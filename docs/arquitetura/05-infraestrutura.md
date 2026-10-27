# Arquitetura, parte 5: infraestrutura

## Desenvolvimento

- `pnpm dev` roda `@app/shared` em modo watch, a API em `:3000` e o Vite em `:5173`.
- O Vite faz proxy de `/api` e `/socket.io` para a API. Abra `http://localhost:5173`.
- ICE usa só o STUN público padrão (`STUN_URLS`). Sem TURN. Dois navegadores na mesma máquina ou na mesma rede conectam por candidatos locais.
- `localhost` é contexto seguro, então `getDisplayMedia` funciona sem HTTPS. Para testar de outro aparelho da rede é preciso HTTPS (fora do escopo das fases de código; veja o guia de operação).

## Produção: uma VM, três contêineres

```
Internet
   |
   |  80/tcp, 443/tcp, 443/udp
   v
+------------------------------ VM (Docker Compose) ------------------------------+
|                                                                                 |
|  web  (Caddy)  ---- /api/*, /socket.io/* ---->  api (NestJS, :3000, só interno) |
|   |  serve /srv (build do React)                                                |
|   |  HTTPS automático para $DOMAIN                                              |
|                                                                                 |
|  coturn  (network_mode: host)                                                   |
|   3478/udp+tcp   49152-49252/udp                                                |
+---------------------------------------------------------------------------------+
```

- `web` é a imagem do Caddy com os arquivos estáticos do front dentro. É o único serviço que publica as portas 80 e 443.
- `api` só é alcançável pela rede interna do Compose (`expose: 3000`).
- `coturn` usa a rede do host porque precisa de uma faixa grande de portas UDP e de conhecer o IP público.

## Arquivos que a Fase 3 cria

| Arquivo | Conteúdo |
| --- | --- |
| `apps/api/Dockerfile` | Build em múltiplos estágios, imagem final só com dependências de produção e `dist`, usuário não root, `HEALTHCHECK` em `/api/health` |
| `apps/web/Dockerfile` | Estágio 1: build do `@app/web`. Estágio 2: `caddy` (versão exata fixada no Dockerfile) com os arquivos em `/srv` e o `Caddyfile` |
| `deploy/Caddyfile` | Configuração do Caddy (abaixo) |
| `docker-compose.prod.yml` | Os três serviços (esboço abaixo) |
| `.env.example` | Variáveis de produção, só com placeholders |
| `.dockerignore` | `node_modules`, `.git`, `dist`, `.env`, `e2e`, `docs` |

Os Dockerfiles usam a mesma major do Node de `.nvmrc`. O contexto de build é a raiz do repositório, porque a API e o front dependem de `packages/shared`. O comportamento de `pnpm deploy` para empacotar um pacote do workspace em produção muda entre majors; confirme na prática antes de assumir.

## Caddyfile

```
{$DOMAIN} {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000"
		Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' wss://{$DOMAIN}; media-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy strict-origin-when-cross-origin
		Permissions-Policy "display-capture=(self), camera=(), microphone=(), geolocation=()"
		Cross-Origin-Opener-Policy same-origin
		-Server
	}

	handle /api/* {
		reverse_proxy api:3000
	}

	handle /socket.io/* {
		reverse_proxy api:3000
	}

	handle {
		root * /srv

		@hashed path /assets/*
		header @hashed Cache-Control "public, max-age=31536000, immutable"

		@unhashed not path /assets/*
		header @unhashed Cache-Control "no-cache"

		try_files {path} /index.html
		file_server
	}
}

# The www address only sends people to the main one, keeping the path and query.
www.{$DOMAIN} {
	redir https://{$DOMAIN}{uri} permanent
}
```

`Content-Security-Policy` só permite recursos da própria origem (as fontes embutidas no CSS como `data:` e o WebSocket em `wss://$DOMAIN`), o que limita o estrago de um XSS, que é o único jeito de roubar o `hostToken` do `localStorage`. `Strict-Transport-Security` faz o navegador nunca mais abrir o site por HTTP; não usa `includeSubDomains` porque os outros subdomínios do domínio podem não ter HTTPS. `index.html` vai sem cache e `/assets/*` (nomes com hash) com cache longo, para cada deploy chegar a quem abrir a página.

O Caddy obtém e renova o certificado sozinho, desde que `DOMAIN` aponte para a VM e as portas 80 e 443 estejam abertas. O endereço `www.$DOMAIN` também ganha certificado e responde com redirecionamento permanente (301) para `https://$DOMAIN`, mantendo o caminho e os parâmetros; para isso, o `www` precisa de um registro DNS apontando para a mesma VM. Sem ele, só o `www` fica sem certificado, e o endereço principal segue funcionando. O proxy cuida do upgrade para WebSocket sem configuração extra. Para um teste local, `DOMAIN=localhost` faz o Caddy usar um certificado de uma autoridade interna dele.

## `docker-compose.prod.yml` (esboço original; o arquivo do repositório é a versão atual)

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: "3000"
      TRUST_PROXY: "1"
      ALLOWED_ORIGINS: https://${DOMAIN}
      STUN_URLS: stun:${DOMAIN}:3478
      TURN_URLS: turn:${DOMAIN}:3478?transport=udp,turn:${DOMAIN}:3478?transport=tcp
      TURN_SECRET: ${TURN_SECRET}
      MAX_VIEWERS_PER_ROOM: ${MAX_VIEWERS_PER_ROOM:-10}
    expose:
      - "3000"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    restart: unless-stopped
    environment:
      DOMAIN: ${DOMAIN}
    depends_on:
      - api
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  coturn:
    image: coturn/coturn
    restart: unless-stopped
    network_mode: host
    command:
      - -n
      - --log-file=stdout
      - --no-cli
      - --fingerprint
      - --lt-cred-mech
      - --use-auth-secret
      - --static-auth-secret=${TURN_SECRET}
      - --realm=${DOMAIN}
      - --listening-port=3478
      - --min-port=49152
      - --max-port=49252
      - --external-ip=${PUBLIC_IP}/${PRIVATE_IP}
      - --no-tls
      - --no-dtls
      - --no-multicast-peers
      - --user-quota=12
      - --total-quota=100
      - --denied-peer-ip=0.0.0.0-0.255.255.255
      - --denied-peer-ip=10.0.0.0-10.255.255.255
      - --denied-peer-ip=100.64.0.0-100.127.255.255
      - --denied-peer-ip=127.0.0.0-127.255.255.255
      - --denied-peer-ip=169.254.0.0-169.254.255.255
      - --denied-peer-ip=172.16.0.0-172.31.255.255
      - --denied-peer-ip=192.0.0.0-192.0.0.255
      - --denied-peer-ip=192.168.0.0-192.168.255.255
      - --denied-peer-ip=198.18.0.0-198.19.255.255
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

volumes:
  caddy_data:
  caddy_config:
```

Notas:

- É um esboço de referência. Valide a sintaxe com `docker compose -f docker-compose.prod.yml config` e confira os flags do coturn contra a ajuda da imagem (`docker run --rm coturn/coturn --help`). Se algum flag não existir na versão da imagem, ajuste e registre.
- `--denied-peer-ip` impede que o TURN seja usado para alcançar redes privadas a partir da internet. O arquivo atual também nega as faixas IPv6 equivalentes (`::1`, IPv4 mapeado em IPv6, NAT64, `fc00::/7`, `fe80::/10`): sem isso, `::ffff:10.0.0.1` passaria por fora das faixas IPv4.
- `--no-tcp-relay`: o WebRTC só precisa de relay UDP; o relay TCP faria do coturn um proxy TCP para qualquer endereço público. (TURN **sobre** TCP na 3478, entre o navegador e o coturn, continua funcionando.)
- `--max-bps=375000`: no máximo cerca de 3 Mbps por sessão em cada sentido. Cobre o vídeo de 2 Mbps com folga e limita o uso das credenciais TURN (que todo espectador recebe) como relay genérico, e com isso a conta de banda.
- As imagens `api` e `web` levam a tag `APP_VERSION`, para o rollback não precisar de rebuild.
- Os três serviços rodam com `no-new-privileges` e `cap_drop: ALL`. O `web` recebe só `NET_BIND_SERVICE` para ouvir nas portas 80 e 443. A API roda com sistema de arquivos somente leitura (`read_only`, com `/tmp` em memória).
- Limites de memória (`api` 256 MB, `web` 128 MB, `coturn` 128 MB) e de processos protegem uma VM de 1 GB: um serviço descontrolado é reiniciado em vez de derrubar a máquina.
- O coturn 4.18 já esconde a versão do software por padrão (`--no-software-attribute` está deprecado).
- `--external-ip=PUBLICO/PRIVADO` é necessário quando a VM está atrás de NAT de nuvem (caso típico de EC2 e Lightsail).
- Sem TLS no coturn no MVP: TURN em UDP e TCP na porta 3478. Redes que bloqueiam tudo exceto 443 não são atendidas. TURN sobre TLS fica para depois.

## Variáveis de produção (`.env` na VM)

| Variável | Exemplo de placeholder | Observação |
| --- | --- | --- |
| `DOMAIN` | `SEU_DOMINIO` | Nome DNS que aponta para a VM, sem `https://` |
| `TURN_SECRET` | `GERE_COM_openssl_rand_hex_32` | Segredo longo e aleatório. Mesmo valor na API e no coturn |
| `PUBLIC_IP` | `IP_PUBLICO_DA_VM` | IP público (Elastic IP, no caso de EC2) |
| `PRIVATE_IP` | `IP_PRIVADO_DA_VM` | IP privado da interface da VM |
| `MAX_VIEWERS_PER_ROOM` | `10` | Opcional |
| `APP_VERSION` | `0.2.0` | Versão publicada (tag sem o `v`); vira a tag das imagens |

## Portas e firewall

Liberar no firewall da nuvem (security group). O firewall do sistema operacional não protege portas publicadas pelo Docker, então a regra que vale é a da nuvem.

| Porta | Protocolo | Origem | Para quê |
| --- | --- | --- | --- |
| 22 | TCP | só o seu IP | SSH |
| 80 | TCP | qualquer | Validação do certificado e redirecionamento para HTTPS |
| 443 | TCP | qualquer | Site e WebSocket |
| 443 | UDP | qualquer | HTTP/3 (opcional) |
| 3478 | UDP e TCP | qualquer | STUN e TURN |
| 49152–49252 | UDP | qualquer | Relay do TURN |

## Operação básica

- Subir ou atualizar: `docker compose -f docker-compose.prod.yml up -d --build`.
- Ver logs: `docker compose -f docker-compose.prod.yml logs -f --tail=100 api`.
- Encerrar todas as salas de emergência: `docker compose -f docker-compose.prod.yml restart api`.
- Procedimento completo (conta na nuvem, VM, domínio, DNS, testes entre redes) está no guia **por fora** do repositório.

<div align="center">

# 📺 Transmitir tela

**Transmita a tela do seu computador por um link. Sem login, sem instalar nada.**

### [🔗 trasmitirtela.com.br](https://trasmitirtela.com.br)

[![Site](https://img.shields.io/badge/site-trasmitirtela.com.br-e63946?style=for-the-badge)](https://trasmitirtela.com.br)
[![CI](https://img.shields.io/github/actions/workflow/status/valeriocoelho1/transmicaodetela/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/valeriocoelho1/transmicaodetela/actions/workflows/ci.yml)
[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue?style=for-the-badge)](LICENSE)

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat-square&logo=socketdotio&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=flat-square&logo=webrtc&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

</div>

---

## ✨ Como funciona

1. **Crie uma sala** no site e compartilhe a tela pelo navegador.
2. **Envie o link** para quem vai assistir.
3. **Pronto:** quem abrir o link assiste na hora, no computador ou no celular.

O vídeo vai por WebRTC, direto entre os navegadores. O servidor só apresenta um navegador ao outro e nunca vê o vídeo.

## 🏗️ Arquitetura

Dois planos separados. O **controle** (criar sala, entrar, trocar `offer`, `answer` e candidatos ICE) passa por uma API NestJS com Socket.IO, que guarda as salas em memória e nunca toca no vídeo. A **mídia** vai direto do navegador do anfitrião para cada espectador, uma `RTCPeerConnection` por espectador; quando o caminho direto falha, o tráfego passa por um servidor TURN (coturn) com credenciais temporárias. Em produção, o Caddy serve o site com HTTPS e encaminha `/api` e `/socket.io` para a API. Detalhes em [`docs/arquitetura/`](docs/arquitetura/).

## 📋 Requisitos

- Node.js LTS (a major está em `.nvmrc`)
- pnpm (versão em `packageManager` no `package.json`)
- Git
- Para os testes e2e: o Chromium do Playwright (instalação abaixo)
- Para produção ou para testar a stack local: Docker e Docker Compose

## 🚀 Instalação e desenvolvimento

```bash
pnpm install
pnpm dev
```

`pnpm dev` constrói `@app/shared` e sobe a API em `http://localhost:3000` e o site em `http://localhost:5173`. O Vite encaminha `/api` e `/socket.io` para a API. Em desenvolvimento nenhuma variável de ambiente é necessária. `localhost` é contexto seguro, então o compartilhamento de tela funciona sem HTTPS.

## 🧰 Scripts

| Script              | O que faz                                                           |
| ------------------- | ------------------------------------------------------------------- |
| `pnpm dev`          | Constrói `@app/shared` e roda shared (watch), API e web em paralelo |
| `pnpm build`        | Constrói todos os pacotes, em ordem topológica                      |
| `pnpm typecheck`    | Verifica tipos em todos os pacotes                                  |
| `pnpm lint`         | ESLint                                                              |
| `pnpm format`       | Formata com Prettier                                                |
| `pnpm format:check` | Confere a formatação                                                |
| `pnpm test`         | Testes unitários e de integração (sem e2e)                          |
| `pnpm test:e2e`     | Testes Playwright em Chromium                                       |

## 🧪 Testes

- **Unitários e integração:** `pnpm test`. Vitest em `@app/shared` e `@app/web`; Jest em `@app/api`, com testes de integração que sobem a API em porta aleatória e usam `socket.io-client` e `supertest`.
- **E2E:** na primeira vez, instale o Chromium do Playwright:

  ```bash
  pnpm --filter @app/e2e exec playwright install chromium
  ```

  Depois rode `pnpm test:e2e`. A suíte sobe a própria API (porta 3100, até 2 espectadores por sala, tolerância do anfitrião de 3 s) e o site (porta 5273) e simula a captura de tela com um `canvas`. Leva cerca de 1 minuto e cria 9 salas, abaixo do limite de 10 criações por minuto por IP.

- **E2E contra uma stack já no ar:** `E2E_BASE_URL=https://SEU_DOMINIO pnpm test:e2e`. Não sobe servidores e aceita certificado não confiável (útil com `DOMAIN=localhost`). O cenário de sala cheia supõe `MAX_VIEWERS_PER_ROOM=2` na stack, e os de tolerância do anfitrião ficam mais lentos com o padrão de 60 s.

## ⚙️ Variáveis de ambiente da API

Todas têm padrão, exceto as marcadas. A configuração é validada na partida; valor inválido impede a API de subir, com mensagem clara.

| Variável                      | Padrão                         | Descrição                                                                               |
| ----------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| `NODE_ENV`                    | `development`                  | `development`, `test` ou `production`                                                   |
| `PORT`                        | `3000`                         | Porta HTTP                                                                              |
| `ALLOWED_ORIGINS`             | `http://localhost:5173`        | Origens permitidas (CORS e Socket.IO), separadas por vírgula. Obrigatória em produção   |
| `TRUST_PROXY`                 | `0`                            | Número de proxies confiáveis à frente da API (1 atrás do Caddy)                         |
| `MAX_VIEWERS_PER_ROOM`        | `10`                           | Espectadores simultâneos por sala                                                       |
| `MAX_ROOMS`                   | `50`                           | Salas simultâneas no servidor                                                           |
| `ROOM_HOST_GRACE_MS`          | `60000`                        | Tempo para o anfitrião voltar antes de a sala ser encerrada                             |
| `ROOM_UNUSED_TTL_MS`          | `900000`                       | Sala em que o anfitrião nunca entrou é apagada após esse tempo                          |
| `ROOM_MAX_AGE_MS`             | `43200000`                     | Vida máxima de uma sala (12 h)                                                          |
| `SWEEP_INTERVAL_MS`           | `30000`                        | Intervalo da varredura de salas expiradas                                               |
| `STUN_URLS`                   | `stun:stun.l.google.com:19302` | Lista separada por vírgula                                                              |
| `TURN_URLS`                   | vazio                          | Lista separada por vírgula. Se definida, `TURN_SECRET` é obrigatório                    |
| `TURN_SECRET`                 | vazio                          | Segredo compartilhado com o coturn. Obrigatório em produção                             |
| `TURN_CREDENTIAL_TTL_SECONDS` | `43200`                        | Validade das credenciais TURN (12 h)                                                    |
| `SOCKET_RATE_LIMIT_EVENTS`    | `300`                          | Eventos permitidos por socket na janela                                                 |
| `SOCKET_RATE_LIMIT_WINDOW_MS` | `10000`                        | Janela do limite acima                                                                  |
| `MAX_SOCKETS_PER_IP`          | `20`                           | Sockets simultâneos por endereço do cliente (atrás do proxy, lido do `X-Forwarded-For`) |

Em produção, o `docker-compose.prod.yml` monta essas variáveis a partir do `.env` (veja `.env.example`): `DOMAIN`, `TURN_SECRET`, `PUBLIC_IP`, `PRIVATE_IP`, `APP_VERSION` e, opcionalmente, `MAX_VIEWERS_PER_ROOM`.

## ⚠️ Limites

- **Até 10 espectadores por sala.** O anfitrião envia uma cópia do vídeo para cada espectador (cerca de 2 Mbps cada, uns 20 Mbps com a sala cheia), então o upload dele limita a sala.
- **Sem senha:** quem tem o link entra. Não divulgue o link publicamente.
- **Sem moderação** nem denúncia.
- **Salas em memória:** reiniciar a API encerra todas as salas.
- **Anfitrião e espectadores podem ver o IP uns dos outros**, porque a conexão é direta.
- Compartilhar a tela exige navegador de computador; o espectador pode estar no celular.
- TURN só em UDP e TCP na porta 3478: redes que bloqueiam tudo exceto a 443 não são atendidas.

## 🌐 Produção

O que é preciso: uma VM Linux com Docker e Docker Compose, um domínio apontando para o IP da VM (o domínio e o `www`, que redireciona para o domínio) e, no firewall da nuvem, as portas 80/tcp, 443/tcp, 443/udp, 3478/udp e tcp e 49152–49252/udp abertas (tabela completa em [`docs/arquitetura/05-infraestrutura.md`](docs/arquitetura/05-infraestrutura.md)).

Na VM, na raiz do repositório:

```bash
cp .env.example .env
```

Edite `.env` e troque todos os placeholders (`SEU_DOMINIO`, `GERE_COM_openssl_rand_hex_32`, `IP_PUBLICO_DA_VM`, `IP_PRIVADO_DA_VM`). Gere o segredo com `openssl rand -hex 32`. Depois:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Ver logs:

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=100 api
```

Encerrar todas as salas de emergência:

```bash
docker compose -f docker-compose.prod.yml restart api
```

### Deploy automático

Cada push na `main` roda o [workflow de CI](.github/workflows/ci.yml) (typecheck, lint, formatação, testes e build). Se tudo passar, a branch `production` aponta para aquele commit, e um timer systemd na VM publica a versão nova em até 2 minutos, sem nenhum segredo guardado no GitHub. Detalhes e instalação em [`docs/arquitetura/05-infraestrutura.md`](docs/arquitetura/05-infraestrutura.md#deploy-automático).

### Publicar uma versão manualmente

Cada versão é uma tag `vX.Y.Z` na `main` (SemVer), descrita no [`CHANGELOG.md`](CHANGELOG.md). Na VM:

```bash
git fetch --tags && git checkout vX.Y.Z
```

Troque `APP_VERSION` no `.env` para `X.Y.Z` e rode:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- Reiniciar a `api` encerra todas as salas (o estado é em memória). Publique em horário vazio.
- Se só o front mudou, `docker compose -f docker-compose.prod.yml up -d --build web` troca só o Caddy: os sockets caem por um instante, reconectam e as salas continuam (tolerância de 60 s do anfitrião).
- `index.html` vai com `Cache-Control: no-cache` e `/assets/*` com `immutable`, então quem abrir a página depois do deploy recebe a versão nova. Mantenha os eventos de `@app/shared` compatíveis entre versões vizinhas: uma aba aberta antes do deploy continua com o front antigo até recarregar.

Voltar para a versão anterior (as imagens ficam guardadas com a tag da versão, não precisa reconstruir):

```bash
git checkout vX.Y.W
```

Troque `APP_VERSION` para `X.Y.W` e rode `docker compose -f docker-compose.prod.yml up -d`, sem `--build`.

Manutenção mensal: `pnpm audit`, `pnpm outdated`, reconstruir as imagens (`up -d --build`) para receber correções do Node, do Caddy e do Alpine, e conferir se há versão nova do coturn. Guarde uma cópia do `.env` num lugar seguro: é o único estado que não se recria (os certificados ficam no volume `caddy_data` e o Caddy os emite de novo se sumirem).

O Caddy emite e renova o certificado HTTPS sozinho. O coturn roda com `network_mode: host`. O passo a passo da VM (conta na nuvem, domínio, DNS, firewall, validação do TURN, teste entre redes) está no guia de operação, fora do repositório.

## 🗂️ Estrutura

```
apps/api/          API NestJS (@app/api)
apps/web/          site React + Vite (@app/web)
packages/shared/   schemas e tipos compartilhados (@app/shared)
e2e/               testes Playwright (@app/e2e)
deploy/            Caddyfile, script e timer do deploy automático
docs/              stack e arquitetura
```

## 📚 Documentação

Veja [`docs/`](docs/): [`stack.md`](docs/stack.md) e [`arquitetura/`](docs/arquitetura/).

## 📄 Licença

[MIT](LICENSE).

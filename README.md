# Compartilhar tela

Site para transmitir a tela do computador por link. O anfitrião cria uma sala, compartilha a tela pelo navegador e envia o link; quem abrir o link assiste pelo navegador, sem login e sem instalar nada. O vídeo vai por WebRTC, direto entre os navegadores. Este repositório contém o MVP.

## Arquitetura

Dois planos separados. O **controle** (criar sala, entrar, trocar `offer`, `answer` e candidatos ICE) passa por uma API NestJS com Socket.IO, que guarda as salas em memória e nunca toca no vídeo. A **mídia** vai direto do navegador do anfitrião para cada espectador, uma `RTCPeerConnection` por espectador; quando o caminho direto falha, o tráfego passa por um servidor TURN (coturn) com credenciais temporárias. Em produção, o Caddy serve o site com HTTPS e encaminha `/api` e `/socket.io` para a API. Detalhes em [`docs/arquitetura/`](docs/arquitetura/).

## Requisitos

- Node.js LTS (a major está em `.nvmrc`)
- pnpm (versão em `packageManager` no `package.json`)
- Git
- Para os testes e2e: o Chromium do Playwright (instalação abaixo)
- Para produção ou para testar a stack local: Docker e Docker Compose

## Instalação e desenvolvimento

```bash
pnpm install
pnpm dev
```

`pnpm dev` constrói `@app/shared` e sobe a API em `http://localhost:3000` e o site em `http://localhost:5173`. O Vite encaminha `/api` e `/socket.io` para a API. Em desenvolvimento nenhuma variável de ambiente é necessária. `localhost` é contexto seguro, então o compartilhamento de tela funciona sem HTTPS.

## Scripts

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

## Testes

- **Unitários e integração:** `pnpm test`. Vitest em `@app/shared` e `@app/web`; Jest em `@app/api`, com testes de integração que sobem a API em porta aleatória e usam `socket.io-client` e `supertest`.
- **E2E:** na primeira vez, instale o Chromium do Playwright:

  ```bash
  pnpm --filter @app/e2e exec playwright install chromium
  ```

  Depois rode `pnpm test:e2e`. A suíte sobe a própria API (porta 3100, até 2 espectadores por sala, tolerância do anfitrião de 3 s) e o site (porta 5273) e simula a captura de tela com um `canvas`. Leva cerca de 1 minuto e cria 9 salas, abaixo do limite de 10 criações por minuto por IP.

- **E2E contra uma stack já no ar:** `E2E_BASE_URL=https://SEU_DOMINIO pnpm test:e2e`. Não sobe servidores e aceita certificado não confiável (útil com `DOMAIN=localhost`). O cenário de sala cheia supõe `MAX_VIEWERS_PER_ROOM=2` na stack, e os de tolerância do anfitrião ficam mais lentos com o padrão de 60 s.

## Variáveis de ambiente da API

Todas têm padrão, exceto as marcadas. A configuração é validada na partida; valor inválido impede a API de subir, com mensagem clara.

| Variável                      | Padrão                         | Descrição                                                                             |
| ----------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| `NODE_ENV`                    | `development`                  | `development`, `test` ou `production`                                                 |
| `PORT`                        | `3000`                         | Porta HTTP                                                                            |
| `ALLOWED_ORIGINS`             | `http://localhost:5173`        | Origens permitidas (CORS e Socket.IO), separadas por vírgula. Obrigatória em produção |
| `TRUST_PROXY`                 | `0`                            | Número de proxies confiáveis à frente da API (1 atrás do Caddy)                       |
| `MAX_VIEWERS_PER_ROOM`        | `5`                            | Espectadores simultâneos por sala                                                     |
| `MAX_ROOMS`                   | `50`                           | Salas simultâneas no servidor                                                         |
| `ROOM_HOST_GRACE_MS`          | `60000`                        | Tempo para o anfitrião voltar antes de a sala ser encerrada                           |
| `ROOM_UNUSED_TTL_MS`          | `900000`                       | Sala em que o anfitrião nunca entrou é apagada após esse tempo                        |
| `ROOM_MAX_AGE_MS`             | `43200000`                     | Vida máxima de uma sala (12 h)                                                        |
| `SWEEP_INTERVAL_MS`           | `30000`                        | Intervalo da varredura de salas expiradas                                             |
| `STUN_URLS`                   | `stun:stun.l.google.com:19302` | Lista separada por vírgula                                                            |
| `TURN_URLS`                   | vazio                          | Lista separada por vírgula. Se definida, `TURN_SECRET` é obrigatório                  |
| `TURN_SECRET`                 | vazio                          | Segredo compartilhado com o coturn. Obrigatório em produção                           |
| `TURN_CREDENTIAL_TTL_SECONDS` | `43200`                        | Validade das credenciais TURN (12 h)                                                  |
| `SOCKET_RATE_LIMIT_EVENTS`    | `300`                          | Eventos permitidos por socket na janela                                               |
| `SOCKET_RATE_LIMIT_WINDOW_MS` | `10000`                        | Janela do limite acima                                                                |

Em produção, o `docker-compose.prod.yml` monta essas variáveis a partir do `.env` (veja `.env.example`): `DOMAIN`, `TURN_SECRET`, `PUBLIC_IP`, `PRIVATE_IP` e, opcionalmente, `MAX_VIEWERS_PER_ROOM`.

## Limites do MVP

- **Até 5 espectadores por sala.** O anfitrião envia uma cópia do vídeo para cada espectador (cerca de 2 Mbps cada), então o upload dele limita a sala.
- **Sem senha:** quem tem o link entra. Não divulgue o link publicamente.
- **Sem moderação** nem denúncia.
- **Salas em memória:** reiniciar a API encerra todas as salas.
- **Anfitrião e espectadores podem ver o IP uns dos outros**, porque a conexão é direta.
- Compartilhar a tela exige navegador de computador; o espectador pode estar no celular.
- TURN só em UDP e TCP na porta 3478: redes que bloqueiam tudo exceto a 443 não são atendidas.

## Produção

O que é preciso: uma VM Linux com Docker e Docker Compose, um domínio apontando para o IP da VM e, no firewall da nuvem, as portas 80/tcp, 443/tcp, 443/udp, 3478/udp e tcp e 49152–49252/udp abertas (tabela completa em [`docs/arquitetura/05-infraestrutura.md`](docs/arquitetura/05-infraestrutura.md)).

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

O Caddy emite e renova o certificado HTTPS sozinho. O coturn roda com `network_mode: host`. O passo a passo da VM (conta na nuvem, domínio, DNS, firewall, validação do TURN, teste entre redes) está no guia de operação, fora do repositório.

## Fora do MVP

Senha de sala, chat, contas e login, banco de dados, Redis, SFU (LiveKit, mediasoup, Janus), gravação, aplicativo desktop, anfitrião no celular, mais de um anfitrião por sala, painel de métricas ou saúde da live, perfis de qualidade escolhidos pelo usuário, traduções além de pt-BR, analytics, TURN sobre TLS na porta 443, CI/CD.

## Estrutura

```
apps/api/          API NestJS (@app/api)
apps/web/          site React + Vite (@app/web)
packages/shared/   schemas e tipos compartilhados (@app/shared)
e2e/               testes Playwright (@app/e2e)
deploy/            Caddyfile
docs/              especificação, arquitetura, fases e progresso
```

## Documentação

Veja [`docs/`](docs/): [`PROMPT-MESTRE.md`](docs/PROMPT-MESTRE.md), [`stack.md`](docs/stack.md), [`arquitetura/`](docs/arquitetura/), [`fases/`](docs/fases/) e [`PROGRESSO.md`](docs/PROGRESSO.md).

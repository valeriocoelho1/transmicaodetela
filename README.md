# Compartilhar tela

Site para transmitir a tela do computador por link. O anfitrião cria uma sala, compartilha a tela pelo navegador e envia o link; quem abrir o link assiste pelo navegador, sem login. O vídeo vai por WebRTC, direto entre os navegadores. Este repositório contém o MVP.

## Requisitos

- Node.js LTS (a major está em `.nvmrc`)
- pnpm (versão em `packageManager` no `package.json`)
- Git

## Começar

```bash
pnpm install
pnpm dev
```

`pnpm dev` sobe a API em `http://localhost:3000` e o site em `http://localhost:5173`. O Vite encaminha `/api` e `/socket.io` para a API.

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
| `pnpm test:e2e`     | Testes Playwright em Chromium (API na 3100, web na 5273)            |

## Testes e2e

Na primeira vez, instale o Chromium do Playwright:

```bash
pnpm --filter @app/e2e exec playwright install chromium
```

Depois rode `pnpm test:e2e`. A suíte sobe a própria API (porta 3100, até 2 espectadores por sala) e o site (porta 5273) e simula a captura de tela com um `canvas`.

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

O Caddy emite o certificado HTTPS sozinho. O coturn roda com `network_mode: host`. O passo a passo da VM (conta na nuvem, domínio, DNS, firewall, validação do TURN) está no guia de operação, fora do repositório.

Para rodar o e2e contra uma stack já no ar: `E2E_BASE_URL=https://SEU_DOMINIO pnpm test:e2e` (aceita certificado não confiável, útil com `DOMAIN=localhost`; o cenário de sala cheia supõe `MAX_VIEWERS_PER_ROOM=2` na stack).

## Estrutura

```
apps/api/          API NestJS (@app/api)
apps/web/          site React + Vite (@app/web)
packages/shared/   schemas e tipos compartilhados (@app/shared)
e2e/               testes Playwright (@app/e2e)
deploy/            Caddyfile
docs/              especificação, arquitetura e fases
```

## Documentação

Veja [`docs/`](docs/): [`PROMPT-MESTRE.md`](docs/PROMPT-MESTRE.md), [`stack.md`](docs/stack.md), [`arquitetura/`](docs/arquitetura/), [`fases/`](docs/fases/) e [`PROGRESSO.md`](docs/PROGRESSO.md).

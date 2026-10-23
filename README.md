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

## Estrutura

```
apps/api/          API NestJS (@app/api)
apps/web/          site React + Vite (@app/web)
packages/shared/   schemas e tipos compartilhados (@app/shared)
e2e/               testes Playwright (@app/e2e)
docs/              especificação, arquitetura e fases
```

## Documentação

Veja [`docs/`](docs/): [`PROMPT-MESTRE.md`](docs/PROMPT-MESTRE.md), [`stack.md`](docs/stack.md), [`arquitetura/`](docs/arquitetura/), [`fases/`](docs/fases/) e [`PROGRESSO.md`](docs/PROGRESSO.md).

# Stack

Tudo em TypeScript. Um único repositório (monorepo pnpm). Esta é a lista fechada de tecnologias do MVP. O que não está aqui não entra sem aprovação.

## Visão por camada

| Camada | Escolha | Papel |
| --- | --- | --- |
| Runtime | Node.js LTS vigente (arquivo `.nvmrc`) | API, build e testes |
| Gerenciador | pnpm (workspaces) | Monorepo |
| Linguagem | TypeScript, `strict: true` | Todo o código |
| Contrato compartilhado | zod + tsup | Schemas e tipos dos eventos, saída ESM + CJS + `.d.ts` |
| API | NestJS (Express) | REST de sala e gateway de sinalização |
| Tempo real | Socket.IO | Sinalização entre navegadores e API |
| Front-end | React + Vite + React Router | Telas inicial, anfitrião e espectador |
| Mídia | APIs nativas do navegador | `getDisplayMedia`, `RTCPeerConnection`, `RTCRtpSender` |
| STUN/TURN | coturn (imagem oficial `coturn/coturn`) | Descoberta de caminho e relay quando o P2P falha |
| Proxy e HTTPS | Caddy 2 | Certificado automático, arquivos estáticos, proxy da API e do WebSocket |
| Empacotamento | Docker + Docker Compose | Produção em uma VM |
| Testes | Jest (API), Vitest (shared e web), Playwright (e2e) | Unitário, integração e ponta a ponta |
| Qualidade | ESLint (flat config) + typescript-eslint + Prettier | Lint e formatação |
| CI e deploy | GitHub Actions + timer systemd na VM | Verificações a cada push; deploy da branch `production` |

## Por que cada escolha

- **P2P agora, SFU depois.** O MVP usa uma conexão WebRTC por espectador, partindo do anfitrião. É a forma mais simples de entender e de colocar no ar. O custo é o upload do anfitrião, que cresce com cada espectador. Por isso o MVP limita a sala (padrão 10 espectadores).
- **Socket.IO** dá reconexão automática, confirmações (`ack`) e tipos de eventos prontos. Evita escrever um protocolo sobre WebSocket puro.
- **NestJS** organiza REST e gateway no mesmo processo, com injeção de dependência e testes de integração fáceis.
- **zod em `@app/shared`** é a única fonte de verdade dos payloads. API e front validam e tipam pelo mesmo schema.
- **tsup** gera ESM para o Vite e CJS para o NestJS a partir do mesmo código.
- **Caddy** emite e renova o certificado sozinho. HTTPS é obrigatório: `getDisplayMedia` só funciona em contexto seguro (`localhost` conta como seguro).
- **coturn** com credenciais temporárias (HMAC) dá STUN e TURN sem guardar usuário em banco.
- **Sem banco e sem Redis.** Salas são efêmeras. Um processo de API só.

## Dependências permitidas por pacote

Equivalentes só com justificativa. Confirme que cada pacote existe antes de instalar.

**Raiz (dev):** `typescript`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `prettier`.

**`@app/shared`:** `zod`. Dev: `tsup`, `typescript`, `vitest`.

**`@app/api`:** `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@nestjs/throttler`, `socket.io`, `helmet`, `reflect-metadata`, `rxjs`, `@app/shared`. Dev: `@nestjs/cli`, `@nestjs/schematics`, `@nestjs/testing`, `jest`, `ts-jest`, `@types/jest`, `@types/express`, `@types/node`, `supertest`, `@types/supertest`, `socket.io-client`.

**`@app/web`:** `react`, `react-dom`, `react-router-dom` (ou `react-router`, conforme a versão atual), `socket.io-client`, `@app/shared`. Dev: `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@types/react`, `@types/react-dom`.

**`@app/e2e`:** `@playwright/test`.

Para IDs e tokens use `node:crypto`. Não use `nanoid`: as versões recentes são só ESM e complicam o NestJS em CJS.

## Fora da stack do MVP

Banco de dados e ORM, Redis, Tailwind ou biblioteca de componentes, gerenciador de estado global, Next.js, SFU (LiveKit, mediasoup, Janus), bibliotecas de WebRTC de terceiros (como simple-peer), Kubernetes, serverless.

## Versões e ambiente

- Node: use o LTS ativo e fixe a major em `.nvmrc` e nos Dockerfiles. Confira a versão vigente em nodejs.org antes de fixar.
- pnpm: instale pelo método oficial (pnpm.io/installation) e registre a versão em `packageManager` no `package.json` raiz.
- Navegadores alvo: Chrome, Edge, Firefox e Safari de computador, atualizados. Espectador também funciona em navegador de celular. Compartilhar tela pelo celular está fora do MVP.

## Portas

| Serviço | Porta | Onde |
| --- | --- | --- |
| Web (Vite) | 5173 | desenvolvimento |
| API | 3000 | desenvolvimento e dentro do Docker |
| Caddy | 80, 443 (TCP) e 443 (UDP, HTTP/3) | produção |
| coturn | 3478 (UDP e TCP) | produção |
| coturn (relay) | 49152–49252 (UDP) | produção |

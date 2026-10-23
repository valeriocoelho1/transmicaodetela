# Progresso

O Claude Code atualiza este arquivo ao fim de cada fase. Não apague o histórico.

## Status das fases

| Fase | Título | Status | Commit final |
| --- | --- | --- | --- |
| 0 | Fundação | concluída com ressalvas (ver Decisões 3–4 e "O que não foi possível verificar") | `30cdcb5` |
| 1 | API de salas e sinalização | concluída | `8ea08bf` |
| 2 | Transmissão no navegador | pendente | |
| 3 | Internet: TURN e deploy | pendente | |
| 4 | Endurecimento e entrega | pendente | |

Status possíveis: `pendente`, `em andamento`, `concluída`, `concluída com ressalvas` (explique abaixo).

## Verificações executadas

Para cada fase, liste o comando e o resultado real (passou, falhou, não executado e por quê).

### Fase 0 (2026-10-23, Node 26.0.0, pnpm 12.15.0, macOS)

| Comando | Resultado |
| --- | --- |
| `node -v` / `pnpm -v` / `git --version` | v26.0.0 / 12.15.0 (instalado nesta fase com `npm install -g pnpm`) / 2.50.1 |
| `pnpm install` | passou |
| `pnpm build` (sem `dist` prévio) | passou; ordem shared → api → web; `packages/shared/dist` tem `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts` |
| `pnpm typecheck && pnpm lint && pnpm format:check` | passou (exit 0) |
| `pnpm test` | passou: shared 4 testes (Vitest), api 2 testes (Jest + supertest), web 3 testes (Vitest + jsdom) |
| `pnpm test:e2e` | passou (placeholder: imprime que o e2e chega na Fase 2) |
| Clone limpo (`git clone` + `pnpm install` + `pnpm typecheck` + `pnpm test`) | passou, sem `dist` prévio |
| `pnpm dev` (sem `dist` nem cache do Vite) | API em 3000 e web em 5173 em ~5 s |
| `curl -s http://localhost:3000/api/health` | `{"status":"ok"}` (200) |
| `curl -s http://localhost:5173/api/health` | `{"status":"ok"}` (200), pelo proxy do Vite |
| `curl http://localhost:5173/socket.io/?EIO=4&transport=polling` | 404 `Cannot GET /socket.io/` vindo do Express da API: o proxy encaminha (ainda não existe servidor Socket.IO) |
| Navegador embutido em `http://localhost:5173` | mostra "Compartilhar tela" e "API: ok"; requisição `GET /api/health` feita a 5173 |
| Mesmo teste com a API parada | mostra "API: indisponível" (proxy devolve 502) |
| `node dist/main.js` (API compilada) | `/api/health` responde `{"status":"ok"}`; `dist/health.controller.js` faz `require("@app/shared")`, resolvido para `dist/index.cjs` |

### Fase 1 (2026-10-23, Node 26.0.0, pnpm 12.15.0, macOS)

| Comando | Resultado |
| --- | --- |
| `pnpm build && pnpm typecheck && pnpm lint && pnpm format:check` | passou (exit 0), no repositório e num clone limpo |
| `pnpm test` | passou: shared 13 testes, web 3, api 49 (26 unitários de config, `RoomsService` e `IceService`; 23 de integração) |
| `pnpm --filter @app/api test` repetido 3 vezes + uma com `--detectOpenHandles` | 49/49 nas quatro; nenhum handle aberto |
| Os 17 cenários da tarefa 9 | existem e passam em `apps/api/test/rooms-rest.spec.ts` (1, 2) e `apps/api/test/signaling.spec.ts` (3 a 17). Extras: 503 `SERVER_BUSY`, CORS, cabeçalho do helmet, mensagem acima de 64 KB desconecta sem derrubar o servidor |
| Vetor TURN (`test-secret`, `1893456000:abcdef`) | `cLAZH1uPPVeiaiZEbOJx5kd0ySk=`, confere (`ice.service.spec.ts`) |
| `curl -X POST /api/rooms` / `curl /api/rooms/ID` / `curl /api/rooms/xyz` | `{"roomId":"…","hostToken":"…"}` / `{"roomId":"…","live":false,"viewerCount":0,"maxViewers":5}` / 404 `{"error":"ROOM_NOT_FOUND"}` |
| Script curto de `socket.io-client` (fora do repositório) contra a API compilada | `host:join` ok → `viewer:join` ok → `room:status {live:true}` → `signal:offer` chega ao espectador → `signal:answer` chega ao anfitrião com o `viewerId` certo → origem `http://evil.test` recusada → `host:end` gera `room:ended HOST_ENDED` → `GET` devolve 404 |
| Log da API nessa sessão | só `Room 4TCt… created / host joined / viewer joined (viewers: 1) / ended (HOST_ENDED, 0 active)`; 0 ocorrências de token, `roomId` completo, SDP ou candidato. O teste 7 também confere isso com um logger que captura tudo |
| `grep` das chamadas de log em `apps/api/src` | 10 chamadas; nenhuma recebe SDP, candidato, token ou segredo |
| SIGINT na API (`enableShutdownHooks`, varredura com `unref`) | processo encerra em menos de 1 s |

## Decisões

Registre aqui decisões tomadas que não estavam nos documentos (data, decisão, motivo em uma linha).

- 2026-10-23 — `.nvmrc` = `24` e `engines.node` = `>=24`: a LTS ativa no nodejs.org é a 24 ("Krypton"); a 26 ainda é Current. `@types/node` fixado em `^24` pelo mesmo motivo. A máquina local roda Node 26.0.0 e foi nela que tudo foi verificado.
- 2026-10-23 — `typescript` em `~6.0` (6.0.3), não a 7.0.2 (`latest`): typescript-eslint 8.72 exige `<6.1.0` e ts-jest 29.4 exige `<7`.
- 2026-10-23 — `react-router` 8 em vez de `react-router-dom`: a última `react-router-dom` é 7.x; na 8 tudo vem de `react-router` (stack.md permite as duas).
- 2026-10-23 — NestJS 12 é publicado só como ESM. A API continua em CommonJS (como os docs preveem) e carrega o Nest por `require(esm)`, nativo no Node ≥ 20.19/22.12. Consequência: o Jest roda com `node --experimental-vm-modules` (script `test` da API), único modo em que o Jest 30 aceita `require(esm)`. Alternativa descartada: converter a API para ESM (exigiria extensões `.js` nos imports e Jest em modo ESM).
- 2026-10-23 — `tsconfig` com `module`/`moduleResolution` `NodeNext` na API e `Bundler` no shared e no web: `node10` está obsoleto no TypeScript 6. Cada pacote declara `types` explicitamente (no TS 6 o padrão é `[]`).
- 2026-10-23 — `@app/shared` usa `exports` com `types` aninhado em `import` (`index.d.ts`) e `require` (`index.d.cts`), para a API em CJS receber os tipos CJS.
- 2026-10-23 — `GET /api/health` monta a resposta com `healthResponse.parse(...)` (valor, não só tipo), para provar em tempo de execução que a API consome o build CJS do shared.
- 2026-10-23 — API sem scaffold do Nest CLI: escrita à mão (módulo, controller de health, `configure-app.ts` com o prefixo `/api`, compartilhado entre `main.ts` e o teste). `@nestjs/schematics` não foi instalado (só serve para gerar código).
- 2026-10-23 — Scripts de build do pnpm (`allowBuilds` em `pnpm-workspace.yaml`): `esbuild` permitido (usado pelo tsup); `@parcel/watcher` e `unrs-resolver` negados (têm binários pré-compilados; tudo passou sem eles).
- 2026-10-23 — `docs/` fica fora do Prettier (`.prettierignore`): ele reescreveria as cercas de quatro crases dos prompts e realinharia todas as tabelas da especificação.
- 2026-10-23 — A página inicial não mostra texto enquanto `/api/health` não responde; depois mostra "API: ok" ou "API: indisponível" (região `aria-live`).
- 2026-10-23 (Fase 1) — `zod` adicionado como dependência direta da API (a configuração é validada com zod; mesmo pacote do shared, já no stack).
- 2026-10-23 (Fase 1) — `allowRequest` aceita conexões **sem** cabeçalho `Origin` e recusa as que trazem uma origem fora de `ALLOWED_ORIGINS`. Motivo: navegadores sempre enviam `Origin` em requisições de outra origem (que é o caso do sequestro de WebSocket), mas podem omiti-lo no polling HTTP da mesma origem, que é o cenário de produção atrás do Caddy. Clientes sem navegador não são vetor desse ataque.
- 2026-10-23 (Fase 1) — Na varredura, se a sala expira com o anfitrião conectado (idade máxima), o anfitrião também recebe `room:ended` e é desconectado, além dos espectadores. Sem isso ele ficaria numa sala que não existe mais.
- 2026-10-23 (Fase 1) — Se um socket que já tem papel faz outro `join`, o papel anterior é desfeito primeiro (como numa desconexão).
- 2026-10-23 (Fase 1) — O anfitrião só é reconhecido se `socket.data.role === 'host'` **e** ele ainda é o `hostSocketId` da sala; o espectador, se ainda está no mapa de espectadores. Socket substituído ou removido perde o papel na hora.
- 2026-10-23 (Fase 1) — Envio para espectadores é feito socket a socket, nunca com `server.to([])`: no Socket.IO uma lista vazia de destinos vira broadcast para todos.
- 2026-10-23 (Fase 1) — Schemas zod descartam campos não declarados. Um espectador que manda `viewerId` no `signal:ice` tem o campo ignorado e o servidor usa o id dele (coberto no teste 8).
- 2026-10-23 (Fase 1) — Resposta 429 do throttler é a padrão do `@nestjs/throttler` (`{ statusCode: 429, message: … }`); o front deve olhar só o status. Foi acrescentado o schema `apiErrorResponse` (`ROOM_NOT_FOUND` | `SERVER_BUSY`) em `@app/shared` para as respostas de erro de sala.
- 2026-10-23 (Fase 1) — `viewerId` validado com `z.uuid()` (forma do zod 4; `z.string().uuid()` está obsoleta). `IceServer.urls` é sempre lista.
- 2026-10-23 (Fase 1) — Nos testes de integração cada cenário sobe o próprio app (porta aleatória, config própria), o que isola o contador do throttler e os limites.

## Placeholders pendentes

Valores que ficaram como placeholder e precisam ser preenchidos por uma pessoa (por exemplo `SEU_DOMINIO`).

- Fase 0: nenhum placeholder criado.
- Fase 1: nenhum placeholder criado.

## O que não foi possível verificar

Itens que o Claude Code não conseguiu executar (por exemplo, Docker ausente, teste em rede móvel) e o motivo.

- Fase 0: nada foi executado em Node 24 (a LTS fixada no `.nvmrc`), porque a máquina só tem Node 26.0.0 e nenhum gerenciador de versões. O `require(esm)` usado pela API existe no Node 24, mas não foi testado nele.
- Fase 0: o proxy WebSocket (`/socket.io`, `ws: true`) só foi conferido com uma requisição HTTP de polling; o upgrade para WebSocket depende do servidor Socket.IO da Fase 1.
- Fase 1: TURN real não foi exercitado (só a geração de credenciais, conferida pelo vetor fixo); isso é da Fase 3.
- Fase 1: o `ThrottlerGuard` com `TRUST_PROXY=1` atrás de um proxy real (IP vindo de `X-Forwarded-For`) não foi testado; os testes rodam com `TRUST_PROXY=0`.
- Fase 1: conferência manual da troca de eventos: a primeira tentativa atingiu, sem eu saber, um `pnpm dev` aberto fora desta sessão (porta 3000) e o meu `kill -INT` encerrou a API dele; o shared (watch) e o Vite (5173) desse `pnpm dev` ficaram rodando. A conferência foi refeita numa instância própria na porta 3100 (resultado acima).
- Observação: se o processo da API cai, o `pnpm dev` (`pnpm -r --parallel`) encerra os outros processos também. Depois de derrubar o Vite à força, a aba já aberta pode dar erro 504 "Outdated Optimize Dep" até reiniciar o Vite; num `pnpm dev` limpo isso não acontece.

## Pendências humanas (fora do código)

Consulte o guia de hospedagem, domínio e operação. Marque aqui o que já foi feito.

- [ ] Conta na nuvem criada e alerta de custo configurado
- [ ] Domínio registrado
- [ ] VM criada com IP fixo e portas liberadas
- [ ] DNS apontando para a VM
- [ ] Docker instalado na VM e `.env` de produção criado
- [ ] Primeiro deploy feito
- [ ] TURN validado com a página de teste de ICE
- [ ] Teste real: anfitrião em uma rede, espectador no 4G

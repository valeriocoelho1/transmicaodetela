# Progresso

O Claude Code atualiza este arquivo ao fim de cada fase. Não apague o histórico.

## Status das fases

| Fase | Título | Status | Commit final |
| --- | --- | --- | --- |
| 0 | Fundação | concluída com ressalvas (ver Decisões 3–4 e "O que não foi possível verificar") | `30cdcb5` |
| 1 | API de salas e sinalização | concluída | `8ea08bf` |
| 2 | Transmissão no navegador | concluída com ressalvas (teste manual com tela real pendente, ver abaixo) | `7b2c8ce` |
| 3 | Internet: TURN e deploy | concluída (validação local com Docker feita em 2026-10-23; TURN em rede real é pendência humana) | `bc72f24` |
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

### Fase 2 (2026-10-23, Node 26.0.0, pnpm 12.15.0, Chromium headless shell 156 do Playwright 1.64.1, macOS)

| Comando | Resultado |
| --- | --- |
| `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | exit 0 |
| `pnpm test` | passou: shared 13, web 24 (fila de ICE, erros de captura, `host-token`, pluralização, `api.ts`, fumaça da Home), api 49. Não roda o e2e |
| `pnpm --filter @app/e2e exec playwright install chromium` | Chromium baixado |
| `pnpm test:e2e` | 6/6 passaram (cenários 1 a 6 da tarefa 9), em 4 rodadas normais, uma delas com o cache do Vite apagado |
| `playwright test --repeat-each=3` (fora do pedido) | 13 passaram, 5 falharam: todas na 3ª repetição, por causa do limite de 10 salas por minuto (a página mostrou "Muitas tentativas. Aguarde um minuto."). Comportamento correto, não é defeito |
| Navegador embutido, 360 px, claro e escuro | Home, anfitrião ao vivo e espectador sem rolagem horizontal (`scrollWidth` = 360); vídeo chegou ao espectador (`videoWidth` 1280, tocando); console sem token, SDP ou candidato; URL sem token (`/host/<roomId>`); token só em `localStorage` (`host-token:<roomId>`) |
| `grep` em `apps/web/src` | 0 `any`, 0 `console.*`, 0 casts; `hostToken` só vai para `localStorage` e para o `host:join` |

**Teste manual que só uma pessoa pode fazer** (o e2e usa captura simulada): com `pnpm dev`, (1) criar sala em `http://localhost:5173`; (2) clicar "Compartilhar tela" e escolher uma **aba do navegador com vídeo e áudio**, marcando a opção de áudio; (3) abrir o link em outra janela; (4) conferir que o vídeo aparece e clicar "Ativar som"; (5) usar o botão do navegador "Parar compartilhamento" e conferir que o espectador volta a "Aguardando o anfitrião iniciar a transmissão." e o anfitrião volta a mostrar "Compartilhar novamente". Repetir em Firefox e Safari se possível.

### Fase 3 (2026-10-23, Node 26.0.0, pnpm 12.15.0, macOS **sem Docker**)

`docker`, Docker Desktop, OrbStack, Colima e Podman não estão instalados (`command not found`). Nenhum comando `docker` da seção "Verificação" pôde ser executado. O que foi validado sem Docker:

| Verificação | Resultado |
| --- | --- |
| Estágios de build dos dois Dockerfiles, simulados numa cópia do repositório filtrada pelo `.dockerignore` (sem `e2e/`, `docs/`, `node_modules`, `dist`) | `pnpm install --frozen-lockfile --filter "@app/api..."` e `"@app/web..."` passaram; builds passaram; `apps/web/dist` gerado |
| `pnpm --filter @app/api deploy --prod <dir>` (mesmo comando do Dockerfile) | `@app/shared` vem **injetado como cópia** (`dist` + `package.json`), não como link; nenhum pacote de desenvolvimento (`jest`, `typescript`, `@nestjs/cli`) na pasta |
| API rodando a partir da pasta do `pnpm deploy` com `NODE_ENV=production` | sem `ALLOWED_ORIGINS`/`TURN_SECRET`: falha na partida com "Invalid configuration" listando as duas; com elas: `/api/health` ok e `POST /api/rooms` 201 |
| `deploy/Caddyfile` | idêntico ao bloco de `05-infraestrutura.md` (`diff` vazio). Sintaxe não validada pelo `caddy` |
| `docker-compose.prod.yml` | YAML válido (parser `js-yaml` já presente no `node_modules`); comparado ao esboço: só `image: coturn/coturn:4.18.0-r0` e a remoção de `--no-dtls`. As 5 variáveis interpoladas existem no `.env.example`. `docker compose config` **não** executado |
| Flags do coturn | conferidos contra `README.turnserver`, `examples/etc/turnserver.conf` e a tabela `long_options` de `src/apps/relay/mainrelay.c` na tag `docker/4.18.0-r0` (a mesma da imagem `latest`, mesmo digest no Docker Hub): todos existem, exceto `--no-dtls` |
| Tags de imagem no Docker Hub | `node:24-alpine`, `caddy:2-alpine` e `coturn/coturn:4.18.0-r0` existem |
| `pnpm test:e2e` (modo padrão) | 6/6 |
| `E2E_BASE_URL=http://localhost:5373 pnpm test:e2e` contra API do `pnpm deploy` em modo produção (`TRUST_PROXY=1`, TURN configurado) + build de produção do front em `vite preview` | 6/6; nenhum servidor local iniciado pelo Playwright; log da API sem segredo, SDP ou candidato |
| `pnpm build`, `typecheck`, `lint`, `format:check`, `test` | exit 0 (shared 13, web 24, api 49) |
| `.env` | ignorado (`git check-ignore`); histórico sem valor de segredo |

### Fase 3, validação com Docker (2026-10-23, Docker Desktop 29.9.2, Compose v5.6.1)

Executada a seção "Verificação" completa com `.env` temporário (`DOMAIN=localhost`, `TURN_SECRET` de teste, `PUBLIC_IP`/`PRIVATE_IP=127.0.0.1`, `MAX_VIEWERS_PER_ROOM=2`), ignorado pelo git e apagado no fim.

| Comando | Resultado |
| --- | --- |
| `docker compose -f docker-compose.prod.yml config` | exit 0 |
| `docker compose ... build` | exit 0; `transmicaodetela-api` 281 MB, `transmicaodetela-web` 89,4 MB |
| `docker compose ... up -d` + `ps` | `api` running **(healthy)** após ~26 s, `web` e `coturn` running, 0 reinícios |
| `curl -k https://localhost/api/health` | `{"status":"ok"}` |
| `curl -k https://localhost/` | `index.html` do front (`<title>Compartilhar tela</title>`) |
| `curl -k ... https://localhost/r/AAAAAAAAAAAA` | 200, mesmo `index.html` (fallback do SPA) |
| Cabeçalhos | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy: display-capture=(self)`, `alt-svc: h3`; `http://localhost/` → 308 para HTTPS |
| `docker compose ... logs coturn` | **primeira subida:** `ERROR no-cli option is deprecated` e `ERROR CONFIG: Unknown argument:` (vazio) — ver Decisões. **Depois da correção:** nenhum `ERROR`, processo `turnserver -n ...`, 80 sockets na porta 3478 (`/proc/net/udp` e `tcp`), 0 reinícios. Avisos restantes esperados: TLS/DTLS desligados (certificado ausente), `--use-auth-secret` sobrepõe `--lt-cred-mech`, sem endereço de escuta explícito, pid file |
| `E2E_BASE_URL=https://localhost pnpm test:e2e` | **6/6** pelo Caddy |
| Upgrade WebSocket pelo Caddy (`/socket.io/?transport=websocket`) | 101 com `Origin: https://localhost`; 400 com `Origin: http://evil.test`; polling de mesma origem sem `Origin`: 200 |
| Limite de criação atrás do Caddy com `TRUST_PROXY=1` | 12 `POST` com `X-Forwarded-For` forjado diferente em cada um: 201×5 e depois 429×7 (o forjado não fura o limite) |
| `docker compose exec api id` | `uid=1000(node) gid=1000(node)` (não root) |
| Log da API | 0 ocorrências do segredo TURN, de SDP e de candidatos |
| `docker compose ... down` e `rm .env` | containers e rede removidos; `.env` apagado; portas 80/443 livres. Os volumes `caddy_data`/`caddy_config` ficaram (o `down` não os remove) |

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
- 2026-10-23 (Fase 2) — A tela inicial deixou de mostrar "API: ok/indisponível" (era só a prova da Fase 0); agora tem exatamente título, descrição, aviso de IP e botão da tabela de textos. `isApiHealthy` foi removido.
- 2026-10-23 (Fase 2) — Textos que a tabela não cobre: "Ao vivo" (rótulo do `StatusPill`, citado nos cenários e2e); "Página não encontrada." na rota `*`, com link "Criar sala"; nome acessível "Link" no campo do link. O anfitrião reutiliza "Conectando à sala…" e "Conexão perdida. Reconectando…"; quando a sala termina, ele vê o texto do motivo (`HOST_ENDED`, `HOST_TIMEOUT`, `EXPIRED`) ou "Esta sala foi aberta em outra aba." **Revise se quiser outros textos.**
- 2026-10-23 (Fase 2) — O espectador continua em "Aguardando…" depois de `room:status { live: true }` até a conexão WebRTC ficar `connected`; só então passa a "assistindo".
- 2026-10-23 (Fase 2) — Botão "Ativar som" só aparece quando há faixa de áudio; "Tela cheia" só quando `document.fullscreenEnabled`.
- 2026-10-23 (Fase 2) — `HostBroadcaster` ganhou `setViewers(ids)`: depois de reconectar, sincroniza a lista do `ack` sem criar peers, e então `rebuildAll()` cria uma oferta por espectador (evita oferta dupla).
- 2026-10-23 (Fase 2) — Socket do anfitrião desconectado pelo servidor (`io server disconnect`) leva a `ended`, porque o cliente não reconecta sozinho nesse caso.
- 2026-10-23 (Fase 2) — Rotas ficam em `App.tsx` (sem `routes.tsx` separado). Arquivos extras pequenos: `lib/format.ts` (pluralização) e `lib/end-reason.ts` (textos de fim e de estado compartilhados entre anfitrião e espectador).
- 2026-10-23 (Fase 2) — `getRoom()` existe em `lib/api.ts` (pedido pela tarefa) e tem teste, mas nenhuma tela o usa: o `ack` do `viewer:join` já informa sala inexistente ou cheia.
- 2026-10-23 (Fase 2) — `vite.config.ts` lê `WEB_PORT`/`API_PORT` com `loadEnv` do Vite, sem `@types/node` no web.
- 2026-10-23 (Fase 2) — O script do pacote e2e chama-se `test:e2e` (não `test`), para o `pnpm test` da raiz não rodar o Playwright. Contextos do Playwright criados com `browser.newContext()` usam URL absoluta (não herdam `baseURL`).
- 2026-10-23 (Fase 3) — **`--no-dtls` removido do coturn.** O flag não existe no coturn 4.18.0 (a imagem atual); um flag desconhecido faz o processo imprimir a ajuda e sair com `exit(-1)`, o que deixaria o contêiner reiniciando em loop. Nessa versão o DTLS só é ativado com `--dtls`, então o efeito pretendido se mantém.
- 2026-10-23 (Fase 3, validação) — **coturn chamado direto (`entrypoint: ['turnserver']`).** O `docker-entrypoint.sh` da imagem faz `eval "echo $i"` em cada argumento; para `-n` isso vira `echo -n`, que imprime vazio. O flag "não usar arquivo de configuração" se perdia e o coturn recebia um argumento vazio (`Unknown argument:`). Também removido `--no-cli`: no 4.18 é obsoleto (gera `ERROR`) e a CLI já vem desligada por padrão (`use_cli = false`). Nenhum `ERROR` depois da correção.
- 2026-10-23 (Fase 3, validação) — No build das imagens o npm 11 avisa que não rodou os scripts de instalação do pacote `pnpm` (`allowScripts`); o pnpm funcionou e o build terminou. Sem ação.
- 2026-10-23 (Fase 3) — Imagem do coturn fixada em `coturn/coturn:4.18.0-r0` (a versão cujos flags foram conferidos; hoje é o mesmo digest de `latest`).
- 2026-10-23 (Fase 3) — Empacotamento da API: `pnpm --filter @app/api deploy --prod /out` no estágio de build (no pnpm 12 o pacote do workspace é injetado como cópia, sem flag extra); a imagem final copia só `package.json`, `node_modules` e `dist`, roda como `node`, com `HEALTHCHECK` via `fetch`.
- 2026-10-23 (Fase 3) — Nas imagens, o pnpm é instalado com `npm install -g pnpm@12.15.0` (a versão de `packageManager`), não com corepack.
- 2026-10-23 (Fase 3) — O Playwright lê `E2E_BASE_URL` de `e2e/support/target.ts`, que acessa `process.env` via `globalThis` para não exigir `@types/node` no pacote e2e. O cenário de sala cheia supõe `MAX_VIEWERS_PER_ROOM=2` na stack alvo.
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
- Fase 2: captura de tela real, áudio real e o botão "Parar compartilhamento" do navegador (evento `ended` da track) não foram exercitados; ficam para o teste manual acima.
- Fase 2: só Chromium foi testado. Firefox e Safari não.
- Fase 2: reconexão do anfitrião no navegador (queda do socket e `rebuildAll`) e o estado `failed` do espectador (10 s) não têm e2e nesta fase; a Fase 4 traz "recarregar anfitrião" e "timeout".
- Fase 2: risco para a Fase 4: a suíte e2e roda numa única API e cada cenário cria uma sala; acima de 10 salas por minuto o limite de criação devolve 429. Hoje são 5.
- Fase 2: o Vite registra `write EPIPE` no proxy quando um WebSocket fecha durante o e2e; não afeta os testes.
- Fase 3: ~~parte Docker não validada~~ — validada depois que o Docker foi instalado (tabela acima).
- Fase 3: o relay do TURN não foi exercitado (nenhuma alocação TURN real): no Docker Desktop do macOS o `network_mode: host` roda dentro da VM do Docker, e a validação do TURN entre redes é pendência humana (guia, seção 8).
- Observação: se o processo da API cai, o `pnpm dev` (`pnpm -r --parallel`) encerra os outros processos também. Depois de derrubar o Vite à força, a aba já aberta pode dar erro 504 "Outdated Optimize Dep" até reiniciar o Vite; num `pnpm dev` limpo isso não acontece.

## Pendências humanas (fora do código)

Consulte o guia de hospedagem, domínio e operação. Marque aqui o que já foi feito.

- [x] Instalar Docker localmente e rodar a "Verificação" da Fase 3
- [ ] Teste manual com tela real da Fase 2 (roteiro acima)
- [ ] Conta na nuvem criada e alerta de custo configurado
- [ ] Domínio registrado
- [ ] VM criada com IP fixo e portas liberadas
- [ ] DNS apontando para a VM
- [ ] Docker instalado na VM e `.env` de produção criado
- [ ] Primeiro deploy feito
- [ ] TURN validado com a página de teste de ICE
- [ ] Teste real: anfitrião em uma rede, espectador no 4G

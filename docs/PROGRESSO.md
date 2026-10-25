# Progresso

O Claude Code atualiza este arquivo ao fim de cada fase. Não apague o histórico.

## Status das fases

| Fase | Título | Status | Commit final |
| --- | --- | --- | --- |
| 0 | Fundação | concluída com ressalvas (ver Decisões 3–4 e "O que não foi possível verificar") | `30cdcb5` |
| 1 | API de salas e sinalização | concluída | `8ea08bf` |
| 2 | Transmissão no navegador | concluída com ressalvas (teste manual com tela real pendente, ver abaixo) | `7b2c8ce` |
| 3 | Internet: TURN e deploy | concluída (validação local com Docker feita em 2026-10-23; TURN em rede real é pendência humana) | `bc72f24` |
| 4 | Endurecimento e entrega | concluída (tag `v0.1.0`) | `0348db4` |

| 5 | Interface: landing page e estilo (pedida depois do MVP, branch `feat/ui-landing-and-styles`) | concluída | `5e1dec6` |
| 10 | Revisão para o lançamento: segurança, qualidade de vídeo, operação | concluída (pendências humanas abaixo) | ver Etapa 10 |
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

### Fase 4 (2026-10-23, Node 26.0.0, pnpm 12.15.0, Docker Desktop 29.9.2, macOS)

| Comando | Resultado |
| --- | --- |
| Testes do checklist de segurança (`apps/api/test/security.spec.ts`, 6 testes) | passam: origem não permitida recusada (inclusive `https://allowed.test.evil.test`); espectador não produz efeito com `signal:offer`, `host:live` e `host:end`; 3 tokens errados recusados e o `GET /api/rooms/:id` só tem `roomId`, `live`, `viewerCount`, `maxViewers`; 10 payloads estranhos (null, número, texto, array, `{ $gt }`, `__proto__` via `JSON.parse`, SDP de 40 KB, candidato de 3 KB, `viewerId` com `../`) em todos os eventos: acks `INVALID_PAYLOAD`, sockets continuam conectados, evento válido seguinte respondido, nenhum protótipo poluído; mensagem acima de 64 KB desconecta só aquele socket; estouro do limite de eventos desconecta (`io server disconnect`) |
| `pnpm test` | shared 13, web 24, api 55 |
| E2E extras (`e2e/tests/resilience.spec.ts`), servidor de e2e com `ROOM_HOST_GRACE_MS=3000` e `SWEEP_INTERVAL_MS=500` | 7 recarregar anfitrião (sala continua, espectador vê "Aguardando…", vídeo volta); 8 anfitrião fecha a aba ("O anfitrião saiu e a sala foi encerrada." em ~4 s); 9 segunda aba ("Esta sala foi aberta em outra aba."); 10 sem token ("Você não tem acesso de anfitrião a esta sala."); 11 espectador offline e de volta (`context.setOffline`): "Conexão perdida. Reconectando…" após ~45 s e vídeo de volta ~1 s depois de voltar a rede |
| `pnpm test:e2e` | 11/11 em ~1,2 min (com contextos fechados após cada teste; antes disso a suíte levava o dobro) |
| Limpeza | removidos `@types/express` (não usado; typecheck, build e testes passam sem ele), o schema `apiErrorResponse` (não usado) e os tons `neutral`/`error` do `StatusPill` (não usados). `grep`: 0 `console.*`/`debugger`; nenhuma chamada de log com `sdp`, `candidate`, `token` ou `secret` |
| `pnpm audit` | **No known vulnerabilities found** (0 info/low/moderate/high/critical; 126 dependências de produção, 647 de desenvolvimento, 787 no total). Sem `--force`, sem `overrides` |
| README final | o que é, arquitetura, requisitos, instalação, scripts, testes (com instalação do Chromium), tabela de variáveis, limites do MVP, produção, Fora do MVP |
| Clone limpo (pasta temporária, removida depois) | `pnpm install --frozen-lockfile`, `build`, `typecheck`, `lint`, `format:check`, `test` (13/24/55) e `test:e2e` (11/11): exit 0. `docker compose -f docker-compose.prod.yml config`: exit 0 (só avisos de variáveis não definidas, porque o clone não tem `.env`) |
| Tag | `v0.1.0` anotada, local, sem push |

### Etapa 5: interface (2026-10-23, branch `feat/ui-landing-and-styles`)

Pedido: componentes e estilo para todas as páginas, com uma landing page para criar a sala. Sem mudança de comportamento, de protocolo ou de dependências (CSS puro, sem biblioteca de UI, sem fonte externa).

| Verificação | Resultado |
| --- | --- |
| `pnpm build`, `typecheck`, `lint`, `format:check` | exit 0 |
| `pnpm test` | shared 13, web 24, api 55 |
| `pnpm test:e2e` | 11/11 (todos os textos e papéis usados pelos testes continuam iguais) |
| Capturas com Playwright (script fora do repositório): 9 telas × desktop 1280 px, celular 360 px e tema escuro | 27 capturas revisadas; nenhuma com rolagem horizontal. Encontrados e corrigidos: conteúdo do cartão de fim deslocado para a esquerda; palco vazio estourando a largura no celular (altura mínima + `aspect-ratio`); botão "Criar sala" sem largura total no celular |
| Teste instável encontrado | `security.spec.ts` (Fase 4) montava o "token quase certo" trocando o último caractere por `A`; quando o token já terminava em `A` (1 em 64), o teste falhava. Corrigido; 30 execuções seguidas sem falha. A tag `v0.1.0` contém a versão instável do teste (o produto não muda) |

Componentes novos: `Button`, `Card`, `Callout`, `Icon` (SVGs próprios), `LinkField`, `StateMessage`; `Layout` ganhou cabeçalho e rodapé; `StatusPill`, `CopyButton` e `RemoteVideo` foram refeitos. `styles.css` virou um design system com tokens (cores claro/escuro, espaçamento, raios, sombras) e respeita `prefers-reduced-motion`.

**Textos novos (fora da tabela de `03-frontend.md`), para revisão:**

- Cabeçalho: "Compartilhar tela" (marca, link para o início). Rodapé: "Vídeo direto entre navegadores, sem cadastro e sem instalar nada."
- Landing: selo "Transmissão de tela pelo navegador"; seção "Como funciona" com "Crie uma sala — Um clique gera a sua sala e o link para os espectadores.", "Compartilhe a tela — Escolha a tela inteira, uma janela ou uma aba no seletor do navegador.", "Envie o link — Quem abrir o link assiste na hora, pelo navegador."; destaques "Sem cadastro — Nem o anfitrião nem os espectadores precisam de conta.", "Sem instalar nada — Funciona no navegador. Para assistir, até o celular serve.", "Direto entre navegadores — O vídeo não passa pelo servidor: vai do anfitrião para cada espectador."; nota "Para compartilhar a tela, use um navegador de computador atualizado."
- Anfitrião: títulos de cartão "Link da sala" e "Espectadores"; palco vazio "A prévia da sua tela aparece aqui."; "Voltar ao início" nas telas de fim e erro.
- Espectador: título "Transmissão"; "Voltar ao início" nas telas de fim e erro.

Os demais textos (título, descrição, aviso de IP, botões, estados, erros) continuam exatamente os da tabela.

### Etapa 6: nova landing (2026-10-24, branch `feat/ui-landing-and-styles`)

Pedido: landing com identidade própria, paleta escura, título à esquerda e "Criar sala" à direita, animação de um cursor desenhando a seleção pontilhada em volta do título, sem o alerta de IP.

| Verificação | Resultado |
| --- | --- |
| `pnpm build`, `typecheck`, `lint`, `format:check` | exit 0 |
| `pnpm test` | shared 13, web 24, api 55 |
| `pnpm test:e2e` | 11/11 |
| Navegador (painel do app, servidor de dev): 1440 px, 800 px e celular 375 px | layout conferido; a animação roda uma vez ao carregar. Encontrado e corrigido: o cursor passava 8 px da borda no celular e criava rolagem horizontal (`overflow-x: clip` na landing) |

Mudanças: `Layout` ganhou `width="landing"` (página inteira escura, cabeçalho sem fundo); `HomePage` refeita (seleção animada, passos, diagrama anfitrião → espectadores com o servidor ao lado); ícone `select` novo, ícone `globe` e animação `appear` removidos por não terem mais uso. Fonte Archivo (eixo de largura) empacotada pelo Vite, sem requisição externa.

**Textos novos, para revisão:**

- Título (h1): "Mostre sua tela para quem tiver o link." (substitui "Compartilhar tela", que continua como marca no cabeçalho). Etiqueta da seleção: "Tela inteira" (decorativa, `aria-hidden`).
- Passos: "Crie uma sala — Um clique gera a sala e o link para quem vai assistir.", "Escolha o que mostrar — A tela inteira, uma janela ou uma aba, no seletor do próprio navegador.", "Envie o link — Mande por onde quiser. O link é tudo que o espectador precisa." O exemplo de link usa o host atual com um id ilustrativo.
- Seção "O vídeo vai direto de você para quem assiste." com "Nenhuma conta, nenhum programa. Para assistir, até o celular serve. A imagem sai do seu navegador e chega ao navegador de cada espectador, sem ficar guardada em lugar nenhum." Diagrama: "Anfitrião", "Espectador", "Servidor — Só combina a conexão. O vídeo não passa por aqui."
- Saíram: selo "Transmissão de tela pelo navegador" e os três destaques.

A descrição e o aviso de IP continuam com o texto exato da tabela; o aviso deixou de ser um alerta e virou uma nota pequena abaixo do botão.

### Etapa 7: seções novas, nav de vidro e sala escura (2026-10-24, branch `feat/ui-landing-and-styles`)

Pedido: mais seções na landing (inclusive "Contribuir", com link para o GitHub), nav bar "liquid glass", hero mais perto da nav, tom mais próximo do preto e a página da sala no mesmo estilo.

| Verificação | Resultado |
| --- | --- |
| `pnpm build`, `typecheck`, `lint`, `format:check` | exit 0 |
| `pnpm test` | shared 13, web 24, api 55 |
| `pnpm test:e2e` | 11/11 |
| Navegador (painel do app, servidor de dev): landing e sala em 1440 px e 375 px | nav fixa e translúcida sobre o conteúdo; links de seção levam a cada seção; sala criada pelo botão abre no tema escuro; sem rolagem horizontal. O estado "ao vivo" da sala foi exercitado pelo e2e, não visto na tela (o seletor de tela do navegador não abre no painel) |

Mudanças: tema escuro `.app--dark` (tokens redefinidos: fundo `#07080c`, destaque dourado `#d9b871`), usado pela landing e pela sala do anfitrião (`Layout dark`); cabeçalho vira uma barra flutuante translúcida com desfoque, com links de seção na landing (escondidos abaixo de 900 px) e link "GitHub" nas páginas escuras. Na sala, a prévia ganha a borda pontilhada, que se move enquanto está ao vivo. Espectador e "Página não encontrada" continuam no tema claro/escuro do sistema. URL do repositório em `config.ts` (`REPOSITORY_URL`), lida do `git remote` do projeto. Ícone novo `code`.

**Textos novos, para revisão:**

- Nav: "Como funciona", "Perguntas", "Contribuir", "GitHub".
- "Perguntas frequentes": "Quantas pessoas podem assistir? — Cada sala tem um limite de espectadores ao mesmo tempo. A página da sala mostra esse limite e quantas pessoas estão assistindo agora."; "Dá para assistir pelo celular? — Sim. Quem assiste só precisa abrir o link no navegador. Para transmitir, use um computador."; "O som vai junto? — Vai, se você compartilhar uma aba do navegador e marcar a opção de áudio, quando o navegador oferecer."; "A transmissão fica gravada? — Não. O vídeo vai do seu navegador para o de quem assiste e não é guardado em lugar nenhum."; "Quando a sala termina? — Quando você clica em Encerrar sala, ou quando sai da página e não volta logo. Recarregar a página não derruba a sala. Toda sala também tem um tempo máximo de duração."
- "Contribua com o projeto": "O código está no GitHub. Encontrou um problema ou tem uma ideia? Abra uma issue ou envie um pull request."; cartão "Repositório" com o nome do repositório e "Ver no GitHub".
- Sala: os títulos dos cartões ("Link da sala", "Espectadores") deixam de ser caixa-alta no tema escuro.

### Etapa 8: redesign pixel art (2026-10-24, branch `feat/ui-landing-and-styles`)

Pedido: tema cartoon/gamer em pixel art (desenhado e aprovado no canvas), "c" legível, estrelas piscando suavemente, limpeza do código e revisão de boas práticas do front (skill `boas-praticas-front` do usuário).

| Verificação | Resultado |
| --- | --- |
| `pnpm build`, `typecheck`, `lint`, `format:check` | exit 0 |
| `pnpm test` | shared 13, web 24, api 55 |
| `pnpm test:e2e` | 11/11 |
| Navegador (servidor de dev): landing em 1440 px e 375 px; sala criada pelo botão em 1440 e 375 px; espectador aguardando; 404 | sem rolagem horizontal. Encontrados e corrigidos: marca quebrando em duas linhas na barra do celular; mini TVs do diagrama sumindo no celular; texto do "Servidor" vazando da caixa |

Mudanças:

- Tema único para o app inteiro: a landing é colorida (céu azul, creme, tomate, amarelo, contornos pretos) e as páginas de sala, espectador e 404 são escuras e minimalistas, com o amarelo como único destaque. O tema claro/escuro por `prefers-color-scheme` e o tema `.app--dark` da etapa anterior foram removidos; o `styles.css` foi reescrito com um conjunto só de tokens (de 1407 para 1319 linhas depois do Prettier, sem regras sem uso).
- `PixelSprite`: a pixel art (TV, estrela, cursor, espectador, marca do GitHub) é desenhada a partir de mapas de caracteres legíveis, em vez de centenas de `<rect>` no JSX.
- `Layout` virou dois componentes: `LandingLayout` (barra fixa e rodapé) e `Layout` (só o conteúdo, sem cabeçalho, como no canvas da sala).
- A sala, o espectador e a 404 usam a moldura de TV em volta do vídeo; a sala mostra os lugares ocupados como bonequinhos (`ViewerSeats`, com `aria-label`).
- Boas práticas: `main.tsx` sem non-null assertion; `RemoteVideo` sem `catch` silencioso no som (volta para mudo se o navegador recusar) e com motivo documentado no de tela cheia; variante `ghost` do botão, tom `warning` do Callout, ícones `shield`/`globe` e classes sem estilo removidos; animações respeitam `prefers-reduced-motion`.

**Textos novos, para revisão:** "Quer contribuir?" e "Abra uma issue ou envie um pull request no repositório do projeto.", com o botão "link" (nome acessível "link do repositório no GitHub"); "Tela inteira" (decorativo); "N de M lugares ocupados" (só para leitor de tela).

### Etapa 9: legibilidade, animação suave e botão com seta (2026-10-24)

Pedido: fonte pixel mais fácil de ler, abertura da seleção mais suave, botão "Criar sala" com uma setinha ao lado.

| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck`, `lint`, `format:check`, `build` | exit 0 |
| `pnpm --filter @app/web test` | 24/24 |
| `pnpm test:e2e` | 11/11 (a primeira tentativa não rodou: o servidor do Playwright passou de 120 s para subir durante um pico de carga da máquina; `nest build` isolado levou 1,8 s logo depois e a segunda rodada passou) |
| Navegador, 1440 px e painel padrão | seleção abrindo de forma contínua com o cursor; "Criar sala" com seta; subtítulos, perguntas, botões e rótulos em Rubik |

Mudanças: a Tiny5 fica só em textos grandes (h1, títulos de seção, título da página, número de espectadores, números dos passos, marca, "Quer contribuir?", nome do repositório); `h3`, títulos de cartão, botões, perguntas, etiqueta da seleção, selo de status, campo do link e rótulos do diagrama passam para Rubik. A abertura da seleção usa `cubic-bezier` e `ease` em vez de `steps()`; as formigas da borda andam de forma linear. `Button` ganhou `trailingIcon`; o ícone `select` saiu por não ter mais uso.

### Etapa 10: revisão para o lançamento (2026-10-25, branch `feat/ui-landing-and-styles`)

Pedido: varredura de arquitetura, conexão, qualidade, hospedagem, versões e segurança, e resolver tudo o que fosse possível sem uma pessoa.

| Verificação | Resultado |
| --- | --- |
| `pnpm audit` antes | **1 alta**: `multer` 2.4.0 (GHSA-q7qp-rjg7-q26m), fixado por `@nestjs/platform-express` 12.2.0, que é a última versão |
| `pnpm audit` depois do override | No known vulnerabilities found |
| Flags novos do coturn (`turnserver --help` na imagem `coturn/coturn:4.18.0-r0`) | `--no-tcp-relay`, `--max-bps` e `--denied-peer-ip` existem |
| `caddy validate` (imagem `caddy:2-alpine`) | Valid configuration |
| `pnpm typecheck`, `lint`, `format:check`, `build` | exit 0 |
| `pnpm test` | shared 13, web 32 (8 novos do `HostBroadcaster`), api 62 (5 novos do limite de sockets) |
| `pnpm test:e2e` | 11/11 |
| Codec negociado (teste temporário, apagado depois, lendo `getStats` do espectador no Chromium) | `video/VP9` |
| Stack de produção no Docker (`.env` temporário, `DOMAIN=localhost`, apagado no fim) | `config` ok; build ok, imagens `transmicaodetela-api:0.2.0-check` e `transmicaodetela-web:0.2.0-check` (removidas no fim); api healthy; `/` com CSP, HSTS e `Cache-Control: no-cache`; `/assets/*.js` com `public, max-age=31536000, immutable`; coturn com 0 `ERROR` e `--no-tcp-relay: TCP relay endpoints are not allowed` no log |
| `E2E_BASE_URL=https://localhost pnpm test:e2e` + teste temporário de CSP (landing, sala ao vivo e espectador assistindo) | 11 passaram, 0 violações de CSP, fontes carregadas. O cenário 8 falhou como esperado: ele supõe `ROOM_HOST_GRACE_MS=3000` (servidor do e2e) e a stack usa os 60 s padrão |
| Testes instáveis com a máquina carregada | Na primeira rodada da varredura, `pnpm test` falhou (timeout do worker do Vitest e 3 testes da API) e passou ao repetir. O Vitest gastava 96% do tempo criando o jsdom em todo arquivo; agora o ambiente padrão é `node` e só os 2 arquivos que usam DOM pedem jsdom: de ~25 s para ~1,2 s. Mesmo assim o `pnpm test` da raiz falhava 2 em 3 vezes: o Jest subia 7 workers (núcleos − 1) carregando o Nest num Mac de 8 GB, a máquina entrava em swap, o primeiro teste de cada arquivo da API passava dos 5 s e o worker do Vitest seguinte não subia em 60 s (limite fixo do Vitest). Correção: Jest com `maxWorkers: 50%` e `testTimeout: 15000`, e pacotes testados um por vez (`--workspace-concurrency=1`). Depois: 3 rodadas seguidas verdes, ~14 s cada (antes 45–135 s) |

Mudanças:

- **Dependência:** `overrides: multer: '>=2.5.0'` em `pnpm-workspace.yaml`. Retirar quando o Nest publicar uma versão com o `multer` corrigido.
- **Caddy:** `Content-Security-Policy`, `Strict-Transport-Security` (1 ano, sem `includeSubDomains`), `Cache-Control` (`no-cache` fora de `/assets`, `immutable` em `/assets`).
- **coturn:** `--no-tcp-relay`, `--max-bps=375000` e `--denied-peer-ip` para `::1`, IPv4 mapeado, NAT64, `fc00::/7` e `fe80::/10`.
- **Compose:** imagens `transmicaodetela-api` e `transmicaodetela-web` com a tag `${APP_VERSION:-latest}`; `APP_VERSION` no `.env.example`.
- **API:** `ConnectionLimiter` (`MAX_SOCKETS_PER_IP`, padrão 20): handshake recusado no limite, vaga liberada na desconexão, endereço calculado como o `trust proxy` do Express.
- **Web:** captura com `max` de 1920×1080; VP9 preferido via `setCodecPreferences`; o `HostBroadcaster` recria o peer em `failed` (na hora) e em `disconnected` (depois de 4 s), até 3 vezes seguidas.
- **Docs:** README (publicar versão, rollback, manutenção), `CHANGELOG.md`, `02-backend`, `03-frontend`, `05-infraestrutura` (Caddyfile atual e notas do coturn) e `06-seguranca-e-limites`.

## Decisões

Registre aqui decisões tomadas que não estavam nos documentos (data, decisão, motivo em uma linha).

- 2026-10-25 (Etapa 10) — `overrides` do pnpm para o `multer`, ao contrário da Fase 4 ("sem overrides"): a última versão do `@nestjs/platform-express` (12.2.0) fixa `multer` 2.4.0, que é vulnerável, e não existe versão do Nest que resolva isso.
- 2026-10-25 (Etapa 10) — Recuperação do peer recriando a conexão (nova oferta), não com ICE restart na mesma conexão: o `ViewerReceiver` troca o peer a cada oferta, então recriar mantém o protocolo e o anfitrião como único ofertante. Custo: um piscar no vídeo do espectador durante a recuperação.
- 2026-10-25 (Etapa 10) — VP9 preferido, não AV1: o AV1 é codificado por software e pesa demais com um encoder por espectador. O VP9 só vai primeiro se o navegador declarar que consegue enviá-lo; os demais codecs ficam como reserva (Safari antigo cai em H.264 ou VP8).
- 2026-10-25 (Etapa 10) — `MAX_SOCKETS_PER_IP` = 20: o uso legítimo é de 1 socket por aba, e no 4G muita gente divide o mesmo IP (CGNAT), então o limite tem folga. O IP recusado não vai para o log.
- 2026-10-25 (Etapa 10) — `--max-bps=375000` (≈ 3 Mbps por sessão): o vídeo usa no máximo 2 Mbps mais o áudio e as retransmissões.
- 2026-10-25 (Etapa 10) — HSTS sem `includeSubDomains` e sem `preload`: o domínio ainda não existe e outros subdomínios dele podem não ter HTTPS.
- 2026-10-25 (Etapa 10) — `pnpm test` da raiz testa um pacote por vez e o Jest usa metade dos núcleos: com tudo em paralelo, a máquina de desenvolvimento (8 GB) entrava em swap e os testes falhavam por tempo.
- 2026-10-25 (Etapa 10) — Vitest com ambiente padrão `node` e `// @vitest-environment jsdom` em `host-token.test.ts` e `HomePage.test.tsx`.

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
- 2026-10-24 (Etapa 8) — Fonte pixel: Tiny5 (`@fontsource/tiny5`), no lugar da Pixelify Sans do primeiro canvas. O "C" maiúsculo da Pixelify é quase fechado e fica parecido com "O" (o problema era o desenho da letra, não o contorno); a Tiny5 tem o "C" aberto. Comparadas no navegador: Pixelify Sans, Jersey 10/15, Silkscreen, Tiny5, Micro 5, Bytesized, Handjet, DotGothic16, Workbench, Sixtyfour, VT323, Press Start 2P. Texto corrido em Rubik (`@fontsource-variable/rubik`). `@fontsource-variable/archivo` removida.
- 2026-10-24 (Etapa 8) — Como a Tiny5 tem traço fino, os títulos de seção não usam contorno (que fechava as letras): sombra dura em vez disso; no fundo creme o título é escuro com sombra amarela.
- 2026-10-24 (Etapa 8) — O app deixa de seguir o tema claro/escuro do sistema: o visual é fixo, como no canvas aprovado.
- 2026-10-24 (Etapa 8) — A caixa "Quer contribuir?" usa a marca do GitHub redesenhada em pixel art, a pedido do usuário. As diretrizes de marca do GitHub pedem para não alterar o logo; trocar pelo logo oficial antes de divulgar o site, se for o caso.
- 2026-10-24 (Etapa 8) — `eslint-plugin-react-hooks` (regras de hooks e dependências de efeitos) não foi adicionado: é dependência nova e aguarda aprovação.
- 2026-10-24 (Etapa 7) — As respostas das perguntas frequentes não citam números (limite de espectadores, tempo de espera, duração máxima), porque são configuráveis por variável de ambiente; a página da sala mostra o limite real.
- 2026-10-24 (Etapa 7) — O ícone do link do GitHub é um `<>` genérico, não a marca do GitHub.
- 2026-10-24 (Etapa 6) — h1 da tela inicial passa a ser "Mostre sua tela para quem tiver o link." por decisão do usuário (os docs pediam "Compartilhar tela"); o teste foi atualizado.
- 2026-10-24 (Etapa 6) — Aviso de IP mantido (regra de `06-seguranca-e-limites.md`), mas como nota discreta abaixo do botão, sem o visual de alerta, por decisão do usuário.
- 2026-10-24 (Etapa 6) — Dependência nova `@fontsource-variable/archivo` (aprovada pelo usuário): fonte com eixo de largura, servida pelo próprio site, sem pedir nada a terceiros.
- 2026-10-24 (Etapa 6) — A landing é sempre escura, nos dois temas do sistema; as outras páginas continuam com claro/escuro por `prefers-color-scheme`.
- 2026-10-23 (Etapa 5) — Trabalho feito numa branch própria (`feat/ui-landing-and-styles`), para a `main` e a tag `v0.1.0` continuarem apontando para o MVP verificado.
- 2026-10-23 (Etapa 5) — Um único botão "Criar sala" na landing (os testes procuram o botão por nome; dois botões iguais seriam ambíguos para leitores de tela e para os testes).
- 2026-10-23 (Etapa 5) — "Tela cheia" no espectador passa a colocar o quadro inteiro em tela cheia (não só o `<video>`), para manter o fundo escuro e o enquadramento.
- 2026-10-23 (Fase 4) — O cenário e2e "anfitrião sem token" usa um `roomId` válido qualquer, sem criar sala: a página recusa antes de qualquer rede. Assim a suíte cria 9 salas por rodada, abaixo do limite de 10 por minuto.
- 2026-10-23 (Fase 4) — O e2e de queda de rede do espectador ficou na suíte: `context.setOffline` não fecha o WebSocket aberto, então a queda só é percebida pelo timeout de ping padrão do Socket.IO (25 s + 20 s). O teste tem timeout próprio de 2 min. Nenhum gancho de teste foi colocado no produto e os tempos de ping do Socket.IO não foram alterados (seria mudança de comportamento).
- 2026-10-23 (Fase 4) — Os helpers do e2e fecham todos os contextos de navegador após cada teste. Sem isso, as transmissões dos cenários anteriores continuavam rodando e deixavam os seguintes lentos.
- 2026-10-23 (Fase 4) — `peerFailed` do `HostBroadcaster` continua na interface (o doc pede "avisar a UI"), mas o hook do anfitrião não mostra nada: o peer que falha é fechado e o espectador recebe nova oferta ao reconectar.
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
- Fase 4: o espectador numa rede que cai em silêncio (sem fechar a conexão) só mostra "Conexão perdida. Reconectando…" depois de ~45 s (ping padrão do Socket.IO). É comportamento observado, não defeito; reduzir esse tempo seria mudança de produto.
- Fase 4: nenhum navegador além do Chromium foi testado; nenhum teste com tela, áudio ou rede reais (roteiro manual abaixo).
- Observação: se o processo da API cai, o `pnpm dev` (`pnpm -r --parallel`) encerra os outros processos também. Depois de derrubar o Vite à força, a aba já aberta pode dar erro 504 "Outdated Optimize Dep" até reiniciar o Vite; num `pnpm dev` limpo isso não acontece.

## Pendências humanas (fora do código)

Consulte o guia de hospedagem, domínio e operação. Marque aqui o que já foi feito.

- [x] Instalar Docker localmente e rodar a "Verificação" da Fase 3
- [ ] Teste manual com tela real da Fase 2 (roteiro acima)
- [ ] Teste manual da Etapa 10: compartilhar uma tela Retina/4K e conferir que o vídeo fica fluido; derrubar o Wi-Fi do espectador por uns 10 s e conferir que o vídeo volta sozinho
- [ ] Decidir o merge da `feat/ui-landing-and-styles` na `main`, enviar `main` e tags ao GitHub e criar a tag `v0.2.0`
- [ ] Política de privacidade e termos de uso, se o site for divulgado (os logs do Caddy e do coturn têm IPs)
- [ ] Conta na nuvem criada e alerta de custo configurado
- [ ] Domínio registrado
- [ ] VM criada com IP fixo e portas liberadas
- [ ] DNS apontando para a VM
- [ ] Docker instalado na VM e `.env` de produção criado
- [ ] Primeiro deploy feito
- [ ] TURN validado com a página de teste de ICE
- [ ] Teste real: anfitrião em uma rede, espectador no 4G

### Teste manual guiado (depois do deploy; da Fase 4)

- [ ] Anfitrião no Chrome (ou Edge) em computador, espectador no celular com **4G** (não Wi-Fi): o vídeo aparece em poucos segundos.
- [ ] Mesmo teste com anfitrião no Firefox e no Safari, se tiver acesso.
- [ ] Compartilhar uma **aba** com áudio: o espectador ouve ao ativar o som.
- [ ] Compartilhar a **tela inteira**: o vídeo aparece; anotar se o áudio chega (depende do sistema).
- [ ] Clicar em "Parar compartilhamento" no navegador: o espectador volta a "Aguardando".
- [ ] Recarregar a página do anfitrião: a sala continua e ele consegue compartilhar de novo.
- [ ] Fechar a aba do anfitrião e esperar mais de 60 segundos: os espectadores veem a sala encerrada.
- [ ] Entrar com 6 espectadores: o sexto vê "A sala está cheia".
- [ ] Abrir o site por `http://`: redireciona para HTTPS.
- [ ] Abrir o link em janela anônima: funciona sem login.

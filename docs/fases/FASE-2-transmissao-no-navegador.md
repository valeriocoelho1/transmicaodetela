# Fase 2: Transmissão no navegador

## Objetivo

O produto funcionando de ponta a ponta em desenvolvimento: criar sala, compartilhar a tela, abrir o link em outra janela e ver o vídeo. Inclui todas as telas, os estados e os textos, e uma suíte e2e com Playwright que prova o fluxo sem depender de uma tela real.

## Pré-requisitos

- Fases 0 e 1 concluídas.
- Ler: `docs/arquitetura/03-frontend.md`, `04-protocolo-sinalizacao.md` e `01-visao-geral.md`.

## Entra

- Libs de apoio, `HostBroadcaster`, `ViewerReceiver`, hooks de sessão, páginas, componentes, estilo e textos.
- Pacote `e2e` com Playwright e captura de tela simulada.

## Não entra

Docker, TURN de verdade, senha, chat, painel de saúde, escolha de qualidade pelo usuário, qualquer coisa de `Fora do MVP`.

## Tarefas

1. **Libs (`apps/web/src/lib`).**
   - `api.ts`: `createRoom()` (`POST /api/rooms`) e `getRoom(roomId)` (`GET /api/rooms/:roomId`), validando as respostas com os schemas de `@app/shared` e traduzindo `429` e `503` em erros tipados.
   - `signaling.ts`: fábrica do socket tipado com `ClientToServerEvents` e `ServerToClientEvents`, `autoConnect: false`, mesma origem (URL relativa).
   - `host-token.ts`: `getHostToken`, `saveHostToken`, `clearHostToken` no `localStorage`, chave `host-token:<roomId>`, com `try/catch` (o acesso pode falhar).
   - `capture.ts`: `isDisplayCaptureSupported()`, `startDisplayCapture()` com as opções de `03-frontend.md` e o mapeamento de erros para as mensagens em pt-BR.
   - `webrtc/ice-candidate-queue.ts`: função/classe pura que guarda candidatos até existir `remoteDescription` e depois os entrega em ordem.
2. **`HostBroadcaster` e `ViewerReceiver`** exatamente como em `03-frontend.md`, incluindo a ordem de criação do peer no anfitrião e a política de bitrate (`config.ts`).
3. **Hooks.** `useHostSession(roomId)` e `useViewerSession(roomId)` com os estados e a regra de reconexão descritos em `03-frontend.md`: ouvintes registrados antes do `join`, `join` refeito a cada `connect`, anfitrião com `rebuildAll()` e `host:live` ao reconectar.
4. **Páginas e componentes.** `HomePage`, `HostPage`, `ViewerPage`, `NotFoundPage`, `Layout`, `CopyButton`, `StatusPill`, `RemoteVideo`. Textos exatamente como na tabela de `03-frontend.md`. Regiões de status com `aria-live="polite"`. `RemoteVideo` expõe `data-testid="remote-video"` (único `data-testid` permitido, para os testes).
5. **Estilo.** `styles.css` conforme `03-frontend.md`: variáveis, tema claro e escuro, contêiner centralizado, foco visível, funcionando a partir de 360 px. Sem nome de produto, sem imagens de marca.
6. **Roteamento** das quatro rotas e título do documento "Compartilhar tela".
7. **Testes unitários (Vitest).** Fila de candidatos (entrega só depois do `remoteDescription`, preserva ordem), mapeamento de erros de captura, `host-token` (leitura, escrita e falha do storage), pluralização do contador.
8. **Pacote `e2e` (`@app/e2e`).**
   - Dependência `@playwright/test`; `playwright.config.ts` com Chromium, `workers: 1`, `trace: 'retain-on-failure'`.
   - `webServer`: API em porta própria (`PORT=3100`, `MAX_VIEWERS_PER_ROOM=2`, `ALLOWED_ORIGINS=http://localhost:5273`) e web em `5273` apontando o proxy para a `3100`. Para isso `vite.config.ts` lê `WEB_PORT` e `API_PORT` (padrões 5173 e 3000).
   - `support/fake-display-media.ts`: via `page.addInitScript`, substitui `navigator.mediaDevices.getDisplayMedia` por uma função que desenha frames num `canvas` 1280×720 com `setInterval` e devolve `canvas.captureStream(30)`.
   - `pnpm exec playwright install chromium` documentado no README; `pnpm test:e2e` na raiz roda a suíte.
9. **Cenários e2e obrigatórios** (use papéis e textos acessíveis; para o vídeo, espere `videoWidth > 0` e `currentTime > 0.3` com `expect.poll`):
   1. Fluxo feliz com espectador **antes** da live: o anfitrião cria a sala, copia o link; o espectador vê "Aguardando o anfitrião iniciar a transmissão."; o anfitrião clica "Compartilhar tela"; o vídeo aparece no espectador; o anfitrião mostra "Ao vivo" e "1 espectador"; o espectador mostra "Esta transmissão está sem áudio." (o canvas não tem áudio).
   2. Espectador **depois** da live: um segundo espectador entra com a live em andamento e recebe vídeo.
   3. Sala cheia: com limite 2, o terceiro espectador vê "A sala está cheia. Tente novamente mais tarde."
   4. Sala inexistente: `/r/` com um `roomId` válido mas inexistente e `/r/` com formato inválido mostram "Sala não encontrada ou já encerrada."
   5. Parar e retomar: "Parar transmissão" leva os espectadores de volta a "Aguardando..."; "Compartilhar novamente" traz o vídeo de volta.
   6. Encerrar sala: "Encerrar sala" leva os espectadores a "A transmissão foi encerrada pelo anfitrião."
10. **Fechamento.** `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm test:e2e`; atualizar `docs/PROGRESSO.md`; commits.

## Critérios de aceite

- [ ] Os 6 cenários e2e passam em Chromium.
- [ ] Testes unitários do front passam.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` e `pnpm test:e2e` passam na raiz.
- [ ] Todos os textos da tabela de `03-frontend.md` aparecem na interface.
- [ ] Nenhum `any` não justificado; casts de opções de `getDisplayMedia` ficam isolados em `capture.ts`.
- [ ] O `hostToken` não aparece em URL, log do console nem em estado visível.
- [ ] A página funciona em 360 px de largura (confira no navegador).
- [ ] `docs/PROGRESSO.md` atualizado, incluindo a lista de testes manuais que só uma pessoa pode fazer.

## Verificação

```
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm dev     # teste manual: duas janelas, uma em /host/:id e outra em /r/:id, com uma aba real compartilhada
```

O teste manual com tela real não pode ser automatizado. Registre em `PROGRESSO.md` que ele fica para a pessoa fazer, com este roteiro: criar sala, compartilhar uma aba com vídeo e áudio, abrir o link em outra janela, ativar o som, usar o botão do navegador "Parar compartilhamento" e conferir que o espectador volta a "Aguardando".

## Armadilhas conhecidas

- **StrictMode.** Em desenvolvimento o React executa efeitos duas vezes (monta, desmonta, monta). Os hooks devem criar e destruir o socket de forma idempotente e ignorar eventos de sockets já descartados (flag `cancelled` na limpeza). Sem isso, o segundo `host:join` substitui o primeiro e a UI pode cair em "ended" por engano.
- **Ordem no espectador.** Ouvintes de `signal:offer`, `signal:ice` e `room:status` registrados antes do `viewer:join`.
- **Ordem no anfitrião.** `addTrack` antes de `createOffer`; só depois `setLocalDescription` e o envio. Candidatos ICE do espectador podem chegar antes da resposta: use a fila.
- **Autoplay.** O `<video>` do espectador precisa começar mudo para tocar sem gesto. Som só depois do clique em "Ativar som".
- **`getDisplayMedia` exige gesto do usuário.** Não chame em `useEffect`.
- **Evento `ended` da track.** É o jeito de saber que a pessoa clicou em "Parar compartilhamento" no navegador. Trate igual a "Parar transmissão".
- **E2E em contêiner ou como root.** Se o Chromium recusar iniciar, use `--no-sandbox` apenas no ambiente de CI. Se dois navegadores na mesma máquina não conectarem, inicie com `--disable-features=WebRtcHideLocalIpsWithMdns`.
- **Valores de `Mbps`.** `maxBitrate` é em bits por segundo (`2_000_000`), não em Mbps.

## Prompt para o Claude Code

````text
Execute a Fase 2 (Transmissão no navegador) do projeto.

Leitura obrigatória, nesta ordem: CLAUDE.md; docs/PROMPT-MESTRE.md; docs/arquitetura/01-visao-geral.md; docs/arquitetura/03-frontend.md; docs/arquitetura/04-protocolo-sinalizacao.md; docs/fases/FASE-2-transmissao-no-navegador.md. Confirme em docs/PROGRESSO.md que as Fases 0 e 1 estão concluídas.

O que entregar (detalhes na seção "Tarefas" do arquivo da fase; execute todas):
- Em apps/web/src/lib: api.ts, signaling.ts (socket tipado, autoConnect:false, mesma origem), host-token.ts (localStorage com try/catch), capture.ts (getDisplayMedia com as opções do doc, suporte, mapeamento de erros em pt-BR), webrtc/ice-candidate-queue.ts.
- HostBroadcaster (um RTCPeerConnection por espectador; addTrack, setParameters com maxBitrate 2_000_000 e maxFramerate 30, onicecandidate, createOffer, setLocalDescription, signal:offer; rebuildAll; stop) e ViewerReceiver (fecha o peer anterior a cada nova oferta, fila de ICE, createAnswer).
- Hooks useHostSession e useViewerSession com os estados e a regra de reconexão do doc (ouvintes antes do join, join a cada connect, anfitrião reconstrói peers e reemite host:live).
- Páginas Home, Host, Viewer, NotFound; componentes Layout, CopyButton, StatusPill, RemoteVideo (data-testid="remote-video"); styles.css (tema claro/escuro, 360 px); todos os textos exatamente como na tabela de docs/arquitetura/03-frontend.md, inclusive o aviso de IP na tela inicial.
- Testes Vitest: fila de ICE, mapeamento de erros de captura, host-token, pluralização.
- Pacote e2e (@app/e2e) com Playwright: config com webServer (API na 3100 com MAX_VIEWERS_PER_ROOM=2 e ALLOWED_ORIGINS correto; web na 5273; vite.config.ts lendo WEB_PORT e API_PORT), support/fake-display-media.ts (getDisplayMedia substituído por canvas.captureStream(30)) e os 6 cenários da tarefa 9. pnpm test:e2e na raiz roda a suíte.

Atenção às armadilhas do arquivo da fase, principalmente: StrictMode (efeitos duplicados em dev; ignore eventos de sockets descartados), ouvintes antes do join, addTrack antes de createOffer, autoplay mudo, getDisplayMedia só em clique, evento "ended" da track.

Regras: sem Docker, TURN real, senha, chat ou painel de saúde; só dependências de docs/stack.md (confirme com pnpm view); não invente nomes nem textos fora da tabela; nunca logue SDP, ICE ou hostToken; o hostToken nunca aparece na URL.

Como trabalhar: plano de 5 a 8 linhas e siga em frente. Commits pequenos (Conventional Commits, em inglês). Rode TODA a seção "Verificação" e corrija o que falhar; não declare sucesso sem ver pnpm typecheck, lint, format:check, test e test:e2e passando. O teste manual com tela real é da pessoa: registre o roteiro em docs/PROGRESSO.md.

Ao terminar: atualize docs/PROGRESSO.md e entregue o relatório (o que foi feito; comandos executados e resultado real; o que não pôde ser verificado; decisões; placeholders pendentes). Depois PARE e espere eu escrever "continuar".
````

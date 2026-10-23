# Arquitetura, parte 3: frontend (`apps/web`)

React + Vite + TypeScript. CSS simples, sem biblioteca de componentes. Toda a mídia usa as APIs nativas do navegador.

## Rotas

| Rota | Tela |
| --- | --- |
| `/` | Início: explica em uma frase e tem o botão "Criar sala" |
| `/host/:roomId` | Anfitrião: link, compartilhar tela, contador de espectadores, encerrar |
| `/r/:roomId` | Espectador: vídeo ou estado de espera |
| `*` | Página não encontrada |

O link que o anfitrião envia é `<origem do site>/r/<roomId>`, montado com `window.location.origin`.

## Estrutura de pastas

```
apps/web/src/
  main.tsx                 App.tsx            routes.tsx
  config.ts                # constantes de captura e bitrate
  pages/                   HomePage.tsx  HostPage.tsx  ViewerPage.tsx  NotFoundPage.tsx
  components/              CopyButton.tsx  StatusPill.tsx  RemoteVideo.tsx  Layout.tsx
  hooks/                   useHostSession.ts  useViewerSession.ts
  lib/
    api.ts                 # fetch de /api (criar sala, consultar sala)
    signaling.ts           # fábrica do socket tipado
    capture.ts             # getDisplayMedia e mapeamento de erros
    host-token.ts          # leitura e escrita do hostToken no localStorage
    webrtc/
      host-broadcaster.ts  # um RTCPeerConnection por espectador
      viewer-receiver.ts   # um RTCPeerConnection que recebe
      ice-candidate-queue.ts  # fila de candidatos que chegam antes do remoteDescription
  styles.css
```

## Constantes (`config.ts`)

| Constante | Valor | Uso |
| --- | --- | --- |
| `CAPTURE_FRAME_RATE` | `30` | `frameRate` pedido ao `getDisplayMedia` |
| `VIDEO_MAX_BITRATE_BPS` | `2_000_000` | `maxBitrate` no `RTCRtpSender` |
| `VIDEO_MAX_FRAMERATE` | `30` | `maxFramerate` no `RTCRtpSender` |

## Captura de tela (`lib/capture.ts`)

```ts
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: { frameRate: { ideal: 30, max: 30 } },
  audio: true,
  selfBrowserSurface: 'exclude',
  surfaceSwitching: 'include',
  systemAudio: 'include',
});
const [videoTrack] = stream.getVideoTracks();
videoTrack.contentHint = 'detail'; // tela com texto: prioriza nitidez
videoTrack.addEventListener('ended', onShareEnded);
```

Regras:

- Só chamar a partir de um clique do usuário (o navegador exige).
- As opções além de `video` e `audio` são dicas e podem não existir em todo navegador. Se o TypeScript não conhecer alguma, faça um cast local, sem `any` espalhado.
- O áudio pode vir ausente mesmo com `audio: true`. Depois da captura, se `stream.getAudioTracks().length === 0`, mostre ao anfitrião o aviso "O áudio não foi compartilhado. Para incluir áudio, compartilhe uma aba do navegador e marque a opção de áudio, quando o navegador oferecer."
- Se `navigator.mediaDevices?.getDisplayMedia` não existir, mostre a mensagem de navegador sem suporte e desabilite o botão.
- Mapeamento de erros por `error.name`:

| Erro | Mensagem (pt-BR) |
| --- | --- |
| `NotAllowedError` | Você cancelou ou não permitiu o compartilhamento. |
| `NotFoundError` | Nenhuma tela disponível para compartilhar. |
| `NotReadableError` | O sistema impediu a captura da tela. |
| outros | Não foi possível iniciar o compartilhamento. |

## `HostBroadcaster` (`lib/webrtc/host-broadcaster.ts`)

Mantém `Map<viewerId, { pc, queue }>` e o conjunto `knownViewers`. Interface:

| Método | O que faz |
| --- | --- |
| `setIceServers(list)` | Atualiza os servidores ICE usados nas próximas conexões |
| `addViewer(viewerId)` | Registra o espectador. Se há stream ativa, cria o peer |
| `removeViewer(viewerId)` | Fecha o peer e remove |
| `start(stream)` | Guarda a stream e cria um peer para cada espectador conhecido |
| `stop()` | Fecha todos os peers e esquece a stream. Mantém `knownViewers` |
| `rebuildAll()` | Fecha todos os peers e recria (usado depois de reconexão do socket) |
| `handleAnswer(viewerId, sdp)` | `setRemoteDescription`, depois esvazia a fila de candidatos |
| `handleIce(viewerId, candidate)` | Se já há `remoteDescription`, `addIceCandidate`; senão, enfileira |
| `dispose()` | `stop()` e remove ouvintes |

Criação de um peer, nesta ordem (validada em protótipo):

1. `new RTCPeerConnection({ iceServers })`.
2. `stream.getTracks().forEach(t => pc.addTrack(t, stream))`.
3. No sender de vídeo: `getParameters()`, garantir `encodings[0]`, definir `maxBitrate` e `maxFramerate`, `setParameters()`.
4. `pc.onicecandidate`: se `e.candidate`, emitir `signal:ice { viewerId, candidate: e.candidate.toJSON() }`.
5. `pc.onconnectionstatechange`: em `failed`, fechar e remover o peer e avisar a UI.
6. `createOffer()`, `setLocalDescription(offer)`, emitir `signal:offer { viewerId, sdp: pc.localDescription.toJSON() }`.

O anfitrião é sempre o ofertante. Nunca crie oferta no espectador.

## `ViewerReceiver` (`lib/webrtc/viewer-receiver.ts`)

| Método | O que faz |
| --- | --- |
| `handleOffer(sdp)` | Fecha o peer anterior (se houver) e cria um novo. `pc.ontrack` entrega `e.streams[0]`. `setRemoteDescription(offer)`, esvazia a fila, `createAnswer()`, `setLocalDescription`, emite `signal:answer` |
| `handleIce(candidate)` | Mesma regra de fila do anfitrião |
| `close()` | Fecha o peer e entrega `null` ao `onStream` |

`pc.onconnectionstatechange`: `connected` leva a UI para "assistindo"; `failed` leva para "falhou" depois de 10 segundos sem recuperação; `disconnected` é tolerado por alguns segundos.

## Hooks de sessão

Ambos recebem o `roomId`, criam o socket via `lib/signaling.ts` e expõem estado pronto para a UI.

**Regra de reconexão (vale para os dois):** registre `socket.on('connect', join)`. O Socket.IO reconecta sozinho; a cada `connect` (inclusive o primeiro) o hook refaz o `join`. No anfitrião, depois de um novo `join` bem-sucedido, chame `broadcaster.rebuildAll()` se havia stream ativa e reemita `host:live { live: true }`.

### `useHostSession(roomId)`

Lê o token com `getHostToken(roomId)`. Sem token: estado `forbidden`.

| Estado | Quando |
| --- | --- |
| `connecting` | Socket conectando ou `host:join` em andamento |
| `forbidden` | Não há `hostToken` guardado para esta sala |
| `not_found` | `ack` com `ROOM_NOT_FOUND` ou `INVALID_TOKEN` |
| `ready` | Dentro da sala, sem transmitir |
| `starting` | Seletor de tela aberto |
| `live` | Transmitindo |
| `reconnecting` | Socket caiu |
| `ended` | Sala encerrada ou aberta em outra aba (`room:host-replaced`) |

Expõe: `state`, `viewerCount`, `maxViewers`, `previewStream`, `error`, `startSharing()`, `stopSharing()`, `endRoom()`.

- `startSharing()`: captura a tela, `broadcaster.start(stream)`, `host:live { live: true }`.
- `stopSharing()` e o evento `ended` da track: param as tracks, `broadcaster.stop()`, `host:live { live: false }`, volta para `ready`.
- `endRoom()`: `host:end`, limpa o token do `localStorage`, estado `ended`.
- Eventos: `viewer:joined` chama `addViewer`; `viewer:left` chama `removeViewer`; `signal:answer` e `signal:ice` vão para o broadcaster.

### `useViewerSession(roomId)`

| Estado | Quando |
| --- | --- |
| `connecting` | Conectando e entrando |
| `not_found` | `ack` com `ROOM_NOT_FOUND` |
| `full` | `ack` com `ROOM_FULL` |
| `waiting` | Dentro da sala e o anfitrião não está transmitindo |
| `watching` | Recebendo vídeo |
| `reconnecting` | Socket caiu |
| `failed` | Conexão WebRTC falhou |
| `ended` | `room:ended` (guarda o motivo) |

Expõe: `state`, `stream`, `hasAudio`, `endedReason`, `retry()`.

- `room:status { live: false }` leva para `waiting` e fecha o receiver.
- `retry()`: desconecta e conecta o socket de novo (novo `viewer:join`).

## Componentes

- `RemoteVideo`: `<video autoPlay playsInline muted>` com `srcObject = stream`. Botão "Ativar som" / "Desativar som" (gesto do usuário) e botão "Tela cheia" (`requestFullscreen`, se existir). Se `hasAudio` for falso, mostra "Esta transmissão está sem áudio."
- Prévia local do anfitrião: `<video muted>` pequeno, só como confirmação visual.
- `CopyButton`: `navigator.clipboard.writeText` com tratamento de falha (seleciona o texto do campo como alternativa). Texto "Copiar link" e depois "Link copiado".
- `StatusPill`: rótulo curto com cor semântica e texto (não depender só de cor).

## Textos da interface (pt-BR)

| Onde | Texto |
| --- | --- |
| Início, título | Compartilhar tela |
| Início, descrição | Crie uma sala, compartilhe a tela do computador e envie o link. Quem tiver o link assiste pelo navegador, sem cadastro. |
| Início, aviso | A transmissão é direta entre navegadores: o anfitrião e os espectadores podem ver o endereço IP uns dos outros. |
| Início, botão | Criar sala (durante: Criando sala…) |
| Início, erro geral | Não foi possível criar a sala. Tente novamente em instantes. |
| Início, erro 429 | Muitas tentativas. Aguarde um minuto. |
| Início, erro 503 | O servidor está lotado agora. Tente novamente mais tarde. |
| Anfitrião, título | Sua sala |
| Anfitrião, limite | Até {maxViewers} espectadores ao mesmo tempo. |
| Anfitrião, contador | 0 espectadores / 1 espectador / N espectadores |
| Anfitrião, botões | Compartilhar tela · Parar transmissão · Compartilhar novamente · Encerrar sala |
| Anfitrião, sem acesso | Você não tem acesso de anfitrião a esta sala. |
| Anfitrião, outra aba | Esta sala foi aberta em outra aba. |
| Navegador sem suporte | Este navegador não permite compartilhar a tela. Use um navegador de computador atualizado. |
| Sala inexistente | Sala não encontrada ou já encerrada. |
| Espectador, conectando | Conectando à sala… |
| Espectador, aguardando | Aguardando o anfitrião iniciar a transmissão. |
| Espectador, sala cheia | A sala está cheia. Tente novamente mais tarde. |
| Espectador, reconectando | Conexão perdida. Reconectando… |
| Espectador, falha | Não foi possível receber o vídeo. Verifique sua rede e tente novamente. (botão: Tentar novamente) |
| Encerrada, `HOST_ENDED` | A transmissão foi encerrada pelo anfitrião. |
| Encerrada, `HOST_TIMEOUT` | O anfitrião saiu e a sala foi encerrada. |
| Encerrada, `EXPIRED` | A sala expirou. |

Os textos de estado ficam em uma região com `aria-live="polite"`.

## Estilo

Um arquivo `styles.css` com variáveis CSS, tema claro e escuro por `prefers-color-scheme`, contêiner centralizado, foco visível, layout que funciona a partir de 360 px de largura. O vídeo ocupa a largura disponível mantendo a proporção. Sem bibliotecas, sem imagens de marca, sem nome de produto.

## Proxy de desenvolvimento

`vite.config.ts` encaminha `/api` e `/socket.io` (com `ws: true`) para `http://localhost:3000`. Assim o front usa URLs relativas em desenvolvimento e produção, e não precisa de CORS no caminho normal.

## Testes

- **Vitest (jsdom):** `ice-candidate-queue`, mapeamento de erros de captura, formatação do contador, leitura e escrita do `hostToken`.
- **Playwright (pasta `e2e/`):** fluxo completo com captura de tela simulada, descrito nas Fases 2 e 4.

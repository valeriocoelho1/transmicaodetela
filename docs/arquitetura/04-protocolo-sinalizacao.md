# Arquitetura, parte 4: protocolo de sinalização

Contrato entre navegadores e API pelo Socket.IO. A fonte de verdade em código é `packages/shared` (schemas zod e tipos `ClientToServerEvents` e `ServerToClientEvents`). Este documento descreve o que esse código deve conter.

## Papéis

- **Anfitrião:** socket que fez `host:join` com `roomId` e `hostToken` válidos.
- **Espectador:** socket que fez `viewer:join` com um `roomId` existente.
- O papel fica em `socket.data` depois do `join`. Eventos que exigem papel são descartados se o papel não bate.

## Eventos: cliente para servidor

| Evento | Quem envia | Payload | Resposta (`ack`) |
| --- | --- | --- | --- |
| `host:join` | anfitrião | `{ roomId, hostToken, name?, avatar? }` | `{ ok: true, iceServers, viewers: { viewerId, name, avatar }[], maxViewers } ` ou `{ ok: false, error }` |
| `host:live` | anfitrião | `{ live: boolean }` | nenhuma |
| `host:end` | anfitrião | nenhum | nenhuma |
| `viewer:join` | espectador | `{ roomId, name?, avatar?, resume?: { viewerId, token, needsOffer } }` | `{ ok: true, viewerId, resumeToken, resumed, iceServers, live, host: { name, avatar, online }, selfId, viewers: { id, name, avatar }[], maxViewers } ` ou `{ ok: false, error }` |
| `user:profile` | ambos | `{ name, avatar }` | nenhuma |
| `signal:offer` | anfitrião | `{ viewerId, sdp }` | nenhuma |
| `signal:answer` | espectador | `{ sdp }` | nenhuma |
| `signal:ice` | ambos | anfitrião: `{ viewerId, candidate }`. Espectador: `{ candidate }` | nenhuma |

`iceServers` é uma lista no formato `RTCIceServer` (`urls`, e `username` e `credential` quando há TURN).

## Eventos: servidor para cliente

| Evento | Para quem | Payload | Quando |
| --- | --- | --- | --- |
| `viewer:joined` | anfitrião | `{ viewerId, name, avatar }` | Um espectador entrou |
| `viewer:updated` | anfitrião | `{ viewerId, name, avatar }` | Um espectador mudou o perfil |
| `viewer:left` | anfitrião | `{ viewerId }` | Um espectador saiu |
| `signal:answer` | anfitrião | `{ viewerId, sdp }` | Repassa a resposta do espectador |
| `signal:ice` | anfitrião | `{ viewerId, candidate }` | Repassa candidato do espectador |
| `room:host-replaced` | anfitrião antigo | nenhum | Outro socket assumiu como anfitrião. O servidor desconecta este socket em seguida |
| `room:status` | espectadores | `{ live: boolean }` | Anfitrião começou ou parou de transmitir, ou ficou offline |
| `room:host` | espectadores | `{ name, avatar, online }` | Anfitrião entrou, caiu, saiu ou mudou o perfil |
| `room:viewers` | espectadores | `{ viewers: { id, name, avatar }[] }` | Um espectador entrou, saiu ou mudou o perfil (quem acabou de entrar recebe a lista no `ack`) |
| `signal:offer` | espectador | `{ sdp }` | Repassa a oferta do anfitrião |
| `signal:ice` | espectador | `{ candidate }` | Repassa candidato do anfitrião |
| `room:ended` | espectadores | `{ reason }`, com `reason` igual a `HOST_ENDED`, `HOST_TIMEOUT` ou `EXPIRED` | A sala foi encerrada. O servidor desconecta os espectadores em seguida |

## Schemas (referência para `packages/shared`)

```ts
export const ROOM_ID_REGEX = /^[A-Za-z0-9_-]{12}$/;
export const MAX_SDP_LENGTH = 32_768;
export const MAX_CANDIDATE_LENGTH = 2_048;

const roomId = z.string().regex(ROOM_ID_REGEX);
const viewerId = z.string().uuid();            // use a forma da versão instalada do zod
const hostToken = z.string().min(20).max(128);

const offerSdp  = z.object({ type: z.literal('offer'),  sdp: z.string().min(1).max(MAX_SDP_LENGTH) });
const answerSdp = z.object({ type: z.literal('answer'), sdp: z.string().min(1).max(MAX_SDP_LENGTH) });

const iceCandidate = z.object({
  candidate: z.string().max(MAX_CANDIDATE_LENGTH),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().int().nonnegative().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

export const hostJoinPayload      = z.object({ roomId, hostToken });
export const hostLivePayload      = z.object({ live: z.boolean() });
export const viewerJoinPayload    = z.object({ roomId });
export const offerPayload         = z.object({ viewerId, sdp: offerSdp });
export const answerPayload        = z.object({ sdp: answerSdp });
export const iceFromHostPayload   = z.object({ viewerId, candidate: iceCandidate });
export const iceFromViewerPayload = z.object({ candidate: iceCandidate });
```

`RTCSessionDescription.toJSON()` produz `{ type, sdp }` e `RTCIceCandidate.toJSON()` produz `{ candidate, sdpMid, sdpMLineIndex, usernameFragment }`. Os schemas acima aceitam exatamente isso.

Códigos de erro (`ErrorCode`): `ROOM_NOT_FOUND`, `INVALID_TOKEN`, `ROOM_FULL`, `INVALID_PAYLOAD`.

Também exporte em `@app/shared`: o tipo `Ack<T>` (`{ ok: true } & T | { ok: false; error: ErrorCode }`), o tipo `EndReason`, e os schemas de resposta REST (`createRoomResponse`, `roomSummaryResponse`).

## Regras do servidor

1. **Validação.** Todo payload passa por `safeParse`. Em evento com `ack`, falha vira `{ ok: false, error: 'INVALID_PAYLOAD' }`. Em evento sem `ack`, o servidor descarta em silêncio.
2. **`host:join`.** `ROOM_NOT_FOUND` se a sala não existe. `INVALID_TOKEN` se o token não confere. Se já existe outro socket de anfitrião, o novo vence: o antigo recebe `room:host-replaced` e é desconectado. O `ack` traz a lista atual de `viewers`.
3. **`host:live`.** Só anfitrião. Atualiza `room.live` e envia `room:status` a todos os espectadores.
4. **`host:end`.** Só anfitrião. Envia `room:ended { reason: 'HOST_ENDED' }`, desconecta os espectadores, apaga a sala.
5. **`viewer:join`.** `ROOM_NOT_FOUND` se não existe. `ROOM_FULL` se atingiu o limite. Senão cria `viewerId` (uuid), responde com `live` atual e avisa o anfitrião com `viewer:joined`.
6. **`signal:offer`.** Só anfitrião, e `viewerId` precisa existir na sala. Repassa ao socket do espectador. Se não existir, descarta.
7. **`signal:answer`.** Só espectador. Repassa ao anfitrião incluindo o `viewerId` do remetente (que o servidor conhece; o cliente nunca informa).
8. **`signal:ice`.** Do anfitrião, repassa ao `viewerId` indicado. Do espectador, repassa ao anfitrião com o `viewerId` do remetente.
9. **Anfitrião desconecta.** Os espectadores recebem `room:host { online: false }` e a sala é mantida por `ROOM_HOST_GRACE_MS`. Se ele saiu de propósito (o cliente fechou o socket, motivo `client namespace disconnect`), também `live = false` e `room:status { live: false }`. Se só perdeu a conexão, a sala continua `live`: o vídeo vai direto entre os navegadores e pode seguir. Se ele voltar com o token, a sala segue. Se não, a varredura encerra com `HOST_TIMEOUT`.
10. **Espectador desconecta.** Se saiu de propósito, é removido na hora e o anfitrião recebe `viewer:left`. Se perdeu a conexão, a vaga fica guardada por `VIEWER_GRACE_MS` (padrão 20 s), sem avisar o anfitrião, e só então é removida com `viewer:left`.
11. **Retomada.** O `ack` do `viewer:join` traz um `resumeToken` aleatório (32 bytes), guardado no servidor só como `sha256`. Ao reconectar, o espectador manda `resume { viewerId, token, needsOffer }`. Com o token certo, recebe a mesma vaga (mesmo com a sala cheia), um token novo e `resumed: true`; um socket antigo do mesmo espectador é desconectado. Se `needsOffer` for `true` (o vídeo dele caiu), o anfitrião recebe `viewer:joined` de novo e manda outra oferta. Token errado ou vaga expirada viram um `join` comum. O token nunca vai para log nem para a URL.
12. **Perfis.** `name` é opcional no `join` (padrão `Anfitrião` ou `Espectador`), passa por `trim`, tem de 1 a 32 caracteres e não aceita caracteres de controle. `avatar` é a foto animada do perfil e só aceita um dos quatro presets de `PROFILE_AVATARS` (`pointing`, `kitten`, `dancing`, `tongue`; padrão `kitten`). `user:profile` do anfitrião vai para os espectadores como `room:host`; o do espectador vai para o anfitrião como `viewer:updated` e para os outros espectadores em `room:viewers`. Nomes não aparecem nos logs. Os espectadores se veem pelo `id` público (`selfId` é o seu), gerado à parte e inútil para sinalização; o `viewerId` só vai para o anfitrião.
13. **Limite de taxa.** Mais de `SOCKET_RATE_LIMIT_EVENTS` eventos em `SOCKET_RATE_LIMIT_WINDOW_MS` desconecta o socket.

## Regras do cliente

1. O anfitrião é o único que cria `offer`. O espectador só responde.
2. Candidatos ICE que chegam **antes** do `setRemoteDescription` vão para uma fila e são aplicados logo depois (`ice-candidate-queue`).
3. Ignore `e.candidate === null` no `onicecandidate` (fim da coleta). Não envie.
4. Ao receber uma oferta de um peer novo do anfitrião, o espectador fecha o peer antigo e cria outro. Uma oferta com o mesmo id de sessão (linha `o=`) do peer atual é um ICE restart e é respondida no mesmo peer.
5. A cada `connect` do socket (inclusive reconexões), refaça o `join`. O espectador manda o `resume` que recebeu no último `ack`.
6. A queda do socket não derruba o vídeo: nenhum dos dois fecha peers por causa dela. Depois de reconectar, o anfitrião só recria os peers que não estão `connected` e reemite `host:live { live: true }` se ainda estiver transmitindo; sem stream (por exemplo, depois de recarregar a página), reemite `host:live { live: false }`.
7. Ao fechar ou recarregar a página (`pagehide`), o cliente fecha o socket de propósito, para o servidor liberar a vaga ou avisar os espectadores na hora.

## Sequências

### Espectador entra antes de a live começar

```
Espectador          API                 Anfitrião
   | viewer:join --->|                      |
   |<- ack live=false|-- viewer:joined ---->|  (anfitrião só registra o id)
   |                 |                      |  clica em "Compartilhar tela"
   |                 |<---- host:live true -|
   |<- room:status --|                      |  cria peer + oferta para cada id
   |<- signal:offer -|<---- signal:offer ---|
   |-- signal:answer>|-- signal:answer ---->|
   |<=== signal:ice nos dois sentidos ======>|
   |<============== vídeo e áudio ===========|
```

### Espectador entra com a live em andamento

```
Espectador          API                 Anfitrião
   | viewer:join --->|                      |
   |<- ack live=true |-- viewer:joined ---->|  cria peer + oferta na hora
   |<- signal:offer -|<---- signal:offer ---|
   |  ... igual ao anterior ...
```

### Anfitrião perde a conexão e volta

```
Anfitrião                 API                      Espectadores
   X socket cai             | live=false, grace      |<- room:status false (UI: aguardando)
   | Socket.IO reconecta    |                        |
   | host:join ------------>| attach                 |
   |<- ack viewers=[...]    |                        |
   | rebuildAll() + host:live true ->| room:status true ->|
   | nova oferta p/ cada id |                        |  espectador troca o peer
```

## Para dar certo na primeira

- O `ack` é a única resposta dos `join`. Registre os ouvintes de eventos (`signal:offer`, `room:status`, etc.) **antes** de emitir o `join`, para não perder mensagens que chegam logo depois.
- `maxHttpBufferSize` de 64 KB cobre ofertas e respostas de screen share com folga.
- Em teste automatizado local, os candidatos `host` bastam para conectar dois navegadores na mesma máquina. Se a conexão não fechar no CI, inicie o Chromium com `--disable-features=WebRtcHideLocalIpsWithMdns`.

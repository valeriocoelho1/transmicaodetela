# Arquitetura, parte 2: backend (`apps/api`)

NestJS com Express e Socket.IO. Um processo, sem banco. Prefixo global `/api` para REST. O Socket.IO fica no caminho padrão `/socket.io`, fora do prefixo.

## Módulos

| Módulo | Conteúdo |
| --- | --- |
| `AppModule` | Importa os demais, configura `ThrottlerModule` e o provider de configuração |
| `ConfigModule` próprio (`config/`) | Lê `process.env`, valida com zod, exporta o objeto `AppConfig` sob o token `APP_CONFIG`. Falha na inicialização se algo estiver inválido. Não use `@nestjs/config` |
| `RoomsModule` | `RoomsController` (REST), `RoomsService` (regras e estado em memória) |
| `SignalingModule` | `SignalingGateway` (Socket.IO), `IceService`, varredura periódica de salas |
| `HealthModule` | `GET /api/health` |

Regra de dependência: `RoomsService` não conhece sockets. O gateway chama o serviço e faz a entrega das mensagens. Isso mantém as regras testáveis sem rede.

## Configuração (variáveis de ambiente)

Validadas por zod no start. Todas têm padrão, exceto as marcadas como obrigatórias em produção.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` ou `production` |
| `PORT` | `3000` | Porta HTTP |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Origens permitidas (CORS e Socket.IO), separadas por vírgula. **Obrigatória em produção** |
| `TRUST_PROXY` | `0` | Número de proxies confiáveis à frente da API (1 em produção, atrás do Caddy) |
| `MAX_VIEWERS_PER_ROOM` | `5` | Espectadores simultâneos por sala |
| `MAX_ROOMS` | `50` | Salas simultâneas no servidor |
| `ROOM_HOST_GRACE_MS` | `60000` | Tempo para o anfitrião voltar antes de a sala ser encerrada |
| `ROOM_UNUSED_TTL_MS` | `900000` | Sala em que o anfitrião nunca entrou é apagada após esse tempo |
| `ROOM_MAX_AGE_MS` | `43200000` | Vida máxima de uma sala (12 h) |
| `SWEEP_INTERVAL_MS` | `30000` | Intervalo da varredura de salas expiradas |
| `STUN_URLS` | `stun:stun.l.google.com:19302` | Lista separada por vírgula |
| `TURN_URLS` | vazio | Lista separada por vírgula. Se definida, `TURN_SECRET` é obrigatório |
| `TURN_SECRET` | vazio | Segredo compartilhado com o coturn. **Obrigatório em produção** |
| `TURN_CREDENTIAL_TTL_SECONDS` | `43200` | Validade das credenciais TURN (12 h) |
| `SOCKET_RATE_LIMIT_EVENTS` | `300` | Eventos permitidos por socket na janela |
| `SOCKET_RATE_LIMIT_WINDOW_MS` | `10000` | Janela do limite acima |

## Modelo de dados (em memória)

```ts
interface Room {
  id: string;                    // 12 caracteres base64url (randomBytes(9))
  hostTokenHash: Buffer;         // sha256 do hostToken (nunca guarde o token puro)
  createdAt: number;             // epoch ms
  hostEverJoined: boolean;
  hostSocketId: string | null;
  hostDisconnectedAt: number | null;
  live: boolean;
  viewers: Map<string, string>;  // viewerId (uuid) -> socketId
}
```

`RoomsService` guarda `Map<string, Room>` e recebe um relógio injetável (`now: () => number`) para os testes de expiração.

### Operações do `RoomsService`

| Método | Regra |
| --- | --- |
| `create()` | Gera `roomId` e `hostToken` (`randomBytes(9)` e `randomBytes(32)`, `base64url`). Se já houver `MAX_ROOMS`, lança erro que vira HTTP 503 |
| `get(roomId)` | Retorna a sala ou `undefined`. `roomId` fora do formato também retorna `undefined` |
| `verifyHost(roomId, token)` | Compara `sha256(token)` com `hostTokenHash` usando `timingSafeEqual` |
| `attachHost(roomId, socketId)` | Marca `hostEverJoined`, zera `hostDisconnectedAt`. Se já havia outro `hostSocketId`, devolve o anterior para o gateway expulsar |
| `detachHost(roomId, socketId)` | Só age se `socketId` for o atual. Define `hostSocketId = null`, `hostDisconnectedAt = now`, `live = false` |
| `setLive(roomId, live)` | Atualiza o flag |
| `addViewer(roomId, socketId)` | Falha com `ROOM_FULL` se `viewers.size >= MAX_VIEWERS_PER_ROOM`. Devolve `viewerId` novo (`randomUUID`) |
| `removeViewer(roomId, viewerId)` | Remove se existir |
| `end(roomId)` | Apaga a sala e devolve os `socketId` dos espectadores |
| `findExpired(now)` | Lista `{ roomId, reason }` com `reason` em `HOST_TIMEOUT` (anfitrião ausente além da tolerância), `EXPIRED` (idade máxima) ou `EXPIRED` (sala nunca usada além de `ROOM_UNUSED_TTL_MS`) |
| `summary(roomId)` | `{ live, viewerCount, maxViewers }` |

## REST

| Método e rota | Resposta | Observações |
| --- | --- | --- |
| `GET /api/health` | `200 { "status": "ok" }` | Usado pelo healthcheck do Docker |
| `POST /api/rooms` | `201 { "roomId", "hostToken" }` | Throttle: 10 por minuto por IP. `503 { "error": "SERVER_BUSY" }` se `MAX_ROOMS` foi atingido |
| `GET /api/rooms/:roomId` | `200 { "roomId", "live", "viewerCount", "maxViewers" }` ou `404 { "error": "ROOM_NOT_FOUND" }` | Não expõe o token nem dados de espectadores |

Os formatos de resposta vivem em `@app/shared` como schemas zod.

## Gateway de sinalização

Comportamento completo no documento do protocolo (`04-protocolo-sinalizacao.md`). Pontos de implementação:

- Opções do servidor Socket.IO: `maxHttpBufferSize: 65536`, verificação de origem via `allowRequest` contra `ALLOWED_ORIGINS`, CORS com a mesma lista. Configure no `main.ts` com um adaptador (`IoAdapter` customizado) lendo o `AppConfig`, porque os decorators são avaliados antes da configuração.
- Cada socket guarda `socket.data = { role: 'host' | 'viewer', roomId, viewerId? }` depois de um `join` bem-sucedido. Eventos que exigem papel conferem `socket.data` antes de qualquer coisa.
- Todo payload passa por `schema.safeParse`. Falhou: nos eventos com `ack`, responde `{ ok: false, error: 'INVALID_PAYLOAD' }`; nos demais, descarta em silêncio e registra em nível `debug` (sem conteúdo do payload).
- Limite de eventos por socket: contador por janela (`SOCKET_RATE_LIMIT_EVENTS` em `SOCKET_RATE_LIMIT_WINDOW_MS`). Ao estourar, desconecta o socket.
- Varredura: `setInterval(SWEEP_INTERVAL_MS)` iniciado em `onModuleInit`, com `unref()`, limpo em `onModuleDestroy`. Para cada sala expirada, emite `room:ended` aos espectadores, desconecta os sockets e apaga a sala.
- Quando um socket de espectador desconecta, remove o espectador e avisa o anfitrião com `viewer:left`.
- Quando o socket do anfitrião desconecta, chama `detachHost`, avisa os espectadores com `room:status { live: false }` e deixa a varredura decidir o encerramento depois da tolerância.

## Credenciais ICE (`IceService`)

Função pura `buildIceServers(config, now)`:

- Sempre inclui `{ urls: STUN_URLS }`.
- Se `TURN_URLS` e `TURN_SECRET` existem, inclui `{ urls: TURN_URLS, username, credential }` com:
  - `username = "<expiraEmEpochSegundos>:<id aleatório curto>"`, onde `expiraEmEpochSegundos = floor(now/1000) + TURN_CREDENTIAL_TTL_SECONDS`
  - `credential = base64( HMAC-SHA1( TURN_SECRET, username ) )`

Vetor de teste fixo (confira no teste unitário): segredo `test-secret`, usuário `1893456000:abcdef` resulta em `cLAZH1uPPVeiaiZEbOJx5kd0ySk=`.

A TTL é longa de propósito: o coturn revalida as credenciais ao renovar a alocação, então a credencial precisa durar mais que a transmissão.

## Logs

Use o `Logger` do Nest. Registre criação e encerramento de sala (com os 4 primeiros caracteres do `roomId`), entrada e saída de espectadores (contagem) e erros. **Nunca** registre SDP, candidatos ICE, `hostToken` ou `TURN_SECRET`.

## Testes

- **Unitários (Jest):** `RoomsService` (limites, expiração com relógio falso, comparação de token), `IceService` (vetor fixo e ausência de TURN), schemas de configuração.
- **Integração (Jest + `socket.io-client` + `supertest`):** sobe o app em porta aleatória e cobre os cenários listados na Fase 1.

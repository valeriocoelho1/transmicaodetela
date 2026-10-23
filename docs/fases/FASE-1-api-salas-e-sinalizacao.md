# Fase 1: API de salas e sinalização

## Objetivo

Backend completo do MVP: criar e consultar salas por REST, e um gateway Socket.IO que autentica o anfitrião, admite espectadores e repassa `offer`, `answer` e ICE. Tudo coberto por testes de integração que usam `socket.io-client` como se fosse um navegador. Ao fim desta fase, a API já faz tudo que o front vai precisar.

## Pré-requisitos

- Fase 0 concluída (`docs/PROGRESSO.md` marcado).
- Ler: `docs/arquitetura/02-backend.md`, `04-protocolo-sinalizacao.md` e `06-seguranca-e-limites.md`.

## Entra

- Schemas e tipos completos em `@app/shared`.
- Configuração validada, `RoomsService`, `IceService`, `RoomsController`, `SignalingGateway`, varredura de salas, limites e proteções.
- Testes unitários e de integração.

## Não entra

Qualquer código de front, Docker, TURN real (só a geração de credenciais), banco, Redis, senha de sala, chat.

## Tarefas

1. **`@app/shared`.** Implemente conforme `04-protocolo-sinalizacao.md`: constantes, schemas zod de todos os payloads, `ErrorCode`, `EndReason`, `Ack<T>`, schemas de resposta REST (`createRoomResponse`, `roomSummaryResponse`), e as interfaces `ClientToServerEvents` e `ServerToClientEvents` (tipam o Socket.IO nos dois lados). Testes Vitest: aceita payloads válidos, recusa `roomId` fora do formato, SDP grande demais, tipo errado de SDP, candidato malformado.
2. **Configuração.** Módulo próprio que lê `process.env`, valida com zod e exporta `AppConfig` sob o token `APP_CONFIG`. Variáveis e padrões em `02-backend.md`. Regras: `TURN_URLS` exige `TURN_SECRET`; em `production`, `ALLOWED_ORIGINS` e `TURN_SECRET` são obrigatórios. Teste unitário dos casos válidos e inválidos.
3. **`RoomsService`.** Todas as operações da tabela em `02-backend.md`, com relógio injetável. Testes unitários: criar, `MAX_ROOMS`, token certo e errado, anfitrião entra e sai, substituição de anfitrião, limite de espectadores, expiração por `HOST_TIMEOUT`, por inatividade inicial e por idade máxima (relógio falso).
4. **`IceService`.** `buildIceServers(config, now)` conforme `02-backend.md`. Testes: sem TURN devolve só STUN; com TURN devolve a entrada com `username` no formato `<expira>:<id>` e `credential` correta; o vetor fixo (segredo `test-secret`, usuário `1893456000:abcdef`, credencial `cLAZH1uPPVeiaiZEbOJx5kd0ySk=`) bate.
5. **REST.** `GET /api/health` (já existe), `POST /api/rooms` com `ThrottlerGuard` (10 por minuto por IP; respeite `TRUST_PROXY`) e `GET /api/rooms/:roomId`. Respostas validadas com os schemas de `@app/shared`. `503 { error: "SERVER_BUSY" }` quando `MAX_ROOMS` é atingido; `404 { error: "ROOM_NOT_FOUND" }` também para `roomId` fora do formato.
6. **`SignalingGateway`.**
   - Todos os eventos e regras de `04-protocolo-sinalizacao.md`.
   - Adaptador do Socket.IO configurado no `main.ts` a partir do `AppConfig`: `allowRequest` conferindo `Origin` contra `ALLOWED_ORIGINS`, CORS com a mesma lista, `maxHttpBufferSize: 65536`.
   - Papel e sala em `socket.data` depois do `join`; eventos conferem o papel antes de agir.
   - Limite de eventos por socket (`SOCKET_RATE_LIMIT_*`); ao estourar, desconecta.
   - Varredura periódica (`setInterval` com `unref`, iniciado em `onModuleInit`, limpo em `onModuleDestroy`) que encerra salas expiradas com `room:ended`, desconecta os espectadores e apaga a sala.
7. **`main.ts`.** `helmet`, prefixo `/api`, `trust proxy` conforme `TRUST_PROXY`, CORS conforme `ALLOWED_ORIGINS`, `enableShutdownHooks`.
8. **Logs.** Só o que a seção "Logs" de `02-backend.md` permite. Confira com `grep` que nada loga SDP, candidatos, token ou segredo.
9. **Testes de integração.** Suba o app em porta aleatória (`app.listen(0)`) e use `socket.io-client`. Cada teste cria a própria sala. Para os tempos (tolerância do anfitrião, inatividade, varredura), use valores pequenos pelo `AppConfig` do teste, por exemplo `ROOM_HOST_GRACE_MS=200` e `SWEEP_INTERVAL_MS=50`. Cenários obrigatórios:
   1. `POST /api/rooms` devolve 201 com o formato certo; `GET` devolve 200; `GET` de sala inexistente e de `roomId` inválido devolvem 404.
   2. A 11ª criação de sala no mesmo minuto devolve 429.
   3. `host:join` com token válido: `ack` ok com `iceServers` e `viewers: []`.
   4. `host:join` com token errado: `INVALID_TOKEN`. Com sala inexistente: `ROOM_NOT_FOUND`. Com payload inválido: `INVALID_PAYLOAD`.
   5. `viewer:join`: `ack` ok com `live: false`; o anfitrião recebe `viewer:joined`.
   6. Sala cheia (`MAX_VIEWERS_PER_ROOM=2`): o terceiro recebe `ROOM_FULL`.
   7. Handshake completo: `signal:offer` do anfitrião chega ao espectador; `signal:answer` chega ao anfitrião com o `viewerId` certo; `signal:ice` flui nos dois sentidos.
   8. Papéis: espectador emitindo `signal:offer`, `host:live` ou `host:end` não produz efeito (o anfitrião não recebe nada, a sala continua); anfitrião emitindo `signal:answer` é ignorado; oferta para `viewerId` inexistente não vai a ninguém.
   9. `host:live` true e false chega aos espectadores como `room:status`; um espectador que entra depois recebe `live` correto no `ack`.
   10. Espectador desconecta: o anfitrião recebe `viewer:left`.
   11. Anfitrião desconecta: espectadores recebem `room:status { live: false }`; passada a tolerância recebem `room:ended { reason: 'HOST_TIMEOUT' }` e `GET /api/rooms/:id` devolve 404.
   12. Anfitrião reconecta dentro da tolerância: a sala continua e o `ack` lista os espectadores atuais.
   13. `host:end`: espectadores recebem `room:ended { reason: 'HOST_ENDED' }` e a sala some.
   14. Dois `host:join` com o mesmo token: o primeiro recebe `room:host-replaced` e é desconectado.
   15. Origem não permitida: a conexão é recusada.
   16. Limite de eventos por socket estourado: o socket é desconectado.
   17. Sala em que o anfitrião nunca entrou some após `ROOM_UNUSED_TTL_MS`.
10. **Fechamento.** `pnpm typecheck`, `pnpm lint`, `pnpm test`; atualizar `docs/PROGRESSO.md`; commits.

## Critérios de aceite

- [ ] Os 17 cenários de integração existem e passam.
- [ ] Testes unitários de `RoomsService`, `IceService`, configuração e schemas passam.
- [ ] O vetor fixo de credencial TURN bate.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check` e `pnpm test` passam na raiz.
- [ ] Nenhum log contém SDP, candidato ICE, `hostToken` ou segredo.
- [ ] Reiniciar a API não deixa processos pendurados (timers com `unref`, `enableShutdownHooks`).
- [ ] `docs/PROGRESSO.md` atualizado.

## Verificação

```
pnpm build && pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @app/api dev    # em outro terminal:
curl -s -X POST http://localhost:3000/api/rooms
curl -s http://localhost:3000/api/rooms/ID_RETORNADO
```

Faça também uma conferência manual de uma troca real de eventos com um script curto de `socket.io-client` (pode ficar só no teste de integração, não precisa virar arquivo do projeto).

## Armadilhas conhecidas

- Nos testes, registre os ouvintes **antes** de emitir `host:join` e `viewer:join`; as mensagens podem chegar logo após o `ack`.
- Decorators de gateway são avaliados antes da configuração. Por isso as opções do servidor Socket.IO vêm de um adaptador criado no `main.ts` (e nos testes, pelo mesmo caminho).
- Para esperar eventos nos testes, crie um helper `waitForEvent(socket, nome, timeout)` em vez de `setTimeout` fixo.
- `ThrottlerModule` conta por IP; atrás do Caddy o IP real depende de `TRUST_PROXY=1`.
- O `viewerId` repassado ao anfitrião vem de `socket.data`, nunca do payload do espectador.

## Prompt para o Claude Code

````text
Execute a Fase 1 (API de salas e sinalização) do projeto.

Leitura obrigatória, nesta ordem: CLAUDE.md; docs/PROMPT-MESTRE.md; docs/stack.md; docs/arquitetura/02-backend.md; docs/arquitetura/04-protocolo-sinalizacao.md; docs/arquitetura/06-seguranca-e-limites.md; docs/fases/FASE-1-api-salas-e-sinalizacao.md. Confirme em docs/PROGRESSO.md que a Fase 0 está concluída.

O que entregar (detalhes na seção "Tarefas" do arquivo da fase; execute todas):
- @app/shared com todos os schemas zod, ErrorCode, EndReason, Ack, schemas de resposta REST e as interfaces ClientToServerEvents e ServerToClientEvents, com testes Vitest.
- Configuração própria validada com zod (token APP_CONFIG), com as variáveis e padrões de docs/arquitetura/02-backend.md.
- RoomsService em memória com relógio injetável (token comparado por sha256 + timingSafeEqual, limites, expiração).
- IceService com buildIceServers (STUN sempre; TURN com credencial temporária HMAC-SHA1). O vetor de teste deve bater: segredo "test-secret", usuário "1893456000:abcdef" => "cLAZH1uPPVeiaiZEbOJx5kd0ySk=".
- REST: POST /api/rooms (10/min por IP, 503 SERVER_BUSY), GET /api/rooms/:roomId (404 também para formato inválido), GET /api/health.
- SignalingGateway (Socket.IO) com todos os eventos, papéis em socket.data, validação zod de todo payload, origem conferida (allowRequest), maxHttpBufferSize 64 KB, limite de eventos por socket, varredura periódica de salas expiradas, substituição de anfitrião, tolerância de reconexão do anfitrião.
- main.ts com helmet, prefixo /api, trust proxy, CORS e shutdown hooks.
- Os 17 cenários de teste de integração listados na tarefa 9 do arquivo da fase, usando socket.io-client e valores de tempo pequenos.

Regras: sem código de front, sem Docker, sem banco, sem Redis, sem senha de sala, sem chat; só dependências de docs/stack.md (confirme com pnpm view antes de instalar); não invente nomes; nunca logue SDP, candidatos ICE, hostToken ou segredo TURN; o viewerId repassado ao anfitrião vem do servidor.

Como trabalhar: escreva um plano de 5 a 8 linhas e siga em frente sem esperar resposta. Commits pequenos (Conventional Commits, em inglês). Rode TODA a seção "Verificação" e corrija o que falhar. Use um helper waitForEvent nos testes em vez de sleeps fixos. Não declare sucesso sem ver pnpm typecheck, pnpm lint, pnpm format:check e pnpm test passando.

Ao terminar: atualize docs/PROGRESSO.md e entregue o relatório (o que foi feito; comandos executados e resultado real; o que não pôde ser verificado; decisões; placeholders pendentes). Depois PARE e espere eu escrever "continuar".
````

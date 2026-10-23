# Arquitetura, parte 1: visão geral

## O que o sistema faz

1. O **anfitrião** abre o site e clica em "Criar sala". Recebe um link.
2. Ele clica em "Compartilhar tela" e escolhe tela, janela ou aba no seletor do navegador.
3. Envia o link a quem quiser.
4. Cada **espectador** abre o link e vê a transmissão. Sem login, sem instalar nada.

## Dois planos

O sistema tem dois caminhos separados. Entender essa divisão é entender o projeto.

- **Plano de controle (sinalização).** Pequenas mensagens JSON entre navegadores e a API: criar sala, entrar, `offer`, `answer`, candidatos ICE. Passa pela API.
- **Plano de mídia.** Vídeo e áudio em tempo real. Vai **direto do navegador do anfitrião para cada navegador de espectador**, via WebRTC. Nunca passa pela API. Quando o caminho direto é impossível (NAT rígido, rede corporativa), o tráfego passa pelo coturn (relay).

```
                      +-----------------------------+
                      |  API (NestJS)               |
                      |  - REST: criar/consultar    |
   REST + Socket.IO   |  - Socket.IO: sinalização   |   REST + Socket.IO
   +----------------->|  - salas em memória         |<-----------------+
   |                  +-----------------------------+                  |
   |                                                                   |
+--+-------------+                                         +-----------+----+
|  Anfitrião     |===== vídeo + áudio (WebRTC, SRTP) ======|  Espectador 1  |
|  (navegador)   |   uma conexão por espectador            |  (navegador)   |
|                |==========================+              +----------------+
+--+-------------+                          |              +----------------+
   |                                        +==============|  Espectador N  |
   |                                                       |  (navegador)   |
   |            +-----------------------------+            +-----------+----+
   +----------->|  coturn (STUN + TURN)       |<--------------------------+
     descobrir  |  STUN: "qual é meu IP?"     |   relay só quando o
     caminho    |  TURN: repassa se P2P falha |   caminho direto falha
                +-----------------------------+
```

Legenda: `---` sinalização e controle; `===` mídia.

## Componentes

| Componente | Responsabilidade | Não faz |
| --- | --- | --- |
| Navegador do anfitrião | Captura a tela, cria uma `RTCPeerConnection` por espectador, envia vídeo e áudio | Não aceita conexões de entrada sem passar pela sinalização |
| Navegador do espectador | Entra na sala, responde à oferta, exibe o vídeo | Não envia vídeo |
| API | Cria e guarda salas, autentica o anfitrião, repassa SDP e ICE, controla limites e expiração | Não toca em vídeo, não guarda nada em disco |
| coturn | STUN e TURN com credenciais temporárias | Não conhece salas |
| Caddy (produção) | HTTPS, serve o site, encaminha `/api` e `/socket.io` para a API | Não faz lógica de negócio |

## Fluxos principais

### 1. Criar sala

```
Anfitrião                     API
   | POST /api/rooms           |
   |-------------------------->|  gera roomId e hostToken
   |<-- { roomId, hostToken } -|
   | guarda hostToken no localStorage
   | navega para /host/:roomId |
```

### 2. Começar a transmitir

```
Anfitrião (navegador)                         API
   | Socket.IO conecta                         |
   | host:join { roomId, hostToken } --------->|  valida token
   |<-- ack { iceServers, viewers, maxViewers }|
   | usuário clica em "Compartilhar tela"      |
   | getDisplayMedia() -> MediaStream          |
   | host:live { live: true } ---------------->|  avisa espectadores: room:status
   | para cada espectador: cria PC e oferta    |
```

### 3. Espectador entra

```
Espectador                    API                         Anfitrião
   | viewer:join { roomId } -->|                              |
   |<-- ack { viewerId, ... }  |                              |
   |                           | viewer:joined { viewerId } ->|
   |                           |                              | cria PC, addTrack
   |                           |<-- signal:offer { viewerId } |
   |<-- signal:offer { sdp } --|                              |
   | cria PC, setRemote, answer|                              |
   | signal:answer { sdp } --->|-- signal:answer { viewerId } >|
   |<== candidatos ICE nos dois sentidos (signal:ice) ========>|
   |<=============== vídeo e áudio direto =====================|
```

Detalhes e regras no documento do protocolo (`04-protocolo-sinalizacao.md`).

### 4. Encerrar

- O anfitrião clica em "Parar transmissão": `host:live { live: false }`. A sala continua; espectadores veem "Aguardando".
- O anfitrião clica em "Encerrar sala": `host:end`. A sala é apagada e os espectadores recebem `room:ended`.
- O anfitrião fecha a aba: a API espera 60 segundos (padrão) pelo retorno. Sem retorno, a sala é encerrada.

## Limites do P2P (por que o MVP é pequeno)

O anfitrião envia **uma cópia do vídeo por espectador**. Com bitrate de 2 Mbps por espectador, 5 espectadores pedem cerca de 10 Mbps de upload do anfitrião. Por isso o padrão é `MAX_VIEWERS_PER_ROOM=5`. Passar disso exige um SFU, que está fora do MVP e pode ser acrescentado depois sem mudar a API de salas.

## Topologias de execução

- **Desenvolvimento:** `pnpm dev` sobe a API (3000) e o Vite (5173). O Vite faz proxy de `/api` e `/socket.io` para a API. Só STUN público do Google. Funciona em `localhost` sem HTTPS.
- **Produção:** uma VM com Docker Compose: `web` (Caddy com os arquivos estáticos), `api` e `coturn`. Detalhes em `05-infraestrutura.md`.

## Mapa dos documentos

| Arquivo | Assunto |
| --- | --- |
| `01-visao-geral.md` | Este arquivo |
| `02-backend.md` | API: módulos, estado, REST, configuração |
| `03-frontend.md` | Telas, estados, captura e WebRTC no navegador |
| `04-protocolo-sinalizacao.md` | Eventos, payloads, regras e erros |
| `05-infraestrutura.md` | Docker, Caddy, coturn, portas, variáveis |
| `06-seguranca-e-limites.md` | Ameaças, controles e limites |

# Prompt mestre

Este é o prompt completo do projeto. Cole-o no Claude Code, na raiz do repositório, **depois** de copiar `CLAUDE.md` e a pasta `docs/` para lá. Ele funciona sozinho, mas os arquivos de `docs/` detalham cada ponto e, em caso de conflito, **os arquivos de `docs/` valem mais que este texto**.

Por padrão o Claude Code para ao fim de cada fase e espera você escrever `continuar`. Para rodar sem paradas, apague a linha marcada com `[PARADA]` na seção 10.

Se preferir conduzir fase por fase, use os prompts individuais em `docs/fases/` e deixe este arquivo só como referência.

````text
Você é o engenheiro responsável por construir, do zero, o MVP descrito abaixo. Trabalhe de forma autônoma, uma fase por vez, e confirme com comandos reais tudo que afirmar.

Se os arquivos CLAUDE.md e docs/ já existem neste repositório, leia CLAUDE.md agora e trate os arquivos de docs/ como especificação detalhada (em conflito com este texto, docs/ vale mais). Se não existem, crie um CLAUDE.md com as seções 2, 3 e 10 deste texto e siga o restante como especificação.

==================================================
1. O QUE CONSTRUIR
==================================================
Um site para transmitir a tela do computador por link.

- Uma pessoa (anfitrião) abre o site, clica em "Criar sala" e recebe um link.
- Ela clica em "Compartilhar tela", escolhe tela, janela ou aba no seletor do navegador e envia o link a quem quiser.
- Qualquer pessoa com o link (espectador) abre no navegador e assiste, sem login e sem instalar nada.
- O vídeo vai por WebRTC, direto do navegador do anfitrião para o de cada espectador (P2P). A API faz só a sinalização. Quando o caminho direto falha, o tráfego passa por um servidor TURN (coturn).
- Em produção: uma VM com Docker Compose (Caddy com HTTPS, API e coturn).

Este é o MVP básico e funcional. Nada além do que está descrito aqui.

==================================================
2. REGRAS INEGOCIÁVEIS
==================================================
1. Não invente nomes. Nada de nome de produto, marca, domínio, e-mail, URL, pacote ou serviço que você não possa confirmar que existe. Onde faltar um valor, use um placeholder em MAIÚSCULAS (por exemplo SEU_DOMINIO) e liste os placeholders ao final de cada fase. Os pacotes do workspace usam o escopo neutro @app (@app/shared, @app/api, @app/web, @app/e2e).
2. Não adicione funcionalidades fora do escopo (seção 3). Se achar que algo é necessário, pergunte.
3. Use só as dependências da seção 4. Confirme que cada pacote existe antes de instalar (pnpm view NOME version). Instale as versões estáveis mais recentes com pnpm add; não digite números de versão de memória.
4. Nunca escreva segredos no repositório. .env fica no .gitignore; .env.example só tem placeholders.
5. Verifique de verdade. Só diga que algo funciona se você executou e viu passar. Se não conseguiu executar (por exemplo, Docker ausente), diga isso explicitamente.
6. Código simples e tipado (TypeScript estrito). Sem abstração que o MVP não exige. Sem comentários que repetem o código.
7. Idiomas: interface em português do Brasil; código, nomes de arquivos, identificadores, comentários e commits (Conventional Commits) em inglês; documentação em português.
8. Nunca logue SDP, candidatos ICE, hostToken ou segredo TURN.

==================================================
3. ESCOPO
==================================================
DENTRO do MVP:
- Criar sala, gerar link, compartilhar tela (com áudio quando o navegador permitir), assistir pelo link sem login.
- Contador de espectadores para o anfitrião. Parar transmissão e encerrar sala.
- Limite de espectadores por sala (padrão 5) e de salas no servidor (padrão 50).
- Reconexão do anfitrião dentro de 60 segundos sem perder a sala.
- STUN/TURN com credenciais temporárias, HTTPS automático e deploy por Docker Compose.
- Testes unitários, de integração e e2e (Playwright com captura de tela simulada).

FORA do MVP (proibido): senha de sala, chat, contas e login, banco de dados, Redis, SFU (LiveKit, mediasoup, Janus), gravação, aplicativo desktop, anfitrião no celular, mais de um anfitrião por sala, painel de métricas, perfis de qualidade escolhidos pelo usuário, outros idiomas, analytics, TURN sobre TLS na 443, CI/CD.

==================================================
4. STACK
==================================================
- Monorepo pnpm, TypeScript estrito, Node.js LTS vigente (fixe a major em .nvmrc e nos Dockerfiles).
- packages/shared (@app/shared): zod + tsup (saída ESM + CJS + tipos). Contém os schemas e tipos dos eventos e das respostas REST.
- apps/api (@app/api): NestJS (Express), Socket.IO via @nestjs/websockets e @nestjs/platform-socket.io, @nestjs/throttler, helmet. Configuração própria validada com zod (sem @nestjs/config). Testes com Jest, @nestjs/testing, supertest e socket.io-client. Estado das salas em memória.
- apps/web (@app/web): React, Vite, React Router, socket.io-client, CSS simples (sem biblioteca de UI). WebRTC com as APIs nativas. Testes com Vitest.
- e2e (@app/e2e): Playwright.
- Produção: Docker Compose com Caddy 2 (HTTPS, estáticos, proxy), API e coturn (imagem coturn/coturn).
- Qualidade: ESLint (flat config) com typescript-eslint, e Prettier.
- IDs e tokens: node:crypto (randomBytes). Não use nanoid.
- Proibido: banco/ORM, Redis, Tailwind, gerenciador de estado global, Next.js, simple-peer ou outra lib de WebRTC.

==================================================
5. ARQUITETURA
==================================================
Dois planos:
- Controle: mensagens JSON (criar sala, entrar, offer, answer, ICE) entre navegadores e API.
- Mídia: vídeo e áudio direto do anfitrião para cada espectador (uma RTCPeerConnection por espectador, só envio). Nunca passa pela API.

Invariantes:
- O anfitrião é sempre quem cria a oferta. O espectador só responde.
- Só o anfitrião (socket que fez host:join com hostToken válido) pode emitir signal:offer, host:live e host:end.
- Todo payload (REST e WebSocket) é validado com os schemas zod de @app/shared. Inválido: ack { ok:false, error:"INVALID_PAYLOAD" } nos eventos com ack; descarte silencioso nos demais. Nunca derruba o servidor.
- roomId = 12 caracteres base64url de randomBytes(9). hostToken = base64url de randomBytes(32). A API guarda só o sha256 do token e compara com timingSafeEqual.
- hostToken fica apenas no localStorage do anfitrião (chave host-token:<roomId>), nunca na URL.
- Salas só em memória. Reiniciar a API encerra todas.

REST (prefixo /api):
- GET /api/health -> 200 { status: "ok" }
- POST /api/rooms -> 201 { roomId, hostToken }. Limite 10/min por IP. 503 { error: "SERVER_BUSY" } se MAX_ROOMS atingido.
- GET /api/rooms/:roomId -> 200 { roomId, live, viewerCount, maxViewers } ou 404 { error: "ROOM_NOT_FOUND" }.

Socket.IO (caminho padrão /socket.io):
Cliente -> servidor:
- host:join { roomId, hostToken } -> ack { ok:true, iceServers, viewers:[viewerId], maxViewers } | { ok:false, error }
- host:live { live:boolean }
- host:end
- viewer:join { roomId } -> ack { ok:true, viewerId, iceServers, live } | { ok:false, error }
- signal:offer { viewerId, sdp }            (só anfitrião)
- signal:answer { sdp }                     (só espectador)
- signal:ice { viewerId, candidate } (anfitrião) | { candidate } (espectador)
Servidor -> cliente:
- Para o anfitrião: viewer:joined { viewerId }, viewer:left { viewerId }, signal:answer { viewerId, sdp }, signal:ice { viewerId, candidate }, room:host-replaced
- Para espectadores: room:status { live }, signal:offer { sdp }, signal:ice { candidate }, room:ended { reason: HOST_ENDED | HOST_TIMEOUT | EXPIRED }
Códigos de erro: ROOM_NOT_FOUND, INVALID_TOKEN, ROOM_FULL, INVALID_PAYLOAD.

Regras do servidor:
- host:join com token válido substitui um anfitrião já conectado (o antigo recebe room:host-replaced e é desconectado).
- Anfitrião desconecta: live=false, room:status { live:false } aos espectadores, sala mantida por ROOM_HOST_GRACE_MS (60000). Se não voltar, room:ended HOST_TIMEOUT e a sala é apagada.
- Sala em que o anfitrião nunca entrou é apagada após ROOM_UNUSED_TTL_MS (15 min). Idade máxima ROOM_MAX_AGE_MS (12 h), motivo EXPIRED. Varredura a cada SWEEP_INTERVAL_MS (30 s).
- Origem do handshake conferida contra ALLOWED_ORIGINS. maxHttpBufferSize 64 KB. Limite de 300 eventos por socket a cada 10 s (estourou, desconecta).
- O servidor, nunca o cliente, informa o viewerId do remetente nos eventos repassados ao anfitrião.

Regras do cliente:
- Registre os ouvintes de eventos ANTES de emitir host:join/viewer:join.
- Candidatos ICE que chegam antes do setRemoteDescription vão para uma fila e são aplicados depois.
- Ignore onicecandidate com candidate nulo.
- A cada connect do socket (inclusive reconexão) refaça o join. Anfitrião: depois de reconectar, reconstrua todos os peers e reemita host:live { live:true } se ainda transmite.
- Espectador que recebe nova oferta fecha o peer antigo e cria outro.
- Ordem de criação do peer no anfitrião: new RTCPeerConnection({iceServers}); addTrack de cada track; getParameters/setParameters no sender de vídeo (maxBitrate 2_000_000, maxFramerate 30); onicecandidate; createOffer; setLocalDescription; emitir signal:offer.
- Captura: getDisplayMedia a partir de clique, video com frameRate ideal/máx 30, audio:true, dicas selfBrowserSurface:"exclude", surfaceSwitching:"include", systemAudio:"include". videoTrack.contentHint = "detail". Evento "ended" da track = parar a transmissão. Avise o anfitrião se não houver faixa de áudio.
- Espectador: <video autoplay playsinline muted>, botão para ativar som, botão de tela cheia, aviso quando não há áudio.

Credenciais ICE: sempre STUN_URLS. Se TURN_URLS e TURN_SECRET existem, adicionar TURN com username "<expiraEmEpochSegundos>:<id aleatório>" e credential = base64(HMAC-SHA1(TURN_SECRET, username)), validade TURN_CREDENTIAL_TTL_SECONDS (43200). Vetor de teste: segredo "test-secret" e usuário "1893456000:abcdef" dão "cLAZH1uPPVeiaiZEbOJx5kd0ySk=".

==================================================
6. ESTRUTURA DO REPOSITÓRIO
==================================================
CLAUDE.md, README.md, package.json, pnpm-workspace.yaml, tsconfig.base.json, eslint.config.js, .prettierrc, .editorconfig, .gitignore, .nvmrc, .env.example, docker-compose.prod.yml
apps/api, apps/web, packages/shared, e2e, deploy (Caddyfile), docs

Scripts na raiz: dev, build, typecheck, lint, format, format:check, test (sem e2e), test:e2e.
pnpm dev deve construir @app/shared uma vez e então rodar shared (watch), API (3000) e web (5173) em paralelo. O Vite faz proxy de /api e /socket.io (ws:true) para a API.

==================================================
7. CONFIGURAÇÃO DA API (variáveis, todas com padrão exceto as marcadas)
==================================================
NODE_ENV, PORT=3000, ALLOWED_ORIGINS=http://localhost:5173 (obrigatória em produção), TRUST_PROXY=0, MAX_VIEWERS_PER_ROOM=5, MAX_ROOMS=50, ROOM_HOST_GRACE_MS=60000, ROOM_UNUSED_TTL_MS=900000, ROOM_MAX_AGE_MS=43200000, SWEEP_INTERVAL_MS=30000, STUN_URLS=stun:stun.l.google.com:19302, TURN_URLS (opcional, lista), TURN_SECRET (obrigatória se TURN_URLS existir e em produção), TURN_CREDENTIAL_TTL_SECONDS=43200, SOCKET_RATE_LIMIT_EVENTS=300, SOCKET_RATE_LIMIT_WINDOW_MS=10000.
Validar com zod no start; falhar cedo com mensagem clara.

==================================================
8. INTERFACE (português do Brasil)
==================================================
Rotas: / (criar sala), /host/:roomId (anfitrião), /r/:roomId (espectador), * (não encontrada).
Estados do anfitrião: connecting, forbidden, not_found, ready, starting, live, reconnecting, ended.
Estados do espectador: connecting, not_found, full, waiting, watching, reconnecting, failed, ended.
Textos exatos em docs/arquitetura/03-frontend.md. A tela inicial avisa que anfitrião e espectadores podem ver o IP uns dos outros. Sem nome de produto: o título é "Compartilhar tela". CSS simples, tema claro/escuro por prefers-color-scheme, funciona a partir de 360 px.

==================================================
9. FASES (detalhes em docs/fases/)
==================================================
Fase 0 - Fundação: monorepo, tooling, shared/api/web mínimos, GET /api/health ponta a ponta, scripts da raiz. Aceite: pnpm install, dev, build, typecheck, lint, test passam; a página inicial mostra o status da API lido pelo proxy.
Fase 1 - API de salas e sinalização: schemas completos em @app/shared, configuração, RoomsService, IceService, REST, gateway Socket.IO, varredura, limites. Aceite: testes de integração cobrindo handshake completo, papéis, sala cheia, desconexão e retorno do anfitrião, encerramento, substituição de anfitrião, origem não permitida e limite de eventos.
Fase 2 - Transmissão no navegador: telas, hooks, HostBroadcaster, ViewerReceiver, captura, textos, estilo; e2e com Playwright usando getDisplayMedia simulado por canvas.captureStream. Aceite: e2e passam (viewer antes e depois da live, sala cheia, sala inexistente, parar e retomar, encerrar).
Fase 3 - Internet: Dockerfiles, Caddyfile, docker-compose.prod.yml, coturn com credenciais temporárias, .env.example de produção. Aceite: compose valida, imagens constroem, stack sobe localmente com DOMAIN=localhost e /api/health responde por HTTPS. O deploy real na VM é feito por mim (guia à parte).
Fase 4 - Endurecimento e entrega: checklist de segurança, e2e extras (recarregar anfitrião, timeout), README final, auditoria de dependências, verificação completa e tag v0.1.0.

==================================================
10. COMO TRABALHAR
==================================================
Para cada fase:
a) Leia o arquivo da fase em docs/fases/ (se existir) e os docs de arquitetura relacionados.
b) Escreva um plano de 5 a 8 linhas (o que vai fazer, o que NÃO vai fazer, dependências a instalar) e siga em frente sem esperar resposta, salvo decisão que dependa de mim.
c) Implemente em commits pequenos (Conventional Commits, em inglês).
d) Rode as verificações da fase e corrija o que falhar. Não declare sucesso sem ver os comandos passando.
e) Atualize docs/PROGRESSO.md (status, decisões, placeholders pendentes, o que não foi possível verificar).
f) Entregue o relatório: o que foi feito; comandos executados e resultado real; o que não pôde ser verificado; decisões tomadas; placeholders pendentes; o que eu preciso fazer por fora (se houver).
g) [PARADA] Pare e espere eu escrever "continuar" antes de começar a fase seguinte.

Se um passo falhar duas vezes pelo mesmo motivo, pare, explique a causa provável e proponha o menor ajuste, em vez de repetir tentativas.

Comece agora pela Fase 0.
````

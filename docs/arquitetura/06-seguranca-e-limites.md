# Arquitetura, parte 6: segurança e limites

O MVP não tem contas nem senha de sala: **quem tem o link, entra**. A segurança vem de links imprevisíveis, de um anfitrião autenticado por token e de limites que impedem abuso básico.

## Ameaças e controles

| Ameaça | Controle |
| --- | --- |
| Adivinhar o `roomId` | 12 caracteres `base64url` de `randomBytes(9)` (72 bits). Não existe rota que liste salas. Sala inexistente e sala encerrada respondem igual (`ROOM_NOT_FOUND`) |
| Roubo do `hostToken` | Fica só no `localStorage` do anfitrião, nunca na URL nem em log. A API guarda apenas o `sha256`. Comparação com `timingSafeEqual`. Tudo sobre HTTPS em produção |
| Espectador se passando por anfitrião | Papel gravado em `socket.data` após o `join`. Cada evento confere o papel. O `viewerId` do remetente vem do servidor, nunca do cliente |
| Criação em massa de salas | `POST /api/rooms` com limite de 10 por minuto por IP. `MAX_ROOMS` global. Salas expiram (nunca usada: 15 min; sem anfitrião: 60 s; idade máxima: 12 h) |
| Payload gigante ou malformado | `maxHttpBufferSize` de 64 KB, schemas zod com tamanhos máximos, limite de eventos por socket |
| Sequestro de WebSocket entre sites | Verificação de `Origin` em `allowRequest` contra `ALLOWED_ORIGINS` |
| Muitos sockets de um só lugar (ocupar as vagas de uma sala, esgotar a API) | No máximo `MAX_SOCKETS_PER_IP` sockets simultâneos por endereço do cliente, contado pelo `X-Forwarded-For` que o Caddy acrescenta |
| coturn usado como relay aberto | Credenciais temporárias (HMAC com segredo compartilhado), `--denied-peer-ip` para faixas privadas, cotas por usuário e totais, sem relay TCP (`--no-tcp-relay`), banda por sessão limitada (`--max-bps`), faixas IPv6 privadas negadas, sem CLI |
| Segredos no repositório | `.env` no `.gitignore`. `.env.example` só com placeholders. `TURN_SECRET` só por variável de ambiente |
| XSS | React escapa texto. Não usar `dangerouslySetInnerHTML`. A interface não renderiza texto vindo de outros usuários. `Content-Security-Policy` no Caddy só aceita script, estilo e conexões da própria origem |
| Rebaixamento para HTTP | `Strict-Transport-Security` no Caddy, além do redirecionamento para HTTPS |
| Clickjacking | `X-Frame-Options: DENY` no Caddy |
| Acesso indevido a recursos do navegador | `Permissions-Policy` libera só a captura de tela; câmera, microfone e localização ficam negados. `Cross-Origin-Opener-Policy: same-origin` isola a janela de páginas de outras origens |
| Roubo da vaga de um espectador | O `resumeToken` (32 bytes de `randomBytes`) fica só na memória da página, nunca na URL nem em log, e é trocado a cada retomada. A API guarda apenas o `sha256` e compara com `timingSafeEqual`. A vaga guardada expira em `VIEWER_GRACE_MS` |
| Vazamento de dados em log | Proibido logar SDP, candidatos ICE, `hostToken`, `resumeToken` e `TURN_SECRET` |
| Contêiner com privilégio demais | API roda com usuário não root e sistema de arquivos somente leitura. Todos os serviços com `no-new-privileges`, `cap_drop: ALL` (o Caddy só com `NET_BIND_SERVICE`) e limites de memória e processos |

## O que o P2P expõe (aviso ao usuário)

Em WebRTC direto, as duas pontas trocam candidatos ICE, que contêm endereços IP. Na prática, **o anfitrião e os espectadores podem ver o endereço IP uns dos outros**. A tela inicial deve avisar isso em uma frase: "A transmissão é direta entre navegadores: o anfitrião e os espectadores podem ver o endereço IP uns dos outros."

## Limites padrão

| Limite | Valor | Onde |
| --- | --- | --- |
| Espectadores por sala | 5 | `MAX_VIEWERS_PER_ROOM` |
| Salas simultâneas | 50 | `MAX_ROOMS` |
| Criação de sala | 10 por minuto por IP | `ThrottlerModule` |
| Sala sem anfitrião | 60 s de tolerância | `ROOM_HOST_GRACE_MS` |
| Sala nunca usada | 15 min | `ROOM_UNUSED_TTL_MS` |
| Idade máxima da sala | 12 h | `ROOM_MAX_AGE_MS` |
| Tamanho de mensagem do socket | 64 KB | `maxHttpBufferSize` |
| Eventos por socket | 300 a cada 10 s | `SOCKET_RATE_LIMIT_*` |
| Sockets por endereço | 20 simultâneos | `MAX_SOCKETS_PER_IP` |
| Banda por sessão TURN | ~3 Mbps em cada sentido | `--max-bps` do coturn |
| Bitrate de vídeo por espectador | 2 Mbps | `VIDEO_MAX_BITRATE_BPS` |
| Credencial TURN | 12 h | `TURN_CREDENTIAL_TTL_SECONDS` |

## O que o MVP não protege

- Não há moderação nem denúncia. Quem tem o link transmite o que quiser. Para um projeto de estudo, não divulgue o endereço publicamente.
- Não há senha. Se o link vazar, qualquer pessoa assiste (até o limite da sala).
- Não há proteção contra ataque volumétrico além dos limites acima e do firewall da nuvem.
- Os registros do servidor podem conter endereços IP (do Caddy e do coturn). Mantenha a rotação de logs ativa e não guarde logs por tempo indefinido.
- Isto não é aconselhamento jurídico. Se o site for público, avalie termos de uso e política de privacidade.

## Checklist de segurança (Fase 4)

- [ ] `.env` fora do git e `git log` sem segredo (`git log -p | grep -i secret` sem achados relevantes).
- [ ] `ALLOWED_ORIGINS` explícito em produção.
- [ ] Teste: socket de origem não permitida é recusado.
- [ ] Teste: espectador não consegue emitir `signal:offer`, `host:live` nem `host:end`.
- [ ] Teste: `hostToken` errado é recusado.
- [ ] Teste: payload inválido não derruba o servidor.
- [ ] Nenhum log com SDP, ICE, token ou segredo.
- [ ] `pnpm audit` revisado.
- [ ] Contêiner da API roda sem root.
- [ ] Portas abertas na nuvem conferem com a tabela de `05-infraestrutura.md`.

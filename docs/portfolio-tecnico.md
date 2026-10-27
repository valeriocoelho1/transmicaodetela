# Portfólio técnico do projeto

Resumo do trabalho técnico feito neste projeto (transmissão de tela por link, WebRTC P2P), organizado para servir de base em entrevistas: o que foi construído, com quais tecnologias, e quais problemas reais foram resolvidos. Todo o conteúdo abaixo reflete o que está de fato implementado e verificado no repositório (ver `docs/PROGRESSO.md` para o detalhe de cada verificação).

## 1. O que é o projeto, em uma frase

Um site onde uma pessoa (anfitrião) compartilha a tela do navegador e qualquer pessoa com o link (espectador) assiste em tempo real, sem login, com o vídeo trafegando direto entre os navegadores (WebRTC P2P) — o servidor só combina a conexão, nunca vê o vídeo.

Isso é a frase que resume o produto. Em entrevista, é o "elevator pitch"; o resto deste documento é material de apoio para aprofundar quando perguntarem "como você fez isso".

## 2. Stack e por que cada peça foi escolhida

| Camada | Tecnologia | Versão (neste projeto) |
| --- | --- | --- |
| Linguagem | TypeScript, `strict: true` | ~6.0.3 |
| Monorepo | pnpm workspaces | 12.15.0 |
| Contrato compartilhado | zod (schemas e tipos) + tsup (build ESM+CJS+`.d.ts`) | zod ^4.6, tsup ^9 |
| Backend | NestJS (Express) + Socket.IO | Nest ^12.2, socket.io ^4.8 |
| Frontend | React 19 + Vite + React Router | React ^19.3, Vite ^8.3, react-router ^8.5 |
| Mídia em tempo real | WebRTC nativo do navegador (`getDisplayMedia`, `RTCPeerConnection`, `RTCRtpSender`) | APIs do navegador, sem lib de terceiros |
| STUN/TURN | coturn (imagem oficial) | `coturn/coturn:4.18.0-r0` |
| Proxy/HTTPS | Caddy 2 | `caddy:2-alpine` |
| Infra | Docker + Docker Compose, multi-stage build | `node:24-alpine` |
| Testes | Jest (API), Vitest (shared/web), Playwright (e2e) | Jest ^30, Vitest ^5, Playwright ^1.64 |
| Qualidade | ESLint flat config + typescript-eslint + Prettier | — |

Pontos que dão bom assunto de entrevista:

- **Por que P2P e não SFU (LiveKit/mediasoup):** decisão consciente de escopo — P2P é mais simples de implementar e operar (sem servidor de mídia), ao custo de o upload do anfitrião crescer linearmente com o número de espectadores. Mitigado com um limite de sala (10 espectadores por padrão). Saber articular esse trade-off (simplicidade operacional vs. escalabilidade) é um ótimo tópico de "arquitetura" em entrevista.
- **Monorepo com pacote compartilhado de contrato (`@app/shared`):** os mesmos schemas zod validam e tipam o payload tanto no NestJS (CJS) quanto no React (ESM). Single source of truth entre backend e frontend, com build dual (ESM/CJS) via `tsup` para servir os dois consumidores a partir do mesmo código-fonte.
- **NestJS escrito à mão, sem scaffold do CLI:** módulo, controller e `configure-app.ts` (prefixo `/api`) foram escritos manualmente e compartilhados entre `main.ts` e os testes de integração — mostra entendimento da estrutura do framework além do "gerador de código".

## 3. Arquitetura do sistema WebRTC (o núcleo técnico do projeto)

Esse é o assunto mais rico tecnicamente do projeto — vale a pena ter os detalhes na ponta da língua.

### 3.1 Separação sinalização vs. mídia

- A API **nunca** vê o vídeo. Ela só troca metadados de conexão (SDP e candidatos ICE) via Socket.IO — o chamado protocolo de sinalização de WebRTC.
- O vídeo (RTP/SRTP) vai direto entre os navegadores; o servidor STUN/TURN (coturn) só entra em cena quando a conexão direta falha (NAT simétrico, firewalls restritivos), fazendo relay de pacotes já cifrados.
- Isso é uma demonstração prática de entender a arquitetura do WebRTC: ICE (Interactive Connectivity Establishment), negociação SDP (offer/answer), e o papel de STUN (descobrir o IP público) vs. TURN (relay quando o P2P não é possível).

### 3.2 Protocolo de sinalização projetado do zero

Protocolo próprio sobre Socket.IO, documentado em `docs/arquitetura/04-protocolo-sinalizacao.md`, com eventos tipados ponta a ponta (`host:join`, `viewer:join`, `signal:offer`, `signal:answer`, `signal:ice`, `room:status`, `room:ended`…), cada um com um schema zod. Decisões de design que valem citar:

- **Anfitrião é sempre quem oferta ("offer"); o espectador só responde ("answer").** Regra fixa que evita colisão de ofertas (problema clássico de WebRTC quando os dois lados tentam negociar ao mesmo tempo, o chamado "glare").
- **Fila de candidatos ICE:** candidatos que chegam antes do `setRemoteDescription` (ordem de rede não é garantida) são colocados numa fila e aplicados depois, em vez de descartados ou de causar erro.
- **`viewerId` nunca vem do cliente**, só do servidor — impede um espectador de se passar por outro ao assinar mensagens.
- **Reconstrução de peers em reconexão:** se o socket do anfitrião cai e volta (troca de rede, aba em segundo plano), ele reconstrói todas as conexões peer e reemite o estado "ao vivo", em vez de tentar reaproveitar conexões possivelmente mortas.
- **Recuperação de peer em falha:** ao detectar estado `failed` (ICE) o peer é recriado imediatamente; em `disconnected`, espera 4 s antes de recriar (pode ser uma blip de rede que se resolve só), até 3 tentativas. Decisão registrada: recriar a conexão inteira em vez de fazer "ICE restart" na mesma conexão, para manter o invariante "anfitrião sempre oferta".

### 3.3 Qualidade de vídeo e banda

- Preferência de codec **VP9** via `setCodecPreferences` (só quando o navegador sabe codificar VP9; senão cai para VP8/H.264) — decisão documentada: AV1 foi descartado por exigir encoding por software, pesado demais com um encoder por espectador (o modelo é 1 upload do anfitrião por espectador, não um broadcast único).
- Captura limitada a 1920×1080 e bitrate de vídeo limitado a 2 Mbps por espectador, com uma cota de banda compatível no coturn (`--max-bps`).
- Resolução de um bug real de enquadramento de vídeo: telas que não são 16:9 (ex.: MacBook, 16:10) apareciam cortadas no quadro de vídeo porque o `<video>` tinha `height: 100%` dentro de um container com `overflow: hidden` e proporção fixa — corrigido posicionando o vídeo em `position: absolute; inset: 0` e deixando o `object-fit: contain` agir de fato.

### 3.4 Segurança aplicada a um sistema real-time

Tabela de ameaças e controles documentada e com testes automatizados cobrindo cada item (`docs/arquitetura/06-seguranca-e-limites.md`, `apps/api/test/security.spec.ts`):

- **IDs de sala não adivinháveis:** 72 bits de entropia (`randomBytes(9)` em base64url), gerados com `node:crypto`, nunca `Math.random`.
- **Token de anfitrião:** fica só em `localStorage`, nunca na URL; o servidor guarda apenas o hash SHA-256 e compara com `timingSafeEqual` (defesa contra timing attack).
- **Validação de todo payload de entrada (REST e WebSocket) com zod**, inclusive tamanho máximo de SDP/candidato ICE; payload inválido devolve um erro tipado e nunca derruba o processo. Testado com um conjunto de 10 payloads hostis (null, array, `{ $gt }`, tentativa de poluição de protótipo via `__proto__`, SDP de 40 KB, `viewerId` com `../`) — todos tratados sem crash e sem efeito.
- **Verificação de `Origin`** no handshake do WebSocket contra uma allowlist, para mitigar cross-site WebSocket hijacking.
- **Rate limiting em duas camadas:** `@nestjs/throttler` na criação de salas (10/min por IP) e um limitador próprio de eventos por socket (desconecta quem exceder).
- **Limite de sockets simultâneos por IP**, calculado a partir do `X-Forwarded-For` que o proxy acrescenta — mitiga um IP só ocupar todas as vagas de uma sala ou esgotar a API.
- **Credenciais TURN efêmeras via HMAC** (coturn `--use-auth-secret`), sem precisar de usuário/senha persistido.
- **Logs auditados por regra e por teste:** proibido logar SDP, candidato ICE, token ou segredo TURN; há um teste que captura todo log da sessão e confere a ausência desses dados.
- **Cabeçalhos de produção:** CSP, HSTS, `X-Frame-Options`, `Permissions-Policy` restringindo `display-capture` à própria origem — configurados no Caddy e validados com `caddy validate`.
- **Correção de vulnerabilidade real de dependência:** `pnpm audit` encontrou uma alta severidade em `multer` (fixado indiretamente pelo NestJS); resolvido com `pnpm.overrides`, já que não havia versão do Nest disponível sem a dependência vulnerável — e documentado como decisão técnica reversível quando o upstream corrigir.

## 4. Infraestrutura e deploy

- **Docker multi-stage build** para API e frontend, com `pnpm --filter @app/api deploy --prod` isolando só as dependências de produção (sem `jest`, `typescript`, `@nestjs/cli` na imagem final) e execução como usuário não-root.
- **Docker Compose de produção** orquestrando API, frontend estático, **Caddy** (certificado HTTPS automático, proxy reverso, upgrade de WebSocket) e **coturn** (STUN/TURN).
- **Depuração de um bug sutil de infraestrutura:** o coturn na imagem oficial reiniciava em loop com `ERROR CONFIG: Unknown argument:` vazio. Causa raiz identificada lendo o `docker-entrypoint.sh` da imagem: o entrypoint faz `eval "echo $i"` em cada flag, e isso silenciosamente "engolia" a flag `-n` (vira `echo -n`, que não imprime nada). Corrigido chamando o `turnserver` direto via `entrypoint`, contornando o entrypoint problemático. Esse é um bom exemplo de debugging de infraestrutura: ler o código-fonte de uma imagem Docker de terceiros em vez de tentar flags às cegas.
- **Validação de versão de dependência binária:** antes de fixar flags do coturn (`--no-dtls`, depois removida por não existir na versão da imagem), as flags foram conferidas contra o código-fonte C (`mainrelay.c`) da tag exata da imagem usada — rigor de verificar contra a fonte, não supor.
- **Healthcheck real** na API via `fetch` nativo (sem dependência extra) consumido pelo Docker Compose.

## 5. Qualidade, testes e confiabilidade

- **Pirâmide de testes completa:** unitários e de integração em Jest (API) e Vitest (shared/web), e **ponta a ponta com Playwright** simulando dois navegadores reais trocando vídeo via WebRTC (anfitrião e espectador em contextos separados, com captura de tela simulada).
- **Cenários e2e de resiliência**, não só "caminho feliz": anfitrião recarrega a página e a sala continua; anfitrião fecha a aba e a sala encerra depois de um tempo de tolerância; segunda aba tentando ser anfitrião é rejeitada; espectador perde a rede e volta sozinho quando a conexão retorna.
- **Debugging de flakiness em CI/máquina local, com causa raiz identificada por medição, não por tentativa e erro:** testes falhavam intermitentemente numa máquina com pouca memória. Investigação revelou duas causas: (1) o Vitest criava um ambiente jsdom completo em todo arquivo de teste, mesmo quando não precisava de DOM — resolvido trocando o ambiente padrão para `node` e usando `jsdom` só nos dois arquivos que realmente precisam; (2) o Jest paralelizava workers suficientes para levar a máquina a swap. Resolvido limitando `maxWorkers` a 50% e rodando os pacotes do monorepo em série. Resultado medido: suíte caiu de 45–135 s (com falhas) para ~14 s estável em três rodadas seguidas.
- **Outro bug de concorrência investigado com medição, não suposição:** `pnpm dev` às vezes falhava com `ECONNREFUSED` porque o Vite ficava pronto antes da API (que em máquina sob memory pressure podia levar de 2 a 60 s para subir). Resolvido com um plugin próprio do Vite (`wait-for-api`) que faz polling em `/api/health` antes de repassar requisições — só ativo em modo de desenvolvimento, sem efeito em produção.
- **Suíte de segurança dedicada** (`security.spec.ts`) além dos testes funcionais, cobrindo os itens da seção 3.4 como casos de teste automatizados, não só documentação.

## 6. Frontend: design system e acessibilidade sem biblioteca de UI

- **Design system próprio em CSS puro** (sem Tailwind, sem biblioteca de componentes — decisão de escopo documentada), com tokens de cor, espaçamento, raio e sombra.
- **Sistema de pixel art próprio** (`PixelSprite`): sprites (TV, cursor, estrela, ícone do GitHub) desenhados a partir de mapas de caracteres legíveis em código, em vez de centenas de elementos `<rect>" no JSX — uma abstração que torna o desenho editável como texto.
- **Acessibilidade tratada como requisito, não afterthought:** animações respeitam `prefers-reduced-motion`; estados dinâmicos usam `aria-live`; elementos decorativos levam `aria-hidden`; contagem de espectadores tem texto alternativo (`aria-label`) específico para leitor de tela.
- **Revisão iterativa com captura de tela automatizada:** 27 capturas (9 telas × desktop/celular/tema) via script Playwright fora do repositório, usadas para achar e corrigir regressões visuais (rolagem horizontal indevida, botão sem largura total no celular, elementos vazando da caixa).

## 7. Práticas de processo que também valem menção

- **Desenvolvimento em fases com critério de aceite e verificação documentada** (`docs/fases/`, `docs/PROGRESSO.md`): cada etapa só é marcada como concluída depois de rodar as verificações de verdade — inclusive registrando honestamente o que **não** pôde ser verificado (ex.: TURN em rede real, que depende de duas redes físicas diferentes) em vez de presumir que funciona.
- **Log de decisões técnicas com data e motivo**, não só o "o quê" mas o "porquê" (ex.: por que VP9 e não AV1; por que `pnpm.overrides` quebra uma regra própria do projeto mas foi necessário; por que recriar o peer em vez de ICE restart).
- **Escopo defendido ativamente:** uma lista explícita de funcionalidades "fora do MVP" (senha de sala, chat, contas, SFU, gravação, app desktop) é tratada como regra de projeto, evitando scope creep — disciplina de produto, não só de código.
- **Convenções consistentes:** Conventional Commits em inglês, interface em português, código e identificadores em inglês — mostra atenção a convenções de equipe mesmo num projeto solo.

## 8. Números concretos para citar

- Mais de 100 testes automatizados somando os três pacotes (shared, web, api), mais 11 cenários end-to-end com Playwright.
- `pnpm audit`: 0 vulnerabilidades conhecidas em ~787 dependências (diretas e de desenvolvimento).
- Imagens Docker de produção: API ~281 MB, frontend ~89 MB.
- Suíte de testes: de 45–135 s instável para ~14 s estável, depois do ajuste de concorrência do Jest/Vitest.
- Entropia do ID de sala: 72 bits (`randomBytes(9)`), suficiente para inviabilizar adivinhação por força bruta.

## 9. Perguntas típicas de entrevista e por onde começar a resposta

- **"Me conta um projeto que você fez do zero."** → Seção 1 e 2.
- **"Como funciona WebRTC / como você montou a sinalização?"** → Seção 3.1 e 3.2.
- **"Já teve que debugar algo difícil em produção/infra?"** → O bug do coturn (seção 4) e o bug de flakiness de testes (seção 5) — ambos têm causa raiz investigada, não só "resolvido reiniciando".
- **"Como você pensa em segurança?"** → Seção 3.4, com exemplos concretos (timing-safe compare, validação de payload, poluição de protótipo).
- **"Como você garante qualidade sem um time de QA?"** → Seção 5 (pirâmide de testes, e2e multi-navegador, suíte de segurança).
- **"Já trabalhou com Docker/deploy?"** → Seção 4.
- **"Como você lida com ambiguidade/escopo?"** → Seção 7 (fases, decisões registradas, escopo defendido).

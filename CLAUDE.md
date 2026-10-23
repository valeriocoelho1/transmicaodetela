# CLAUDE.md

Instruções permanentes para o Claude Code neste repositório. Leia este arquivo inteiro no início de toda sessão e antes de qualquer tarefa.

## O que é o projeto

Site para transmitir a tela do computador por link. Uma pessoa (o **anfitrião**) cria uma sala, compartilha a tela pelo navegador e envia o link. Qualquer pessoa com o link (o **espectador**) assiste pelo navegador, sem login. O vídeo vai por WebRTC, direto entre os navegadores (P2P). Este repositório contém apenas o **MVP**.

## Regras que valem sempre

1. **Não invente nomes.** Nada de nome de produto, marca, domínio, e-mail, URL, pacote ou serviço que você não tenha como confirmar que existe. Onde faltar um valor, use um placeholder em MAIÚSCULAS com underscore (por exemplo `SEU_DOMINIO`) e liste os placeholders no fim da tarefa. Os pacotes do workspace usam o escopo neutro `@app`.
2. **Escopo é só o MVP.** A lista "Fora do MVP" abaixo é proibida, mesmo que pareça fácil ou útil. Se achar que algo fora da lista é necessário, pergunte antes.
3. **Dependências.** Use só as listadas em `docs/stack.md`. Qualquer outra exige justificativa de uma linha e aprovação. Antes de instalar, confirme que o pacote existe (`pnpm view NOME version`). Instale as versões estáveis mais recentes com `pnpm add` e deixe o lockfile fixar. Não digite números de versão de memória.
4. **Segredos.** Nunca escreva segredo no repositório. `.env` fica no `.gitignore`; `.env.example` tem só placeholders.
5. **Uma fase por vez**, na ordem de `docs/fases/`. Não adiante trabalho de fases futuras.
6. **Verifique de verdade.** Ao fim de cada fase, rode as verificações da própria fase e só marque como feito o que você executou e viu passar. Se não conseguiu executar algo (por exemplo, Docker ausente), diga isso claramente. Nunca presuma que funciona.
7. **Registre.** Atualize `docs/PROGRESSO.md` ao fim de cada fase e faça commits pequenos e coerentes (Conventional Commits, em inglês).
8. **Decisões.** Se algo não está nos docs e muda comportamento visível ou segurança, pergunte antes. Se é detalhe interno, decida e anote em `docs/PROGRESSO.md`, seção "Decisões".
9. **Sem enfeite.** Código simples, tipado, sem abstração que o MVP não pede. Sem comentários que repetem o código. Sem arquivos de exemplo ou boilerplate que ninguém usa.

## Idiomas

- Interface do usuário: **português do Brasil**.
- Código, nomes de arquivos, identificadores, comentários e mensagens de commit: **inglês**.
- Documentação em `docs/`: português.

## Stack (resumo; detalhes em `docs/stack.md`)

- Monorepo **pnpm** com TypeScript estrito.
- `packages/shared` (`@app/shared`): schemas **zod** e tipos dos eventos, compilado com **tsup** (ESM + CJS + tipos).
- `apps/api` (`@app/api`): **NestJS** (Express) + **Socket.IO** (`@nestjs/websockets`, `@nestjs/platform-socket.io`). Salas em memória.
- `apps/web` (`@app/web`): **React + Vite**, React Router, `socket.io-client`, CSS simples. WebRTC com as APIs nativas do navegador.
- `e2e` (`@app/e2e`): **Playwright**.
- Produção: **Docker Compose** com Caddy (HTTPS + arquivos estáticos + proxy), API e coturn (STUN/TURN).

## Estrutura do repositório

```
CLAUDE.md
README.md
package.json            pnpm-workspace.yaml     tsconfig.base.json
eslint.config.js        .prettierrc             .editorconfig
.gitignore              .nvmrc                  .env.example
docker-compose.prod.yml
apps/api/               NestJS
apps/web/               React + Vite
packages/shared/        schemas e tipos compartilhados
e2e/                    testes Playwright
deploy/                 Caddyfile
docs/                   documentação e fases
```

## Comandos (devem existir no fim da Fase 0)

```
pnpm install
pnpm dev            # shared (watch) + api (3000) + web (5173)
pnpm build
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test           # unitários e integração (sem e2e)
pnpm test:e2e       # Playwright
```

## Invariantes de arquitetura (não quebrar)

- **O vídeo nunca passa pela API.** A API só faz sinalização (SDP e ICE) e controle de sala.
- **O anfitrião é sempre quem cria a oferta** (`offer`). O espectador só responde (`answer`). Isso evita colisão de ofertas.
- **Só o anfitrião** (socket autenticado com `hostToken`) pode emitir `signal:offer`, `host:live` e `host:end`.
- **Todo payload** de entrada (REST e WebSocket) é validado com os schemas zod de `@app/shared`. Payload inválido recebe erro `INVALID_PAYLOAD` e nunca derruba o servidor.
- **IDs e tokens** vêm de `node:crypto` (`randomBytes`), nunca de `Math.random`.
- **Nenhum log** contém SDP, candidatos ICE, `hostToken` ou segredo TURN.
- **Estado das salas é em memória.** Reiniciar a API encerra todas as salas. Isso é aceito no MVP.
- **O `hostToken` fica só no `localStorage` do anfitrião**, nunca na URL.

## Fora do MVP (proibido implementar)

Senha de sala, chat, contas e login, banco de dados, Redis, SFU (LiveKit, mediasoup, Janus), gravação, aplicativo desktop, anfitrião no celular, mais de um anfitrião por sala, painel de métricas ou saúde da live, perfis de qualidade escolhidos pelo usuário, traduções além de pt-BR, analytics, TURN sobre TLS na porta 443, CI/CD.

## Definição de pronto do MVP

Duas pessoas em redes diferentes (uma delas no 4G): o anfitrião cria a sala, compartilha a tela, envia o link, e o espectador vê o vídeo em até poucos segundos, em um site com HTTPS. Todas as verificações de `docs/fases/` passam. `docs/PROGRESSO.md` está atualizado.

## Onde ler mais

- `docs/PROMPT-MESTRE.md`: visão completa do que construir.
- `docs/stack.md` e `docs/arquitetura/`: stack e arquitetura em partes.
- `docs/fases/`: uma fase por arquivo, com tarefas, critérios de aceite e verificação.
- `docs/PROGRESSO.md`: onde você registra o andamento.

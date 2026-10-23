# Fase 0: Fundação

## Objetivo

Ter o monorepo de pé, com os três pacotes conversando entre si e um único caminho funcionando de ponta a ponta: o front lê `GET /api/health` pela API, validando a resposta com um schema que vive em `@app/shared`. Nenhuma funcionalidade de sala ainda.

## Pré-requisitos

- Node.js LTS vigente, pnpm e Git instalados (`node -v`, `pnpm -v`, `git --version`).
- `CLAUDE.md` e `docs/` copiados para a raiz do repositório.
- Docker não é necessário nesta fase.

## Entra

- Arquivos da raiz: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.editorconfig`, `.gitignore`, `.nvmrc`, `.env.example`, `README.md`.
- `packages/shared`, `apps/api` e `apps/web` mínimos.
- Scripts da raiz funcionando.

## Não entra

Salas, sinalização, WebRTC, Docker, Playwright, qualquer tela além da inicial.

## Tarefas

1. **Conferir o ambiente.** Rode `node -v`, `pnpm -v`, `git --version`. Se a pasta não for um repositório Git, rode `git init -b main`. Confirme que `CLAUDE.md` e `docs/` existem.
2. **Raiz do monorepo.**
   - `package.json` privado, com `packageManager` (versão do pnpm instalado), `engines.node` e os scripts: `dev`, `build`, `typecheck`, `lint`, `format`, `format:check`, `test`, `test:e2e` (por enquanto imprime que o e2e vem na Fase 2 e sai com sucesso).
   - `pnpm-workspace.yaml` com `apps/*` e `packages/*`.
   - `.nvmrc` com a major do Node em uso (confira a LTS vigente em nodejs.org).
   - `tsconfig.base.json`: `strict: true`, `target` ES2022, `esModuleInterop`, `skipLibCheck`, `forceConsistentCasingInFileNames`. Os pacotes estendem esse arquivo.
   - ESLint (flat config) com `typescript-eslint` e `eslint-config-prettier`; Prettier com configuração mínima; `.editorconfig`.
   - `.gitignore`: `node_modules`, `dist`, `.env`, `coverage`, `playwright-report`, `test-results`, arquivos de editor.
   - `.env.example`: comentário dizendo que em desenvolvimento nenhuma variável é necessária e que as variáveis de produção entram na Fase 3.
3. **`packages/shared` (`@app/shared`).**
   - `package.json` com `"type": "module"`, mapa `exports` (`types`, `import`, `require`) apontando para `dist`, scripts `build` (`tsup src/index.ts --format esm,cjs --dts`), `dev` (mesmo comando com `--watch`), `typecheck`, `test` (Vitest).
   - `src/index.ts` exporta: `ROOM_ID_REGEX` (`/^[A-Za-z0-9_-]{12}$/`) e o schema zod `healthResponse` (`{ status: 'ok' }`) com seu tipo.
   - Um teste Vitest simples para `healthResponse` e `ROOM_ID_REGEX`.
4. **`apps/api` (`@app/api`).**
   - NestJS (pode gerar com o Nest CLI e depois adaptar ao monorepo; remova o que o CLI cria e não é usado, como controller e service de exemplo).
   - Prefixo global `/api`, porta por `process.env.PORT ?? 3000`.
   - `GET /api/health` devolve `{ status: 'ok' }` e a resposta é construída com o tipo de `@app/shared` (prova de que a API consome o pacote em CJS).
   - Jest configurado; teste com `supertest` para `/api/health`.
   - Scripts: `dev` (modo watch), `build`, `start`, `typecheck`, `test`.
5. **`apps/web` (`@app/web`).**
   - Vite + React + TypeScript (template `react-ts`), com React Router já instalado e a rota `/`.
   - `vite.config.ts` com proxy de `/api` e `/socket.io` (`ws: true`) para `http://localhost:3000`.
   - A página inicial mostra o título "Compartilhar tela" e uma linha "API: ok" ou "API: indisponível", obtida de `/api/health` e validada com `healthResponse`.
   - Vitest com jsdom e um teste de fumaça de renderização.
6. **Encadeamento dos scripts.**
   - `pnpm build` constrói `@app/shared` antes dos demais (use ordem topológica do pnpm).
   - `pnpm typecheck` e `pnpm test` funcionam a partir de um clone limpo: construa `@app/shared` primeiro dentro do script se for preciso.
   - `pnpm dev` constrói `@app/shared` uma vez e depois roda shared (watch), API e web em paralelo.
7. **README.md** curto: o que é, requisitos, `pnpm install`, `pnpm dev`, lista de scripts, link para `docs/`.
8. **Fechamento.** Atualize `docs/PROGRESSO.md` e faça os commits.

## Critérios de aceite

- [ ] `pnpm install` conclui sem erro.
- [ ] `pnpm build` conclui; `packages/shared/dist` contém `.js`, `.cjs` e `.d.ts`.
- [ ] `pnpm typecheck`, `pnpm lint` e `pnpm format:check` passam.
- [ ] `pnpm test` passa (shared, api e web).
- [ ] `pnpm dev` sobe API em 3000 e web em 5173; `curl http://localhost:3000/api/health` devolve `{"status":"ok"}`.
- [ ] Em `http://localhost:5173` a página mostra "API: ok" (a requisição passou pelo proxy do Vite).
- [ ] Nenhuma dependência fora de `docs/stack.md`.
- [ ] `docs/PROGRESSO.md` atualizado e commits feitos.

## Verificação

```
pnpm install
pnpm build
pnpm typecheck && pnpm lint && pnpm format:check
pnpm test
pnpm dev        # em outro terminal: curl -s http://localhost:3000/api/health  e  curl -s http://localhost:5173/api/health
```

O segundo `curl` (porta 5173) prova que o proxy do Vite funciona.

## Armadilhas conhecidas

- **Dois formatos de módulo.** O Nest compila para CommonJS e o Vite consome ESM. Por isso `@app/shared` usa tsup com saída dupla e `exports` com `import` e `require`. Se a API reclamar de `ERR_REQUIRE_ESM` ou de import não resolvido, o problema está no `exports` ou no `build` do shared.
- **Corrida na primeira subida.** Se a API ou o web iniciarem antes de `@app/shared/dist` existir, falham ao importar. Por isso o `dev` constrói o shared uma vez antes de paralelizar.
- **Decorators.** A API precisa de `experimentalDecorators` e `emitDecoratorMetadata` no `tsconfig` dela, não no base.
- **Versão do pnpm.** Registre em `packageManager` a versão realmente instalada.

## Prompt para o Claude Code

````text
Execute a Fase 0 (Fundação) do projeto.

Leitura obrigatória, nesta ordem: CLAUDE.md; docs/PROMPT-MESTRE.md; docs/stack.md; docs/arquitetura/01-visao-geral.md; a seção "Desenvolvimento" de docs/arquitetura/05-infraestrutura.md; docs/fases/FASE-0-fundacao.md.

O que entregar (os detalhes estão na seção "Tarefas" de docs/fases/FASE-0-fundacao.md; execute todas):
- Monorepo pnpm com raiz configurada (package.json, pnpm-workspace.yaml, tsconfig.base.json, ESLint flat config, Prettier, .editorconfig, .gitignore, .nvmrc, .env.example, README.md).
- packages/shared (@app/shared) com tsup (ESM + CJS + tipos), exportando ROOM_ID_REGEX e o schema zod healthResponse, com teste Vitest.
- apps/api (@app/api) em NestJS com prefixo /api e GET /api/health usando o tipo de @app/shared, com teste Jest + supertest.
- apps/web (@app/web) em Vite + React + TypeScript com React Router, proxy de /api e /socket.io (ws:true) para a porta 3000 e uma página inicial "Compartilhar tela" que mostra "API: ok" ou "API: indisponível" lendo /api/health e validando com healthResponse; teste Vitest de fumaça.
- Scripts da raiz: dev, build, typecheck, lint, format, format:check, test, test:e2e (placeholder). pnpm dev constrói o shared uma vez e roda shared (watch), API (3000) e web (5173) em paralelo. typecheck e test funcionam a partir de um clone limpo.

Regras: não invente nomes; use o escopo @app; só dependências de docs/stack.md, confirmando cada uma com pnpm view antes de instalar e sem digitar versões de memória; nada fora do escopo da Fase 0 (sem salas, sem WebRTC, sem Docker, sem Playwright).

Como trabalhar: escreva primeiro um plano de 5 a 8 linhas e siga em frente sem esperar resposta. Faça commits pequenos (Conventional Commits, em inglês). Rode TODA a seção "Verificação" do arquivo da fase, incluindo o curl pela porta 5173, e corrija o que falhar. Não declare sucesso sem ver os comandos passando.

Ao terminar: atualize docs/PROGRESSO.md (status da Fase 0, decisões, o que não pôde ser verificado) e entregue um relatório com: o que foi feito; comandos executados e resultado real; o que não pôde ser verificado; decisões tomadas; placeholders pendentes. Depois PARE e espere eu escrever "continuar".
````

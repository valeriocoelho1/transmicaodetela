# Fase 3: Internet, TURN e deploy

## Objetivo

Deixar tudo pronto para rodar numa VM com HTTPS e TURN: imagens Docker, Caddy, coturn e um `docker-compose.prod.yml`. O Claude Code constrói e testa a stack **localmente**. O deploy real (VM, domínio, DNS, firewall) é trabalho seu e está no guia à parte.

## Pré-requisitos

- Fases 0, 1 e 2 concluídas.
- Docker e Docker Compose instalados na máquina onde o Claude Code roda. Se não estiverem, o Claude Code escreve os arquivos e registra que não pôde validar.
- Ler: `docs/arquitetura/05-infraestrutura.md` e `06-seguranca-e-limites.md`.

## Entra

- `apps/api/Dockerfile`, `apps/web/Dockerfile`, `deploy/Caddyfile`, `docker-compose.prod.yml`, `.dockerignore`.
- Seção de produção em `.env.example`.
- E2E opcionalmente executável contra uma URL externa (a stack local).
- Seção de deploy no `README.md`.

## Não entra

TURN sobre TLS, CI/CD, múltiplas instâncias, banco, Redis, certificado manual, monitoramento, script que acessa a VM. Nada que exija conta de nuvem.

## Tarefas

1. **`apps/api/Dockerfile`.** Múltiplos estágios, contexto na raiz do repositório. Estágio de build: instala dependências com o lockfile, constrói `@app/shared` e `@app/api`. Estágio final: só dependências de produção e `dist`, `NODE_ENV=production`, usuário não root (`node`), `EXPOSE 3000`, `HEALTHCHECK` chamando `/api/health`. Mesma major do Node de `.nvmrc`. Teste como o pnpm leva o pacote `@app/shared` para a imagem final (o comportamento de `pnpm deploy` muda entre majors) e registre a decisão.
2. **`apps/web/Dockerfile`.** Estágio 1: constrói `@app/shared` e `@app/web`. Estágio 2: `caddy:2-alpine` com `dist` em `/srv` e `deploy/Caddyfile` em `/etc/caddy/Caddyfile`.
3. **`deploy/Caddyfile`.** Exatamente como em `05-infraestrutura.md` (`{$DOMAIN}`, cabeçalhos de segurança, `/api/*` e `/socket.io/*` para `api:3000`, fallback do SPA para `index.html`).
4. **`docker-compose.prod.yml`.** Serviços `api`, `web` e `coturn` como no esboço de `05-infraestrutura.md`, com `restart: unless-stopped`, rotação de logs (`max-size` e `max-file`), `healthcheck` da API, volumes `caddy_data` e `caddy_config`. O coturn usa `network_mode: host` e a lista de flags do esboço. A API recebe `TRUST_PROXY=1`, `ALLOWED_ORIGINS=https://${DOMAIN}`, `STUN_URLS`, `TURN_URLS` e `TURN_SECRET`.
5. **`.env.example`.** Seção "produção" com `DOMAIN`, `TURN_SECRET`, `PUBLIC_IP`, `PRIVATE_IP` e `MAX_VIEWERS_PER_ROOM`, todos com placeholders (`SEU_DOMINIO`, `GERE_COM_openssl_rand_hex_32`, `IP_PUBLICO_DA_VM`, `IP_PRIVADO_DA_VM`). Comentário explicando como gerar o segredo (`openssl rand -hex 32`).
6. **`.dockerignore`.** `node_modules`, `.git`, `dist`, `.env`, `e2e`, `docs`, `coverage`, `playwright-report`, `test-results`.
7. **E2E contra a stack local.** No `playwright.config.ts`: se `E2E_BASE_URL` estiver definida, não inicia os `webServer`, usa essa URL e `ignoreHTTPSErrors: true`.
8. **Teste local da stack.** Crie um `.env` temporário **que não vai para o git**: `DOMAIN=localhost`, `TURN_SECRET=` qualquer valor de teste, `PUBLIC_IP=127.0.0.1`, `PRIVATE_IP=127.0.0.1`, `MAX_VIEWERS_PER_ROOM=2`. Execute a sequência da seção "Verificação".
9. **README.** Seção "Produção" curta: o que é preciso (VM, domínio, portas), como subir (`docker compose -f docker-compose.prod.yml up -d --build`), como ver logs, e uma nota dizendo que o passo a passo da VM está no guia de operação (fora do repositório).
10. **Fechamento.** Atualizar `docs/PROGRESSO.md` (incluindo a lista de pendências humanas) e fazer os commits.

## Critérios de aceite

Verificáveis pelo Claude Code:

- [ ] `docker compose -f docker-compose.prod.yml config` sem erro.
- [ ] `docker compose -f docker-compose.prod.yml build` conclui para `api` e `web`.
- [ ] `docker compose ... up -d` sobe os três serviços; `api` fica `healthy`.
- [ ] `curl -k https://localhost/api/health` devolve `{"status":"ok"}`.
- [ ] `curl -k https://localhost/` devolve o HTML do front, e `curl -k https://localhost/r/AAAAAAAAAAAA` também devolve o `index.html` (fallback do SPA).
- [ ] Os logs do `coturn` mostram o servidor ouvindo na 3478 sem erro de flag.
- [ ] `E2E_BASE_URL=https://localhost pnpm test:e2e` passa (prova o WebSocket através do Caddy).
- [ ] A imagem da API roda sem root (`docker compose exec api id` mostra usuário diferente de root).
- [ ] Nenhum segredo no git (`.env` ignorado).
- [ ] `docker compose ... down` ao final; `.env` temporário removido.

Só você consegue (guia à parte): conta na nuvem, VM, domínio, DNS, firewall, `.env` real, deploy, validação do TURN, teste em rede móvel.

## Verificação

```
cp .env.example .env     # depois edite os valores de teste descritos na tarefa 8
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
curl -k https://localhost/api/health
curl -k https://localhost/ | head
curl -k -s -o /dev/null -w "%{http_code}\n" https://localhost/r/AAAAAAAAAAAA
docker compose -f docker-compose.prod.yml logs --tail=30 coturn
E2E_BASE_URL=https://localhost pnpm test:e2e
docker compose -f docker-compose.prod.yml down
rm .env
```

## Armadilhas conhecidas

- **Contexto de build.** Os dois Dockerfiles precisam do `packages/shared`. Use a raiz como contexto (`context: .`) e `dockerfile:` apontando para o arquivo de cada app.
- **Porta 80 e 443 ocupadas** na sua máquina (outro servidor local) impedem o Caddy de subir. Pare o outro serviço ou ajuste só para o teste.
- **`DOMAIN=localhost`.** O Caddy usa uma autoridade de certificado interna; o navegador e o `curl` recusam sem `-k` / `ignoreHTTPSErrors`. Isso é esperado.
- **coturn em `network_mode: host`** só funciona de verdade em Linux. No Docker Desktop (macOS e Windows) o modo host se comporta diferente; o objetivo local é só ver o processo subir sem erro de flag.
- **Flags do coturn.** Se algum flag do esboço não existir na imagem, ajuste e registre. Confira com `docker run --rm coturn/coturn --help`.
- **`pnpm deploy`.** A forma de empacotar um pacote do workspace para produção muda entre majors do pnpm. Se a imagem final não achar `@app/shared`, o problema está aqui.
- **Healthcheck.** A imagem Alpine do Node não tem `curl`; use o `node -e fetch(...)` do esboço.

## Prompt para o Claude Code

````text
Execute a Fase 3 (Internet, TURN e deploy) do projeto.

Leitura obrigatória, nesta ordem: CLAUDE.md; docs/PROMPT-MESTRE.md; docs/arquitetura/05-infraestrutura.md; docs/arquitetura/06-seguranca-e-limites.md; docs/fases/FASE-3-internet-turn-e-deploy.md. Confirme em docs/PROGRESSO.md que as Fases 0, 1 e 2 estão concluídas.

O que entregar (detalhes na seção "Tarefas" do arquivo da fase; execute todas):
- apps/api/Dockerfile (multi-stage, contexto na raiz, só dependências de produção, usuário não root, HEALTHCHECK em /api/health, mesma major do Node de .nvmrc) e apps/web/Dockerfile (build do front + caddy:2-alpine com dist em /srv).
- deploy/Caddyfile exatamente como em docs/arquitetura/05-infraestrutura.md.
- docker-compose.prod.yml com api, web (portas 80, 443/tcp e 443/udp) e coturn (network_mode: host, flags do esboço), rotação de logs, healthcheck da API, volumes do Caddy; a API recebe TRUST_PROXY=1, ALLOWED_ORIGINS=https://${DOMAIN}, STUN_URLS, TURN_URLS e TURN_SECRET.
- .env.example com a seção de produção só com placeholders (SEU_DOMINIO, GERE_COM_openssl_rand_hex_32, IP_PUBLICO_DA_VM, IP_PRIVADO_DA_VM) e .dockerignore.
- playwright.config.ts aceitando E2E_BASE_URL (sem webServer, ignoreHTTPSErrors:true).
- Seção "Produção" no README.
- Teste local completo da stack com um .env temporário (DOMAIN=localhost, PUBLIC_IP=127.0.0.1, PRIVATE_IP=127.0.0.1, MAX_VIEWERS_PER_ROOM=2), seguindo a seção "Verificação" do arquivo da fase, inclusive o e2e contra https://localhost.

Regras: sem TURN sobre TLS, CI/CD, banco ou múltiplas instâncias; nada que dependa de conta de nuvem; não invente domínio, IP, e-mail ou segredo (use os placeholders); o .env temporário não pode ir para o git e deve ser removido no fim; valide os flags do coturn contra a ajuda da imagem e registre qualquer ajuste. Se o Docker não estiver instalado, escreva os arquivos, diga claramente que não pôde validar e liste o que ficou sem teste.

Como trabalhar: plano de 5 a 8 linhas e siga em frente. Commits pequenos (Conventional Commits, em inglês). Corrija o que falhar; não declare sucesso sem ver os comandos da seção "Verificação" passando.

Ao terminar: atualize docs/PROGRESSO.md (inclusive as pendências humanas) e entregue o relatório (o que foi feito; comandos e resultado real; o que não pôde ser verificado; decisões; placeholders pendentes; o que eu preciso fazer por fora). Depois PARE e espere eu escrever "continuar".
````

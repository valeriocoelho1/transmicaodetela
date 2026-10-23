# Fase 4: Endurecimento e entrega

## Objetivo

Fechar o MVP: cobrir com testes os riscos de segurança e os casos de borda que ainda não têm teste, deixar o README completo, limpar o que sobrou, auditar dependências e provar que um clone limpo instala, constrói e passa em tudo. Termina com a tag `v0.1.0`.

## Pré-requisitos

- Fases 0 a 3 concluídas.
- Ler: `docs/arquitetura/06-seguranca-e-limites.md` e `docs/PROGRESSO.md`.

## Entra

- Testes de segurança e de borda (API e e2e).
- README final, limpeza, auditoria, verificação em clone limpo, tag.

## Não entra

Funcionalidades novas. Se um teste revelar um defeito, corrija o defeito; não acrescente recurso.

## Tarefas

1. **Testes do checklist de segurança** (`06-seguranca-e-limites.md`), na API, caso ainda não existam:
   - Origem não permitida é recusada no handshake do Socket.IO.
   - Espectador não consegue emitir `signal:offer`, `host:live` nem `host:end`.
   - `hostToken` errado é recusado, e o `hostToken` não aparece em nenhuma resposta de `GET /api/rooms/:roomId`.
   - Payload inválido, inclusive SDP gigante e JSON estranho, não derruba o servidor (o servidor responde ao evento seguinte normalmente).
   - Estouro do limite de eventos desconecta o socket.
2. **E2E extras** (adicione à suíte existente; em `playwright.config.ts` o servidor de e2e passa a usar `ROOM_HOST_GRACE_MS=3000` e `SWEEP_INTERVAL_MS=500`):
   1. Recarregar a página do anfitrião: a sala continua (token no `localStorage`), os espectadores veem "Aguardando...", e ele consegue compartilhar de novo e o vídeo volta.
   2. Anfitrião fecha a aba e não volta: depois da tolerância, os espectadores veem "O anfitrião saiu e a sala foi encerrada."
   3. Anfitrião abre a mesma sala em uma segunda aba: a primeira mostra "Esta sala foi aberta em outra aba."
   4. Anfitrião sem token (contexto limpo, sem `localStorage`) abrindo `/host/:roomId`: vê "Você não tem acesso de anfitrião a esta sala."
   5. Recuperação do espectador após queda de rede (melhor esforço): derrube a conexão do espectador com uma técnica do próprio Playwright (por exemplo `context.setOffline(true)` e depois `false`) e confira que ele volta a "Aguardando..." ou a "assistindo". Se não houver forma confiável de simular isso **sem** colocar código de teste no produto, não adicione gancho de teste: pule o cenário e registre em `docs/PROGRESSO.md` que ele ficou como teste manual.
3. **Limpeza.** Remova código morto, `console.log` de depuração, arquivos gerados pelo scaffold que não são usados, dependências não usadas (confira cada `package.json`). Confirme com `grep` que nenhum log contém `sdp`, `candidate`, `hostToken` ou `TURN_SECRET`.
4. **Auditoria.** Rode `pnpm audit`. Corrija o que for simples (atualização de dependência direta). Para o que não puder corrigir, registre em `docs/PROGRESSO.md` com a justificativa. Não use `--force` nem `overrides` sem registrar.
5. **README final.** O que é; requisitos; instalação; scripts; como rodar os testes (unit, integração, e2e e a instalação do Chromium do Playwright); tabela de variáveis de ambiente; arquitetura em um parágrafo com link para `docs/arquitetura/`; limites do MVP (5 espectadores, sem senha, sem moderação, salas em memória); seção de produção; lista "Fora do MVP". Sem nome de produto.
6. **Verificação em clone limpo.** Clone o repositório numa pasta temporária (`git clone . /tmp/...` ou equivalente), rode `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` e `pnpm test:e2e`. Se o Docker existir, rode também `docker compose -f docker-compose.prod.yml config`. Remova a pasta temporária ao final.
7. **Entrega.** Atualize `docs/PROGRESSO.md` (todas as fases, decisões, o que não foi verificado, pendências humanas). Crie a tag `v0.1.0` (`git tag -a v0.1.0 -m "MVP"`). Não faça push.

## Critérios de aceite

- [ ] Todos os testes de segurança e os 5 e2e extras existem e passam.
- [ ] `pnpm audit` revisado e registrado.
- [ ] Nenhum `console.log` de depuração e nenhum log sensível.
- [ ] Clone limpo: install, build, typecheck, lint, format:check, test e test:e2e passam.
- [ ] README final completo e sem nome inventado.
- [ ] Tag `v0.1.0` criada localmente.
- [ ] `docs/PROGRESSO.md` com todas as fases `concluída` (ou `concluída com ressalvas` explicadas).

## Teste manual guiado (para você, fora do Claude Code)

Faça depois do deploy da Fase 3. Marque no seu `PROGRESSO.md`.

- [ ] Anfitrião no Chrome (ou Edge) em computador, espectador no celular com **4G** (não Wi-Fi). O vídeo aparece em poucos segundos.
- [ ] Mesmo teste com anfitrião no Firefox e no Safari, se tiver acesso.
- [ ] Compartilhar uma **aba** com áudio: o espectador ouve ao ativar o som.
- [ ] Compartilhar a **tela inteira**: o vídeo aparece; anote se o áudio chega (depende do sistema).
- [ ] Clicar em "Parar compartilhamento" no navegador: o espectador volta a "Aguardando".
- [ ] Recarregar a página do anfitrião: a sala continua e ele consegue compartilhar de novo.
- [ ] Fechar a aba do anfitrião e esperar mais de 60 segundos: os espectadores veem a sala encerrada.
- [ ] Entrar com 6 espectadores: o sexto vê "A sala está cheia".
- [ ] Abrir o site por `http://` (sem HTTPS): confirme que redireciona para HTTPS.
- [ ] Abrir o link em janela anônima: funciona sem login.

## Armadilhas conhecidas

- Testes que dependem de tempo (tolerância do anfitrião, varredura) precisam de valores pequenos por configuração, nunca de `sleep` longo.
- O clone limpo expõe dependências esquecidas no `package.json` e arquivos não versionados que o projeto usa sem saber. Corrija na origem.
- `pnpm audit` pode apontar problemas em dependências de desenvolvimento que não vão para produção; registre sem alarme, mas registre.

## Prompt para o Claude Code

````text
Execute a Fase 4 (Endurecimento e entrega) do projeto.

Leitura obrigatória, nesta ordem: CLAUDE.md; docs/PROMPT-MESTRE.md; docs/arquitetura/06-seguranca-e-limites.md; docs/PROGRESSO.md; docs/fases/FASE-4-endurecimento-e-entrega.md. Confirme em docs/PROGRESSO.md que as Fases 0 a 3 estão concluídas.

O que entregar (detalhes na seção "Tarefas" do arquivo da fase; execute todas):
- Testes de segurança na API: origem não permitida recusada; espectador não emite signal:offer, host:live nem host:end; hostToken errado recusado e nunca exposto em GET /api/rooms/:roomId; payload inválido (inclusive SDP gigante) não derruba o servidor; estouro do limite de eventos desconecta.
- 5 e2e extras: recarregar o anfitrião mantém a sala e o vídeo volta; anfitrião some e a sala encerra com a mensagem de HOST_TIMEOUT (e2e com ROOM_HOST_GRACE_MS=3000 e SWEEP_INTERVAL_MS=500); segunda aba de anfitrião derruba a primeira com "Esta sala foi aberta em outra aba."; anfitrião sem token vê "Você não tem acesso de anfitrião a esta sala."; espectador se recupera depois de uma queda de rede (melhor esforço, sem colocar código de teste no produto; se não for confiável, registre como teste manual).
- Limpeza: código morto, console.log de depuração, dependências não usadas, grep confirmando que nada loga sdp, candidate, hostToken ou TURN_SECRET.
- pnpm audit revisado e registrado em docs/PROGRESSO.md (sem --force e sem overrides não registrados).
- README final completo (o que é, requisitos, instalação, scripts, testes incluindo a instalação do Chromium do Playwright, tabela de variáveis, arquitetura em um parágrafo, limites do MVP, produção, Fora do MVP), sem nome de produto.
- Verificação em clone limpo numa pasta temporária: pnpm install --frozen-lockfile, build, typecheck, lint, format:check, test, test:e2e e, se houver Docker, docker compose config. Remover a pasta temporária depois.
- Tag local v0.1.0 (git tag -a v0.1.0 -m "MVP"). Não faça push.

Regras: nenhuma funcionalidade nova (se um teste revelar defeito, corrija o defeito); não invente nomes; só dependências de docs/stack.md; não declare sucesso sem ver cada comando passando.

Como trabalhar: plano de 5 a 8 linhas e siga em frente. Commits pequenos (Conventional Commits, em inglês). Corrija o que falhar.

Ao terminar: atualize docs/PROGRESSO.md (todas as fases, decisões, o que não foi verificado, pendências humanas) e entregue o relatório final: o que foi feito; comandos e resultado real; o que não pôde ser verificado; decisões; placeholders pendentes; e a lista do que eu preciso fazer por fora (guia de hospedagem, domínio e operação) para colocar no ar.
````

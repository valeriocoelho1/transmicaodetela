# Como contribuir

## Ambiente

Siga a seção "Instalação e desenvolvimento" do [README](README.md). Antes de abrir um pull
request:

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
```

```bash
pnpm test:e2e
```

## Regras do projeto

- **TypeScript strict.** Sem `any`, sem `@ts-ignore`.
- **Contratos no `packages/shared`.** Todo payload de entrada (REST e WebSocket) é validado
  com os schemas zod de `@app/shared`; payload inválido recebe `INVALID_PAYLOAD` e nunca
  derruba o servidor. Mantenha os eventos compatíveis entre versões vizinhas.
- **O vídeo nunca passa pela API.** Ela só faz sinalização (SDP e ICE) e controle de sala.
- **Só o anfitrião cria a oferta.** O espectador só responde, e só o socket autenticado com
  `hostToken` emite `signal:offer`, `host:live` e `host:end`.
- **IDs e tokens** vêm de `randomBytes` do `node:crypto`, nunca de `Math.random`.
- **Nenhum log** contém SDP, candidatos ICE, `hostToken` ou segredo TURN.
- **Dependências** novas só com justificativa no pull request.
- **Textos da interface** em português do Brasil; código, comentários e commits em inglês.
- **Commits** pequenos, no formato [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`...).

## Segurança

Encontrou uma vulnerabilidade? Veja [SECURITY.md](SECURITY.md). Não abra issue pública.

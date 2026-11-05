# Política de segurança

## Como reportar uma vulnerabilidade

Não abra uma issue pública. Use o recurso **Report a vulnerability** (aba Security do
repositório no GitHub) e inclua:

- o que é possível fazer explorando a falha e qual o impacto;
- passos para reproduzir (eventos do socket, requisições, telas, versão ou commit);
- se possível, uma sugestão de correção.

Você recebe uma resposta em até 5 dias úteis. Pedimos que a falha não seja divulgada antes
da correção ser publicada.

## Escopo

Tudo neste repositório: site, API de sinalização, configuração de produção (Caddy, coturn,
Docker Compose) e dependências. Testes contra instâncias de outras pessoas, engenharia
social e negação de serviço por volume estão fora do escopo.

Não são vulnerabilidades, porque são limites conhecidos e documentados:

- quem tem o link da sala entra (não existe senha de sala);
- o anfitrião e os espectadores podem ver o endereço IP uns dos outros, porque a conexão é
  direta entre os navegadores.

## Controles existentes

As ameaças consideradas, os controles de cada uma e os limites padrão estão em
[docs/arquitetura/06-seguranca-e-limites.md](docs/arquitetura/06-seguranca-e-limites.md).

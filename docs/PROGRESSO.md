# Progresso

O Claude Code atualiza este arquivo ao fim de cada fase. Não apague o histórico.

## Status das fases

| Fase | Título | Status | Commit final |
| --- | --- | --- | --- |
| 0 | Fundação | pendente | |
| 1 | API de salas e sinalização | pendente | |
| 2 | Transmissão no navegador | pendente | |
| 3 | Internet: TURN e deploy | pendente | |
| 4 | Endurecimento e entrega | pendente | |

Status possíveis: `pendente`, `em andamento`, `concluída`, `concluída com ressalvas` (explique abaixo).

## Verificações executadas

Para cada fase, liste o comando e o resultado real (passou, falhou, não executado e por quê).

## Decisões

Registre aqui decisões tomadas que não estavam nos documentos (data, decisão, motivo em uma linha).

## Placeholders pendentes

Valores que ficaram como placeholder e precisam ser preenchidos por uma pessoa (por exemplo `SEU_DOMINIO`).

## O que não foi possível verificar

Itens que o Claude Code não conseguiu executar (por exemplo, Docker ausente, teste em rede móvel) e o motivo.

## Pendências humanas (fora do código)

Consulte o guia de hospedagem, domínio e operação. Marque aqui o que já foi feito.

- [ ] Conta na nuvem criada e alerta de custo configurado
- [ ] Domínio registrado
- [ ] VM criada com IP fixo e portas liberadas
- [ ] DNS apontando para a VM
- [ ] Docker instalado na VM e `.env` de produção criado
- [ ] Primeiro deploy feito
- [ ] TURN validado com a página de teste de ICE
- [ ] Teste real: anfitrião em uma rede, espectador no 4G

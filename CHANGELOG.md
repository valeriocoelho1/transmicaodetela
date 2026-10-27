# Changelog

Versões seguem [SemVer](https://semver.org/lang/pt-BR/). Cada versão é uma tag `vX.Y.Z` na `main`.

## Não lançado (previsto: 0.2.0)

### Interface

- Landing page nova em pixel art, com "Como funciona", perguntas frequentes e "Quer contribuir?".
- Sala do anfitrião, espectador e 404 no mesmo visual, com moldura de TV e lugares ocupados.
- Fontes Tiny5 e Rubik servidas pelo próprio site.
- Nome na sala: cada pessoa começa com um nome aleatório, que pode trocar no topo da página, com um avatar da inicial.
- Lista de espectadores com os nomes no lugar dos lugares ocupados; o espectador vê o nome do anfitrião.
- Tela cheia no celular, inclusive no iPhone, girando para deitado ou em pé conforme o formato da tela transmitida.
- Carregamento com um círculo girando suave no lugar do quadrado.
- O espectador também vê a lista de espectadores, com o próprio nome marcado como "você".
- Vídeo maior: sala mais larga, sem o título "Sua sala", com o status na barra do topo.
- Botões principais da sala no vermelho da landing, no lugar do amarelo.
- Controles do vídeo (som e tela cheia) dentro da imagem, que somem quando o mouse fica parado, como num player de vídeo.
- A sala ocupa exatamente a janela, sem rolagem: o vídeo se ajusta ao espaço e a coluna lateral rola por dentro.
- O anfitrião não fica mais preso em "Reconectando…" quando a sala deixou de existir, e os dois lados voltam a conectar sozinhos depois que o servidor os desconecta por limite.

### Transmissão

- Captura limitada a 1920×1080: telas Retina e 4K deixam de derrubar o FPS e de pesar na CPU do anfitrião.
- VP9 preferido no vídeo (melhor para texto e telas), com os outros codecs como reserva.
- O anfitrião recria sozinho a conexão de um espectador que falha ou fica desconectado, até 3 vezes seguidas.
- Se o navegador recusar o pedido de áudio, a tela é compartilhada só com vídeo em vez de falhar, e o aviso explica como incluir o som.
- Enquanto a janela de compartilhamento não responde, dá para cancelar; depois de 8 segundos aparece a opção "Compartilhar sem som", que pede só o vídeo.
- No Mac, o Chrome pede só o som da guia, sem o som do sistema: o pedido de som do sistema deixava o compartilhamento travado.

### Segurança e operação

- `Content-Security-Policy` e `Strict-Transport-Security` no Caddy.
- Cache: `index.html` sem cache, `/assets/*` imutável.
- Limite de sockets simultâneos por endereço (`MAX_SOCKETS_PER_IP`, padrão 20).
- coturn sem relay TCP, com banda limitada por sessão e faixas IPv6 privadas negadas.
- `multer` forçado para 2.5.0 ou mais (GHSA-q7qp-rjg7-q26m).
- Imagens Docker com a tag `APP_VERSION`, para rollback sem rebuild.

## 0.1.0

- MVP: criar sala, compartilhar a tela, assistir pelo link, P2P com STUN/TURN próprio, deploy com Docker Compose.

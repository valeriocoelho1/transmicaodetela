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

### Transmissão

- Captura limitada a 1920×1080: telas Retina e 4K deixam de derrubar o FPS e de pesar na CPU do anfitrião.
- VP9 preferido no vídeo (melhor para texto e telas), com os outros codecs como reserva.
- O anfitrião recria sozinho a conexão de um espectador que falha ou fica desconectado, até 3 vezes seguidas.
- Se o navegador recusar o pedido de áudio, a tela é compartilhada só com vídeo em vez de falhar, e o aviso explica como incluir o som.

### Segurança e operação

- `Content-Security-Policy` e `Strict-Transport-Security` no Caddy.
- Cache: `index.html` sem cache, `/assets/*` imutável.
- Limite de sockets simultâneos por endereço (`MAX_SOCKETS_PER_IP`, padrão 20).
- coturn sem relay TCP, com banda limitada por sessão e faixas IPv6 privadas negadas.
- `multer` forçado para 2.5.0 ou mais (GHSA-q7qp-rjg7-q26m).
- Imagens Docker com a tag `APP_VERSION`, para rollback sem rebuild.

## 0.1.0

- MVP: criar sala, compartilhar a tela, assistir pelo link, P2P com STUN/TURN próprio, deploy com Docker Compose.

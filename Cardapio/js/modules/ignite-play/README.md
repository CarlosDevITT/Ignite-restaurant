# Ignite Play — fonte oficial

Esta pasta é a única fonte de implementação do Ignite Play usada pelo Cardápio:

`/Cardapio/js/modules/ignite-play/`

## Estrutura oficial

- `index.js` — shell fullscreen, biblioteca de jogos, controles e API pública `IgnitePlay`.
- `game-registry.js` — catálogo único dos jogos disponíveis.
- `score-store.js` — persistência de recorde por jogo.
- `games/snake.js` — Snake.
- `games/pong.js` — Pong.
- `games/breakout.js` — Breakout.
- `games/tetris.js` — Tetris.
- `/Cardapio/styles/ignite-play.css` — estilos do console/jogo.
- `/Cardapio/styles/ignite-play-library.css` — estilos da biblioteca de jogos.

## Contrato dos jogos

Todo jogo registrado deve implementar o mesmo contrato:

`createGame({ canvas, onScoreChange, onStateChange })`

Retornando:

`start`, `pause`, `resume`, `restart`, `setDirection`, `destroy`, `getScore`, `getState`.

Estados esperados: `ready`, `playing`, `paused`, `game_over`.

## Regra de manutenção

Não copie a implementação do Ignite Play para outras árvores do repositório. Entry points antigos devem apenas reexportar este módulo para compatibilidade.

Novos jogos devem ser criados em `games/` e registrados exclusivamente em `game-registry.js`.

O Ignite Play não acessa Supabase/pedidos diretamente. A integração com status do pedido continua pertencendo ao `Cardapio/js/app.js` e aos módulos de pedidos.

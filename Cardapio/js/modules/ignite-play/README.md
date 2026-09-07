# Ignite Play — fonte oficial

Esta pasta é a única fonte de implementação do Ignite Play usada pelo Cardápio:

`/Cardapio/js/modules/ignite-play/`

## Arquivos oficiais

- `index.js` — shell, controles, fullscreen e integração pública `IgnitePlay`.
- `games/snake.js` — motor oficial do Snake.
- `score-store.js` — persistência de recorde.
- `/Cardapio/styles/ignite-play.css` — estilos oficiais.

## Regra de manutenção

Não copie a implementação do Ignite Play para outras árvores do repositório. Entry points antigos que ainda existam devem apenas reexportar este módulo para compatibilidade.

Toda feature nova, correção, novo jogo, ranking ou alteração de UX deve ser implementada nesta pasta (e no CSS oficial citado acima).

O Ignite Play não deve acessar Supabase/pedidos diretamente. A integração com status do pedido continua pertencendo ao `Cardapio/js/app.js` e aos módulos de pedidos.

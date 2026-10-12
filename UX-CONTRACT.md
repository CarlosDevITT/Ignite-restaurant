# Cardápio digital — catálogo

Escopo deste contrato: busca, seleção de categoria, filtros, cards e inclusão local no carrinho. Referências de negócio: `Cardapio/README.md`, `Cardapio/js/services/product-service.js`, `Cardapio/js/store/cart-store.js` e `Cardapio/js/modules/catalog.js`. Visual: `DESIGN.md`.

| Capacidade | Responsável | Comportamento |
|---|---|---|
| Produtos, preços e disponibilidade | product-service.js / Supabase | Normalização existente de preço promocional e disponibilidade; não inferir estoque ou ranking de vendas |
| Busca local | catalog.js | Busca textual com normalização de acentos; limpar mantém foco no input; aguardar composição IME; resultados e reset sem requisições extras |
| Filtros | catalog.js | Todos, Em oferta (promo válida), Destaques (featured editorial); estado exposto por aria-pressed; combinação com busca |
| Categorias | catalog.js | Links de rolagem para seções do catálogo; chip mantém foco e seleção; movimento reduzido usa navegação instantânea |
| Painel de categorias | mobile-ux.js | Botão único abre painel; Escape/backdrop fecham; Tab contido; fundo inert com restauração; foco retorna ao acionador |
| Card e detalhes | catalog.js / SweetAlert2 | Imagem e nome abrem os detalhes existentes; sem fotos inventadas; indisponível permanece bloqueado para inclusão |
| Carrinho local | cart-store.js / cart.js | Adicionar usa produto normalizado; contador e total locais atualizados; detalhes preservam quantidade e observações |
| Feedback | SweetAlert2 compartilhado | Feedback de inclusão local; nunca declarar pedido enviado antes de confirmação do fluxo de checkout |
| Scrollbar e foco | cardapio.css / estilos existentes | Preservar baseline da aplicação e focus-visible; não criar scroll infinito ou esconder barras |

Adicionar ao carrinho é diferente de enviar um pedido. Este trabalho não muda disponibilidade operacional, taxas, modalidades, autenticação, tabelas ou RPCs de checkout. Estado de caixa permanece no leitor existente do aplicativo.

Verificação do catálogo: busca com resultado e sem resultado, limpar/reset, ofertas/destaques, painel por mouse e teclado, foto indisponível, detalhes/quantidade/observações, inclusão local e contador em mobile/desktop. Não fazer pedidos reais como teste de interface.

Feed: route and entrypoints require a registered non-anonymous Supabase session. Registration without an active confirmed session does not unlock the feed. Logout clears displayed posts and redirects an active feed route to profile. getFeedSessionState/RPCs remain authoritative for social permissions; local profile fields do not grant access.

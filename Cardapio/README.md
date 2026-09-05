# Ignite — Cardápio digital

Aplicação mobile-first em HTML, CSS e módulos JavaScript. O projeto atual lê o catálogo e envia pedidos para o Supabase configurado em `js/supabase-config.js`; perfil, carrinho e histórico deste aparelho também ficam no armazenamento local.

## Supabase do projeto atual

O login anônimo está desativado e não é necessário para o fluxo legado atualmente conectado. O perfil é salvo localmente; o pedido é enviado às tabelas legadas `orders` e `order_items` e depois guardado no aparelho para aparecer imediatamente em **Meus pedidos**.

- Mantenha `js/supabase-config.js` carregado antes do módulo principal.
- Use apenas a chave publicável/anon no navegador; nunca exponha a chave `service_role`.
- As políticas RLS devem permitir somente as operações públicas indispensáveis ao checkout.
- Publique em HTTPS para habilitar a instalação e o service worker.

O arquivo `supabase/schema.sql` descreve uma instalação nova, separada do banco legado. Ele usa autenticação anônima e não deve ser executado sobre o banco atual sem uma migração planejada, pois os nomes e tipos das colunas são diferentes.

## Migração segura do Cardápio no banco compartilhado

Use `supabase/cardapio-hardening-20260904.sql` para o banco atualmente compartilhado com PDV, Dashboard, Mesas, Chat e Gerenciador de Produtos. A migração preserva as tabelas legadas e limita as mudanças automáticas ao catálogo e aos pedidos `delivery` do Cardápio.

Ordem de publicação:

1. Publique primeiro esta versão do frontend, que reconhece as views/RPC novas e mantém fallback para o banco antigo.
2. Faça um backup do Supabase.
3. Execute `supabase/cardapio-hardening-20260904.sql` no SQL Editor.
4. Confirme que a auditoria ao final retorna seis categorias, zero promoções inválidas e zero pedidos delivery com total divergente.
5. Teste catálogo, feed e um checkout completo.

Para habilitar as modalidades **Delivery**, **Retirada** e **Comer no local**, execute depois `supabase/cardapio-checkout-v2-20260904.sql`. Essa segunda migração mantém a RPC anterior e adiciona `place_cardapio_order_v2`.

A migração revoga acesso da função `anon` às tabelas com clientes, pedidos, vendas e dados operacionais. PDV e Dashboard devem usar autenticação ou um backend seguro; nenhum painel administrativo deve depender da chave pública anon para ler essas tabelas.

## Estrutura

- `js/modules`: telas e interações da interface.
- `js/services`: comunicação com Supabase e persistência.
- `js/store`: estado do carrinho.
- `js/data`: catálogo usado no modo demonstração.
- `supabase/schema.sql`: tabelas, RLS, função segura de pedido e dados iniciais.
- `manifest.json` e `sw.js`: instalação e funcionamento offline.

O Chat IA incluído responde localmente usando os produtos carregados. Para uma IA generativa real, conecte o módulo a uma Supabase Edge Function; não exponha chaves de provedor de IA no JavaScript do navegador.

Os controles usam Flaticon UIcons 4.0 no estilo Regular Rounded. A atribuição do plano gratuito está disponível na tela Perfil.

// Integração Chat <-> Carrinho
(function () {
  function log() { /* noop for now */ }

  function adicionarAoCarrinho(produto) {
    try {
      // produto pode ser um objeto normalizado do Chat (produto) ou apenas um ID
      if (!produto) return;

      // Se vier apenas ID
      if (typeof produto === 'string' || typeof produto === 'number') {
        const id = produto;
        // Preferir usar addToCart (legacy) que aceita id
        if (typeof window.addToCart === 'function') {
          window.addToCart(String(id));
          if (typeof showToast === 'function') showToast('Item adicionado ao carrinho', 'success');
          return;
        }

        // Tentar buscar produto em window.products
        const found = (window.products || []).find(p => String(p.id) === String(id));
        if (found && window.unifiedCartManager) {
          window.unifiedCartManager.addItem(found);
          if (typeof showToast === 'function') showToast('Item adicionado ao carrinho', 'success');
          return;
        }
      }

      // Se veio objeto produto
      if (typeof produto === 'object') {
        // Se UnifiedCartManager disponível, usar addItem com mapeamento
        if (window.unifiedCartManager && typeof window.unifiedCartManager.addItem === 'function') {
          const p = {
            id: produto.id || produto._id || produto.nome || Date.now(),
            name: produto.name || produto.nome || produto.title || 'Produto',
            price: Number(produto.price || produto.preco || produto.final || 0),
            image: produto.image || produto.image_url || produto.imagem_url || produto.foto || null,
          };
          window.unifiedCartManager.addItem(p);
          if (typeof showToast === 'function') showToast(`Adicionado: ${p.name}`, 'success');
          return;
        }

        // Fallback: tentar chamar addToCart por id
        if (typeof window.addToCart === 'function' && produto.id) {
          window.addToCart(String(produto.id));
          if (typeof showToast === 'function') showToast('Item adicionado ao carrinho', 'success');
          return;
        }
      }

      // Se nada funcionou, dispatch para que outro módulo lide
      window.dispatchEvent(new CustomEvent('ignite:add-to-cart-fallback', { detail: produto }));
    } catch (e) {
      console.error('Erro integração chat-carrinho:', e);
    }
  }

  // Expor compatível com nome usado no ProductCard
  window.adicionarAoCarrinho = adicionarAoCarrinho;

  // Ouvir eventos dispatchados pelo chat
  window.addEventListener('ignite:add-to-cart', (e) => {
    adicionarAoCarrinho(e.detail);
  });

  // Criar botão 'Finalizar compra' dentro do chat (ao lado do enviar)
  // DESATIVADO: Botão removido conforme solicitação
  function ensureCheckoutButton() {
    // Função desativada - botão "Finalizar compra" removido do chat
    return;
  }

  // Tenta injetar o botão quando o DOM carregar e quando o chat abrir
  document.addEventListener('DOMContentLoaded', () => {
    ensureCheckoutButton();
  });

  // Também observar mutações na DOM para garantir presença do botão caso o chat seja renderizado tarde
  const obs = new MutationObserver(() => ensureCheckoutButton());
  obs.observe(document.body, { childList: true, subtree: true });

  // Exportar função para debug se necessário
  window.chatCart = { adicionarAoCarrinho };
})();

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
  function ensureCheckoutButton() {
    const sendBtn = document.getElementById('chat-send-btn');
    if (!sendBtn) return;

    if (document.getElementById('chat-checkout-btn')) return; // já criado

    const btn = document.createElement('button');
    btn.id = 'chat-checkout-btn';
    btn.className = 'bg-[#069C54] text-white px-3 py-2 rounded-lg ml-2 hover:bg-[#048654] transition-colors flex items-center gap-2';
    btn.type = 'button';
    btn.innerHTML = '<i class="fas fa-shopping-cart"></i> Finalizar';
    btn.title = 'Finalizar compra';

    btn.addEventListener('click', () => {
      // prioridade: chamar checkout direto, senão abrir o carrinho
      if (window.unifiedCartManager && typeof window.unifiedCartManager.checkout === 'function') {
        window.unifiedCartManager.checkout();
        return;
      }

      // fallback: abrir carrinho (toggle)
      if (typeof window.toggleCart === 'function') {
        window.toggleCart();
        return;
      }

      // ultima alternativa: abrir cart sidebar element if present
      const sidebar = document.getElementById('cart-sidebar');
      if (sidebar) sidebar.classList.remove('translate-x-full');
    });

    // Inserir antes do botão enviar para ficar visível
    sendBtn.insertAdjacentElement('beforebegin', btn);
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

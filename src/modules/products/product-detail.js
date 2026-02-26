// Product detail modal and handlers
(function () {
  function createModal() {
    if (document.getElementById('product-detail-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'product-detail-modal';
    modal.className = 'fixed inset-0 z-60 hidden items-center justify-center p-4';
    modal.innerHTML = `
      <div class="absolute inset-0 bg-black bg-opacity-60" data-action="close"></div>
      <div class="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden">
        <button class="absolute top-3 right-3 text-gray-500 hover:text-gray-800" data-action="close" aria-label="Fechar">
          <i class="fas fa-times text-2xl"></i>
        </button>

        <div id="product-detail-content" class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          <!-- Conteúdo será preenchido dinamicamente -->
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close on Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeProductDetail();
      }
    });
  }

  function openProductDetail(productId) {
    createModal();
    const modal = document.getElementById('product-detail-modal');
    const content = document.getElementById('product-detail-content');
    if (!modal || !content) return;

    const products = window.products || [];
    const product = products.find(p => p.id == productId);
    if (!product) return;

    const priceInfo = (window.getDisplayPrice && window.getDisplayPrice(product)) || { final: product.price || 0, hasPromo: false };

    content.innerHTML = `
      <div class="md:col-span-1 flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
        ${product.image_url ? `<img src="${product.image_url}" alt="${product.name}" class="w-full h-full object-cover">` : `<div class="p-6 text-gray-400"><i class="fas fa-utensils text-4xl"></i></div>`}
      </div>
      <div class="md:col-span-2 p-2 flex flex-col">
        <h3 class="text-2xl font-bold text-gray-800 mb-2">${product.name}</h3>
        <p class="text-sm text-gray-600 mb-4">${product.description || 'Descrição não disponível'}</p>

        <div class="mb-4">
          ${priceInfo.hasPromo ? `
            <div class="flex items-baseline gap-3">
              <span class="text-2xl font-bold text-red-600">R$ ${priceInfo.final.toFixed(2)}</span>
              <span class="text-sm line-through text-gray-400">R$ ${priceInfo.original.toFixed(2)}</span>
            </div>
          ` : `
            <span class="text-2xl font-bold text-primary">R$ ${priceInfo.final.toFixed(2)}</span>
          `}
        </div>

        <div class="flex gap-3 mt-auto">
          <button id="detail-add-btn" class="bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
            <i class="fas fa-cart-plus"></i>Adicionar
          </button>
          <button id="detail-share-btn" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2">
            <i class="fas fa-share-alt"></i>Compartilhar
          </button>
          <button id="detail-close-btn" class="ml-auto text-sm text-gray-500 px-3 py-2" data-action="close">Fechar</button>
        </div>
      </div>
    `;

    // Attach actions
    document.getElementById('detail-add-btn').onclick = function () {
      if (typeof window.addToCart === 'function') {
        window.addToCart(product.id);
      } else if (window.cartManager) {
        window.cartManager.addItem(product);
      }
    };

    document.getElementById('detail-share-btn').onclick = function () {
      if (typeof window.shareProduct === 'function') {
        window.shareProduct(product.name, product.description, product.id);
      }
    };

    // Close handlers
    modal.querySelectorAll('[data-action="close"]').forEach(btn => btn.addEventListener('click', closeProductDetail));
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    // prevent background scroll
    document.body.style.overflow = 'hidden';
  }

  function closeProductDetail() {
    const modal = document.getElementById('product-detail-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  // Delegated click handler to open detail
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.produto-card') || e.target.closest('.story-card');
    if (!card) return;

    // ignore clicks on buttons inside the card
    if (e.target.closest('.add-to-cart') || e.target.closest('.add-to-cart-story') || e.target.closest('.share-product')) return;

    const id = card.getAttribute('data-id') || card.dataset.id;
    if (id) {
      openProductDetail(id);
    }
  });

  // expose for debugging
  window.openProductDetail = openProductDetail;
  window.closeProductDetail = closeProductDetail;
})();

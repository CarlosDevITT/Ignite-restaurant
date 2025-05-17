// Variáveis globais
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Função para carregar produtos
async function loadProducts() {
  try {
    showLoading('Carregando cardápio...');
    const response = await fetch('data/products.json');
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    products = await response.json();
    renderProducts();
    Swal.close();
  } catch (error) {
    console.error('Falha ao carregar produtos:', error);
    showAlert('Erro', 'Não foi possível carregar o cardápio', 'error');
  }
}

// Exibe loading
function showLoading(message) {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    showConfirmButton: false,
    willOpen: () => Swal.showLoading()
  });
}

// Alert personalizado
function showAlert(title, text, icon, position = 'center') {
  return Swal.fire({
    position,
    title,
    text,
    icon,
    showConfirmButton: position === 'center',
    timer: position !== 'center' ? 2000 : undefined,
    toast: position !== 'center',
    confirmButtonColor: '#069c54',
    background: '#ffffff'
  });
}

// Salva carrinho no localStorage
function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

// Atualiza contador do carrinho
function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartCount = document.getElementById('cart-count');
  if (cartCount) {
    cartCount.textContent = count;
    cartCount.classList.toggle('hidden', count === 0);
  }
}

// Atualiza total do carrinho
function updateCartTotal() {
  const total = cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.id);
    return sum + (product?.price * item.quantity || 0);
  }, 0);

  const cartTotalElement = document.getElementById('cart-total');
  if (cartTotalElement) {
    cartTotalElement.textContent = `R$ ${total.toFixed(2)}`;
  }
}

// Adiciona produto ao carrinho
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const existingItem = cart.find(item => item.id === productId);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({id: productId, quantity: 1});
  }

  saveCart();
  renderCart();
  animateCartIcon();
  showAlert('✔ Adicionado', product.name, 'success', 'top-end');
}

// Remove produto do carrinho
function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  saveCart();
  renderCart();
  showAlert('Removido', 'Item removido do carrinho', 'info', 'top-end');
}

// Atualiza quantidade
function updateQuantity(productId, newQuantity) {
  const item = cart.find(item => item.id === productId);
  if (!item) return;

  if (newQuantity < 1) {
    removeFromCart(productId);
  } else {
    item.quantity = newQuantity;
    saveCart();
    renderCart();
  }
}

// Anima ícone do carrinho
function animateCartIcon() {
  const cartIcon = document.getElementById('cart-count');
  if (cartIcon) {
    cartIcon.classList.add('animate-ping');
    setTimeout(() => cartIcon.classList.remove('animate-ping'), 500);
  }
}

// Renderiza produtos
function renderProducts() {
  const menuSection = document.getElementById('menu');
  const newProductsSection = document.getElementById('new-products');

  if (!products.length) {
    menuSection.innerHTML = '<p class="text-center py-8 text-gray-500">Cardápio não disponível no momento</p>';
    return;
  }

  // Novos produtos
  const newProducts = products.filter(product => product.isNew);
  newProductsSection.innerHTML = newProducts.map(product => createProductCard(product, true)).join('');

  // Produtos normais
  const regularProducts = products.filter(product => !product.isNew);
  menuSection.innerHTML = regularProducts.map(product => createProductCard(product, false)).join('');
}

// Cria card de produto
function createProductCard(product, isNew) {
  return `
    <div class="${isNew ? 'flex-shrink-0 w-64' : 'w-full'} bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <img src="${product.image}" alt="${product.name}" class="w-full ${isNew ? 'h-40' : 'h-48'} object-cover">
      <div class="p-4">
        <h3 class="${isNew ? 'text-lg' : 'text-xl'} font-bold">${product.name}</h3>
        <p class="text-gray-600 ${isNew ? 'text-sm' : ''} mt-2 ${isNew ? 'line-clamp-2' : ''}">${product.description}</p>
        <div class="mt-4 flex justify-between items-center">
          <span class="${isNew ? 'text-md' : 'text-lg'} font-bold">R$ ${product.price.toFixed(2)}</span>
          <button class="add-to-cart bg-primary hover:bg-secondary text-white ${isNew ? 'px-3 py-1 text-sm' : 'px-4 py-2'} rounded transition-colors" data-id="${product.id}">
            Adicionar
          </button>
        </div>
      </div>
    </div>
  `;
}

// Renderiza carrinho
function renderCart() {
  const cartItemsContainer = document.getElementById('cart-items');
  const cartSummary = document.getElementById('cart-summary');

  if (!cartItemsContainer || !cartSummary) return;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="text-center py-8">
        <p class="text-gray-500">Seu carrinho está vazio</p>
        <button class="mt-4 bg-primary hover:bg-secondary text-white px-4 py-2 rounded transition-colors" id="continue-shopping">
          Continuar comprando
        </button>
      </div>
    `;
    cartSummary.classList.add('hidden');
  } else {
    cartItemsContainer.innerHTML = cart.map(item => {
      const product = products.find(p => p.id === item.id) || {};
      return createCartItem(product, item.quantity);
    }).join('');
    updateCartTotal();
    cartSummary.classList.remove('hidden');
  }

  updateCartCount();
}

function checkSchedule() {
  const now = new Date();
  const currentHour = now.getHours();

  const menuSection = document.getElementById('menu');
  const newProductsSection = document.getElementById('new-products');
  const statusMessage = document.getElementById('schedule-status');

  // Se não tem elemento para mostrar status, cria um
  let messageDiv = statusMessage;
  if (!messageDiv) {
    messageDiv = document.createElement('div');
    messageDiv.id = 'schedule-status';
    messageDiv.className = 'text-center py-4 text-red-600 font-bold text-lg';
    document.querySelector('main')?.insertBefore(messageDiv, document.querySelector('main').firstChild);
  }

  if (currentHour >= 18 && currentHour < 22) {
    // Dentro do horário comercial
    menuSection.style.display = 'grid';
    newProductsSection.style.display = 'flex';
    messageDiv.textContent = '';
    document.querySelectorAll('.add-to-cart').forEach(btn => btn.disabled = false);
  } else {
    // Fora do horário
    menuSection.style.display = 'none';
    newProductsSection.style.display = 'none';
    messageDiv.textContent = 'Estamos fechados no momento. Abriremos às 18:00.';
    document.querySelectorAll('.add-to-cart').forEach(btn => btn.disabled = true);
  }
}

// Cria item do carrinho
function createCartItem(product, quantity) {
  return `
    <div class="cart-item border-b pb-4 mb-4" data-id="${product.id}">
      <div class="flex items-start gap-3">
        <img src="${product.image || ''}" alt="${product.name || ''}" class="w-16 h-16 object-cover rounded">
        <div class="flex-1">
          <div class="flex justify-between">
            <h3 class="font-bold">${product.name || 'Produto'}</h3>
            <button class="remove-item text-red-500 hover:text-red-700">✕</button>
          </div>
          <div class="flex justify-between items-center mt-2">
            <div class="flex items-center">
              <button class="decrease-quantity bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-full flex items-center justify-center">−</button>
              <span class="quantity mx-3 font-medium">${quantity}</span>
              <button class="increase-quantity bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-full flex items-center justify-center">+</button>
            </div>
            <span class="item-total font-bold">R$ ${(product.price * quantity).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Controle do Carrinho
function toggleCart() {
  const cartSidebar = document.getElementById('cart-sidebar');
  const cartOverlay = document.getElementById('cart-overlay');
  if (!cartSidebar || !cartOverlay) return;

  cartSidebar.classList.toggle('translate-x-full');
  cartOverlay.classList.toggle('hidden');
  document.body.style.overflow = cartSidebar.classList.contains('translate-x-full') ? 'auto' : 'hidden';

  if (!cartSidebar.classList.contains('translate-x-full')) {
    renderCart();
  }
}

// Finalizar pedido
function setupCheckout() {
  const checkoutButton = document.getElementById('checkout-button');
  if (!checkoutButton) return;

  checkoutButton.addEventListener('click', function () {
    const address = document.getElementById('delivery-address')?.value.trim();
    if (!address) {
      showAlert('Atenção', 'Por favor, insira seu endereço de entrega', 'warning');
      return;
    }

    const phoneNumber = '559285130951'; // Substitua pelo número real
    let message = `*Pedido via Ignite Cardápio Online*\n\n`;
    message += `*Itens do pedido:*\n`;

    cart.forEach(item => {
      const product = products.find(p => p.id === item.id);
      message += `➤ ${product?.name || 'Produto'} (${item.quantity}x) - R$ ${(product?.price * item.quantity).toFixed(2)}\n`;
    });

    const total = cart.reduce((sum, item) => {
      const product = products.find(p => p.id === item.id);
      return sum + (product?.price * item.quantity || 0);
    }, 0);

    message += `\n*Total: R$ ${total.toFixed(2)}*\n`;
    message += `*Endereço:* ${address}\n`;
    message += `\nPor favor, confirme o pedido. Obrigado!`;

    window.open(`https://wa.me/ ${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');

    cart = [];
    saveCart();
    renderCart();
    toggleCart();
    showAlert('Sucesso!', 'Pedido enviado com sucesso', 'success');
  });
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  // Event delegation
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('add-to-cart') || e.target.closest('.add-to-cart')) {
      const button = e.target.classList.contains('add-to-cart') ? e.target : e.target.closest('.add-to-cart');
      addToCart(parseInt(button.dataset.id));
    }

    if (e.target.id === 'cart-button' || e.target.closest('#cart-button')) {
      toggleCart();
    }

    if (e.target.id === 'close-cart' || e.target.id === 'continue-shopping' || e.target.id === 'cart-overlay') {
      toggleCart();
    }

    const cartItem = e.target.closest('.cart-item');
    if (cartItem) {
      const productId = parseInt(cartItem.dataset.id);
      if (e.target.classList.contains('remove-item') || e.target.closest('.remove-item')) {
        removeFromCart(productId);
      } else if (e.target.classList.contains('decrease-quantity') || e.target.closest('.decrease-quantity')) {
        updateQuantity(productId, cart.find(i => i.id === productId)?.quantity - 1);
      } else if (e.target.classList.contains('increase-quantity') || e.target.closest('.increase-quantity')) {
        updateQuantity(productId, cart.find(i => i.id === productId)?.quantity + 1);
      }
    }
  });

  // Inicializa tudo
  loadProducts();
  setupCheckout();
  renderCart();
 });
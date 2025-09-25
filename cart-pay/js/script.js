// Configuração do Supabase
const supabaseUrl = 'https://qgnqztsxfeugopuhyioq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbnF6dHN4ZmV1Z29wdWh5aW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MTg4MjEsImV4cCI6MjA3MzA5NDgyMX0.mW88-7P_Af3WMVAUT7ha4Mf0nyKJoSiNjMfuXiCllIA';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Variáveis globais
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let lastUpdateTime = localStorage.getItem('lastUpdateTime') || 0;

// Debug function
function updateDebug(message) {
  console.log(`[CARDÁPIO] ${new Date().toLocaleTimeString()}: ${message}`);
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  updateDebug('Iniciando cardápio...');
  await loadProducts();
  updateCartCount();
  setupEventListeners();
  checkBusinessHours();
  
  // Atualização automática a cada 30 segundos
  setInterval(async () => {
    await checkForUpdates();
  }, 30000);
});

// Verificar atualizações
async function checkForUpdates() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const lastUpdate = new Date(data[0].updated_at).getTime();
      const storedUpdate = parseInt(localStorage.getItem('lastUpdateTime') || '0');

      if (lastUpdate > storedUpdate) {
        updateDebug('Atualizações detectadas! Recarregando produtos...');
        localStorage.setItem('lastUpdateTime', lastUpdate.toString());
        await loadProducts();
        
        // Mostrar notificação de atualização
        showToast('Cardápio atualizado!');
      }
    }
  } catch (error) {
    updateDebug('Erro ao verificar atualizações: ' + error.message);
  }
}

// Carregar produtos com estrutura completa
async function loadProducts() {
  try {
    showLoading();
    updateDebug('Carregando produtos...');
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('available', true)
      .order('category')
      .order('name');

    if (error) throw error;

    // Validar e normalizar dados
    products = data.map(product => validateProduct(product));
    updateDebug(`✅ ${products.length} produtos carregados e validados`);
    
    // Salvar timestamp da última atualização
    if (data.length > 0) {
      const latestUpdate = Math.max(...data.map(p => new Date(p.updated_at || p.created_at).getTime()));
      localStorage.setItem('lastUpdateTime', latestUpdate.toString());
    }
    
    renderProducts();
    hideLoading();

     // Inicializar Stories Slider após carregar produtos
     setTimeout(() => {
      if (typeof initStoriesSlider === 'function') {
        initStoriesSlider();
      }
    }, 100);
    
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    hideLoading();
    showError('Não foi possível carregar o cardápio. Tente novamente mais tarde.');
  }
}

// Validar estrutura do produto
function validateProduct(product) {
  return {
    id: product.id || generateTempId(),
    name: product.name || 'Produto sem nome',
    description: product.description || '',
    category: product.category || 'outros',
    price: Number(product.price) || 0,
    image_url: product.image_url || null,
    featured: Boolean(product.featured),
    available: product.available !== false,
    promo: Boolean(product.promo),
    promo_price: product.promo_price ? Number(product.promo_price) : null,
    promo_text: product.promo_text || '',
    created_at: product.created_at || new Date().toISOString(),
    updated_at: product.updated_at || new Date().toISOString()
  };
}

// Gerar ID temporário para produtos sem ID
function generateTempId() {
  return 'temp_' + Math.random().toString(36).substr(2, 9);
}

// Função para obter preço de exibição
function getDisplayPrice(product) {
  if (product.promo && product.promo_price !== null && product.promo_price !== undefined) {
    return {
      final: product.promo_price,
      original: product.price,
      hasPromo: true
    };
  }
  return {
    final: product.price,
    hasPromo: false
  };
}

// Renderizar produtos na página
// modifiquei a função renderProducts para:
function renderProducts() {
  renderNewProducts();
  renderMenuProducts();
  
  // Inicializar/atualizar o Stories Slider
  if (typeof refreshStoriesSlider === 'function') {
    refreshStoriesSlider();
  }
}

// Renderizar novos produtos (destaques)
function renderNewProducts() {
  const newProductsContainer = document.getElementById('new-products');
  const featuredProducts = products.filter(product => product.featured && product.available);
  
  if (featuredProducts.length === 0) {
    newProductsContainer.innerHTML = `
      <div class="min-w-[200px] bg-gray-100 rounded-lg p-4 text-center">
        <i class="fas fa-star text-gray-400 text-2xl mb-2"></i>
        <p class="text-gray-500">Nenhum produto em destaque no momento.</p>
      </div>
    `;
    return;
  }
  
  newProductsContainer.innerHTML = featuredProducts.map(product => {
    const priceInfo = getDisplayPrice(product);
    
    return `
      <div class="min-w-[200px] bg-white rounded-lg shadow-md overflow-hidden produto-card">
        <div class="w-full h-32 bg-gray-200 flex items-center justify-center relative">
          ${product.image_url ? 
            `<img src="${product.image_url}" alt="${product.name}" class="w-full h-32 object-cover" 
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
            ''
          }
          <div class="w-full h-32 ${product.image_url ? 'hidden' : 'flex'} items-center justify-center bg-gray-100">
            <i class="fas fa-utensils text-3xl text-gray-400"></i>
          </div>
          ${product.promo ? `
            <div class="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              <i class="fas fa-tag mr-1"></i>PROMO
            </div>
          ` : ''}
        </div>
        <div class="p-3">
          <h3 class="font-bold text-gray-800 truncate">${product.name}</h3>
          <p class="text-sm text-gray-600 mt-1 line-clamp-2 h-10">${product.description || 'Descrição não disponível'}</p>
          <div class="flex justify-between items-center mt-2">
            <div>
              ${priceInfo.hasPromo ? `
                <div class="flex items-center">
                  <span class="font-bold text-red-600">R$ ${priceInfo.final.toFixed(2)}</span>
                  <span class="text-xs text-gray-500 line-through ml-1">R$ ${priceInfo.original.toFixed(2)}</span>
                </div>
              ` : `
                <span class="font-bold text-primary">R$ ${priceInfo.final.toFixed(2)}</span>
              `}
            </div>
            <button class="add-to-cart bg-primary hover:bg-secondary text-white p-2 rounded-full w-8 h-8 flex items-center justify-center transition-colors" 
                    data-id="${product.id}" title="Adicionar ao carrinho">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          ${product.promo_text ? `
            <div class="mt-2 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
              <p class="text-xs text-yellow-800">${product.promo_text}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Renderizar produtos do menu
function renderMenuProducts() {
  const menuContainer = document.getElementById('menu');
  const categories = [...new Set(products.map(product => product.category))];
  
  if (products.length === 0) {
    menuContainer.innerHTML = `
      <div class="col-span-full text-center py-12">
        <i class="fas fa-utensils text-4xl text-gray-400 mb-4"></i>
        <p class="text-gray-500">Nenhum produto disponível no momento.</p>
        <button class="mt-4 bg-primary text-white px-4 py-2 rounded" onclick="location.reload()">
          <i class="fas fa-redo mr-2"></i>Recarregar
        </button>
      </div>
    `;
    return;
  }
  
  menuContainer.innerHTML = categories.map(category => {
    const categoryProducts = products.filter(product => 
      product.category === category && product.available
    );
    
    if (categoryProducts.length === 0) return '';
    
    const categoryNames = {
      'entrada': '🍴 Entradas',
      'principal': '🍽️ Pratos Principais',
      'bebida': '🥤 Bebidas',
      'sobremesa': '🍰 Sobremesas',
      'promocao': '🔥 Promoções',
      'outros': '📦 Outros'
    };
    
    return `
      <div class="col-span-full mb-8">
        <h3 class="text-lg font-bold text-gray-800 border-b-2 border-primary pb-2 mb-4 flex items-center">
          ${categoryNames[category] || category}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${categoryProducts.map(product => {
            const priceInfo = getDisplayPrice(product);
            
            return `
              <div class="bg-white rounded-lg shadow-md overflow-hidden flex produto-card hover:shadow-lg transition-shadow">
                <div class="w-24 h-24 bg-gray-200 flex items-center justify-center relative flex-shrink-0">
                  ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${product.name}" class="w-24 h-24 object-cover"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                    ''
                  }
                  <div class="w-24 h-24 ${product.image_url ? 'hidden' : 'flex'} items-center justify-center bg-gray-100">
                    <i class="fas fa-utensils text-2xl text-gray-400"></i>
                  </div>
                  ${product.promo ? `
                    <div class="absolute top-1 right-1 bg-red-500 text-white text-xs px-1 py-0.5 rounded">
                      PROMO
                    </div>
                  ` : ''}
                </div>
                <div class="p-3 flex-1 min-w-0">
                  <div class="flex justify-between items-start mb-1">
                    <h3 class="font-bold text-gray-800 truncate flex-1">${product.name}</h3>
                    <div class="text-right ml-2">
                      ${priceInfo.hasPromo ? `
                        <div class="flex flex-col items-end">
                          <span class="font-bold text-red-600">R$ ${priceInfo.final.toFixed(2)}</span>
                          <span class="text-xs text-gray-500 line-through">R$ ${priceInfo.original.toFixed(2)}</span>
                        </div>
                      ` : `
                        <span class="font-bold text-primary">R$ ${priceInfo.final.toFixed(2)}</span>
                      `}
                    </div>
                  </div>
                  <p class="text-sm text-gray-600 mb-2">${product.description || ''}</p>
                  ${product.promo_text ? `
                    <div class="mb-2 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                      <p class="text-xs text-yellow-800">${product.promo_text}</p>
                    </div>
                  ` : ''}
                  <button class="add-to-cart bg-primary hover:bg-secondary text-white px-3 py-1 rounded-md text-sm transition-colors w-full" 
                          data-id="${product.id}">
                    <i class="fas fa-cart-plus mr-1"></i>Adicionar
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// Restante do código permanece igual para funções do carrinho...
// [Manter todas as funções do carrinho existentes: addToCart, updateCart, etc.]

// Configurar event listeners
function setupEventListeners() {
  // Botão do carrinho
  document.getElementById('cart-button').addEventListener('click', toggleCart);
  
  // Fechar carrinho
  document.getElementById('close-cart').addEventListener('click', toggleCart);
  
  // Overlay do carrinho
  document.getElementById('cart-overlay').addEventListener('click', toggleCart);
  
  // Finalizar pedido
  document.getElementById('checkout-button').addEventListener('click', checkout);
 
  // Botões de navegação
    document.getElementById('next-story').addEventListener('click', goToNextStory);
    document.getElementById('prev-story').addEventListener('click', goToPrevStory);
  
    // Tela cheia
    document.getElementById('toggle-fullscreen').addEventListener('click', toggleFullscreen);
  
    // Navegação por teclado
    document.addEventListener('keydown', function(e) {
      if (!isFullscreen) return;
      
      if (e.key === 'ArrowRight') goToNextStory();
      if (e.key === 'ArrowLeft') goToPrevStory();
      if (e.key === 'Escape' && isFullscreen) toggleFullscreen();
    });
  
    // Swipe para mobile
    let touchStartX = 0;
    const storiesContainer = document.getElementById('stories-container');
  
    storiesContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      resetAutoplay();
    });
  
    storiesContainer.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
  
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          goToNextStory();
        } else {
          goToPrevStory();
        }
      }
    });
  
    // Clique nas laterais para navegar
    storiesContainer.addEventListener('click', (e) => {
      const featuredProducts = getFeaturedProducts();
      if (featuredProducts.length <= 1) return;
      
      const rect = storiesContainer.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const containerWidth = rect.width;
  
      if (clickX < containerWidth * 0.3) {
        goToPrevStory();
      } else if (clickX > containerWidth * 0.7) {
        goToNextStory();
      }
    });
 
  // Adicionar produtos ao carrinho (delegation)
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('add-to-cart') || e.target.closest('.add-to-cart')) {
      const button = e.target.classList.contains('add-to-cart') ? e.target : e.target.closest('.add-to-cart');
      const productId = button.dataset.id;
      addToCart(productId);
    }
  });
}

// Funções do carrinho (MANTER EXISTENTES)
function addToCart(productId) {
  const product = products.find(p => p.id == productId);
  if (!product) {
    updateDebug('Produto não encontrado: ' + productId);
    return;
  }
  
  const existingItem = cart.find(item => item.id == productId);
  const priceToUse = product.promo && product.promo_price ? product.promo_price : product.price;
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: priceToUse,
      image: product.image_url,
      quantity: 1,
      is_promo: product.promo
    });
  }
  
  updateCart();
  showToast(`${product.name} adicionado ao carrinho!`);
}

function updateCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  renderCartItems();
}

function updateCartCount() {
  const cartCount = document.getElementById('cart-count');
  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
  
  if (totalItems > 0) {
    cartCount.textContent = totalItems;
    cartCount.classList.remove('hidden');
  } else {
    cartCount.classList.add('hidden');
  }
}

function renderCartItems() {
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  
  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-gray-500 py-12">
        <i class="fas fa-shopping-cart text-4xl mb-4"></i>
        <p>Seu carrinho está vazio</p>
        <button class="mt-4 bg-primary text-white px-4 py-2 rounded" onclick="toggleCart()">
          Ver cardápio
        </button>
      </div>
    `;
    cartTotal.textContent = 'R$ 0,00';
    return;
  }
  
  cartItems.innerHTML = cart.map(item => `
    <div class="flex items-center mb-4 pb-4 border-b">
      <div class="w-16 h-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
        ${item.image ? 
          `<img src="${item.image}" alt="${item.name}" class="w-16 h-16 object-cover rounded">` : 
          `<i class="fas fa-image text-gray-400"></i>`
        }
      </div>
      <div class="ml-4 flex-1 min-w-0">
        <h3 class="font-bold truncate">${item.name}</h3>
        <p class="text-primary font-bold">R$ ${item.price.toFixed(2)}</p>
        ${item.is_promo ? '<span class="text-xs bg-red-100 text-red-600 px-1 rounded">PROMO</span>' : ''}
        <div class="flex items-center mt-1">
          <button class="decrease-quantity bg-gray-200 rounded-lg w-6 h-6 flex items-center justify-center" data-id="${item.id}">-</button>
          <span class="mx-2 font-medium">${item.quantity}</span>
          <button class="increase-quantity bg-gray-200 rounded-lg w-6 h-6 flex items-center justify-center" data-id="${item.id}">+</button>
        </div>
      </div>
      <button class="remove-item text-red-500 ml-2 p-2" data-id="${item.id}" title="Remover">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');
  
  // Calcular total
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  cartTotal.textContent = `R$ ${total.toFixed(2)}`;
  
  // Adicionar event listeners para os botões de quantidade
  document.querySelectorAll('.increase-quantity').forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.dataset.id;
      const item = cart.find(item => item.id == itemId);
      if (item) {
        item.quantity += 1;
        updateCart();
      }
    });
  });
  
  document.querySelectorAll('.decrease-quantity').forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.dataset.id;
      const item = cart.find(item => item.id == itemId);
      if (item) {
        item.quantity -= 1;
        if (item.quantity <= 0) {
          cart = cart.filter(i => i.id != itemId);
        }
        updateCart();
      }
    });
  });
  
  document.querySelectorAll('.remove-item').forEach(button => {
    button.addEventListener('click', () => {
      const itemId = button.dataset.id;
      cart = cart.filter(item => item.id != itemId);
      updateCart();
    });
  });
}

function toggleCart() {
  const cartSidebar = document.getElementById('cart-sidebar');
  const cartOverlay = document.getElementById('cart-overlay');
  
  if (cartSidebar.classList.contains('translate-x-full')) {
    cartSidebar.classList.remove('translate-x-full');
    cartOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    renderCartItems();
  } else {
    cartSidebar.classList.add('translate-x-full');
    cartOverlay.classList.add('hidden');
    document.body.style.overflow = 'auto';
  }
}

function checkout() {
  const address = document.getElementById('delivery-address').value.trim();
  
  if (cart.length === 0) {
    showError('Seu carrinho está vazio!');
    return;
  }
  
  if (!address) {
    showError('Por favor, informe o endereço de entrega.');
    return;
  }
  
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Criar mensagem para WhatsApp
  let message = `*Pedido - Ignite Cardápio Online*%0A%0A`;
  message += `*Endereço de entrega:*%0A${address}%0A%0A`;
  message += `*Itens do pedido:*%0A`;
  
  cart.forEach(item => {
    message += `➡️ ${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}`;
    if (item.is_promo) message += ` 🔥PROMO`;
    message += `%0A`;
  });
  
  message += `%0A*Total: R$ ${total.toFixed(2)}*%0A%0A`;
  message += `*Observações:* ...`;
  
  // Abrir WhatsApp
  window.open(`https://wa.me/+5592985130951?text=${message}`, '_blank');
}

function checkBusinessHours() {
  const now = new Date();
  const hour = now.getHours();
  const statusElement = document.getElementById('schedule-status');
  
  if (hour >= 9 && hour < 22) {
    statusElement.innerHTML = `
      <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
        <strong class="font-bold"><i class="fas fa-store mr-2"></i>Estamos abertos!</strong>
        <span class="block sm:inline">Fazemos entregas até às 22:00.</span>
      </div>
    `;
  } else {
    statusElement.innerHTML = `
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
        <strong class="font-bold"><i class="fas fa-store-slash mr-2"></i>Estamos fechados no momento.</strong>
        <span class="block sm:inline">Nosso horário de funcionamento é de Seg à Dom - 09:00 às 22:00</span>
      </div>
    `;
  }
}

// Utilitários
function showLoading() {
  const menu = document.getElementById('menu');
  menu.innerHTML = `
    <div class="col-span-full flex justify-center items-center py-12">
      <div class="loading text-primary"></div>
      <span class="ml-2 text-gray-600">Carregando cardápio...</span>
    </div>
  `;
}

function hideLoading() {
  // O conteúdo será preenchido pela renderização dos produtos
}

function showError(message) {
  const menu = document.getElementById('menu');
  menu.innerHTML = `
    <div class="col-span-full text-center py-12">
      <i class="fas fa-exclamation-circle text-red-500 text-4xl mb-4"></i>
      <p class="text-red-500">${message}</p>
      <button class="mt-4 bg-primary text-white px-4 py-2 rounded" onclick="location.reload()">
        <i class="fas fa-redo mr-2"></i>Tentar novamente
      </button>
    </div>
  `;
}

function showToast(message) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      toast: true,
      position: 'bottom-end',
      icon: 'success',
      title: message,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  } else {
    // Fallback simples
    console.log('Toast:', message);
  }
}

// Forçar atualização manual
window.forceRefresh = async function() {
  updateDebug('Atualização forçada solicitada');
  localStorage.removeItem('lastUpdateTime');
  await loadProducts();
  showToast('Cardápio atualizado!');
};

// Adicionar botão de atualização manual no header (opcional)
function addRefreshButton() {
  const header = document.querySelector('header .container');
  if (header) {
    const refreshBtn = document.createElement('button');
    refreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-1"></i>Atualizar';
    refreshBtn.className = 'fixed bottom-4 left-4 sm:relative sm:bottom-auto sm:left-auto bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm';
    refreshBtn.onclick = window.forceRefresh;
    header.appendChild(refreshBtn);
  }
}

// Inicializar botão de atualização
setTimeout(addRefreshButton, 1000);
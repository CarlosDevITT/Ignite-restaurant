  // Configuração do Supabase - SUBSTITUA com suas credenciais
  const supabaseUrl = 'https://qgnqztsxfeugopuhyioq.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbnF6dHN4ZmV1Z29wdWh5aW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MTg4MjEsImV4cCI6MjA3MzA5NDgyMX0.mW88-7P_Af3WMVAUT7ha4Mf0nyKJoSiNjMfuXiCllIA';
  const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

  // Variáveis globais
  let products = [];
  let cart = JSON.parse(localStorage.getItem('cart')) || [];

  // Inicialização
  document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    updateCartCount();
    setupEventListeners();
    checkBusinessHours();
  });

  // Carregar produtos do Supabase
  async function loadProducts() {
    try {
      showLoading();
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('available', true)
        .order('category')
        .order('name');

      if (error) throw error;

      products = data;
      renderProducts();
      hideLoading();
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      hideLoading();
      showError('Não foi possível carregar o cardápio. Tente novamente mais tarde.');
    }
  }

  // Renderizar produtos na página
  function renderProducts() {
    renderNewProducts();
    renderMenuProducts();
  }

  // Renderizar novos produtos (destaques)
  function renderNewProducts() {
    const newProductsContainer = document.getElementById('new-products');
    const newProducts = products.filter(product => product.featured);
    
    if (newProducts.length === 0) {
      newProductsContainer.innerHTML = '<p class="text-gray-500">Nenhum produto em destaque no momento.</p>';
      return;
    }
    
    newProductsContainer.innerHTML = newProducts.map(product => `
      <div class="min-w-[200px] bg-white rounded-lg shadow-md overflow-hidden">
        <div class="w-full h-32 bg-gray-200 flex items-center justify-center">
          ${product.image_url ? 
            `<img src="${product.image_url}" alt="${product.name}" class="w-full h-32 object-cover">` : 
            `<i class="fas fa-image text-4xl text-gray-400"></i>`
          }
        </div>
        <div class="p-3">
          <h3 class="font-bold text-gray-800">${product.name}</h3>
          <p class="text-sm text-gray-600 mt-1 line-clamp-2">${product.description || 'Sem descrição'}</p>
          <div class="flex justify-between items-center mt-2">
            <span class="font-bold text-primary">R$ ${product.price.toFixed(2)}</span>
            <button class="add-to-cart bg-primary text-white p-1 rounded-full w-8 h-8 flex items-center justify-center" data-id="${product.id}">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
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
        </div>
      `;
      return;
    }
    
    menuContainer.innerHTML = categories.map(category => {
      const categoryProducts = products.filter(product => product.category === category);
      
      return `
        <div class="col-span-full mb-6">
          <h3 class="text-lg font-bold text-gray-800 border-b pb-2 mb-4">${category}</h3>
          <div class="grid grid-cols-1 gap-4">
            ${categoryProducts.map(product => `
              <div class="bg-white rounded-lg shadow-md overflow-hidden flex">
                <div class="w-24 h-24 bg-gray-200 flex items-center justify-center">
                  ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${product.name}" class="w-24 h-24 object-cover">` : 
                    `<i class="fas fa-image text-2xl text-gray-400"></i>`
                  }
                </div>
                <div class="p-3 flex-1">
                  <div class="flex justify-between">
                    <h3 class="font-bold text-gray-800">${product.name}</h3>
                    <span class="font-bold text-primary">R$ ${product.price.toFixed(2)}</span>
                  </div>
                  <p class="text-sm text-gray-600 mt-1">${product.description || ''}</p>
                  <button class="add-to-cart mt-2 bg-primary text-white px-3 py-1 rounded-md text-sm" data-id="${product.id}">
                    Adicionar ao carrinho
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

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
    
    // Adicionar produtos ao carrinho (delegation)
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('add-to-cart') || e.target.closest('.add-to-cart')) {
        const button = e.target.classList.contains('add-to-cart') ? e.target : e.target.closest('.add-to-cart');
        const productId = button.dataset.id;
        addToCart(productId);
      }
    });
  }

  // Funções do carrinho
  function addToCart(productId) {
    const product = products.find(p => p.id == productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.id == productId);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image_url,
        quantity: 1
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
        <div class="flex flex-col items-center justify-center h-full text-gray-500">
          <i class="fas fa-shopping-cart text-4xl mb-4"></i>
          <p>Seu carrinho está vazio</p>
        </div>
      `;
      cartTotal.textContent = 'R$ 0,00';
      return;
    }
    
    cartItems.innerHTML = cart.map(item => `
      <div class="flex items-center mb-4 pb-4 border-b">
        <div class="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
          ${item.image ? 
            `<img src="${item.image}" alt="${item.name}" class="w-16 h-16 object-cover rounded">` : 
            `<i class="fas fa-image text-gray-400"></i>`
          }
        </div>
        <div class="ml-4 flex-1">
          <h3 class="font-bold">${item.name}</h3>
          <p class="text-primary font-bold">R$ ${item.price.toFixed(2)}</p>
          <div class="flex items-center mt-1">
            <button class="decrease-quantity bg-gray-200 rounded-lg w-6 h-6" data-id="${item.id}">-</button>
            <span class="mx-2">${item.quantity}</span>
            <button class="increase-quantity bg-gray-200 rounded-lg w-6 h-6" data-id="${item.id}">+</button>
          </div>
        </div>
        <button class="remove-item text-red-500 ml-2" data-id="${item.id}">
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
      message += `➡️ ${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}%0A`;
    });
    
    message += `%0A*Total: R$ ${total.toFixed(2)}*%0A%0A`;
    message += `*Observações:* ...`;
    
    // Abrir WhatsApp (substitua pelo número correto)
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
    // Usar SweetAlert2 para toasts consistentes
    Swal.fire({
      toast: true,
      position: 'bottom-end',
      icon: 'success',
      title: message,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  }
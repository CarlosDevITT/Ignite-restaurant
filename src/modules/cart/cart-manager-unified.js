// cart-manager-unified.js - Gerenciador Unificado do Carrinho (Mobile e Desktop)

// ✅ NOTA: safeStorage agora é provido globalmente pelo storage-helper.js



class UnifiedCartManager {
  constructor() {
    this.cart = [];
    this.isOpen = false;
    this.deliveryFee = 0;
    this.deliveryTime = null;
    this.init();
  }

  init() {
    // Aguardar um pouco para garantir que DOM está pronto
    setTimeout(() => {
      this.loadCartFromStorage();
      this.setupElements();
      this.attachEventListeners();
      this.syncWithGlobalCart();
      this.updateCartUI();
    }, 100);
  }

  // Método auxiliar para feedback háptico (vibração)
  vibrate(type = 'soft') {
    if (!navigator.vibrate) return;

    if (type === 'soft') {
      navigator.vibrate(20);
    } else if (type === 'medium') {
      navigator.vibrate([30, 10, 30]);
    } else if (type === 'success') {
      navigator.vibrate([10, 50, 20]);
    } else if (type === 'error') {
      navigator.vibrate([100, 50, 100]);
    }
  }

  setupElements() {
    // Elementos do carrinho
    this.cartSidebar = document.getElementById('cart-sidebar');
    this.cartOverlay = document.getElementById('cart-overlay');
    this.cartItems = document.getElementById('cart-items');
    this.cartTotal = document.getElementById('cart-total');
    this.deliveryAddress = document.getElementById('delivery-address');
    this.deliveryPhone = document.getElementById('delivery-phone');
    this.checkoutButton = document.getElementById('checkout-button');
    this.closeCartBtn = document.getElementById('close-cart');

    // Botões do carrinho (mobile, desktop e header)
    this.cartButtonMobile = document.getElementById('cart-button');
    this.cartButtonDesktop = document.getElementById('cart-button-desktop');
    this.cartButtonHeader = document.getElementById('cart-button-header');

    // Contadores
    this.cartCountMobile = document.getElementById('cart-count');
    this.cartCountDesktop = document.getElementById('cart-count-desktop');
    this.cartCountHeader = document.getElementById('cart-count-header');
  }

  attachEventListeners() {
    // Botões de abrir carrinho
    if (this.cartButtonMobile) {
      this.cartButtonMobile.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        this.toggleCart();
      });
    }

    if (this.cartButtonDesktop) {
      this.cartButtonDesktop.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.toggleCart();
      });
    }

    if (this.cartButtonHeader) {
      this.cartButtonHeader.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.toggleCart();
      });
    }

    // Botão fechar
    if (this.closeCartBtn) {
      this.closeCartBtn.addEventListener('click', () => this.closeCart());
    }

    // Overlay
    if (this.cartOverlay) {
      this.cartOverlay.addEventListener('click', () => this.closeCart());
    }


    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.closeCart();
      }
    });
  }

  syncWithGlobalCart() {
    // Sincronizar com carrinho global do script.js se existir
    try {
      const globalCart = JSON.parse(safeStorage.getItem('cart') || '[]');
      const igniteCart = JSON.parse(safeStorage.getItem('igniteCart') || '[]');

      // Usar o carrinho mais atualizado
      const sourceCart = globalCart.length > igniteCart.length ? globalCart : igniteCart;

      if (Array.isArray(sourceCart) && sourceCart.length > 0) {
        // Converter formato se necessário
        this.cart = sourceCart.map(item => ({
          id: item.id,
          name: item.name || item.nome,
          price: item.price || item.preco || 0,
          image: item.image || item.image_url || item.imagem_url,
          quantity: item.quantity || item.quantidade || 1,
          is_promo: item.is_promo || false,
          original_price: item.original_price || null
        }));
        this.saveCartToStorage();
      }
    } catch (error) {
      console.warn('Erro ao sincronizar carrinho:', error);
    }
  }

  toggleCart() {
    if (this.isOpen) {
      this.closeCart();
    } else {
      this.openCart();
    }
  }

  openCart() {
    // Garantir que elementos existem
    if (!this.cartSidebar) {
      this.setupElements();
      if (!this.cartSidebar) {
        console.error('❌ Elemento cart-sidebar não encontrado');
        return;
      }
    }

    this.isOpen = true;
    this.cartSidebar.classList.remove('translate-x-full');
    this.cartSidebar.classList.add('cart-open');

    if (this.cartOverlay) {
      this.cartOverlay.classList.remove('hidden');
      this.cartOverlay.classList.add('visible');
      setTimeout(() => {
        if (this.cartOverlay) {
          this.cartOverlay.style.opacity = '1';
        }
      }, 10);
    }

    document.body.style.overflow = 'hidden';
    this.updateCartUI();
  }

  closeCart() {
    if (!this.cartSidebar) return;

    this.isOpen = false;
    this.cartSidebar.classList.add('translate-x-full');
    this.cartSidebar.classList.remove('cart-open');

    if (this.cartOverlay) {
      this.cartOverlay.style.opacity = '0';
      setTimeout(() => {
        if (this.cartOverlay) {
          this.cartOverlay.classList.add('hidden');
          this.cartOverlay.classList.remove('visible');
        }
      }, 300);
    }

    document.body.style.overflow = '';
  }

  addItem(product) {
    const existingItem = this.cart.find(item => item.id == product.id);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.cart.push({
        id: product.id,
        name: product.name || product.nome,
        price: product.price || product.preco || 0,
        image: product.image || product.image_url || product.imagem_url,
        quantity: 1,
        is_promo: product.is_promo || false,
        original_price: product.original_price || null
      });
    }

    this.saveCartToStorage();
    this.updateCartUI();
    this.vibrate('soft');
  }

  removeItem(productId) {
    this.cart = this.cart.filter(item => item.id != productId);
    this.saveCartToStorage();
    this.updateCartUI();
    this.vibrate('medium');
  }

  updateQuantity(productId, change) {
    const item = this.cart.find(i => i.id == productId);
    if (!item) return;

    const newQuantity = item.quantity + change;

    if (newQuantity <= 0) {
      this.removeItem(productId);
      return;
    }

    if (newQuantity > 99) {
      this.showMessage('Quantidade máxima é 99', 'warning');
      return;
    }

    item.quantity = newQuantity;
    this.saveCartToStorage();
    this.updateCartUI();
    this.vibrate('soft');
  }

  setDeliveryExtra(fee, time) {
    this.deliveryFee = fee;
    this.deliveryTime = time;
    this.updateCartUI();
  }

  updateCartUI() {
    // Atualizar referências se necessário
    if (!this.cartItems) {
      this.setupElements();
    }

    // 1. Atualizar Itens do Carrinho
    if (this.cartItems) {
      if (this.cart.length === 0) {
        this.cartItems.innerHTML = this.getEmptyCartHTML();
        // Esconder botões/blocos que não fazem sentido com carrinho vazio
        if (document.getElementById('cart-clear-btn')) document.getElementById('cart-clear-btn').classList.add('hidden');
        if (document.getElementById('checkout-button')) {
          document.getElementById('checkout-button').className = "w-full bg-gray-300 text-white font-bold text-[17px] py-[14px] rounded-lg cursor-not-allowed border-none flex items-center justify-center";
          document.getElementById('checkout-button').innerHTML = "Carrinho Vazio";
          document.getElementById('checkout-button').disabled = true;
        }
      } else {
        this.cartItems.innerHTML = this.cart.map(item => this.createCartItemHTML(item)).join('');
        this.attachItemEventListeners();

        if (document.getElementById('cart-clear-btn')) {
          document.getElementById('cart-clear-btn').classList.remove('hidden');
          document.getElementById('cart-clear-btn').onclick = () => {
            this.cart = [];
            this.saveCartToStorage();
            this.updateCartUI();
          };
        }

        if (document.getElementById('checkout-button')) {
          document.getElementById('checkout-button').className = "w-full bg-[#069C54] text-white font-bold text-[17px] py-[14px] rounded-lg hover:bg-[#048654] transition-colors border-none cursor-pointer flex items-center justify-center gap-2";
          document.getElementById('checkout-button').innerHTML = "Continuar";
          document.getElementById('checkout-button').disabled = false;
        }
      }
    }

    // 2. Atualizar Totais
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const finalTotal = subtotal + this.deliveryFee;

    const subtotalEl = document.getElementById('cart-subtotal-val');
    const totalEl = document.getElementById('cart-total-val');
    const deliveryFeeEl = document.getElementById('delivery-fee-val');
    const deliveryTimeEl = document.getElementById('delivery-time-val');

    if (subtotalEl) subtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    if (totalEl) totalEl.textContent = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;

    if (this.deliveryFee > 0) {
      if (deliveryFeeEl) deliveryFeeEl.textContent = `R$ ${this.deliveryFee.toFixed(2).replace('.', ',')}`;
      if (deliveryTimeEl) deliveryTimeEl.textContent = `${this.deliveryTime}-${this.deliveryTime + 15} min`;
    }

    // Atualizar "Seu Pedido" fallback antigo se existir
    if (this.cartTotal && this.cartTotal.id !== 'cart-total-val') {
      this.cartTotal.innerHTML = this.getTotalHTML(finalTotal);
    }

    // 3. Atualizar Contadores Header
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    this.updateCartCount(totalItems);

    // 4. Render Cross-Selling "Peça também"
    this.renderCrossSelling();
  }

  createCartItemHTML(item) {
    const subtotal = (item.price * item.quantity).toFixed(2).replace('.', ',');
    const unitPrice = item.price.toFixed(2).replace('.', ',');
    const imageUrl = item.image || '../assets/images/logos/logo.png';
    const extrasText = item.observacao ? `<p class="text-xs text-gray-500 m-0 mt-1">${item.observacao}</p>` : '';

    return `
      <div class="cart-item-redesign border border-gray-100 rounded-lg p-3 bg-white relative flex flex-col gap-2" data-id="${item.id}">
        <div class="flex justify-between items-start">
          <div class="flex-1 pr-2">
            <h4 class="text-[15px] font-medium text-slate-800 m-0 leading-tight mb-2">
              <span class="font-bold">${item.quantity}x</span> ${item.name}
            </h4>
            
            <div class="flex items-center mb-1 mt-2">
               <button class="quantity-btn decrease w-7 h-7 rounded bg-green-50 text-green-700 border border-green-200 flex items-center justify-center font-bold" style="margin-right: 12px;" data-id="${item.id}" type="button"><i class="fas fa-minus text-xs pointer-events-none"></i></button>
               <span class="text-sm font-bold text-slate-700" style="min-width: 20px; text-align: center; margin-right: 12px;">${item.quantity}</span>
               <button class="quantity-btn increase w-7 h-7 rounded bg-green-50 text-green-700 border border-green-200 flex items-center justify-center font-bold" data-id="${item.id}" type="button"><i class="fas fa-plus text-xs pointer-events-none"></i></button>
            </div>
            
            ${extrasText}
            
            <div class="flex items-center mt-3">
              <button class="cart-item__edit text-slate-800 text-[13px] font-bold bg-transparent border-none p-0 cursor-pointer hover:underline" style="margin-right: 16px;" data-id="${item.id}">Editar</button>
              <button class="cart-item__delete text-gray-400 text-[13px] font-medium bg-transparent border-none p-0 cursor-pointer hover:text-red-500 hover:underline" data-id="${item.id}">Remover</button>
            </div>
          </div>
          
          <div class="flex flex-col items-end gap-2">
            <span class="text-[15px] font-bold text-slate-800">R$ ${subtotal}</span>
            <div class="w-14 h-14 rounded-md overflow-hidden bg-gray-50 shadow-sm border border-gray-100 flex-shrink-0">
               <img src="${imageUrl}" alt="${item.name}" class="w-full h-full object-cover">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachItemEventListeners() {
    // Botões de quantidade
    document.querySelectorAll('.quantity-btn.decrease').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.updateQuantity(id, -1);
      });
    });

    document.querySelectorAll('.quantity-btn.increase').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.updateQuantity(id, 1);
      });
    });

    // Input de quantidade
    document.querySelectorAll('.quantity-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = input.dataset.id;
        const newQuantity = parseInt(input.value) || 1;
        const item = this.cart.find(i => i.id == id);
        if (item) {
          item.quantity = Math.max(1, Math.min(99, newQuantity));
          this.saveCartToStorage();
          this.updateCartUI();
        }
      });
    });

    // Botão remover
    document.querySelectorAll('.cart-item__delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.removeItem(id);
      });
    });

    // Botão Editar (Abre o modal usando a função global abrirModalProduto se existir)
    document.querySelectorAll('.cart-item__edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (typeof window.abrirModalProduto === 'function') {
          this.closeCart();
          window.abrirModalProduto(id);
        }
      });
    });
  }

  getEmptyCartHTML() {
    return `
      <div class="flex flex-col items-center justify-center p-8 text-center text-gray-500">
        <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
           <i class="fas fa-shopping-bag text-3xl text-gray-300"></i>
        </div>
        <h3 class="text-lg font-bold text-slate-700 m-0 mb-2">Sua sacola está vazia</h3>
        <p class="text-sm">Adicione itens do cardápio para fazer seu pedido.</p>
      </div>
    `;
  }

  getTotalHTML(total) {
    // Apenas por segurança caso algo chame o getTotalHTML antigo
    return ``;
  }

  renderCrossSelling() {
    const container = document.getElementById('cross-selling-container');
    if (!container) return;

    // Se o array de produtos globais ($produtos ou window.produtos) estiver disponivel
    const allProducts = window.$produtos || window.produtos || [];
    if (allProducts.length === 0) {
      container.parentElement.classList.add('hidden');
      return;
    }

    // Filtrar itens que não estão no carrinho
    const cartIds = this.cart.map(item => String(item.id));
    const available = allProducts.filter(p => !cartIds.includes(String(p.id)));

    if (available.length === 0) {
      container.parentElement.classList.add('hidden');
      return;
    }

    container.parentElement.classList.remove('hidden');

    // Pegar 4 aleatórios
    const shuffled = available.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 4);

    container.innerHTML = selected.map(product => {
      const image = product.image_url || product.imagem_url || '../assets/images/logos/logo.png';
      const price = (product.price || product.preco || 0).toFixed(2).replace('.', ',');
      const name = product.name || product.nome;

      return `
         <div class="min-w-[140px] max-w-[140px] border border-gray-100 rounded-lg p-3 bg-white flex flex-col snap-start cursor-pointer hover:border-[#069C54] transition-colors" onclick="window.unifiedCartManager.addItem({id:'${product.id}', name:'${name}', price:${product.price || product.preco}, image:'${image}'})">
           <div class="w-full h-[100px] mb-2 rounded overflow-hidden">
             <img src="${image}" alt="${name}" class="w-full h-full object-cover">
           </div>
           <h4 class="text-sm font-medium text-slate-800 m-0 leading-tight mb-2 truncate">${name}</h4>
           <div class="mt-auto">
             <span class="text-[15px] font-bold text-[#069C54]">R$ ${price}</span>
           </div>
         </div>
       `;
    }).join('');
  }

  updateCartCount(count) {
    const counts = [this.cartCountMobile, this.cartCountDesktop, this.cartCountHeader];

    counts.forEach(el => {
      if (el) {
        el.textContent = count;
        el.style.display = count > 0 ? 'flex' : 'none';
      }
    });
  }

  async checkout() {
    if (this.cart.length === 0) {
      this.showMessage('Seu carrinho está vazio!', 'warning');
      return;
    }

    // Verificar se o restaurante está aberto
    const now = new Date();
    const hour = now.getHours();
    if (hour < 9 || hour >= 22) {
      this.showMessage('Estamos fechados no momento. Horário: 9h às 22h', 'warning');
      return;
    }

    // Obter dados do Perfil
    let profile = null;
    try {
      profile = JSON.parse(localStorage.getItem('igniteProfile'));
    } catch (e) { }

    // Validar se usuário tem conta
    if (!profile || !profile.phone || !profile.name) {
      this.showMessage('Crie seu perfil para continuar.', 'info');
      this.closeCart();
      setTimeout(() => {
        const modal = document.getElementById('profile-modal');
        if (modal) modal.classList.remove('hidden');
        if (typeof window.navOpenProfile === 'function') {
          window.navOpenProfile();
        }
      }, 400);
      return;
    }

    // Validar se usuário tem endereço
    if (!profile.address || profile.address.length < 5) {
      this.showMessage('Adicione um endereço no seu perfil.', 'warning');
      this.closeCart();
      setTimeout(() => {
        const modal = document.getElementById('profile-modal');
        if (modal) modal.classList.remove('hidden');
        if (typeof window.navOpenProfile === 'function') {
          window.navOpenProfile();
        }

        // Focar no campo de endereço
        setTimeout(() => {
          const addressInput = document.getElementById('prof-edit-address');
          if (addressInput) {
            addressInput.focus();
            addressInput.style.border = '2px solid #069C54';
          }
        }, 300);
      }, 400);
      return;
    }

    const address = profile.address;
    const phone = profile.phone;
    const name = profile.name;

    // Calcular itens e total
    const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemsSimplificados = this.cart.map(item => ({
      id: item.id,
      nome: item.name,
      quantidade: item.quantity,
      preco_unitario: item.price,
      subtotal: item.price * item.quantity,
      observacao: item.observacao || ''
    }));

    // Tentar salvar no Supabase primeiro
    if (window.supabaseManager && typeof window.supabaseManager.salvarPedido === 'function') {
      try {
        // Se formos salvar também via PIX depois, o status deveria ser pendente de pgto, master "novo" ou "pendente" atende
        const pedidoEnviado = await window.supabaseManager.salvarPedido({
          items: itemsSimplificados,
          total: total,
          endereco: address,
          telefone: phone
        });

        if (!pedidoEnviado) {
          console.warn("Aviso: Falha ao salvar no Supabase, mas prosseguiremos com WhatsApp.");
        }
      } catch (e) {
        console.error("Erro inesperado ao salvar pedido:", e);
      }
    }

    // Gerar mensagem WhatsApp
    const message = this.generateWhatsAppMessage(address, phone, name);
    const phoneNumber = '5592985130951';
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');

    // Limpar carrinho após envio
    setTimeout(() => {
      this.cart = [];
      this.updateCartUI();
      this.closeCart();
      this.vibrate('success');
      this.showMessage('Pedido enviado com sucesso! Acompanhe pelo WhatsApp.', 'success');
    }, 1000);
  }

  generateWhatsAppMessage(address, phone, name) {
    const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);

    let message = `🍽️ *NOVO PEDIDO - IGNITE RESTAURANT*\n\n`;

    if (name) {
      message += `👤 *Cliente:* ${name.toUpperCase()}\n\n`;
    }

    message += `📋 *ITENS DO PEDIDO:*\n`;

    this.cart.forEach((item, index) => {
      message += `${index + 1}. ${item.quantity}x ${item.name}`;
      message += ` - R$ ${(item.price * item.quantity).toFixed(2)}`;
      if (item.is_promo) message += ` 🔥`;
      message += `\n`;
    });

    message += `\n💰 *RESUMO:*\n`;
    message += `• Total de itens: ${totalItems}\n`;
    message += `• *Total: R$ ${total.toFixed(2)}*\n\n`;
    message += `📍 *ENDEREÇO DE ENTREGA:*\n${address}\n\n`;
    message += `📞 *TELEFONE:*\n${phone}\n\n`;
    message += `🕐 Pedido realizado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
    message += `💬 *OBSERVAÇÕES:* (adicione aqui)`;

    return message;
  }

  showMessage(text, type = 'info') {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: type,
        title: text,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } else {
      alert(text);
    }
  }

  saveCartToStorage() {
    try {
      safeStorage.setItem('igniteCart', JSON.stringify(this.cart));
      safeStorage.setItem('cart', JSON.stringify(this.cart));
    } catch (e) {
      // Silenciado - safeStorage já trata internamente
    }
  }

  loadCartFromStorage() {
    try {
      const igniteCart = safeStorage.getItem('igniteCart');
      const cartStorage = safeStorage.getItem('cart');

      let saved = igniteCart || cartStorage;

      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.cart = parsed;
          return;
        }
      }
    } catch (error) {
      // Silenciado - safeStorage já trata internamente
    }

    // Fallback ou se estiver vazio
    if (!this.cart) this.cart = [];
  }

  clear() {
    this.cart = [];
    this.saveCartToStorage();
    this.updateCartUI();
  }

  getCart() {
    return this.cart;
  }

  getTotal() {
    return this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }
}

// Inicializar gerenciador unificado
let unifiedCartManagerInstance = null;

function initUnifiedCartManager() {
  if (!unifiedCartManagerInstance) {
    unifiedCartManagerInstance = new UnifiedCartManager();
    window.unifiedCartManager = unifiedCartManagerInstance;

    // Compatibilidade com código antigo
    if (typeof window.cartManager === 'undefined') {
      window.cartManager = unifiedCartManagerInstance;
    }

    console.log('✅ UnifiedCartManager inicializado');
  }
  return unifiedCartManagerInstance;
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initUnifiedCartManager, 200);
  });
} else {
  setTimeout(initUnifiedCartManager, 200);
}

// Exportar para uso global
window.toggleCart = function () {
  if (window.unifiedCartManager) {
    window.unifiedCartManager.toggleCart();
  }
};


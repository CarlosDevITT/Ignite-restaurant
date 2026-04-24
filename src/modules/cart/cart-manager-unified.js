// cart-manager-unified.js - Gerenciador Unificado do Carrinho (Mobile e Desktop)

/**
 * Padroniza o tipo de pedido para os valores aceitos pelo sistema: delivery, retirada, local.
 * @param {string} type 
 * @returns {'delivery' | 'retirada' | 'local'}
 */
function normalizeOrderType(type) {
  if (!type) return 'delivery';
  
  const map = {
    'delivery': 'delivery',
    'takeaway': 'retirada',
    'pickup': 'retirada',
    'retirada': 'retirada',
    'local': 'local',
    'dinein': 'local',
    'dine_in': 'local',
    'mesa': 'local'
  };
  
  return map[type.toLowerCase()] || 'delivery';
}

// Tornar global para ser usado em outros módulos (como o painel administrativo)
window.normalizeOrderType = normalizeOrderType;

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
    const openButtons = [this.cartButtonMobile, this.cartButtonDesktop, this.cartButtonHeader];
    openButtons.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.toggleCart();
        });
      }
    });

    // Botão fechar
    if (this.closeCartBtn) {
      this.closeCartBtn.addEventListener('click', () => this.closeCart());
    }

    // Overlay
    if (this.cartOverlay) {
      this.cartOverlay.addEventListener('click', () => this.closeCart());
    }

    // Botão de Checkout (Finalizar Pedido)
    if (this.checkoutButton) {
      this.checkoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.checkout();
      });
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
      if (typeof safeStorage === 'undefined') return;

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
          original_price: item.original_price || null,
          observacao: item.observacao || ''
        }));
        this.saveCartToStorage();
      }
    } catch (error) {
      console.warn('Erro ao sincronizar carrinho:', error);
    }
  }

  toggleCart() {
    this.isOpen ? this.closeCart() : this.openCart();
  }

  openCart() {
    if (!this.cartSidebar) {
      this.setupElements();
      if (!this.cartSidebar) return;
    }

    this.isOpen = true;
    this.cartSidebar.classList.remove('translate-x-full');
    this.cartSidebar.classList.add('cart-open');

    if (this.cartOverlay) {
      this.cartOverlay.classList.remove('hidden');
      this.cartOverlay.classList.add('visible');
      setTimeout(() => {
        if (this.cartOverlay) this.cartOverlay.style.opacity = '1';
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
    const existingItem = this.cart.find(item => String(item.id) === String(product.id));

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
        original_price: product.original_price || null,
        observacao: product.observacao || ''
      });
    }

    this.saveCartToStorage();
    this.updateCartUI();
    this.vibrate('soft');
  }

  removeItem(productId) {
    this.cart = this.cart.filter(item => String(item.id) !== String(productId));
    this.saveCartToStorage();
    this.updateCartUI();
    this.vibrate('medium');
  }

  updateQuantity(productId, change) {
    if (this._updating) return; 
    this._updating = true;
    
    const item = this.cart.find(i => String(i.id) === String(productId));
    if (!item) { this._updating = false; return; }

    const newQuantity = item.quantity + change;

    if (newQuantity <= 0) {
      this.removeItem(productId);
      this._updating = false;
      return;
    }

    if (newQuantity > 99) {
      this.showMessage('Quantidade máxima é 99', 'warning');
      this._updating = false;
      return;
    }

    item.quantity = newQuantity;
    this.saveCartToStorage();
    this.updateCartUI();
    this.vibrate('soft');
    
    setTimeout(() => { this._updating = false; }, 100);
  }

  setDeliveryExtra(fee, time) {
    this.deliveryFee = Number(fee) || 0;
    this.deliveryTime = time;
    this.updateCartUI();
  }

  // Método centralizado para obter o tipo de pedido normalizado
  getCurrentOrderType() {
    const rawType = typeof window.getSelectedOrderType === 'function' ? window.getSelectedOrderType() : 'delivery';
    return normalizeOrderType(rawType);
  }

  updateCartUI() {
    if (!this.cartItems) this.setupElements();

    // 1. Atualizar Itens do Carrinho
    if (this.cartItems) {
      if (this.cart.length === 0) {
        this.cartItems.innerHTML = this.getEmptyCartHTML();
        if (document.getElementById('cart-clear-btn')) document.getElementById('cart-clear-btn').classList.add('hidden');
        if (this.checkoutButton) {
          this.checkoutButton.className = "w-full bg-gray-300 text-white font-bold text-[17px] py-[14px] rounded-lg cursor-not-allowed border-none flex items-center justify-center";
          this.checkoutButton.innerHTML = "Carrinho Vazio";
          this.checkoutButton.disabled = true;
        }
      } else {
        this.cartItems.innerHTML = this.cart.map(item => this.createCartItemHTML(item)).join('');
        this.attachItemEventListeners();

        const clearBtn = document.getElementById('cart-clear-btn');
        if (clearBtn) {
          clearBtn.classList.remove('hidden');
          clearBtn.onclick = () => {
            if (confirm('Deseja realmente limpar o carrinho?')) {
              this.clear();
            }
          };
        }

        if (this.checkoutButton) {
          this.checkoutButton.className = "w-full bg-[#069C54] text-white font-bold text-[17px] py-[14px] rounded-lg hover:bg-[#048654] transition-colors border-none cursor-pointer flex items-center justify-center gap-2";
          this.checkoutButton.innerHTML = "Continuar";
          this.checkoutButton.disabled = false;
        }
      }
    }

    // 2. Atualizar Totais com regra de Taxa de Entrega
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderType = this.getCurrentOrderType();
    
    // Taxa de entrega SÓ se for delivery
    const effectiveDeliveryFee = orderType === 'delivery' ? this.deliveryFee : 0;
    const finalTotal = subtotal + effectiveDeliveryFee;

    const subtotalEl = document.getElementById('cart-subtotal-val');
    const totalEl = document.getElementById('cart-total-val');
    const deliveryFeeEl = document.getElementById('delivery-fee-val');
    const deliveryTimeEl = document.getElementById('delivery-time-val');
    const deliveryRowEl = document.getElementById('cart-delivery-row');

    if (subtotalEl) subtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    if (totalEl) totalEl.textContent = `R$ ${finalTotal.toFixed(2).replace('.', ',')}`;

    // Mostrar/Esconder linha de entrega baseado no tipo
    if (orderType === 'delivery') {
      if (deliveryRowEl) deliveryRowEl.classList.remove('hidden');
      if (deliveryFeeEl) deliveryFeeEl.textContent = `R$ ${this.deliveryFee.toFixed(2).replace('.', ',')}`;
      if (deliveryTimeEl && this.deliveryTime) {
        deliveryTimeEl.textContent = `${this.deliveryTime}-${this.deliveryTime + 15} min`;
      }
    } else {
      if (deliveryRowEl) deliveryRowEl.classList.add('hidden');
    }

    // 3. Atualizar Contadores
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    this.updateCartCount(totalItems);

    // 4. Render Cross-Selling
    this.renderCrossSelling();
  }

  createCartItemHTML(item) {
    const subtotal = (item.price * item.quantity).toFixed(2).replace('.', ',');
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
    document.querySelectorAll('.quantity-btn.decrease').forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); this.updateQuantity(btn.dataset.id, -1); };
    });

    document.querySelectorAll('.quantity-btn.increase').forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); this.updateQuantity(btn.dataset.id, 1); };
    });

    document.querySelectorAll('.cart-item__delete').forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); this.removeItem(btn.dataset.id); };
    });

    document.querySelectorAll('.cart-item__edit').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (typeof window.abrirModalProduto === 'function') {
          this.closeCart();
          window.abrirModalProduto(btn.dataset.id);
        }
      };
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

  renderCrossSelling() {
    const container = document.getElementById('cross-selling-container');
    if (!container) return;

    const allProducts = window.$produtos || window.produtos || [];
    if (allProducts.length === 0) {
      if (container.parentElement) container.parentElement.classList.add('hidden');
      return;
    }

    const cartIds = this.cart.map(item => String(item.id));
    const available = allProducts.filter(p => !cartIds.includes(String(p.id)));

    if (available.length === 0) {
      if (container.parentElement) container.parentElement.classList.add('hidden');
      return;
    }

    if (container.parentElement) container.parentElement.classList.remove('hidden');

    const shuffled = available.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 4);

    container.innerHTML = selected.map(product => {
      const image = product.image_url || product.imagem_url || '../assets/images/logos/logo.png';
      const priceFormatted = (product.price || product.preco || 0).toFixed(2).replace('.', ',');
      const name = product.name || product.nome;

      return `
         <div class="min-w-[140px] max-w-[140px] border border-gray-100 rounded-lg p-3 bg-white flex flex-col snap-start cursor-pointer hover:border-[#069C54] transition-colors" onclick="window.unifiedCartManager.addItem({id:'${product.id}', name:'${name}', price:${product.price || product.preco}, image:'${image}'})">
           <div class="w-full h-[100px] mb-2 rounded overflow-hidden">
             <img src="${image}" alt="${name}" class="w-full h-full object-cover">
           </div>
           <h4 class="text-sm font-medium text-slate-800 m-0 leading-tight mb-2 truncate">${name}</h4>
           <div class="mt-auto">
             <span class="text-[15px] font-bold text-[#069C54]">R$ ${priceFormatted}</span>
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

    // Horário de funcionamento centralizado
    const now = new Date();
    const hour = now.getHours();
    if (hour < 9 || hour >= 23) {
      this.showMessage('Estamos fechados no momento. Horário: 09h às 23h', 'warning');
      return;
    }

    // Perfil do Usuário
    let profile = null;
    try {
      profile = JSON.parse(localStorage.getItem('igniteProfile'));
    } catch (e) { }

    if (!profile || !profile.phone || !profile.name) {
      this.showMessage('Crie seu perfil para continuar.', 'info');
      this.closeCart();
      setTimeout(() => {
        if (typeof window.navOpenProfile === 'function') window.navOpenProfile();
      }, 400);
      return;
    }

    const cleanPhone = profile.phone ? profile.phone.replace(/\D/g, '') : '';
    const orderType = this.getCurrentOrderType();

    // Validação de endereço apenas para delivery
    if (orderType === 'delivery' && (!profile.address || profile.address.length < 10)) {
      this.showMessage('Informe seu endereço completo para entrega.', 'warning');
      this.closeCart();
      setTimeout(() => {
        if (typeof window.navOpenProfile === 'function') window.navOpenProfile();
      }, 400);
      return;
    }

    const address = profile.address || 'Não informado';
    const name = profile.name;

    // Calcular itens e total final (Taxa de entrega só se for delivery)
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const effectiveDeliveryFee = orderType === 'delivery' ? (this.deliveryFee || 0) : 0;
    const total = subtotal + effectiveDeliveryFee;

    const itemsSimplificados = this.cart.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.price * item.quantity,
      observacao: item.observacao || ''
    }));

    // Iniciar carregamento
    if (this.checkoutButton) {
      const originalText = this.checkoutButton.innerHTML;
      this.checkoutButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processando...`;
      this.checkoutButton.disabled = true;
      
      try {
        const payment = typeof window.getSelectedPaymentMethod === 'function' ? window.getSelectedPaymentMethod() : { method: 'não informada' };

        const payload = {
          items: itemsSimplificados,
          total: total,
          subtotal: subtotal,
          endereco: address,
          telefone: cleanPhone,
          nome: name,
          tipo_pedido: orderType, // NORMALIZADO: delivery, retirada ou local
          forma_pagamento: payment.method || 'não informada',
          taxa_entrega: effectiveDeliveryFee,
          status: 'pendente'
        };

        // 1. Enviar para Supabase
        if (window.supabaseManager && typeof window.supabaseManager.finalizarPedido === 'function') {
           const result = await window.supabaseManager.finalizarPedido(payload);
           if (!result || !result.success) {
             console.warn("Aviso: Falha ao salvar no Supabase:", result?.error);
           }
        }

        // 2. Gerar URL WhatsApp como fallback/confirmação
        const message = this.generateWhatsAppMessage(address, cleanPhone, name, payment);
        const storePhone = '5592985130951'; // Telefone do restaurante
        const whatsappUrl = `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`;

        // 3. Sucesso! Limpar e Notificar
        this.clear();
        this.closeCart();
        this.vibrate('success');
        
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            title: 'Pedido Recebido! 🎉',
            html: `<p>Seu pedido de <b>${orderType}</b> foi enviado com sucesso.</p>`,
            icon: 'success',
            showCancelButton: true,
            confirmButtonColor: '#069C54',
            cancelButtonColor: '#25D366',
            confirmButtonText: 'Ver Meus Pedidos',
            cancelButtonText: '<i class="fab fa-whatsapp"></i> Confirmar no WhatsApp',
            reverseButtons: true
          }).then((result) => {
            if (!result.isConfirmed && result.dismiss === Swal.DismissReason.cancel) {
              window.open(whatsappUrl, '_blank');
            } else if (result.isConfirmed) {
              if (typeof window.openOrderHistory === 'function') window.openOrderHistory();
            }
          });
        }

      } catch (e) {
        console.error("Erro no checkout:", e);
        this.showMessage('Erro ao processar pedido.', 'error');
      } finally {
        this.checkoutButton.innerHTML = originalText;
        this.checkoutButton.disabled = false;
      }
    }
  }

  generateWhatsAppMessage(address, phone, name, payment = null) {
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const orderType = this.getCurrentOrderType();
    const fee = orderType === 'delivery' ? this.deliveryFee : 0;
    const total = subtotal + fee;

    const paymentLabels = {
      credit: '💳 Cartão de Crédito',
      debit:  '💳 Cartão de Débito',
      pix:    '🔑 PIX',
      cash:   '💵 Dinheiro'
    };

    const typeLabels = {
      delivery: '🛵 Delivery',
      retirada: '🏪 Retirada no Balcão',
      local:    '🍽️ Comer no Local'
    };

    let message = `*🍽️ NOVO PEDIDO - IGNITE RESTAURANT*\n`;
    message += `--------------------------------\n`;
    message += `📝 *TIPO:* ${typeLabels[orderType]}\n`;
    message += `👤 *CLIENTE:* ${name}\n`;
    message += `📞 *CONTATO:* ${phone}\n`;
    message += `--------------------------------\n\n`;

    message += `📋 *ITENS:*\n`;
    this.cart.forEach((item) => {
      message += `• ${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}\n`;
      if (item.observacao) message += `   _Obs: ${item.observacao}_\n`;
    });

    message += `\n💰 *VALORES:*\n`;
    message += `• Subtotal: R$ ${subtotal.toFixed(2)}\n`;
    if (orderType === 'delivery') message += `• Taxa de Entrega: R$ ${fee.toFixed(2)}\n`;
    message += `• *TOTAL: R$ ${total.toFixed(2)}*\n\n`;

    if (payment) {
      message += `💳 *PAGAMENTO:* ${paymentLabels[payment.method] || payment.method}\n`;
      if (payment.method === 'cash' && payment.needsChange) {
        message += `💵 *TROCO PARA:* R$ ${(payment.changeAmount || 0).toFixed(2)}\n`;
      }
    }

    message += `\n📍 *LOCALIZAÇÃO:*\n`;
    if (orderType === 'delivery') {
      message += `${address}\n`;
    } else if (orderType === 'local') {
      message += `Consumo no Local\n`;
    } else {
      message += `Retirada no Balcão\n`;
    }
    
    message += `\n🕐 _Pedido realizado às ${new Date().toLocaleTimeString('pt-BR')}_`;

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
      if (typeof safeStorage !== 'undefined') {
        safeStorage.setItem('igniteCart', JSON.stringify(this.cart));
        safeStorage.setItem('cart', JSON.stringify(this.cart));
      }
    } catch (e) { }
  }

  loadCartFromStorage() {
    try {
      if (typeof safeStorage === 'undefined') return;
      const saved = safeStorage.getItem('igniteCart') || safeStorage.getItem('cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) this.cart = parsed;
      }
    } catch (e) { }
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
    const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderType = this.getCurrentOrderType();
    const fee = orderType === 'delivery' ? this.deliveryFee : 0;
    return subtotal + fee;
  }
}

// Inicializar gerenciador unificado
let unifiedCartManagerInstance = null;

function initUnifiedCartManager() {
  if (!unifiedCartManagerInstance) {
    unifiedCartManagerInstance = new UnifiedCartManager();
    window.unifiedCartManager = unifiedCartManagerInstance;

    // Compatibilidade com código legado
    if (typeof window.cartManager === 'undefined') {
      window.cartManager = unifiedCartManagerInstance;
    }

    console.log('✅ UnifiedCartManager inicializado e padronizado');
  }
  return unifiedCartManagerInstance;
}

// Inicialização segura
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initUnifiedCartManager, 200));
} else {
  setTimeout(initUnifiedCartManager, 200);
}

// Global toggle
window.toggleCart = () => window.unifiedCartManager?.toggleCart();

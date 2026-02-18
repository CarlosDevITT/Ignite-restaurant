// cart-manager.js - Gerenciador do Carrinho
class CartManager {
  constructor() {
    this.cart = [];
    this.cartSidebar = document.getElementById('cart-sidebar');
    this.cartButton = document.getElementById('cart-button');
    this.closeCartBtn = document.getElementById('close-cart');
    this.cartOverlay = document.getElementById('cart-overlay');
    this.cartItems = document.getElementById('cart-items');
    this.cartTotal = document.getElementById('cart-total');
    this.deliveryAddress = document.getElementById('delivery-address');
    this.checkoutButton = document.getElementById('checkout-button');
    
    this.init();
  }

  init() {
    this.loadCartFromStorage();
    this.attachEventListeners();
    this.updateCartUI();
  }

  attachEventListeners() {
    // Abrir carrinho
    if (this.cartButton) {
      this.cartButton.addEventListener('click', () => this.openCart());
    }

    // Fechar carrinho
    if (this.closeCartBtn) {
      this.closeCartBtn.addEventListener('click', () => this.closeCart());
    }

    // Fechar ao clicar no overlay
    if (this.cartOverlay) {
      this.cartOverlay.addEventListener('click', () => this.closeCart());
    }

    // Checkout
    if (this.checkoutButton) {
      this.checkoutButton.addEventListener('click', () => this.checkout());
    }
  }

  openCart() {
    if (!this.cartSidebar) return;
    
    this.cartSidebar.classList.add('show');
    this.cartSidebar.style.transform = 'translateX(0)';
    
    if (this.cartOverlay) {
      this.cartOverlay.classList.remove('hidden');
    }
    
    document.body.style.overflow = 'hidden';
  }

  closeCart() {
    if (!this.cartSidebar) return;
    
    this.cartSidebar.classList.remove('show');
    this.cartSidebar.style.transform = 'translateX(100%)';
    
    if (this.cartOverlay) {
      this.cartOverlay.classList.add('hidden');
    }
    
    document.body.style.overflow = 'auto';
  }

  addItem(product) {
    const existingItem = this.cart.find(item => item.id === product.id);
    
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      this.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1
      });
    }
    
    this.saveCartToStorage();
    this.updateCartUI();
  }

  removeItem(productId) {
    this.cart = this.cart.filter(item => item.id !== productId);
    this.saveCartToStorage();
    this.updateCartUI();
  }

  updateQuantity(productId, quantity) {
    const item = this.cart.find(i => i.id === productId);
    if (item) {
      item.quantity = Math.max(1, quantity);
      this.saveCartToStorage();
      this.updateCartUI();
    }
  }

  updateCartUI() {
    if (!this.cartItems) return;

    // Atualizar itens
    this.cartItems.innerHTML = '';
    
    if (this.cart.length === 0) {
      this.cartItems.innerHTML = `
        <div style="text-align: center; color: var(--text-color-light); padding: 2rem;">
          <i class="fas fa-shopping-cart" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
          <p>Seu carrinho está vazio</p>
        </div>
      `;
    } else {
      this.cart.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
          <div style="flex: 1;">
            <div class="cart-item-title">${item.name}</div>
            <div class="cart-item-price">R$ ${(item.price * item.quantity).toFixed(2)}</div>
            <div class="cart-item-quantity" style="display: flex; align-items: center; gap: 0.5rem;">
              <button class="quantity-btn" onclick="window.cartManager.updateQuantity('${item.id}', ${item.quantity - 1})">−</button>
              <span>${item.quantity}</span>
              <button class="quantity-btn" onclick="window.cartManager.updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
              <button class="remove-btn" onclick="window.cartManager.removeItem('${item.id}')" style="margin-left: auto;">✕</button>
            </div>
          </div>
        `;
        this.cartItems.appendChild(itemEl);
      });
    }

    // Atualizar total
    const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (this.cartTotal) {
      this.cartTotal.textContent = `R$ ${total.toFixed(2)}`;
    }

    // Atualizar badge do carrinho
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
      const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
      cartCount.textContent = totalItems;
      cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
    }
  }

  checkout() {
    if (this.cart.length === 0) {
      alert('Seu carrinho está vazio!');
      return;
    }

    const address = this.deliveryAddress?.value.trim();
    if (!address) {
      alert('Por favor, preencha o endereço de entrega!');
      return;
    }

    // Construir mensagem WhatsApp
    let message = '🍽️ *Pedido Ignite - Cardápio Online*\n\n';
    message += '📋 *Itens:*\n';
    
    this.cart.forEach(item => {
      message += `• ${item.name} x${item.quantity} - R$ ${(item.price * item.quantity).toFixed(2)}\n`;
    });

    const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    message += `\n💰 *Total: R$ ${total.toFixed(2)}*\n`;
    message += `\n📍 *Endereço: ${address}*`;

    // Número WhatsApp (com código do país)
    const phoneNumber = '5592985130951'; // Número Ignite
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');

    // Limpar carrinho
    this.cart = [];
    this.saveCartToStorage();
    this.updateCartUI();
    this.closeCart();
  }

  saveCartToStorage() {
    localStorage.setItem('igniteCart', JSON.stringify(this.cart));
  }

  loadCartFromStorage() {
    const saved = localStorage.getItem('igniteCart');
    if (saved) {
      this.cart = JSON.parse(saved);
    }
  }

  clear() {
    this.cart = [];
    this.saveCartToStorage();
    this.updateCartUI();
  }
}

// Inicializar gerenciador quando DOM estiver pronto
window.addEventListener('DOMContentLoaded', () => {
  if (typeof window.cartManager === 'undefined') {
    window.cartManager = new CartManager();
  }
});

// Fallback se DOMContentLoaded já passou
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof window.cartManager === 'undefined') {
      window.cartManager = new CartManager();
    }
  });
} else {
  if (typeof window.cartManager === 'undefined') {
    window.cartManager = new CartManager();
  }
}

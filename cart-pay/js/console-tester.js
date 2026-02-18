// console-tester.js - Script de teste para o console

// Copie e cole isso no DevTools Console para testar

console.log('%c🧪 TESTE DE CART-PAY', 'font-size: 16px; font-weight: bold; color: #069C54;');

// 1. Testar CartManager
console.log('%n1️⃣ CartManager:', 'font-weight: bold; color: #069C54;');
if (window.cartManager) {
  console.log('✅ CartManager: OK');
  console.log('   - Métodos:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.cartManager)).filter(m => typeof window.cartManager[m] === 'function'));
} else {
  console.error('❌ CartManager: NÃO ENCONTRADO');
}

// 2. Testar addToCart
console.log('%n2️⃣ addToCart:', 'font-weight: bold; color: #069C54;');
if (typeof addToCart === 'function') {
  console.log('✅ addToCart: OK');
} else {
  console.error('❌ addToCart: NÃO É FUNÇÃO');
}

// 3. Testar Tailwind
console.log('%n3️⃣ Tailwind:', 'font-weight: bold; color: #069C54;');
if (typeof tailwind !== 'undefined') {
  console.log('✅ Tailwind: CARREGADO');
} else {
  console.error('❌ Tailwind: NÃO CARREGADO');
}

// 4. Testar Supabase
console.log('%n4️⃣ Supabase:', 'font-weight: bold; color: #069C54;');
if (window.supabase) {
  console.log('✅ Supabase: OK');
} else {
  console.error('❌ Supabase: NÃO ENCONTRADO');
}

// 5. Testar Elementos do DOM
console.log('%n5️⃣ Elementos DOM:', 'font-weight: bold; color: #069C54;');
const elements = ['cart-sidebar', 'cart-button', 'cart-items', 'cart-total'];
elements.forEach(id => {
  if (document.getElementById(id)) {
    console.log(`✅ #${id}: OK`);
  } else {
    console.error(`❌ #${id}: NÃO ENCONTRADO`);
  }
});

// 6. Testar localStorage
console.log('%n6️⃣ localStorage:', 'font-weight: bold; color: #069C54;');
try {
  const cartData = JSON.parse(localStorage.getItem('igniteCart') || '[]');
  console.log(`✅ localStorage: ${cartData.length} itens`);
} catch (e) {
  console.error('❌ localStorage: ERRO', e);
}

// Funções de teste
console.log('%n📝 Funções de Teste:', 'font-weight: bold; color: #069C54;');
console.log('testCartOpen()      - Testar abrir carrinho');
console.log('testCartClose()     - Testar fechar carrinho');
console.log('testAddProduct()    - Testar adicionar produto');
console.log('testRemoveProduct() - Testar remover produto');
console.log('testCheckout()      - Testar checkout');

window.testCartOpen = function() {
  console.log('📂 Abrindo carrinho...');
  window.cartManager?.openCart();
};

window.testCartClose = function() {
  console.log('📁 Fechando carrinho...');
  window.cartManager?.closeCart();
};

window.testAddProduct = function() {
  console.log('➕ Adicionando produto de teste...');
  window.cartManager?.addItem({
    id: 'test-' + Date.now(),
    name: 'Produto Teste',
    price: 29.90,
    quantity: 1
  });
  console.log('✅ Produto adicionado');
};

window.testRemoveProduct = function() {
  console.log('➖ Removendo primeiro produto...');
  if (window.cartManager?.cart?.length > 0) {
    const id = window.cartManager.cart[0].id;
    window.cartManager.removeItem(id);
    console.log('✅ Produto removido');
  } else {
    console.warn('⚠️ Carrinho vazio');
  }
};

window.testCheckout = function() {
  console.log('💳 Iniciando checkout...');
  const address = 'Rua Teste, 123 - Manaus, AM';
  if (document.getElementById('delivery-address')) {
    document.getElementById('delivery-address').value = address;
  }
  console.log('✅ Endereço preenchido. Clique em "Finalizar via WhatsApp"');
};

console.log('%n✅ TESTES PRONTOS', 'font-size: 14px; font-weight: bold; color: #069C54;');

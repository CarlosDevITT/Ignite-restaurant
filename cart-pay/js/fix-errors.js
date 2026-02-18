// fix-errors.js - Correção de Erros do Cart-Pay

console.log('🔧 Iniciando correção de erros...');

// 1. Evitar erro de Tailwind not defined
if (typeof window === 'undefined') {
  window = {};
}

// Aguardar Tailwind carregar e depois configurar
function setupTailwind() {
  if (typeof tailwind !== 'undefined' && tailwind.config) {
    console.log('✅ Tailwind carregado e configurado');
    return true;
  }
  return false;
}

// Retry até 30 vezes (3 segundos)
let tailwindRetries = 0;
const tailwindInterval = setInterval(() => {
  if (setupTailwind()) {
    clearInterval(tailwindInterval);
  } else if (tailwindRetries++ > 30) {
    clearInterval(tailwindInterval);
    console.warn('⚠️ Tailwind não carregou, usando CSS fallback');
  }
}, 100);

// 2. Evitar erro de Supabase redeclarado
if (typeof window.supabase === 'undefined') {
  window.supabase = {};
  console.log('✅ Supabase namespace inicializado');
}

// 3. Garantir que cartManager exista
if (typeof window.cartManager === 'undefined') {
  console.log('⏳ Aguardando CartManager...');
  
  let cartManagerRetries = 0;
  const checkCartManager = setInterval(() => {
    if (window.cartManager) {
      console.log('✅ CartManager detectado');
      clearInterval(checkCartManager);
    } else if (cartManagerRetries++ > 100) {
      clearInterval(checkCartManager);
      console.error('❌ CartManager não inicializou');
    }
  }, 50);
}

// 4. Garantir que addToCart exista como função global
if (typeof window.addToCart === 'undefined') {
  window.addToCart = function(productId) {
    console.log(`➕ addToCart chamado para produto: ${productId}`);
    
    if (window.cartManager) {
      // Buscar o produto
      const product = window.products?.find(p => p.id == productId);
      if (product) {
        window.cartManager.addItem({
          id: product.id,
          name: product.name,
          price: parseFloat(product.price) || 0,
          image: product.image_url
        });
      }
    } else {
      console.warn('⚠️ CartManager não está disponível');
    }
  };
  console.log('✅ addToCart função criada como fallback');
}

// 5. Verificar DOM essencial
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM Carregado, verificando elementos...');
  
  const essentialElements = [
    'cart-sidebar',
    'cart-button', 
    'cart-items',
    'cart-total',
    'checkout-button',
    'delivery-address'
  ];
  
  essentialElements.forEach(id => {
    if (!document.getElementById(id)) {
      console.warn(`⚠️ Elemento faltando: #${id}`);
    } else {
      console.log(`✅ Elemento encontrado: #${id}`);
    }
  });
});

// 6. Monitorar erros globais
window.addEventListener('error', (event) => {
  console.error('❌ Erro global:', event.error?.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Promise rejection:', event.reason);
});

// 7. Verificar CartManager periodicamente
setInterval(() => {
  if (!window.cartManager && document.readyState === 'complete') {
    console.warn('⚠️ CartManager perdido, tentando reinicializar...');
    // Recarregar cart-manager.js
    const script = document.createElement('script');
    script.src = 'js/cart-manager.js';
    script.defer = true;
    document.head.appendChild(script);
  }
}, 5000);

console.log('🔧 Correção de erros iniciada');

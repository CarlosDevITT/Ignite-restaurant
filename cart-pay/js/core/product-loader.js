// Verifica se funções essenciais existem e aguarda disponibilidade
let maxRetries = 50;
let retryCount = 0;

function waitForAddToCart() {
  if (typeof addToCart === 'function') {
    console.log('✅ Função addToCart disponível');
    initProductLoaders();
  } else if (retryCount < maxRetries) {
    retryCount++;
    setTimeout(waitForAddToCart, 100);
  } else {
    console.error('❌ Função addToCart não encontrada após múltiplas tentativas');
    // Usar cartManager como fallback
    initProductLoaders();
  }
}

// Estado do slider integrado com os produtos existentes
let currentStoryIndex = 0;
let isFullscreen = false;
let autoPlayInterval;
const storyDuration = 5000; // 5 segundos por produto

// Inicializar loaders quando CartManager estiver pronto
function initProductLoaders() {
  initStoriesSlider();
  attachCartListeners();
}

// Aguardar que o CartManager esteja disponível
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForAddToCart);
} else {
  waitForAddToCart();
}

// Inicializar o slider quando os produtos forem carregados
function initStoriesSlider() {
  const featuredProducts = getFeaturedProducts();
  
  if (featuredProducts.length === 0) {
    showEmptyStories();
    return;
  }
  
  renderProgressBars(featuredProducts);
  renderStories(featuredProducts);
  startAutoplay();
  setupEventListeners();
}

// Obter produtos em destaque da lista carregada
function getFeaturedProducts() {
  return products.filter(product => product.featured && product.available);
}

function showEmptyStories() {
  document.getElementById('stories-container').classList.add('hidden');
  document.getElementById('stories-empty').classList.remove('hidden');
  document.getElementById('progress-container').classList.add('hidden');
  document.getElementById('prev-story').classList.add('hidden');
  document.getElementById('next-story').classList.add('hidden');
  document.getElementById('toggle-fullscreen').classList.add('hidden');
}

function renderProgressBars(featuredProducts) {
  const container = document.getElementById('progress-container');
  container.innerHTML = ''; // Limpa as barras existentes
  container.classList.remove('hidden');

  featuredProducts.forEach((_, index) => {
    const progressBar = document.createElement('div');
    progressBar.className = `h-1 flex-1 bg-gray-300 bg-opacity-50 rounded-full overflow-hidden ${index !== 0 ? 'ml-1' : ''}`;
    
    const progressFill = document.createElement('div');
    progressFill.className = 'h-full bg-white bg-opacity-80 w-0 transition-all duration-100 linear';
    progressFill.id = `progress-fill-${index}`;
    
    progressBar.appendChild(progressFill);
    container.appendChild(progressBar);
  });
}

function renderStories(featuredProducts) {
  const container = document.getElementById('stories-container');
  const emptyState = document.getElementById('stories-empty');
  
  container.innerHTML = ''; // Limpa os stories existentes
  container.style.width = `${featuredProducts.length * 100}%`;
  container.classList.remove('hidden');
  emptyState.classList.add('hidden');

  featuredProducts.forEach((product, index) => {
    const storySlide = document.createElement('div');
    storySlide.className = 'w-full flex-shrink-0 relative';
    storySlide.style.width = `${100 / featuredProducts.length}%`;

    const priceInfo = getDisplayPrice(product);
    
    storySlide.innerHTML = `
      <div class="w-full h-64 md:h-96 bg-gray-200 relative">
        ${product.image_url ? 
          `<img src="${product.image_url}" alt="${product.name}" 
                class="w-full h-full object-cover" 
                onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzljYTNhZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuadpea6kOa1i+ivlTwvdGV4dD48L3N2Zz4=';">` : 
          `<div class="w-full h-full flex items-center justify-center bg-gray-100">
            <i class="fas fa-utensils text-6xl text-gray-400"></i>
          </div>`
        }
        
        ${product.promo ? `
          <div class="absolute top-4 right-4 bg-red-500 text-white text-sm px-3 py-1 rounded-full z-10">
            <i class="fas fa-tag mr-1"></i>PROMO
          </div>
        ` : ''}
        
        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/70 to-transparent p-6 text-white">
          <h3 class="font-bold text-xl mb-2">${product.name}</h3>
          <p class="text-sm opacity-90 mb-3">${product.description || 'Delicioso produto preparado com ingredientes selecionados'}</p>
          
          <div class="flex justify-between items-center">
            <div>
              ${priceInfo.hasPromo ? `
                <div class="flex items-center">
                  <span class="font-bold text-2xl text-red-400">R$ ${priceInfo.final.toFixed(2)}</span>
                  <span class="text-sm text-gray-300 line-through ml-2">R$ ${priceInfo.original.toFixed(2)}</span>
                </div>
              ` : `
                <span class="font-bold text-2xl text-primary">R$ ${priceInfo.final.toFixed(2)}</span>
              `}
            </div>
            
            <button class="add-to-cart-story bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg font-bold hover:scale-105 transition-all duration-200"
                    data-id="${product.id}">
              <i class="fas fa-cart-plus mr-2"></i>Adicionar
            </button>
          </div>
          
          ${product.promo_text ? `
            <div class="mt-3 bg-yellow-500 bg-opacity-20 border border-yellow-400 border-opacity-30 rounded-lg px-3 py-2">
              <p class="text-xs text-yellow-200 flex items-center">
                <i class="fas fa-bullhorn mr-1"></i>${product.promo_text}
              </p>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    container.appendChild(storySlide);
  });

  updateSliderPosition(featuredProducts);
}

function updateSliderPosition(featuredProducts) {
  const container = document.getElementById('stories-container');
  const translateX = -((100 / featuredProducts.length) * currentStoryIndex);
  container.style.transform = `translateX(${translateX}%)`;
  updateProgressBars(featuredProducts);
}

function updateProgressBars(featuredProducts) {
  // Reseta todas as barras
  document.querySelectorAll('[id^="progress-fill-"]').forEach((bar, index) => {
    bar.style.width = index < currentStoryIndex ? '100%' : '0%';
    bar.style.transition = 'none';
  });

  // Anima a barra atual
  const currentProgressBar = document.getElementById(`progress-fill-${currentStoryIndex}`);
  if (currentProgressBar && featuredProducts.length > 0) {
    setTimeout(() => {
      currentProgressBar.style.transition = `width ${storyDuration}ms linear`;
      currentProgressBar.style.width = '100%';
    }, 10);
  }
}

function goToNextStory() {
  const featuredProducts = getFeaturedProducts();
  if (featuredProducts.length === 0) return;
  
  if (currentStoryIndex < featuredProducts.length - 1) {
    currentStoryIndex++;
  } else {
    currentStoryIndex = 0;
  }
  updateSliderPosition(featuredProducts);
  resetAutoplay();
}

function goToPrevStory() {
  const featuredProducts = getFeaturedProducts();
  if (featuredProducts.length === 0) return;
  
  if (currentStoryIndex > 0) {
    currentStoryIndex--;
  } else {
    currentStoryIndex = featuredProducts.length - 1;
  }
  updateSliderPosition(featuredProducts);
  resetAutoplay();
}

function startAutoplay() {
  const featuredProducts = getFeaturedProducts();
  if (featuredProducts.length <= 1) return; // Não autoplay se tiver apenas 1 item
  
  clearInterval(autoPlayInterval);
  autoPlayInterval = setInterval(goToNextStory, storyDuration);
}

function resetAutoplay() {
  clearInterval(autoPlayInterval);
  startAutoplay();
}

function toggleFullscreen() {
  const slider = document.getElementById('stories-slider');
  const fullscreenBtn = document.getElementById('toggle-fullscreen');
  const progressContainer = document.getElementById('progress-container');
  const prevBtn = document.getElementById('prev-story');
  const nextBtn = document.getElementById('next-story');
  
  if (!isFullscreen) {
    // 🔥 ENTRAR em tela cheia - CORREÇÃO
    slider.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 50; height: 100vh; width: 100vw; background: black;';
    slider.classList.remove('relative', 'rounded-xl', 'shadow-lg');
    
    // 🔥 Botão de tela cheia - CORREÇÃO (sem !important)
    fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
    fullscreenBtn.style.cssText = 'background: rgba(0,0,0,0.7) !important; bottom: 2rem !important; right: 1.5rem !important; padding: 1rem !important;';
    
    // 🔥 Melhorar visibilidade dos controles
    progressContainer.style.cssText = 'padding-left: 1rem; padding-right: 1rem; padding-top: 1.5rem;';
    prevBtn.style.cssText = 'width: 3rem !important; height: 3rem !important; font-size: 1.125rem !important;';
    nextBtn.style.cssText = 'width: 3rem !important; height: 3rem !important; font-size: 1.125rem !important;';
    
    // 🔥 Prevenir scroll
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // 🔥 Adicionar overlay de instruções para mobile
    if (window.innerWidth <= 768) {
      showMobileInstructions();
    }
    
  } else {
    // 🔥 SAIR da tela cheia - CORREÇÃO
    slider.style.cssText = '';
    slider.classList.add('relative', 'rounded-xl', 'shadow-lg');
    
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    fullscreenBtn.style.cssText = '';
    
    // 🔥 Restaurar controles
    progressContainer.style.cssText = '';
    prevBtn.style.cssText = '';
    nextBtn.style.cssText = '';
    
    // 🔥 Restaurar scroll
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    // 🔥 Remover instruções
    hideMobileInstructions();
  }
  
  isFullscreen = !isFullscreen;
  
  // 🔥 Feedback visual suave
  setTimeout(() => {
    updateSliderPosition(getFeaturedProducts());
  }, 50);
}


// 🔥 NOVAS FUNÇÕES AUXILIARES para melhor UX mobile:

function showMobileInstructions() {
  // Verificar se já mostrou as instruções antes (usando sessionStorage)
  const hasSeenInstructions = sessionStorage.getItem('hasSeenStoryInstructions');
  
  if (!hasSeenInstructions) {
    // Criar overlay de instruções
    const instructionsOverlay = document.createElement('div');
    instructionsOverlay.id = 'mobile-instructions';
    instructionsOverlay.className = 'fixed inset-0 z-60 bg-black bg-opacity-80 flex items-center justify-center p-4';
    instructionsOverlay.innerHTML = `
      <div class="bg-white rounded-2xl p-6 max-w-sm text-center">
        <div class="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-hand-pointer text-white text-2xl"></i>
        </div>
        <h3 class="font-bold text-lg mb-2">Como navegar</h3>
        <p class="text-gray-600 mb-4">
          • Toque na <strong>esquerda</strong> para voltar<br>
          • Toque na <strong>direita</strong> para avançar<br>
          • Deslize para os lados<br>
          • Toque no <strong>X</strong> para sair
        </p>
        <button onclick="hideMobileInstructions(true)" 
                class="bg-primary text-white px-6 py-3 rounded-lg font-bold w-full">
          Entendi!
        </button>
      </div>
    `;
    
    document.body.appendChild(instructionsOverlay);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
      if (document.getElementById('mobile-instructions')) {
        hideMobileInstructions(true);
      }
    }, 5000);
  }
}

function hideMobileInstructions(remember = false) {
  const instructions = document.getElementById('mobile-instructions');
  if (instructions) {
    instructions.remove();
  }
  
  if (remember) {
    sessionStorage.setItem('hasSeenStoryInstructions', 'true');
  }
}

function announceToScreenReader(message) {
  // Criar elemento para leitores de tela
  const announcer = document.getElementById('screen-reader-announcer') || 
                   document.createElement('div');
  
  announcer.id = 'screen-reader-announcer';
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  announcer.className = 'sr-only';
  announcer.textContent = message;
  
  if (!document.getElementById('screen-reader-announcer')) {
    document.body.appendChild(announcer);
  }
}

// Adicionar listeners para botões de carrinho
function attachCartListeners() {
  // Stories
  document.addEventListener('click', (e) => {
    if (e.target.closest('.add-to-cart-story')) {
      const btn = e.target.closest('.add-to-cart-story');
      const productId = btn.getAttribute('data-id');
      handleAddToCart(productId);
    }
  });

  // Menu Principal
  document.addEventListener('click', (e) => {
    if (e.target.closest('.btn-add')) {
      const btn = e.target.closest('.btn-add');
      const productId = btn.getAttribute('data-id');
      handleAddToCart(productId);
    }
  });
}

// Handler centralizado para adicionar ao carrinho
function handleAddToCart(productId) {
  // Tentar usar addToCart se disponível
  if (typeof addToCart === 'function') {
    addToCart(productId);
  } else if (window.cartManager) {
    // Fallback: usar cartManager
    const product = products.find(p => p.id === productId);
    if (product) {
      window.cartManager.addItem({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price) || 0,
        image: product.image_url
      });
      
      // Feedback visual
      const btn = document.querySelector(`[data-id="${productId}"]`);
      if (btn) {
        btn.innerHTML = '<i class="fas fa-check mr-2"></i>Adicionado!';
        btn.disabled = true;
        setTimeout(() => {
          btn.innerHTML = '<i class="fas fa-cart-plus mr-2"></i>Adicionar';
          btn.disabled = false;
        }, 2000);
      }
    }
  } else {
    console.error('Nenhum gerenciador de carrinho disponível');
    alert('Erro ao adicionar ao carrinho. Tente novamente.');
  }
}
  announcer.className = 'sr-only'; // Classe Tailwind para screen readers
  
  announcer.textContent = message;
  
  if (!document.getElementById('screen-reader-announcer')) {
    document.body.appendChild(announcer);
  }
  
  // Limpar após alguns segundos
  setTimeout(() => {
    announcer.textContent = '';
  }, 3000);
}



// Reinicializar o slider quando os produtos forem atualizados
window.refreshStoriesSlider = function() {
  currentStoryIndex = 0;
  initStoriesSlider();
};

// Inicializar quando a DOM estiver pronta
document.addEventListener('DOMContentLoaded', function() {
  // O slider será inicializado após o carregamento dos produtos
});
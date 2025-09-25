// Verifica se funções essenciais existem
if (typeof addToCart === 'undefined') {
  console.warn('Função addToCart não encontrada. O carrinho pode não funcionar corretamente.');
}

// Estado do slider integrado com os produtos existentes
let currentStoryIndex = 0;
let isFullscreen = false;
let autoPlayInterval;
const storyDuration = 5000; // 5 segundos por produto

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
  
  if (!isFullscreen) {
    // Entrar em tela cheia
    slider.classList.add('fixed', 'inset-0', 'z-50', 'h-screen', 'w-screen');
    slider.classList.remove('relative', 'rounded-xl', 'shadow-lg');
    fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
    document.body.style.overflow = 'hidden';
  } else {
    // Sair da tela cheia
    slider.classList.remove('fixed', 'inset-0', 'z-50', 'h-screen', 'w-screen');
    slider.classList.add('relative', 'rounded-xl', 'shadow-lg');
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    document.body.style.overflow = 'auto';
  }
  
  isFullscreen = !isFullscreen;
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
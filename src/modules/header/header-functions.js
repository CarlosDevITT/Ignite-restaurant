// header-functions.js - Funções do Header Mobile e Desktop

/**
 * Gerenciador de Categorias
 */
class CategoriesManager {
  constructor() {
    this.categories = [];
    this.isMenuOpen = false;
    this.init();
  }

  async init() {
    await this.loadCategories();
    this.setupEventListeners();
  }

  async loadCategories() {
    try {
      // Aguardar Supabase estar disponível
      let retries = 0;
      while (retries < 50 && (!window.supabaseManager || !window.supabaseManager.isConnected())) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      if (window.supabaseManager && window.supabaseManager.isConnected()) {
        this.categories = await window.supabaseManager.getCategorias();
      } else {
        // Fallback: tentar carregar diretamente
        const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
        if (client) {
          // Tentar tabela categorias primeiro
          let { data, error } = await client
            .from('categorias')
            .select('*')
            .order('nome');

          // Se não encontrar, tentar categories (inglês)
          if (error || !data || data.length === 0) {
            const result = await client
              .from('categories')
              .select('*')
              .order('name');
            data = result.data;
            error = result.error;
          }

          if (!error && data && data.length > 0) {
            this.categories = data;
          }
        }
      }

      // Se não encontrou categorias, criar categorias padrão baseadas nos produtos
      if (this.categories.length === 0) {
        this.categories = await this.generateCategoriesFromProducts();
      }

      this.renderCategories();
    } catch (error) {
      console.error('❌ Erro ao carregar categorias:', error);
      this.categories = await this.generateCategoriesFromProducts();
      this.renderCategories();
    }
  }

  async generateCategoriesFromProducts() {
    const products = window.products || [];
    const categoriesMap = new Map();

    products.forEach(product => {
      const category = product.category || product.categoria || 'outros';
      const categoryName = this.formatCategoryName(category);

      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, {
          id: category,
          nome: categoryName,
          nome_en: category,
          ativa: true
        });
      }
    });

    return Array.from(categoriesMap.values());
  }

  formatCategoryName(category) {
    const categoryNames = {
      'entrada': 'Entradas',
      'principal': 'Pratos Principais',
      'bebida': 'Bebidas',
      'sobremesa': 'Sobremesas',
      'promocao': 'Promoções',
      'lanche': 'Lanches',
      'pizza': 'Pizzas',
      'outros': 'Outros'
    };

    return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
  }

  renderCategories() {
    const mobileList = document.getElementById('categories-list');
    const desktopList = document.getElementById('categories-list-desktop');
    const toolbar = document.getElementById('mobile-categories-toolbar');

    const allCategory = { id: 'all', nome: 'Todas', icon: 'fa-utensils' };

    // Mobile Dropdown (deprecated but kept for fallback)
    if (mobileList) {
      mobileList.innerHTML = '';
      this.categories.forEach(category => {
        mobileList.appendChild(this.createCategoryItem(category));
      });
    }

    // New Mobile Toolbar (Horizontal)
    if (toolbar) {
      toolbar.innerHTML = '';
      // Add 'All' first
      toolbar.appendChild(this.createToolbarItem(allCategory));
      this.categories.forEach(category => {
        toolbar.appendChild(this.createToolbarItem(category));
      });
    }

    // Desktop Dropdown
    if (desktopList) {
      desktopList.innerHTML = '';
      // Add 'All' first
      desktopList.appendChild(this.createCategoryItem(allCategory, true));
      this.categories.forEach(category => {
        const item = this.createCategoryItem(category, true);
        desktopList.appendChild(item);
      });
    }

    // Remover loading
    document.querySelectorAll('.categories-loading').forEach(el => {
      el.style.display = 'none';
    });
  }

  createToolbarItem(category) {
    const btn = document.createElement('button');
    btn.className = 'flex-shrink-0 flex items-center gap-2 px-1 py-1 text-[13px] font-black text-slate-500 hover:text-primary transition-all uppercase tracking-tight group whitespace-nowrap border-b-2 border-transparent hover:border-primary pb-2';
    
    const categoryName = category.nome || category.name || category;
    const categoryId = category.id || category.nome || category.name || category;
    const iconClass = category.icon || 'fa-utensils';

    btn.innerHTML = `
      <i class="fas ${iconClass} text-slate-300 group-hover:text-primary transition-colors"></i>
      <span>${categoryName}</span>
    `;

    btn.addEventListener('click', () => {
      this.selectCategory(categoryId, categoryName);
      // Highlight active
      document.querySelectorAll('#mobile-categories-toolbar button').forEach(b => {
        b.classList.remove('text-primary', 'border-primary');
        b.classList.add('text-slate-500', 'border-transparent');
      });
      btn.classList.add('text-primary', 'border-primary');
      btn.classList.remove('text-slate-500', 'border-transparent');
    });

    return btn;
  }

  createCategoryItem(category, isDesktop = false) {
    const item = document.createElement('div');
    item.className = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all text-left cursor-pointer group';
    
    const categoryName = category.nome || category.name || category;
    const categoryId = category.id || category.nome || category.name || category;
    const iconClass = category.icon || 'fa-utensils';

    item.innerHTML = `
      <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-primary group-hover:bg-white transition-colors">
        <i class="fas ${iconClass}"></i>
      </div>
      <span>${categoryName}</span>
    `;

    item.addEventListener('click', () => {
      this.selectCategory(categoryId, categoryName);
      if (isDesktop) {
        document.getElementById('categories-menu-desktop')?.classList.add('hidden');
      }
    });

    return item;
  }

  selectCategory(categoryId, categoryName) {
    const categoryLower = categoryId.toLowerCase();
    const isAll = categoryLower === 'all';

    // Mostrar ou esconder as seções de categoria corretamente
    document.querySelectorAll('.category-section').forEach(section => {
      if (isAll) {
        section.style.display = '';
      } else {
        const sectionCategory = (section.dataset.category || '').toLowerCase();
        if (sectionCategory === categoryLower || sectionCategory.includes(categoryLower) || categoryLower.includes(sectionCategory)) {
          section.style.display = '';
        } else {
          section.style.display = 'none';
        }
      }
    });

    // Mostrar ou esconder produtos individuais se não estiverem em seções (ex: novidades)
    document.querySelectorAll('.produto-card').forEach(card => {
      // Apenas filtrá-los se não estiverem numa category-section já oculta
      if (!card.closest('.category-section')) {
        if (isAll) {
          card.parentElement.style.display = ''; // assumed to be inside a grid wrap or something similar, adjust accordingly
        } else {
          const cardCategory = (card.dataset.category || '').toLowerCase();
          if (cardCategory === categoryLower || cardCategory.includes(categoryLower) || categoryLower.includes(cardCategory)) {
            card.parentElement.style.display = '';
          } else {
            card.parentElement.style.display = 'none';
          }
        }
      }
    });

    // Scroll para seção de produtos
    const menuSection = document.getElementById('menu') || document.getElementById('product-list');
    if (menuSection) {
      menuSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Atualizar texto do dropdown
    const categoriesText = document.getElementById('categories-text');
    if (categoriesText) {
      categoriesText.textContent = categoryName;
    }
  }

  toggleMenu(isDesktop = false) {
    const menuId = isDesktop ? 'categories-menu-desktop' : 'categories-menu';
    const menu = document.getElementById(menuId);
    const arrowId = isDesktop ? 'categories-arrow-desktop' : 'categories-arrow';
    const arrow = document.getElementById(arrowId);

    if (menu) {
      this.isMenuOpen = !this.isMenuOpen;
      menu.classList.toggle('hidden', !this.isMenuOpen);

      if (arrow) {
        arrow.style.transform = this.isMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    }
  }

  setupEventListeners() {
    // Fechar menu ao clicar fora
    document.addEventListener('click', (e) => {
      const mobileMenu = document.getElementById('categories-menu');
      const desktopMenu = document.getElementById('categories-menu-desktop');
      const mobileDropdown = document.getElementById('categories-dropdown');
      const desktopBtn = document.getElementById('categories-btn-desktop');

      if (mobileMenu && !mobileMenu.contains(e.target) && !mobileDropdown?.contains(e.target)) {
        if (!mobileMenu.classList.contains('hidden')) {
          this.toggleMenu(false);
        }
      }

      if (desktopMenu && !desktopMenu.contains(e.target) && !desktopBtn?.contains(e.target)) {
        if (!desktopMenu.classList.contains('hidden')) {
          this.toggleMenu(true);
        }
      }
    });
  }
}

/**
 * Gerenciador de Busca
 */
class SearchManager {
  constructor() {
    this.searchTimeout = null;
    this.init();
  }

  init() {
    const mobileInput = document.getElementById('search-input');
    const desktopInput = document.getElementById('search-input-desktop');

    if (mobileInput) {
      mobileInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
      mobileInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.performSearch(e.target.value);
        }
      });
    }

    if (desktopInput) {
      desktopInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
      desktopInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.performSearch(e.target.value);
        }
      });
    }
  }

  handleSearch(query) {
    clearTimeout(this.searchTimeout);

    this.searchTimeout = setTimeout(() => {
      if (query.length >= 2) {
        this.performSearch(query);
      } else if (query.length === 0) {
        this.clearSearch();
      }
    }, 300);
  }

  performSearch(query = null) {
    const mobileInput = document.getElementById('search-input');
    const desktopInput = document.getElementById('search-input-desktop');
    const searchQuery = query || mobileInput?.value || desktopInput?.value || '';

    if (searchQuery.length < 2) {
      alert('Digite pelo menos 2 caracteres para buscar');
      return;
    }

    const products = window.products || [];
    const filteredProducts = products.filter(product => {
      const name = (product.name || product.nome || '').toLowerCase();
      const description = (product.description || product.descricao || '').toLowerCase();
      const searchLower = searchQuery.toLowerCase();

      return name.includes(searchLower) || description.includes(searchLower);
    });

    // Scroll para produtos
    const menuSection = document.getElementById('menu') || document.getElementById('product-list');
    if (menuSection) {
      menuSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Destacar produtos encontrados
    setTimeout(() => {
      document.querySelectorAll('.produto-card').forEach(card => {
        card.classList.remove('search-highlighted');
        const productName = card.querySelector('h3')?.textContent?.toLowerCase() || '';
        if (productName.includes(searchQuery.toLowerCase())) {
          card.classList.add('search-highlighted');
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }, 500);

    // Atualizar inputs
    if (mobileInput) mobileInput.value = searchQuery;
    if (desktopInput) desktopInput.value = searchQuery;
  }

  clearSearch() {
    document.querySelectorAll('.produto-card').forEach(card => {
      card.classList.remove('search-highlighted');
    });
  }
}

// Funções globais para uso no HTML
window.categoriesManager = new CategoriesManager();
window.searchManager = new SearchManager();

function toggleCategoriesMenu() {
  window.categoriesManager.toggleMenu(false);
}

function toggleCategoriesMenuDesktop() {
  window.categoriesManager.toggleMenu(true);
}

function toggleSearch() {
  const searchBar = document.getElementById('search-bar-mobile');
  if (searchBar) {
    searchBar.classList.toggle('hidden');
    if (!searchBar.classList.contains('hidden')) {
      document.getElementById('search-input')?.focus();
    }
  }
}

function performSearch() {
  window.searchManager.performSearch();
}

window.filterByCategory = function(id) {
  window.categoriesManager.selectCategory(id, id);
};

/**
 * Utilitários de Entrega
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function calculateDelivery() {
  const deliveryAddress = document.getElementById('delivery-address')?.value || '';
  const branches = window.CONFIG?.BRANCHES || [
    { name: 'Manaus', lat: -3.1022, lng: -60.0217 },
    { name: 'Itajaí', lat: -26.9078, lng: -48.6619 }
  ];
  const rules = window.CONFIG?.DELIVERY_RULES || {
    base_fee: 5.0, per_km_fee: 1.5, min_fee: 5.0, max_fee: 25.0,
    estimated_time_base: 30, estimated_time_per_km: 3
  };

  if (!navigator.geolocation) {
    alert('Geolocalização não é suportada pelo seu navegador.');
    return;
  }

  // Feedback Visual (Loading)
  const calcBtn = document.querySelector('.delivery-calc-btn');
  const originalHTML = calcBtn?.innerHTML;
  if (calcBtn) {
    calcBtn.disabled = true;
    calcBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Calculando...</span>';
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      // Encontrar unidade mais próxima
      let closestBranch = null;
      let minDistance = Infinity;

      branches.forEach(branch => {
        const dist = calculateDistance(userLat, userLng, branch.lat, branch.lng);
        if (dist < minDistance) {
          minDistance = dist;
          closestBranch = branch;
        }
      });

      // Calcular Taxa
      let fee = rules.base_fee + (minDistance * rules.per_km_fee);
      fee = Math.max(rules.min_fee, Math.min(rules.max_fee, fee));
      const time = rules.estimated_time_base + Math.round(minDistance * rules.estimated_time_per_km);

      // Atualizar no Carrinho (Global Manager)
      if (window.unifiedCartManager) {
        window.unifiedCartManager.setDeliveryExtra(fee, time);
      }

      // Feedback para o usuário
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: 'Cálculo Concluído!',
          html: `Distância: <b>${minDistance.toFixed(1)} km</b> até a unidade ${closestBranch.name}<br>Taxa: <b>R$ ${fee.toFixed(2).replace('.', ',')}</b><br>Tempo: <b>${time}-${time + 15} min</b>`,
          icon: 'success',
          confirmButtonColor: '#069C54'
        });
      } else {
        alert(`📦 Entrega via Unidade ${closestBranch.name}\n\nDistância: ${minDistance.toFixed(1)} km\nTaxa: R$ ${fee.toFixed(2).replace('.', ',')}\nTempo: ${time}-${time + 15} min`);
      }

      if (calcBtn) {
        calcBtn.disabled = false;
        calcBtn.innerHTML = originalHTML;
      }
    },
    (error) => {
      console.error('Erro ao obter localização:', error);

      let errorTitle = 'Localização não encontrada';
      let errorMsg = 'Não conseguimos obter sua posição automática.';

      if (error.code === 1) {
        errorTitle = 'Acesso Negado';
        errorMsg = 'Você negou a permissão de localização.';
      } else if (error.code === 3) {
        errorTitle = 'Tempo Expirado';
        errorMsg = 'A busca automática demorou muito.';
      }

      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: errorTitle,
          text: errorMsg + ' Selecione sua cidade para uma taxa média:',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Estou em Manaus',
          cancelButtonText: 'Estou em Itajaí',
          confirmButtonColor: '#069C54',
          cancelButtonColor: '#069C54'
        }).then((result) => {
          let selectedBranch = null;
          let fallbackDistance = 7; // KM médio estimado

          if (result.isConfirmed) {
            selectedBranch = branches[0]; // Manaus
          } else if (result.dismiss === Swal.DismissReason.cancel) {
            selectedBranch = branches[1]; // Itajaí
          }

          if (selectedBranch) {
            const fee = rules.base_fee + (fallbackDistance * rules.per_km_fee);
            const time = rules.estimated_time_base + (fallbackDistance * rules.estimated_time_per_km);

            if (window.unifiedCartManager) {
              window.unifiedCartManager.setDeliveryExtra(fee, time);
            }

            Swal.fire('Taxa Aplicada', `Usando taxa média para ${selectedBranch.name}: R$ ${fee.toFixed(2).replace('.', ',')}`, 'success');
          }
        });
      } else {
        // Fallback simples sem Swal
        alert(errorMsg + ' Usando taxa padrão de R$ 12,00.');
        if (window.unifiedCartManager) {
          window.unifiedCartManager.setDeliveryExtra(12.00, 45);
        }
      }

      if (calcBtn) {
        calcBtn.disabled = false;
        calcBtn.innerHTML = originalHTML;
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Já inicializado acima
  });
} else {
  // DOM já carregado
}


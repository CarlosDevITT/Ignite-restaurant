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

    const allCategory = { id: 'all', nome: 'Todas as Categorias' };

    if (mobileList) {
      mobileList.innerHTML = '';
      if (this.categories.length === 0) {
        mobileList.innerHTML = '<div class="category-item-empty">Nenhuma categoria encontrada</div>';
      } else {
        mobileList.appendChild(this.createCategoryItem(allCategory));
        this.categories.forEach(category => {
          const item = this.createCategoryItem(category);
          mobileList.appendChild(item);
        });
      }
    }

    if (desktopList) {
      desktopList.innerHTML = '';
      if (this.categories.length === 0) {
        desktopList.innerHTML = '<div class="category-item-empty">Nenhuma categoria encontrada</div>';
      } else {
        desktopList.appendChild(this.createCategoryItem(allCategory, true));
        this.categories.forEach(category => {
          const item = this.createCategoryItem(category, true);
          desktopList.appendChild(item);
        });
      }
    }

    // Remover loading
    document.querySelectorAll('.categories-loading').forEach(el => {
      el.style.display = 'none';
    });
  }

  createCategoryItem(category, isDesktop = false) {
    const item = document.createElement('div');
    item.className = 'category-item';
    const categoryName = category.nome || category.name || category;
    const categoryId = category.id || category.nome || category.name || category;

    item.innerHTML = `
      <i class="fas fa-utensils"></i>
      <span>${categoryName}</span>
    `;

    item.addEventListener('click', () => {
      this.selectCategory(categoryId, categoryName);
      this.toggleMenu(isDesktop);
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

function calculateDelivery() {
  const address = document.getElementById('delivery-address')?.value || '';
  if (!address.trim()) {
    alert('Por favor, informe o endereço de entrega primeiro.');
    document.getElementById('delivery-address')?.focus();
    return;
  }

  // Calcular taxa baseada na distância (simulado)
  const taxa = 5.00;
  const tempo = '30-45 minutos';

  alert(`📦 Cálculo de entrega:\n\nTaxa: R$ ${taxa.toFixed(2)}\nTempo estimado: ${tempo}`);
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Já inicializado acima
  });
} else {
  // DOM já carregado
}


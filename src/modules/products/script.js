// Usar o SupabaseManager já inicializado em supabase-config.js
// Não declarar variável supabase para evitar conflitos

// Função para obter o cliente Supabase do manager
function getSupabaseClient() {
  if (window.supabaseManager && window.supabaseManager.isConnected()) {
    return window.supabaseManager.client;
  }

  // Fallback: tentar criar cliente diretamente se manager não estiver disponível
  if (window.supabase?.createClient) {
    try {
      const SUPABASE_URL = 'https://qgnqztsxfeugopuhyioq.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbnF6dHN4ZmV1Z29wdWh5aW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MTg4MjEsImV4cCI6MjA3MzA5NDgyMX0.mW88-7P_Af3WMVAUT7ha4Mf0nyKJoSiNjMfuXiCllIA';
      const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Supabase cliente criado (fallback)');
      return client;
    } catch (error) {
      console.error('❌ Erro ao criar cliente Supabase:', error);
      return null;
    }
  }

  return null;
}

// ✅ CONSTANTES PARA CONFIGURAÇÃO
const CONFIG = {
  AUTO_UPDATE_INTERVAL: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,
  CACHE_TTL: 5 * 60 * 1000,
  DEBOUNCE_DELAY: 300,
  SWIPE_THRESHOLD: 50,
  BUSINESS_HOURS: { start: 9, end: 22 },
  BRANCHES: [
    { name: 'Manaus (Vieiralves)', lat: -3.1022, lng: -60.0217 },
    { name: 'Itajaí (Centro)', lat: -26.9078, lng: -48.6619 }
  ],
  DELIVERY_RULES: {
    base_fee: 5.00,
    per_km_fee: 1.50,
    min_fee: 5.00,
    max_fee: 25.00,
    estimated_time_base: 30, // minutos
    estimated_time_per_km: 3 // minutos por KM
  }
};

// ✅ VARIÁVEIS GLOBAIS (tornar acessível globalmente)
window.products = window.products || [];
let products = window.products; // Referência local
let cart = [];
let lastUpdateTime = 0;
let isLoading = false;
let retryCount = 0;
let updateInterval = null;
let storiesSliderInstance = null;

// ✅ SINGLETON PARA EVENT HANDLERS
let productClickHandler = null;
let cartEventHandlers = [];

// ✅ SISTEMA DE CACHE
class CacheManager {
  constructor() {
    this.cache = new Map();
  }

  set(key, value, ttl = CONFIG.CACHE_TTL) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  clear() {
    this.cache.clear();
  }
}

const cacheManager = new CacheManager();

// ✅ SISTEMA DE LOGGING
class Logger {
  static log(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const logMessage = `[CARDÁPIO ${level}] ${timestamp}: ${message}`;

    console[level.toLowerCase()](logMessage, data || '');
  }

  static info(message, data = null) {
    this.log('INFO', message, data);
  }

  static warn(message, data = null) {
    this.log('WARN', message, data);
  }

  static error(message, data = null) {
    this.log('ERROR', message, data);
  }
}

// ✅ DEBOUNCE PARA OTIMIZAÇÃO
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ✅ INICIALIZAÇÃO DA APLICAÇÃO
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initializeApp();
  } catch (error) {
    Logger.error('Erro crítico na inicialização', error);
    showError('Erro ao inicializar a aplicação. Recarregando...', () => {
      setTimeout(() => window.location.reload(), 2000);
    });
  }
});

async function initializeApp() {
  Logger.info('Iniciando aplicação...');

  // Aguardar até 3s pelo Supabase SDK ou SupabaseManager ficarem disponíveis
  const supabaseReady = await new Promise((resolve) => {
    if (window.supabase?.createClient || window.supabaseManager) {
      resolve(true);
      return;
    }
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.supabase?.createClient || window.supabaseManager) {
        clearInterval(interval);
        resolve(true);
      } else if (attempts >= 30) { // 30 × 100ms = 3s
        clearInterval(interval);
        resolve(false);
      }
    }, 100);
  });

  if (!supabaseReady) {
    Logger.warn('Supabase não encontrado após aguardar. Continuando sem conexão...');
  }

  loadFromStorage();
  updateCartCount();
  checkBusinessHours();
  await loadProducts();
  setupEventListeners();
  startAutoUpdates();

  Logger.info('Aplicação inicializada com sucesso');
}

// ✅ CARREGAMENTO DO LOCALSTORAGE
function loadFromStorage() {
  try {
    const savedCart = safeStorage.getItem('cart');
    const savedUpdateTime = safeStorage.getItem('lastUpdateTime');

    cart = savedCart ? JSON.parse(savedCart) : [];
    lastUpdateTime = savedUpdateTime ? parseInt(savedUpdateTime) : 0;

    // Se o UnifiedCartManager já tem dados mais recentes, usar os dele
    if (window.unifiedCartManager && window.unifiedCartManager.cart.length > cart.length) {
      cart = window.unifiedCartManager.cart;
    }

    Logger.info(`Dados carregados: ${cart.length} itens no carrinho`);
  } catch (error) {
    Logger.warn('Erro ao carregar dados do storage (usando fallback em memória)');
    cart = [];
    lastUpdateTime = 0;
  }
}

// ✅ SISTEMA DE RETRY AUTOMÁTICO
async function withRetry(asyncFunction, maxRetries = CONFIG.MAX_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await asyncFunction();
      if (attempt > 1) {
        Logger.info(`Operação bem-sucedida na tentativa ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      Logger.warn(`Tentativa ${attempt} falhou:`, error.message);

      if (attempt < maxRetries) {
        const delay = CONFIG.RETRY_DELAY * attempt;
        Logger.info(`Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ✅ VERIFICAÇÃO DE ATUALIZAÇÕES
async function checkForUpdates() {
  if (isLoading) return;

  try {
    const cached = cacheManager.get('lastUpdateCheck');
    if (cached && Date.now() - cached < 10000) return;

    const client = getSupabaseClient();
    if (!client) return;

    // Tentar primeiro 'products', depois 'produtos'
    let { data, error } = await client
      .from('products')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);

    // Fallback para tabela em português
    if (error && error.code === 'PGRST116') {
      const result = await client
        .from('produtos')
        .select('atualizado_em')
        .order('atualizado_em', { ascending: false })
        .limit(1);
      data = result.data;
      error = result.error;
    }

    if (error) throw error;

    cacheManager.set('lastUpdateCheck', Date.now());

    if (data && data.length > 0) {
      const serverUpdate = new Date(data[0].updated_at).getTime();

      if (serverUpdate > lastUpdateTime) {
        Logger.info('Atualizações detectadas! Recarregando produtos...');
        lastUpdateTime = serverUpdate;
        safeStorage.setItem('lastUpdateTime', serverUpdate.toString());

        await loadProducts();
        showToast('Cardápio atualizado!', 'info');
      }
    }
  } catch (error) {
    Logger.error('Erro ao verificar atualizações:', error);
  }
}

// ✅ CARREGAMENTO DE PRODUTOS
async function loadProducts() {
  if (isLoading) {
    Logger.info('Carregamento já em andamento, aguardando...');
    return;
  }

  isLoading = true;
  showLoading();

  try {
    Logger.info('Iniciando carregamento de produtos...');

    const result = await withRetry(async () => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase não disponível');
      }

      // Tentar primeiro 'products', depois 'produtos' como fallback
      let { data, error } = await client
        .from('products')
        .select('*')
        .eq('available', true)
        .order('category')
        .order('name');

      // Se não encontrar tabela 'products', tentar com 'produtos' (português)
      if (error && (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist'))) {
        Logger.info('Tabela "products" não encontrada, tentando "produtos"...');
        const result = await client
          .from('produtos')
          .select('*')
          .eq('disponivel', true)
          .order('categoria')
          .order('nome');
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      if (error) throw error;
      return data;
    });

    const validatedProducts = result
      .map(validateProduct)
      .filter(product => product.id && product.name);

    if (validatedProducts.length === 0) {
      throw new Error('Nenhum produto válido encontrado');
    }

    products = validatedProducts;
    window.products = products; // Atualizar referência global
    Logger.info(`✅ ${products.length} produtos carregados com sucesso`);

    if (result.length > 0) {
      const latestUpdate = Math.max(
        ...result.map(p => new Date(p.updated_at || p.created_at).getTime())
      );
      lastUpdateTime = latestUpdate;
      safeStorage.setItem('lastUpdateTime', latestUpdate.toString());
    }

    renderProducts();
    cacheManager.set('products', products, CONFIG.CACHE_TTL);
    retryCount = 0;

  } catch (error) {
    Logger.error('Erro no carregamento de produtos:', error);
    retryCount++;

    if (retryCount < CONFIG.MAX_RETRIES) {
      showError(`Erro ao carregar cardápio. Tentativa ${retryCount}/${CONFIG.MAX_RETRIES}...`);
      setTimeout(() => loadProducts(), CONFIG.RETRY_DELAY);
    } else {
      showError('Não foi possível carregar o cardápio. Verifique sua conexão.', () => {
        window.location.reload();
      });
    }
  } finally {
    isLoading = false;
    hideLoading();
  }
}

// ✅ VALIDAÇÃO DE PRODUTOS (suporta campos em inglês e português)
function validateProduct(product) {
  try {
    // Normalizar campos (suporta inglês e português)
    const name = product.name || product.nome || '';
    const description = product.description || product.descricao || '';
    const category = (product.category || product.categoria || 'outros').toLowerCase();
    const price = Math.max(0, Number(product.price || product.preco || 0));
    const imageUrl = product.image_url || product.imagem_url || product.imagem || null;
    const featured = Boolean(product.featured || product.destaque);
    const available = product.available !== false && product.disponivel !== false;
    const promo = Boolean(product.promo || product.promocao);
    const promoPrice = product.promo_price || product.preco_promocao || null;
    const promoText = product.promo_text || product.texto_promocao || '';
    const createdAt = product.created_at || product.criado_em || new Date().toISOString();
    const updatedAt = product.updated_at || product.atualizado_em || new Date().toISOString();

    return {
      id: product.id || generateTempId(),
      name: name.trim() || 'Produto sem nome',
      description: description.trim(),
      category: category,
      price: price,
      image_url: isValidUrl(imageUrl) ? imageUrl : null,
      featured: featured,
      available: available,
      promo: promo,
      promo_price: promoPrice ? Math.max(0, Number(promoPrice)) : null,
      promo_text: promoText.trim(),
      created_at: createdAt,
      updated_at: updatedAt
    };
  } catch (error) {
    Logger.warn('Erro ao validar produto:', { product, error });
    return null;
  }
}

function isValidUrl(string) {
  try {
    if (!string) return false;
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function generateTempId() {
  return 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ✅ SISTEMA DE PREÇOS
function getDisplayPrice(product) {
  try {
    const basePrice = Number(product.price) || 0;
    const promoPrice = Number(product.promo_price) || 0;

    if (product.promo && promoPrice > 0 && promoPrice < basePrice) {
      return {
        final: promoPrice,
        original: basePrice,
        hasPromo: true,
        discount: Math.round(((basePrice - promoPrice) / basePrice) * 100)
      };
    }

    return {
      final: basePrice,
      hasPromo: false,
      discount: 0
    };
  } catch (error) {
    Logger.warn('Erro ao calcular preço:', { product, error });
    return {
      final: 0,
      hasPromo: false,
      discount: 0
    };
  }
}

// ✅ RENDERIZAÇÃO DE PRODUTOS
function renderProducts() {
  try {
    renderNewProducts();
    renderMenuProducts();

    if (typeof initStoriesSlider === 'function') {
      setTimeout(initStoriesSlider, 100);
    }

    Logger.info('Produtos renderizados com sucesso');
  } catch (error) {
    Logger.error('Erro na renderização:', error);
    showError('Erro ao exibir produtos');
  }
}

// ✅ PRODUTOS EM DESTAQUE
function renderNewProducts() {
  const newProductsContainer = document.getElementById('new-products');
  if (!newProductsContainer) return;

  const featuredProducts = products.filter(product =>
    product.featured && product.available && product.price > 0
  );

  if (featuredProducts.length === 0) {
    newProductsContainer.innerHTML = `
      <div class="min-w-[200px] bg-gray-50 rounded-lg p-6 text-center">
        <i class="fas fa-star text-gray-300 text-3xl mb-3"></i>
        <p class="text-gray-500 text-sm">Em breve produtos em destaque!</p>
      </div>
    `;
    return;
  }

  newProductsContainer.innerHTML = featuredProducts.map(product => {
    const priceInfo = getDisplayPrice(product);

    return `
      <div class="min-w-[200px] bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden produto-card cursor-pointer" data-id="${product.id}" data-category="${product.category || ''}">
        <div class="relative">
          <div class="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            ${product.image_url ?
        `<img src="${product.image_url}" 
                   alt="${product.name}" 
                   class="w-full h-32 object-cover"
                   loading="lazy"
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` :
        ''
      }
            <div class="w-full h-32 ${product.image_url ? 'hidden' : 'flex'} items-center justify-center">
              <i class="fas fa-utensils text-3xl text-gray-300"></i>
            </div>
          </div>
          
          ${product.promo ? `
            <div class="absolute top-2 right-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs px-2 py-1 rounded-full shadow-lg">
              <i class="fas fa-fire mr-1"></i>-${priceInfo.discount}%
            </div>
          ` : ''}
        </div>
        
        <div class="p-4">
          <h3 class="produto-card-title">${product.name}</h3>
          <p class="produto-card-description line-clamp-2 h-10 mb-3">${product.description || 'Delicioso produto especial'}</p>
          
          <div class="flex justify-between items-center">
            <div class="flex flex-col">
              ${priceInfo.hasPromo ? `
                <span class="price price-promo">R$ ${priceInfo.final.toFixed(2)}</span>
                <span class="price-original">R$ ${priceInfo.original.toFixed(2)}</span>
              ` : `
                <span class="price">R$ ${priceInfo.final.toFixed(2)}</span>
              `}
            </div>
            
            <div class="flex gap-2">
              <button class="share-product bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200 hover:scale-105" 
                      onclick="window.shareProduct('${product.name}', '${product.description}', '${product.id}')"
                      title="Compartilhar">
                <i class="fas fa-share-alt"></i>
              </button>
              
              <button class="add-to-cart bg-primary hover:bg-secondary text-white p-2 rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg" 
                      data-id="${product.id}" 
                      title="Adicionar ao carrinho">
                <i class="fas fa-plus"></i>
              </button>
            </div>
          </div>
          
          ${product.promo_text ? `
            <div class="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p class="promo-text">${product.promo_text}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ✅ MENU PRINCIPAL
function renderMenuProducts() {
  const menuContainer = document.getElementById('menu');
  if (!menuContainer) return;

  const categories = [...new Set(products.map(product => product.category))];

  if (products.length === 0) {
    menuContainer.innerHTML = `
      <div class="col-span-full text-center py-16">
        <div class="max-w-md mx-auto">
          <i class="fas fa-utensils text-6xl text-gray-300 mb-6"></i>
          <h3 class="text-xl font-bold text-gray-600 mb-4">Cardápio em preparação</h3>
          <p class="text-gray-500 mb-6">Nossos produtos estão sendo carregados...</p>
          <button class="bg-primary text-white px-6 py-3 rounded-lg hover:bg-secondary transition-colors" 
                  onclick="location.reload()">
            <i class="fas fa-redo mr-2"></i>Tentar novamente
          </button>
        </div>
      </div>
    `;
    return;
  }

  const categoryNames = {
    'entrada': '🍴 Entradas',
    'principal': '🍽️ Pratos Principais',
    'bebida': '🥤 Bebidas',
    'sobremesa': '🍰 Sobremesas',
    'promocao': '🔥 Promoções',
    'lanche': '🍔 Lanches',
    'pizza': '🍕 Pizzas',
    'outros': '📦 Outros'
  };

  menuContainer.innerHTML = categories.map(category => {
    const categoryProducts = products.filter(product =>
      product.category === category && product.available && product.price > 0
    );

    if (categoryProducts.length === 0) return '';

    return `
      <div class="col-span-full mb-10 category-section" data-category="${category}">
        <div class="flex items-center mb-6">
          <h3 class="text-xl font-bold text-gray-800 mr-4">
            ${categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1)}
          </h3>
          <div class="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent"></div>
          <span class="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full ml-4">
            ${categoryProducts.length} item${categoryProducts.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${categoryProducts.map(product => {
      const priceInfo = getDisplayPrice(product);

      return `
              <div class="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex produto-card group cursor-pointer" data-id="${product.id}" data-category="${product.category || ''}">
                <div class="relative">
                  <div class="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0">
                    ${product.image_url ?
          `<img src="${product.image_url}" 
                           alt="${product.name}" 
                           class="w-24 h-24 object-cover"
                           loading="lazy"
                           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` :
          ''
        }
                    <div class="w-24 h-24 ${product.image_url ? 'hidden' : 'flex'} items-center justify-center">
                      <i class="fas fa-utensils text-2xl text-gray-300"></i>
                    </div>
                  </div>
                  
                  ${product.promo ? `
                    <div class="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      -${priceInfo.discount}%
                    </div>
                  ` : ''}
                </div>
                
                <div class="p-4 flex-1 min-w-0 flex flex-col">
                  <div class="flex justify-between items-start mb-2">
                    <h3 class="produto-card-title truncate flex-1 mr-2">${product.name}</h3>
                    <div class="text-right">
                      ${priceInfo.hasPromo ? `
                        <div class="flex flex-col items-end">
                          <span class="price price-promo">R$ ${priceInfo.final.toFixed(2)}</span>
                          <span class="price-original">R$ ${priceInfo.original.toFixed(2)}</span>
                        </div>
                      ` : `
                        <span class="price">R$ ${priceInfo.final.toFixed(2)}</span>
                      `}
                    </div>
                  </div>
                  
                  <p class="produto-card-description mb-3 flex-1">${product.description || ''}</p>
                  
                  ${product.promo_text ? `
                    <div class="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                      <p class="promo-text">${product.promo_text}</p>
                    </div>
                  ` : ''}
                  
                  <div class="flex gap-2">
                        <button class="share-product flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm transition-all duration-200 flex items-center justify-center" 
                          onclick="window.shareProduct('${product.name}', '${product.description}', '${product.id}')">
                      <i class="fas fa-share-alt mr-2"></i>Share
                    </button>
                    
                    <button class="add-to-cart flex-[2] bg-primary hover:bg-secondary text-white px-4 py-2 rounded-lg text-sm transition-all duration-200 w-full group-hover:shadow-md" 
                            data-id="${product.id}">
                      <i class="fas fa-cart-plus mr-2"></i>Adicionar
                    </button>
                  </div>
                </div>
              </div>
            `;
    }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ✅ SISTEMA DE EVENTOS CORRIGIDO (SEM DUPLICAÇÃO)
function setupEventListeners() {
  // ✅ CONFIGURAR EVENT DELEGATION UMA ÚNICA VEZ (apenas cliques em produtos)
  setupProductClickHandler();

  // ✅ NOTA: setupCartEventHandlers() foi REMOVIDO daqui para evitar conflito
  // com o UnifiedCartManager (cart-manager-unified.js) que já gerencia:
  // cart-button, close-cart, cart-overlay e checkout-button.

  // ✅ OUTROS EVENTOS (teclado, touch, resize, visibilidade)
  setupAdditionalEventListeners();

  // ✅ Registrar checkout no botão SOMENTE se UnifiedCartManager não estiver presente
  // (garante que não haja listener duplo no checkout-button)
  const checkoutBtn = document.getElementById('checkout-button');
  if (checkoutBtn && !window.unifiedCartManager) {
    checkoutBtn.addEventListener('click', () => checkout());
  }

  Logger.info('Event listeners configurados com sucesso');
}

// ✅ SINGLETON PARA CLICKS EM PRODUTOS
function setupProductClickHandler() {
  // REMOVER HANDLER ANTERIOR SE EXISTIR
  if (productClickHandler) {
    document.removeEventListener('click', productClickHandler);
  }

  // NOVO HANDLER COM DEBOUNCE INTEGRADO
  productClickHandler = function (e) {
    const target = e.target.closest('.add-to-cart');
    if (!target) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    // ✅ PREVENIR MÚLTIPLOS CLIQUES RÁPIDOS
    if (target.hasAttribute('data-clicked')) {
      Logger.warn('Clique rápido ignorado');
      return;
    }

    target.setAttribute('data-clicked', 'true');

    const productId = target.dataset.id;
    if (productId) {
      Logger.info(`Adicionando produto: ${productId}`);
      addToCart(productId);
    }

    // LIBERAR BOTÃO APÓS 500ms
    setTimeout(() => {
      target.removeAttribute('data-clicked');
    }, 500);
  };

  // REGISTRAR HANDLER UMA ÚNICA VEZ
  document.addEventListener('click', productClickHandler);
}

// ✅ EVENTOS DO CARRINHO (DESATIVADO - gerenciado pelo UnifiedCartManager)
// Esta função foi desativada para evitar conflito de listeners duplicados.
// O cart-manager-unified.js já gerencia: cart-button, close-cart,
// cart-overlay e checkout-button com stopImmediatePropagation correto.
function setupCartEventHandlers() {
  // Função mantida por compatibilidade, mas não faz mais nada.
  // Todos os eventos do carrinho são gerenciados pelo UnifiedCartManager.
  cartEventHandlers = [];
}

// ✅ EVENTOS ADICIONAIS
function setupAdditionalEventListeners() {
  // NAVEGAÇÃO POR TECLADO
  document.addEventListener('keydown', handleKeyboardNavigation);

  // EVENTOS TOUCH PARA MOBILE
  setupTouchEvents();

  // REDIMENSIONAMENTO
  window.addEventListener('resize', debounce(handleWindowResize, 250));

  // VISIBILIDADE DA PÁGINA
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

function handleKeyboardNavigation(e) {
  if (document.activeElement.tagName === 'INPUT') return;

  switch (e.key) {
    case 'Escape':
      if (!document.getElementById('cart-sidebar').classList.contains('translate-x-full')) {
        toggleCart();
      }
      break;
    case 'F5':
      e.preventDefault();
      window.forceRefresh();
      break;
  }
}

function setupTouchEvents() {
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > CONFIG.SWIPE_THRESHOLD) {
      const cartSidebar = document.getElementById('cart-sidebar');
      if (cartSidebar && !cartSidebar.classList.contains('translate-x-full')) {
        if (diffX < 0) {
          toggleCart();
        }
      }
    }
  }, { passive: true });
}

function handleWindowResize() {
  // Sincronizar estado do carrinho no resize se necessário
  if (window.unifiedCartManager) {
    window.unifiedCartManager.updateCartUI();
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopAutoUpdates();
  } else {
    startAutoUpdates();
    checkForUpdates();
  }
}

// ✅ SISTEMA DE CARRINHO CORRIGIDO
// Tornar função global para uso em outros módulos
window.addToCart = function (productId) {
  console.log(`🛒 ADD_TO_CART chamado UMA VEZ para: ${productId} - ${Date.now()}`);

  try {
    const productsList = window.products || products || [];
    const product = productsList.find(p => p.id == productId);
    if (!product) {
      Logger.warn('Produto não encontrado:', productId);
      showToast('Produto não encontrado', 'error');
      return;
    }

    if (!product.available || product.price <= 0) {
      showToast('Produto não disponível no momento', 'warning');
      return;
    }

    // Se tivermos o UnifiedCartManager criado, passar a responsabilidade para ele
    if (window.unifiedCartManager) {
      window.unifiedCartManager.addItem(product);
    } else {
      // Fallback fallback antigo
      const existingItem = cart.find(item => item.id == productId);
      const priceInfo = getDisplayPrice(product);

      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        const newItem = {
          id: product.id,
          name: product.name,
          price: priceInfo.final,
          image: product.image_url,
          quantity: 1,
          is_promo: priceInfo.hasPromo,
          original_price: priceInfo.hasPromo ? priceInfo.original : null
        };
        cart.push(newItem);
      }
      updateCart();
    }

    showToast(`${product.name} adicionado ao carrinho!`, 'success');

    // FEEDBACK VISUAL
    const button = document.querySelector(`[data-id="${productId}"]`);
    if (button) {
      button.classList.add('animate-pulse');
      setTimeout(() => button.classList.remove('animate-pulse'), 500);
    }

  } catch (error) {
    Logger.error('Erro ao adicionar produto:', error);
    showToast('Erro ao adicionar produto', 'error');
  }
};

// Manter compatibilidade com código antigo
function addToCart(productId) {
  return window.addToCart(productId);
}

function updateCart() {
  try {
    if (window.unifiedCartManager) {
      // No need to manually update local `cart` variables when using the unified manager.
      // Call update cart count just in case.
      updateCartCount();
      return;
    }

    const validCart = cart.filter(item =>
      item.id && item.name && item.price > 0 && item.quantity > 0
    );
    const cartData = JSON.stringify(validCart);
    localStorage.setItem('cart', cartData);

    updateCartCount();
    if (typeof renderCartItems === 'function') {
      renderCartItems();
    }

    Logger.info(`Carrinho atualizado: ${validCart.length} tipos de produtos`);
  } catch (error) {
    Logger.error('Erro ao atualizar carrinho:', error);
  }
}

function updateCartCount() {
  const cartCountMobile = document.getElementById('cart-count');
  const cartCountDesktop = document.getElementById('cart-count-desktop');

  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

  // Atualizar mobile
  if (cartCountMobile) {
    const currentCount = parseInt(cartCountMobile.textContent) || 0;
    cartCountMobile.textContent = totalItems;

    if (totalItems > 0) {
      cartCountMobile.style.display = 'flex';
      if (totalItems !== currentCount) {
        cartCountMobile.classList.add('animate-bounce');
        setTimeout(() => cartCountMobile.classList.remove('animate-bounce'), 600);
      }
    } else {
      cartCountMobile.style.display = 'none';
    }
  }

  // Atualizar desktop
  if (cartCountDesktop) {
    cartCountDesktop.textContent = totalItems;
    cartCountDesktop.style.display = totalItems > 0 ? 'flex' : 'none';
  }

  // Sincronizar com gerenciador unificado
  if (window.unifiedCartManager) {
    window.unifiedCartManager.updateCartCount(totalItems);
  }
}

function renderCartItems() {
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');

  if (!cartItems || !cartTotal) return;

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-gray-500 py-16">
        <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <i class="fas fa-shopping-cart text-2xl text-gray-400"></i>
        </div>
        <h3 class="text-lg font-medium text-gray-600 mb-2">Carrinho vazio</h3>
        <p class="text-sm text-gray-500 mb-6 text-center">Adicione produtos do nosso delicioso cardápio!</p>
        <button class="bg-primary text-white px-6 py-2 rounded-lg hover:bg-secondary transition-colors" 
                onclick="toggleCart()">
          <i class="fas fa-utensils mr-2"></i>Ver Cardápio
        </button>
      </div>
    `;
    cartTotal.textContent = 'R$ 0,00';
    return;
  }

  cartItems.innerHTML = cart.map(item => `
    <div class="flex items-center mb-4 pb-4 border-b border-gray-100 cart-item" data-id="${item.id}">
      <div class="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
        ${item.image ?
      `<img src="${item.image}" 
               alt="${item.name}" 
               class="w-16 h-16 object-cover rounded-lg"
               loading="lazy"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` :
      ''
    }
        <div class="w-16 h-16 ${item.image ? 'hidden' : 'flex'} items-center justify-center">
          <i class="fas fa-utensils text-gray-400"></i>
        </div>
      </div>
      
      <div class="ml-4 flex-1 min-w-0">
        <h3 class="font-bold text-gray-800 truncate">${item.name}</h3>
        
        <div class="flex items-center gap-2 mb-2">
          <span class="font-bold text-primary">R$ ${item.price.toFixed(2)}</span>
          ${item.is_promo ? `
            <span class="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
              <i class="fas fa-fire mr-1"></i>PROMO
            </span>
          ` : ''}
        </div>
        
        ${item.is_promo && item.original_price ? `
          <div class="text-xs text-gray-500">
            Preço original: <span class="line-through">R$ ${item.original_price.toFixed(2)}</span>
            <span class="text-green-600 font-medium ml-1">
              (${Math.round(((item.original_price - item.price) / item.original_price) * 100)}% off)
            </span>
          </div>
        ` : ''}
        
        <div class="flex items-center mt-2">
          <button class="decrease-quantity bg-gray-200 hover:bg-gray-300 rounded-lg w-8 h-8 flex items-center justify-center transition-colors" 
                  data-id="${item.id}" 
                  title="Diminuir quantidade">
            <i class="fas fa-minus text-xs"></i>
          </button>
          <span class="mx-3 font-bold text-lg min-w-[2rem] text-center">${item.quantity}</span>
          <button class="increase-quantity bg-gray-200 hover:bg-gray-300 rounded-lg w-8 h-8 flex items-center justify-center transition-colors" 
                  data-id="${item.id}" 
                  title="Aumentar quantidade">
            <i class="fas fa-plus text-xs"></i>
          </button>
        </div>
        
        <div class="text-sm text-gray-600 mt-1">
          Subtotal: <span class="font-semibold">R$ ${(item.price * item.quantity).toFixed(2)}</span>
        </div>
      </div>
      
      <button class="remove-item text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg p-2 ml-2 transition-colors" 
              data-id="${item.id}" 
              title="Remover item">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `).join('');

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const savings = cart.reduce((sum, item) => {
    if (item.is_promo && item.original_price) {
      return sum + ((item.original_price - item.price) * item.quantity);
    }
    return sum;
  }, 0);

  cartTotal.innerHTML = `
    <div class="space-y-2 text-sm">
      <div class="flex justify-between">
        <span>Itens (${totalItems})</span>
        <span>R$ ${subtotal.toFixed(2)}</span>
      </div>
      ${savings > 0 ? `
        <div class="flex justify-between text-green-600">
          <span><i class="fas fa-tags mr-1"></i>Você economiza</span>
          <span>-R$ ${savings.toFixed(2)}</span>
        </div>
      ` : ''}
      <hr class="border-gray-200">
      <div class="flex justify-between text-lg font-bold text-gray-800">
        <span>Total</span>
        <span>R$ ${subtotal.toFixed(2)}</span>
      </div>
    </div>
  `;

  setupCartItemEventListeners();
}

function setupCartItemEventListeners() {
  // AUMENTAR QUANTIDADE
  document.querySelectorAll('.increase-quantity').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = button.dataset.id;
      changeQuantity(itemId, 1);
    });
  });

  // DIMINUIR QUANTIDADE
  document.querySelectorAll('.decrease-quantity').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = button.dataset.id;
      changeQuantity(itemId, -1);
    });
  });

  // REMOVER ITEM
  document.querySelectorAll('.remove-item').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = button.dataset.id;
      removeFromCart(itemId);
    });
  });
}

function changeQuantity(itemId, change) {
  try {
    const item = cart.find(item => item.id == itemId);
    if (!item) return;

    const newQuantity = item.quantity + change;

    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    if (newQuantity > 99) {
      showToast('Quantidade máxima atingida (99)', 'warning');
      return;
    }

    item.quantity = newQuantity;
    updateCart();

    Logger.info(`Quantidade alterada: ${item.name} -> ${newQuantity}`);
  } catch (error) {
    Logger.error('Erro ao alterar quantidade:', error);
  }
}

function removeFromCart(itemId) {
  try {
    const itemIndex = cart.findIndex(item => item.id == itemId);
    if (itemIndex === -1) return;

    const itemName = cart[itemIndex].name;
    cart.splice(itemIndex, 1);

    updateCart();
    showToast(`${itemName} removido do carrinho`, 'info');

    Logger.info(`Item removido: ${itemName}`);
  } catch (error) {
    Logger.error('Erro ao remover item:', error);
  }
}

function toggleCart() {
  // Usar gerenciador unificado se disponível
  if (window.unifiedCartManager) {
    window.unifiedCartManager.toggleCart();
    return;
  }

  // Fallback para código antigo
  const cartSidebar = document.getElementById('cart-sidebar');
  const cartOverlay = document.getElementById('cart-overlay');
  const body = document.body;

  if (!cartSidebar || !cartOverlay) return;

  const isOpen = !cartSidebar.classList.contains('translate-x-full');

  if (isOpen) {
    cartSidebar.classList.add('translate-x-full');
    cartOverlay.classList.add('opacity-0');
    setTimeout(() => {
      cartOverlay.classList.add('hidden');
      body.style.overflow = 'auto';
    }, 300);
  } else {
    cartOverlay.classList.remove('hidden');
    setTimeout(() => {
      cartSidebar.classList.remove('translate-x-full');
      cartOverlay.classList.remove('opacity-0');
      body.style.overflow = 'hidden';
    }, 10);

    if (typeof renderCartItems === 'function') {
      renderCartItems();
    }
  }

  Logger.info(`Carrinho ${isOpen ? 'fechado' : 'aberto'}`);
}

// ✅ CHECKOUT E FUNÇÕES RESTANTES
function checkout() {
  // Delegar para o UnifiedCartManager que é o gerenciador autorizado
  if (window.unifiedCartManager) {
    window.unifiedCartManager.checkout();
    return;
  }

  // Fallback legado (caso o UnifiedCartManager não esteja disponível)
  try {
    const addressInput = document.getElementById('delivery-address');
    if (!addressInput) {
      showError('Campo de endereço não encontrado');
      return;
    }

    const address = addressInput.value.trim();

    const cartData = window.unifiedCartManager ? window.unifiedCartManager.cart : cart;
    if (cartData.length === 0) {
      showToast('Seu carrinho está vazio!', 'warning');
      return;
    }

    if (!address) {
      showToast('Por favor, informe o endereço de entrega.', 'warning');
      addressInput.focus();
      return;
    }

    if (address.length < 10) {
      showToast('Por favor, informe um endereço mais detalhado.', 'warning');
      addressInput.focus();
      return;
    }

    if (!isBusinessOpen()) {
      showToast('Estamos fechados no momento. Horário: 9h às 22h', 'warning');
      return;
    }

    const orderSummary = generateOrderSummary(address);

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Confirmar Pedido',
        html: orderSummary.preview,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Enviar Pedido',
        cancelButtonText: 'Revisar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280'
      }).then((result) => {
        if (result.isConfirmed) {
          sendWhatsAppOrder(orderSummary.message);
        }
      });
    } else {
      if (confirm('Deseja enviar este pedido?')) {
        sendWhatsAppOrder(orderSummary.message);
      }
    }

  } catch (error) {
    Logger.error('Erro no checkout:', error);
    showError('Erro ao processar pedido. Tente novamente.');
  }
}

function isBusinessOpen() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= CONFIG.BUSINESS_HOURS.start && hour < CONFIG.BUSINESS_HOURS.end;
}

function generateOrderSummary(address) {
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const savings = cart.reduce((sum, item) => {
    if (item.is_promo && item.original_price) {
      return sum + ((item.original_price - item.price) * item.quantity);
    }
    return sum;
  }, 0);

  let message = `*🍽️ Pedido - Cardápio Online*%0A%0A`;
  message += `📍 *Endereço de entrega:*%0A${encodeURIComponent(address)}%0A%0A`;
  message += `🛒 *Itens do pedido:*%0A`;

  cart.forEach((item, index) => {
    message += `${index + 1}. ${item.quantity}x ${encodeURIComponent(item.name)}`;
    message += ` - R$ ${(item.price * item.quantity).toFixed(2)}`;
    if (item.is_promo) message += ` 🔥`;
    message += `%0A`;
  });

  message += `%0A💰 *Resumo:*%0A`;
  message += `• Total de itens: ${totalItems}%0A`;
  if (savings > 0) {
    message += `• Economia: R$ ${savings.toFixed(2)}%0A`;
  }
  message += `• *Total: R$ ${total.toFixed(2)}*%0A%0A`;
  message += `🕐 Pedido realizado em: ${new Date().toLocaleString('pt-BR')}%0A%0A`;
  message += `💬 *Observações:* (adicione aqui)`;

  const preview = `
    <div class="text-left space-y-3">
      <div><strong>📍 Endereço:</strong><br>${address}</div>
      <div><strong>🛒 Itens (${totalItems}):</strong><br>
        ${cart.map(item => `• ${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}`).join('<br>')}
      </div>
      <div><strong>💰 Total: R$ ${total.toFixed(2)}</strong></div>
      ${savings > 0 ? `<div class="text-green-600">✨ Você economiza: R$ ${savings.toFixed(2)}</div>` : ''}
    </div>
  `;

  return { message, preview };
}

function sendWhatsAppOrder(message) {
  try {
    const phoneNumber = '5592985130951';
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

    window.open(whatsappUrl, '_blank');

    setTimeout(() => {
      cart = [];
      updateCart();
      toggleCart();
      showToast('Pedido enviado! Aguarde nosso contato.', 'success');
    }, 1000);

    Logger.info('Pedido enviado via WhatsApp');

  } catch (error) {
    Logger.error('Erro ao enviar pedido:', error);
    showError('Erro ao abrir WhatsApp. Tente novamente.');
  }
}

function checkBusinessHours() {
  const statusElement = document.getElementById('schedule-status');
  const statusElementDesktop = document.getElementById('schedule-status-desktop');

  const now = new Date();
  const hour = now.getHours();
  const isOpen = hour >= CONFIG.BUSINESS_HOURS.start && hour < CONFIG.BUSINESS_HOURS.end;

  const statusHTML = isOpen ? `
    <div class="status-text aberto">
      <i class="fas fa-circle" style="font-size: 0.6rem; margin-right: 0.5rem;"></i>
      <span>Aberto • Fechamos às ${CONFIG.BUSINESS_HOURS.end}:00h</span>
    </div>
  ` : `
    <div class="status-text fechado">
      <i class="fas fa-circle" style="font-size: 0.6rem; margin-right: 0.5rem;"></i>
      <span>Fechado • Abrimos às ${CONFIG.BUSINESS_HOURS.start}:00h</span>
    </div>
  `;

  if (statusElement) {
    statusElement.innerHTML = statusHTML;
  }

  if (statusElementDesktop) {
    statusElementDesktop.innerHTML = statusHTML;
  }
}

function startAutoUpdates() {
  if (updateInterval) return;

  updateInterval = setInterval(async () => {
    try {
      await checkForUpdates();
    } catch (error) {
      Logger.error('Erro na atualização automática:', error);
    }
  }, CONFIG.AUTO_UPDATE_INTERVAL);

  Logger.info('Atualizações automáticas iniciadas');
}

function stopAutoUpdates() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    Logger.info('Atualizações automáticas pausadas');
  }
}

function showLoading() {
  const menu = document.getElementById('menu');
  const newProducts = document.getElementById('new-products');

  const skeletonHTML = `
    <div class="skeleton-card">
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text" style="width: 50%"></div>
      <div class="skeleton skeleton-button mt-4"></div>
    </div>
  `;

  const manySkeletons = Array(4).fill(skeletonHTML).join('');
  const menuSkeletons = Array(6).fill(skeletonHTML).join('');

  if (menu) {
    menu.innerHTML = menuSkeletons;
  }

  if (newProducts) {
    newProducts.innerHTML = manySkeletons;
  }
}

function hideLoading() {
  // Loading será substituído pelo conteúdo renderizado
}

function showError(message, callback = null) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      icon: 'error',
      title: 'Ops! Algo deu errado',
      text: message,
      confirmButtonText: 'OK',
      confirmButtonColor: '#ef4444'
    }).then(() => {
      if (callback) callback();
    });
  } else {
    alert(message);
    if (callback) callback();
  }

  Logger.error('Erro mostrado ao usuário:', message);
}

function showToast(message, type = 'success') {
  if (typeof Swal !== 'undefined') {
    const icons = {
      success: 'success',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };

    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };

    Swal.fire({
      toast: true,
      position: 'top-start',
      icon: icons[type] || 'info',
      title: message,
      showConfirmButton: false,
      timer: type === 'error' ? 5000 : 3000,
      timerProgressBar: true,
      background: '#ffffff',
      color: '#374151',
      iconColor: colors[type] || colors.info,
      customClass: {
        popup: 'swal-toast-custom'
      }
    });
  } else {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'fixed bottom-4 right-4 z-50 space-y-2';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm transform transition-all duration-300 translate-x-full`;
    toast.innerHTML = `
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <i class="fas fa-${type === 'success' ? 'check-circle text-green-500' :
        type === 'error' ? 'exclamation-circle text-red-500' :
          type === 'warning' ? 'exclamation-triangle text-yellow-500' :
            'info-circle text-blue-500'} text-lg"></i>
        </div>
        <div class="ml-3">
          <p class="text-sm font-medium text-gray-900">${message}</p>
        </div>
      </div>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('translate-x-full');
    }, 10);

    setTimeout(() => {
      toast.classList.add('translate-x-full');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, type === 'error' ? 5000 : 3000);
  }
}

window.forceRefresh = async function () {
  if (isLoading) {
    showToast('Carregamento já em andamento...', 'info');
    return;
  }

  try {
    Logger.info('Atualização forçada solicitada pelo usuário');
    localStorage.removeItem('lastUpdateTime');
    cacheManager.clear();

    await loadProducts();
    showToast('Cardápio atualizado com sucesso!', 'success');

  } catch (error) {
    Logger.error('Erro na atualização forçada:', error);
    showError('Erro ao atualizar cardápio');
  }
};

function addRefreshButton() {
  if (document.getElementById('refresh-button')) return;

  const header = document.querySelector('header .container');
  if (!header) return;

  const refreshBtn = document.createElement('button');
  refreshBtn.id = 'refresh-button';
  refreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Atualizar';
  refreshBtn.className = 'hidden sm:inline-flex items-center bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-colors duration-200 shadow-sm hover:shadow-md';
  refreshBtn.onclick = window.forceRefresh;
  refreshBtn.title = 'Atualizar cardápio (F5)';

  header.appendChild(refreshBtn);

  const mobileBtn = document.createElement('button');
  mobileBtn.id = 'mobile-refresh-button';
  mobileBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
  mobileBtn.className = 'fixed bottom-20 left-4 sm:hidden bg-blue-500 hover:bg-blue-600 text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center z-40 transition-all duration-200';
  mobileBtn.onclick = window.forceRefresh;
  mobileBtn.title = 'Atualizar cardápio';

  document.body.appendChild(mobileBtn);
}

function monitorConnectivity() {
  window.addEventListener('online', () => {
    Logger.info('Conexão restaurada');
    showToast('Conexão restaurada!', 'success');
    checkForUpdates();
  });

  window.addEventListener('offline', () => {
    Logger.warn('Conexão perdida');
    showToast('Conexão perdida. Usando dados salvos.', 'warning');
  });
}

function initPerformanceMonitoring() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        Logger.info(`Performance [${entry.entryType}]:`, {
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime
        });
      });
    });

    try {
      observer.observe({ entryTypes: ['measure', 'navigation'] });
    } catch (error) {
      Logger.warn('Performance monitoring não suportado:', error);
    }
  }
}

// ✅ INICIALIZAÇÃO FINAL
setTimeout(() => {
  addRefreshButton();
  monitorConnectivity();
  initPerformanceMonitoring();
}, 2000);

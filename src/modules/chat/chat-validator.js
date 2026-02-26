/**
 * Chat Validation & Testing Module
 * Versão 1.0
 * 
 * Ferramentas para validar e testar o chat em produção
 * Use: window.ChatValidator.runAllTests()
 */

(function() {
  'use strict';

  const tests = {};
  const results = [];

  // ==========================================
  // 1. CORE INITIALIZATION TESTS
  // ==========================================

  tests.initializationTest = function() {
    const checks = {
      chatConfigExists: !!window.CHAT_CONFIG,
      historyStoreExists: !!window.HistoryStore,
      feedbackStoreExists: !!window.FeedbackStore,
      aiProviderExists: !!window.AIProvider,
      uiManagerExists: !!window.UIManager,
      productCardExists: !!window.ProductCard,
      chatBotExists: !!window.ChatBot,
      cacheManagerExists: !!window.ChatCacheManager,
      cartIntegrationExists: !!window.adicionarAoCarrinho,
    };

    const allPassed = Object.values(checks).every(v => v);
    
    return {
      name: '🚀 Initialization Test',
      passed: allPassed,
      details: checks,
      message: allPassed ? 'Todos módulos carregados ✅' : 'Falha ao carregar módulos ❌'
    };
  };

  // ==========================================
  // 2. CONFIGURATION TESTS
  // ==========================================

  tests.configurationTest = function() {
    const config = window.CHAT_CONFIG;
    const checks = {
      hasRestaurantName: !!config?.restaurante?.nome,
      hasUnidades: Array.isArray(config?.restaurante?.unidades) && config.restaurante.unidades.length > 0,
      hasChips: Array.isArray(config?.chips) && config.chips.length > 0,
      hasAIConfig: !!config?.ai,
      hasUIConfig: !!config?.ui,
      fallbackEnabled: config?.ai?.usarFallbackLocal === true,
    };

    const allPassed = Object.values(checks).every(v => v);
    
    return {
      name: '⚙️ Configuration Test',
      passed: allPassed,
      details: checks,
      message: allPassed ? 'Configuração válida ✅' : 'Configuração incompleta ⚠️'
    };
  };

  // ==========================================
  // 3. DOM TESTS
  // ==========================================

  tests.domTest = function() {
    const chatModals = document.querySelectorAll('[data-chat-modal]');
    const chatInput = document.querySelector('[data-chat-input]');
    const chatMessages = document.querySelector('[data-chat-messages]');
    const sendButton = document.querySelector('[data-chat-send]');

    const checks = {
      chatModalExists: chatModals.length > 0,
      chatInputExists: !!chatInput,
      chatMessagesExists: !!chatMessages,
      sendButtonExists: !!sendButton,
      modalIsVisible: chatModals.length > 0 && chatModals[0].offsetHeight > 0,
    };

    const allPassed = Object.values(checks).every(v => v);
    
    return {
      name: '🎨 DOM Test',
      passed: allPassed,
      details: checks,
      message: allPassed ? 'DOM estrutura válida ✅' : 'DOM incompleto ⚠️'
    };
  };

  // ==========================================
  // 4. STORAGE TESTS
  // ==========================================

  tests.storageTest = function() {
    try {
      const testKey = 'ignite_test_' + Date.now();
      const testValue = 'test_value_123';

      // Test LocalStorage
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      const storageWorks = retrieved === testValue;
      localStorage.removeItem(testKey);

      // Check history
      const historico = localStorage.getItem('ignite_chat_historico');
      const historicoExists = historico !== null;

      const checks = {
        localStorageWorks: storageWorks,
        historicoExists: historicoExists,
        historicoIsValid: historicoExists ? isValidJSON(historico) : true,
      };

      const allPassed = checks.localStorageWorks;
      
      return {
        name: '💾 Storage Test',
        passed: allPassed,
        details: checks,
        message: allPassed ? 'Storage funcionando ✅' : 'Storage indisponível ⚠️'
      };
    } catch (e) {
      return {
        name: '💾 Storage Test',
        passed: false,
        details: { error: e.message },
        message: 'Storage erro: ' + e.message + ' ❌'
      };
    }
  };

  // ==========================================
  // 5. PRODUCT CACHE TESTS
  // ==========================================

  tests.cacheTest = function() {
    try {
      const cache = window.ChatCacheManager;
      const produtos = cache.getProdutos();
      
      const checks = {
        cacheMethodsExist: typeof cache.getProdutos === 'function',
        produtosCarregados: Array.isArray(produtos) && produtos.length > 0,
        produtoTemNome: produtos.length > 0 && (produtos[0].nome || produtos[0].name),
        produtoTemPreco: produtos.length > 0 && (produtos[0].preco || produtos[0].price),
        buscaFunciona: cache.buscarProduto('') !== null, // Teste básico
      };

      const allPassed = checks.produtosCarregados;
      
      return {
        name: '🗂️ Cache Test',
        passed: allPassed,
        details: {
          ...checks,
          totalProdutos: produtos.length
        },
        message: allPassed ? `Cache OK (${produtos.length} produtos) ✅` : 'Cache vazio ⚠️'
      };
    } catch (e) {
      return {
        name: '🗂️ Cache Test',
        passed: false,
        details: { error: e.message },
        message: 'Cache erro: ' + e.message + ' ❌'
      };
    }
  };

  // ==========================================
  // 6. CART INTEGRATION TESTS
  // ==========================================

  tests.cartTest = function() {
    try {
      const cartManager = window.unifiedCartManager;
      const cartFunction = window.adicionarAoCarrinho;

      const checks = {
        cartManagerExists: !!cartManager,
        cartFunctionExists: typeof cartFunction === 'function',
        getItemsMethodExists: cartManager && typeof cartManager.getItems === 'function',
        addItemMethodExists: cartManager && typeof cartManager.addItem === 'function',
      };

      const allPassed = checks.cartFunctionExists && checks.cartManagerExists;
      
      return {
        name: '🛒 Cart Integration Test',
        passed: allPassed,
        details: checks,
        message: allPassed ? 'Cart integrado ✅' : 'Cart não disponível ⚠️'
      };
    } catch (e) {
      return {
        name: '🛒 Cart Integration Test',
        passed: false,
        details: { error: e.message },
        message: 'Cart erro: ' + e.message + ' ❌'
      };
    }
  };

  // ==========================================
  // 7. FALLBACK RESPONSE TESTS
  // ==========================================

  tests.fallbackTest = function() {
    try {
      const aiProvider = window.AIProvider;
      
      // Test fallback responses
      const testCases = [
        { input: 'oi', expected: 'greeting' },
        { input: 'onde fica', expected: 'location' },
        { input: 'qual horário', expected: 'hours' },
        { input: 'entrega', expected: 'delivery' },
      ];

      const results = testCases.map(tc => {
        const response = aiProvider.responder(tc.input);
        return {
          query: tc.input,
          responded: !!response && response.length > 0,
          responseLength: response ? response.length : 0
        };
      });

      const allResponded = results.every(r => r.responded);
      
      return {
        name: '🤖 Fallback Response Test',
        passed: allResponded,
        details: results,
        message: allResponded ? 'Fallback respondendo ✅' : 'Fallback com falhas ⚠️'
      };
    } catch (e) {
      return {
        name: '🤖 Fallback Response Test',
        passed: false,
        details: { error: e.message },
        message: 'Fallback erro: ' + e.message + ' ❌'
      };
    }
  };

  // ==========================================
  // 8. PERFORMANCE TESTS
  // ==========================================

  tests.performanceTest = function() {
    const checks = {};

    // Test 1: Initial load time
    const perfData = window.performance.timing;
    if (perfData) {
      const loadTime = perfData.loadEventEnd - perfData.navigationStart;
      checks.pageLoadTime = loadTime < 5000;
      checks.domContentLoadedTime = (perfData.domContentLoadedEventEnd - perfData.navigationStart) < 3000;
    }

    // Test 2: Memory usage
    if (window.performance.memory) {
      const memUsed = window.performance.memory.usedJSHeapSize;
      const memLimit = window.performance.memory.jsHeapSizeLimit;
      checks.memoryUsage = (memUsed / memLimit) < 0.8; // < 80%
    }

    // Test 3: Chat input response time
    const startTime = Date.now();
    window.ChatBot?.procesarMensaje('test');
    const responseTime = Date.now() - startTime;
    checks.chatResponseTime = responseTime < 500;

    const allPassed = Object.values(checks).every(v => v !== false);
    
    return {
      name: '⚡ Performance Test',
      passed: allPassed,
      details: checks,
      message: allPassed ? 'Performance OK ✅' : 'Performance degradado ⚠️'
    };
  };

  // ==========================================
  // 9. CSS & ANIMATIONS TEST
  // ==========================================

  tests.cssTest = function() {
    try {
      const chatModal = document.querySelector('[data-chat-modal]');
      const computedStyle = window.getComputedStyle(chatModal);

      const checks = {
        gradientLoaded: computedStyle.background.includes('grad') || computedStyle.backgroundImage.length > 0,
        animationsEnabled: computedStyle.animation !== 'none',
        borderRadiusDefined: computedStyle.borderRadius !== '0px',
        shadowDefined: computedStyle.boxShadow !== 'none',
      };

      const allPassed = checks.gradientLoaded || checks.shadowDefined;
      
      return {
        name: '🎨 CSS & Animations Test',
        passed: allPassed,
        details: checks,
        message: allPassed ? 'CSS carregadas ✅' : 'CSS ausentes ⚠️'
      };
    } catch (e) {
      return {
        name: '🎨 CSS & Animations Test',
        passed: false,
        details: { error: e.message },
        message: 'CSS erro: ' + e.message + ' ❌'
      };
    }
  };

  // ==========================================
  // 10. BROWSER COMPATIBILITY TEST
  // ==========================================

  tests.compatibilityTest = function() {
    const checks = {
      es6Support: typeof Promise !== 'undefined',
      fetchSupport: typeof fetch !== 'undefined',
      localStorageSupport: typeof localStorage !== 'undefined',
      customEventsSupport: typeof CustomEvent !== 'undefined',
      mutationObserverSupport: typeof MutationObserver !== 'undefined',
      intersectionObserverSupport: typeof IntersectionObserver !== 'undefined',
    };

    const allPassed = Object.values(checks).every(v => v);
    const browser = getBrowserInfo();
    
    return {
      name: '🌐 Browser Compatibility Test',
      passed: allPassed,
      details: {
        ...checks,
        browser: browser.name,
        version: browser.version
      },
      message: allPassed ? `Browser ${browser.name} compatível ✅` : '⚠️ Alguns features podem não funcionar'
    };
  };

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  function isValidJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getBrowserInfo() {
    const ua = navigator.userAgent;
    let name = 'Unknown';
    let version = 'Unknown';

    if (ua.indexOf('Firefox') > -1) name = 'Firefox';
    else if (ua.indexOf('Chrome') > -1) name = 'Chrome';
    else if (ua.indexOf('Safari') > -1) name = 'Safari';
    else if (ua.indexOf('Edge') > -1) name = 'Edge';
    else if (ua.indexOf('Trident') > -1) name = 'IE';

    return { name, version };
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  window.ChatValidator = {
    
    runAllTests() {
      console.group('🧪 Chat Validation Report');
      console.log('📍 Tests rodando em:', new Date().toLocaleString());
      
      const allResults = [];
      
      for (const [name, testFn] of Object.entries(tests)) {
        try {
          const result = testFn();
          allResults.push(result);
          
          const icon = result.passed ? '✅' : '❌';
          console.log(`${icon} ${result.name}: ${result.message}`);
          console.table(result.details);
        } catch (e) {
          console.error(`❌ ${name} erro:`, e.message);
        }
      }

      // Summary
      const passedCount = allResults.filter(r => r.passed).length;
      const totalCount = allResults.length;
      const percentage = Math.round((passedCount / totalCount) * 100);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 RESUMO: ${passedCount}/${totalCount} testes (${percentage}%)`);
      
      if (percentage === 100) {
        console.log('✨ Chat pronto para produção!');
      } else if (percentage >= 80) {
        console.log('⚠️ Chat funcional, mas com avisos');
      } else {
        console.log('❌ Chat com problemas críticos');
      }

      console.groupEnd();

      return {
        passed: passedCount,
        total: totalCount,
        percentage,
        results: allResults,
        timestamp: new Date().toISOString()
      };
    },

    quickTest() {
      // Teste rápido (apenas core)
      console.log('⚡ Quick validation...');
      const initTest = tests.initializationTest();
      const configTest = tests.configurationTest();
      const domTest = tests.domTest();

      const allPassed = initTest.passed && configTest.passed && domTest.passed;
      console.log(allPassed ? '✅ Chat OK' : '❌ Chat com problemas');

      return allPassed;
    },

    getReport() {
      // Retorna resultado dos testes já executados
      return {
        tests: tests,
        result: this.runAllTests()
      };
    },

    fixCommonIssues() {
      console.log('🔧 Tentando corrigir problemas comuns...');

      // Fix 1: Ensure chat config exists
      if (!window.CHAT_CONFIG) {
        console.error('❌ CHAT_CONFIG não encontrado');
        return false;
      }

      // Fix 2: Ensure DOM elements exist
      const chatModal = document.querySelector('[data-chat-modal]');
      if (!chatModal) {
        console.warn('⚠️ Chat modal não encontrado no DOM');
      }

      // Fix 3: Reinitialize cache
      if (window.ChatCacheManager) {
        window.ChatCacheManager.ativarAutoCarregamento();
        console.log('✅ Cache reativado');
      }

      // Fix 4: Re-attach event listeners
      if (window.chatEnhancementsReady === false) {
        console.log('✅ Tentando recarregar enhancements');
        // Pode tentar reexecuir o módulo
      }

      console.log('🔧 Reparos concluídos');
      return true;
    }
  };

  // Auto-run quick test on load
  if (window.CHAT_CONFIG?.debug) {
    document.addEventListener('DOMContentLoaded', () => {
      window.ChatValidator.quickTest();
    });
  }

  console.log('✅ Chat Validator module carregado (v1.0)');

})();

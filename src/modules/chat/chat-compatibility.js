/**
 * Chat Compatibility & Performance Helper
 * Versão 1.0
 * 
 * Utilitários para melhorar compatibilidade entre browsers e otimizar performance
 * Este arquivo é opcional mas recomendado para produção
 */

(function() {
  'use strict';

  // ==========================================
  // 1. POLYFILLS & COMPATIBILITY
  // ==========================================

  /**
   * Polyfill para EventTarget.addEventListener no IE11
   */
  if (!EventTarget.prototype.addEventListener) {
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      this.attachEvent('on' + type, listener);
    };
  }

  /**
   * Polyfill para String.prototype.normalize
   */
  if (!String.prototype.normalize) {
    String.prototype.normalize = function(form = 'NFC') {
      // Fallback simples: remove acentos
      return this.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };
  }

  /**
   * Polyfill para Array.prototype.flat
   */
  if (!Array.prototype.flat) {
    Array.prototype.flat = function(depth = 1) {
      return depth > 0
        ? this.reduce((acc, val) => 
            acc.concat(Array.isArray(val) ? val.flat(depth - 1) : val), [])
        : this.slice();
    };
  }

  /**
   * Polyfill para IntersectionObserver (IE11)
   */
  if (typeof IntersectionObserver === 'undefined') {
    window.IntersectionObserver = function(callback, options) {
      this.callback = callback;
      this.elements = new WeakMap();
      
      this.observe = function(element) {
        this.elements.set(element, true);
        // Fallback: executar callback imediatamente
        setTimeout(() => {
          callback([{ target: element, isIntersecting: true }]);
        }, 100);
      };
      
      this.unobserve = function(element) {
        this.elements.delete(element);
      };
      
      this.disconnect = function() {
        this.elements = new WeakMap();
      };
    };
  }

  // ==========================================
  // 2. PERFORMANCE HELPERS
  // ==========================================

  /**
   * Debounce com cancelamento
   */
  function debounce(func, wait, options = {}) {
    let timeout, args, context, timestamp, result;
    let later = function() {
      let last = Date.now() - timestamp;
      
      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!options.leading) {
          result = func.apply(context, args);
        }
        if (!timeout) context = args = null;
      }
    };
    
    let debounced = function() {
      context = this;
      args = arguments;
      timestamp = Date.now();
      let callNow = options.leading && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) result = func.apply(context, args);
      return result;
    };
    
    debounced.cancel = function() {
      clearTimeout(timeout);
      timeout = context = args = null;
    };
    
    debounced.flush = function() {
      if (timeout) clearTimeout(timeout);
      if (!timeout) result = func.apply(context, args);
      timeout = context = args = null;
      return result;
    };
    
    return debounced;
  }

  /**
   * Throttle com garantia de execução
   */
  function throttle(func, limit, options = {}) {
    let inThrottle, lastFunc, lastRan;
    
    return function() {
      const context = this;
      const args = arguments;
      
      if (!lastRan) lastRan = Date.now();
      
      clearTimeout(lastFunc);
      lastFunc = setTimeout(function() {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, Math.max(limit - (Date.now() - lastRan), 0));
    };
  }

  /**
   * RequestAnimationFrame com fallback
   */
  const raf = window.requestAnimationFrame || 
              window.webkitRequestAnimationFrame || 
              window.mozRequestAnimationFrame || 
              function(cb) { return setTimeout(cb, 16); };

  const caf = window.cancelAnimationFrame || 
              window.webkitCancelAnimationFrame || 
              window.mozCancelAnimationFrame || 
              clearTimeout;

  // ==========================================
  // 3. DOM UTILITIES
  // ==========================================

  /**
   * Verificar suporte a CSS Grid
   */
  function supportsGridLayout() {
    const el = document.createElement('div');
    el.style.display = 'grid';
    return el.style.display === 'grid';
  }

  /**
   * Verificar suporte a CSS Columns
   */
  function supportsColumns() {
    const el = document.createElement('div');
    return 'columns' in el.style || 
           'webkitColumns' in el.style ||
           'mozColumns' in el.style;
  }

  /**
   * Verificar se elemento é visível em viewport
   */
  function isElementInViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Suavizar scroll com fallback
   */
  function smoothScroll(element, target = 'top') {
    if (!element) return;
    
    if (element.scrollIntoView && 'behavior' in Element.prototype) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else {
      // Fallback para browsers antigos
      element.scrollIntoView();
    }
  }

  /**
   * Detectar mobile
   */
  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth < 768;
  }

  /**
   * Detectar touch support
   */
  function supportsTouch() {
    return (('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0));
  }

  // ==========================================
  // 4. STORAGE UTILITIES
  // ==========================================

  /**
   * LocalStorage com fallback em memória
   */
  const SafeStorage = {
    data: {}, // fallback em memória
    
    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        // Fallback: armazenar em memória (não persiste)
        this.data[key] = value;
        console.warn('⚠️ LocalStorage indisponível, usando memória (não persiste)');
      }
    },
    
    getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return this.data[key] || null;
      }
    },
    
    removeItem(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        delete this.data[key];
      }
    },
    
    clear() {
      try {
        localStorage.clear();
      } catch (e) {
        this.data = {};
      }
    }
  };

  // ==========================================
  // 5. NETWORK UTILITIES
  // ==========================================

  /**
   * Verificar conexão com internet
   */
  function isOnline() {
    return navigator.onLine !== false;
  }

  /**
   * Retry com backoff exponencial
   */
  async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Fazer fetch com timeout
   */
  function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    return fetch(url, {
      ...options,
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
  }

  // ==========================================
  // 6. TEXT UTILITIES
  // ==========================================

  /**
   * Normalizar texto removalendo acentos
   */
  function removeAccents(str) {
    try {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    } catch (e) {
      // Fallback simples
      const accentMap = {
        á: 'a', à: 'a', ã: 'a', â: 'a',
        é: 'e', è: 'e', ê: 'e',
        í: 'i', ì: 'i', î: 'i',
        ó: 'o', ò: 'o', õ: 'o', ô: 'o',
        ú: 'u', ù: 'u', û: 'u',
        ç: 'c'
      };
      
      return str
        .toLowerCase()
        .replace(/[áàãâéèêíìîóòõôúùûç]/g, (c) => accentMap[c] || c);
    }
  }

  /**
   * Truncar texto com ellipsis
   */
  function truncate(str, length = 100, suffix = '...') {
    if (!str) return '';
    return str.length > length 
      ? str.substring(0, length - suffix.length) + suffix 
      : str;
  }

  /**
   * Capitalizar primeira letra
   */
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  // ==========================================
  // 7. EXPORTAR PARA GLOBAL
  // ==========================================

  window.ChatCompat = {
    // Performance
    debounce,
    throttle,
    raf,
    caf,
    
    // DOM
    supportsGridLayout,
    supportsColumns,
    isElementInViewport,
    smoothScroll,
    isMobile,
    supportsTouch,
    
    // Storage
    SafeStorage,
    
    // Network
    isOnline,
    retryWithBackoff,
    fetchWithTimeout,
    
    // Text
    removeAccents,
    truncate,
    capitalize,
    
    // Info
    version: '1.0',
    loaded: true,
    timestamp: new Date().toISOString()
  };

  // ==========================================
  // 8. AUTO-DETECTION & LOGGING
  // ==========================================

  if (window.CHAT_CONFIG && window.CHAT_CONFIG.debug) {
    console.group('🔧 Chat Compatibility Check');
    console.log('📱 Mobile:', window.ChatCompat.isMobile());
    console.log('👆 Touch Support:', window.ChatCompat.supportsTouch());
    console.log('🌐 Online:', window.ChatCompat.isOnline());
    console.log('📦 CSS Grid:', window.ChatCompat.supportsGridLayout());
    console.log('🎬 RAF Available:', window.ChatCompat.raf !== undefined);
    console.groupEnd();
  }

  // Log de carregamento
  console.log('✅ Chat Compatibility module carregado (v1.0)');

})();

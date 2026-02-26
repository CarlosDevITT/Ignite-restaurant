/**
 * @file chat-cache-manager.js
 * @description Gerenciador de cache e otimização do chat
 * Melhora performance e implementa funcionalidades avançadas
 */

(function () {
  'use strict';

  // Normalização de texto para busca (remove acentos, pontuação e minúsculas)
  function _normalizeText(str) {
    try {
      return String(str || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9\s]/g, ' ').trim();
    } catch (e) {
      return String(str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    }
  }

  function _productSearchIndex(p) {
    const parts = [];
    parts.push(p.nome || p.name || '');
    parts.push(p.descricao || p.description || '');
    parts.push(p.categoria || p.category || '');
    parts.push(p.tags || p.etiquetas || '');
    parts.push(p.sku || p.codigo || '');
    parts.push(String(p.id || p._id || ''));
    return _normalizeText(parts.join(' '));
  }

  // Exportar globalmente
  window.ChatCacheManager = {
    // Cache de produtos normalizado
    _produtosCache: null,
    _cacheTime: 0,
    _CACHE_TTL: 5 * 60 * 1000, // 5 minutos

    /**
     * Obter produtos com cache
     */
    async getProdutos() {
      const agora = Date.now();

      // Retornar do cache se válido
      if (this._produtosCache && agora - this._cacheTime < this._CACHE_TTL) {
        return this._produtosCache;
      }

      // Tentar obter de window.products
      if (window.products && Array.isArray(window.products) && window.products.length > 0) {
        this._produtosCache = window.products;
        this._cacheTime = agora;
        return this._produtosCache;
      }

      // Tentar obter de window.produtos ou window.$produtos
      const alt = window.produtos || window.$produtos;
      if (Array.isArray(alt) && alt.length > 0) {
        this._produtosCache = alt;
        this._cacheTime = agora;
        return this._produtosCache;
      }

      // Tentar buscar do Supabase se disponível
      if (window.supabaseManager?.isConnected?.()) {
        try {
          const { data, error } = await window.supabaseManager.client
            .from('products')
            .select('*')
            .eq('available', true)
            .limit(100);

          if (!error && Array.isArray(data) && data.length > 0) {
            this._produtosCache = this._normalizarProdutos(data);
            this._cacheTime = agora;
            window.products = this._produtosCache; // Expor globalmente
            console.log(`✅ ChatCache: ${this._produtosCache.length} produtos carregados do Supabase`);
            return this._produtosCache;
          }
        } catch (e) {
          console.warn('⚠️ ChatCache: erro ao buscar Supabase', e.message);
        }
      }

      // Fallback: retornar cache antigo mesmo se expirado
      return this._produtosCache || [];
    },

    /**
     * Normalizar produtos (compatibilidade PT-BR / EN)
     */
    _normalizarProdutos(lista) {
      return lista.map(p => ({
        ...p,
        id: p.id,
        nome: p.nome || p.name || 'Produto',
        name: p.name || p.nome || 'Produto',
        preco: Number(p.preco || p.price || 0),
        price: Number(p.price || p.preco || 0),
        descricao: p.descricao || p.description || '',
        description: p.description || p.descricao || '',
        categoria: p.categoria || p.category || '',
        category: p.category || p.categoria || '',
        imagem_url: p.imagem_url || p.image_url || p.foto || '',
        image_url: p.image_url || p.imagem_url || p.foto || '',
        featured: Boolean(p.featured || p.destaque),
        available: p.available !== false && p.disponivel !== false,
      }));
    },

    /**
     * Buscar produto por nome
     */
    buscarProduto(nome, produtos = null) {
      const lista = produtos || this._produtosCache || [];
      if (!nome || !Array.isArray(lista) || lista.length === 0) return null;

      const q = _normalizeText(nome);
      const tokens = q.split(/\s+/).filter(Boolean);

      // 1) exact name or id
      let found = lista.find(p => _normalizeText(p.nome || p.name) === q || String(p.id) === nome || String(p.id) === q);
      if (found) return found;

      // 2) all tokens present (AND)
      found = lista.find(p => {
        const idx = _productSearchIndex(p);
        return tokens.every(t => idx.includes(t));
      });
      if (found) return found;

      // 3) any token present (OR)
      found = lista.find(p => {
        const idx = _productSearchIndex(p);
        return tokens.some(t => idx.includes(t));
      });
      if (found) return found;

      // 4) fallback partial name
      found = lista.find(p => _normalizeText(p.nome || p.name).includes(q));
      return found || null;
    },

    /**
     * Buscar múltiplos produtos
     */
    buscarProdutos(nomes, produtos = null) {
      if (!nomes) return [];
      const lista = produtos || this._produtosCache || [];
      const nomesArray = typeof nomes === 'string' ? nomes.split('|') : Array.isArray(nomes) ? nomes : [];

      // Se for array de nomes, buscar um a um
      const encontrados = [];
      for (const nm of nomesArray.map(n => (typeof n === 'string' ? n.trim() : ''))) {
        if (!nm) continue;
        const p = this.buscarProduto(nm, lista);
        if (p && !encontrados.find(x => String(x.id) === String(p.id))) encontrados.push(p);
      }

      // Se nenhum encontrado e nomesArray tem apenas 1 item, tentar busca por tokens retornando múltiplos
      if (encontrados.length === 0 && nomesArray.length === 1) {
        const q = _normalizeText(nomesArray[0]);
        const tokens = q.split(/\s+/).filter(Boolean);
        const matches = lista.filter(p => {
          const idx = _productSearchIndex(p);
          return tokens.every(t => idx.includes(t)) || tokens.some(t => idx.includes(t));
        });
        return matches.slice(0, 5);
      }

      return encontrados.slice(0, 5);
    },

    /**
     * Filtrar por categoria
     */
    filtrarPorCategoria(categoria, produtos = null) {
      const lista = produtos || this._produtosCache || [];
      const cat = categoria.toLowerCase().trim();

      return lista.filter(p => {
        const pCat = (p.categoria || p.category || '').toLowerCase();
        return pCat.includes(cat);
      });
    },

    /**
     * Obter destaques (featured)
     */
    obterDestaques(quantidade = 5, produtos = null) {
      const lista = produtos || this._produtosCache || [];
      const destaques = lista.filter(p => p.featured || p.destaque);

      if (destaques.length > 0) {
        return destaques.slice(0, quantidade);
      }

      // Fallback: retornar primeiros produtos
      return lista.slice(0, quantidade);
    },

    /**
     * Limpar cache
     */
    limparCache() {
      this._produtosCache = null;
      this._cacheTime = 0;
      console.log('🗑️ ChatCache: cache limpado');
    },

    /**
     * Ativar auto-carregamento de produtos
     */
    ativarAutoCarregamento() {
      // Carregamento inicial
      this.getProdutos().then(prods => {
        console.log(`🔄 ChatCache: ${prods.length} produtos disponíveis`);
      });

      // Recarregar a cada 3 minutos
      setInterval(() => {
        this.limparCache();
        this.getProdutos();
      }, 3 * 60 * 1000);
    },
  };

  // ────────────────────────────────────────────────────────────────
  // Integração com chat-bot.js: fornecer getProdutos otimizado
  // ────────────────────────────────────────────────────────────────

  // Substituir SupabaseService.carregarProdutos se existir
  if (typeof SupabaseService !== 'undefined' && SupabaseService.carregarProdutos) {
    const originalCarregarProdutos = SupabaseService.carregarProdutos;

    SupabaseService.carregarProdutos = async function () {
      try {
        const produtos = await window.ChatCacheManager.getProdutos();
        if (produtos.length > 0) {
          return produtos;
        }
        return await originalCarregarProdutos.call(this);
      } catch (e) {
        console.error('ChatCache integration error:', e);
        return await originalCarregarProdutos.call(this);
      }
    };
  }

  // Ativar auto-carregamento
  document.addEventListener('DOMContentLoaded', () => {
    window.ChatCacheManager.ativarAutoCarregamento();
  });

  // Também tentar ativar após 500ms se ainda não ativado
  setTimeout(() => {
    if (!window.ChatCacheManager._produtosCache) {
      window.ChatCacheManager.ativarAutoCarregamento();
    }
  }, 500);

  console.log('✨ ChatCacheManager iniciado');
})();

// supabase-config.js - Configuração centralizada do Supabase

/**
 * 🔐 CONFIGURAÇÃO DO SUPABASE
 * Projeto: qgnqztsxfeugopuhyioq
 * URL: https://qgnqztsxfeugopuhyioq.supabase.co
 */

const SUPABASE_CONFIG = {
  // URLs e Chaves
  url: 'https://qgnqztsxfeugopuhyioq.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbnF6dHN4ZmV1Z29wdWh5aW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MTg4MjEsImV4cCI6MjA3MzA5NDgyMX0.mW88-7P_Af3WMVAUT7ha4Mf0nyKJoSiNjMfuXiCllIA',
  publishableKey: 'QPY4rsWbKIlFHTxCeshY5w_xLrl2cwN',

  // Tabelas
  tables: {
    produtos: 'produtos',
    pedidos: 'pedidos',
    usuarios: 'usuarios',
    categorias: 'categorias',
    promocoes: 'promocoes'
  },

  // Configurações
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000 // 5 minutos
  },

  retry: {
    maxRetries: 3,
    retryDelay: 2000
  }
};

// Classe SupabaseManager - Gerenciador centralizado
class SupabaseManager {
  constructor() {
    this.client = null;
    this.connected = false;
    this.cache = new Map();
    this.init();
  }

  init() {
    this.waitForSupabase();
  }

  waitForSupabase() {
    if (window.supabase?.createClient) {
      this.connect();
    } else {
      // Retry a cada 100ms
      setTimeout(() => this.waitForSupabase(), 100);
    }
  }

  connect() {
    try {
      this.client = window.supabase.createClient(
        SUPABASE_CONFIG.url,
        SUPABASE_CONFIG.anonKey
      );
      this.connected = true;
      console.log('✅ Supabase Manager: Conectado com sucesso');
      this.testConnection();
      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar Supabase:', error);
      this.connected = false;
      return false;
    }
  }

  async testConnection() {
    try {
      if (!this.client) return false;

      // Testar com uma query simples - usar tabela 'products' que existe
      const { data, error, count } = await this.client
        .from('products')
        .select('*', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        console.warn('⚠️ Teste de conexão falhou:', error);
        // Tentar com tabela produtos também
        const { error: error2 } = await this.client
          .from('produtos')
          .select('*', { count: 'exact', head: true })
          .limit(1);

        if (error2) {
          console.warn('⚠️ Tabelas products e produtos não encontradas. Verifique a estrutura do banco.');
        }
        return false;
      }

      console.log('✅ Teste de conexão bem-sucedido');
      return true;
    } catch (error) {
      console.error('❌ Erro no teste de conexão:', error);
      return false;
    }
  }

  isConnected() {
    return this.connected && this.client !== null;
  }

  // ========== PRODUTOS ==========
  async getProdutos(categoria = null) {
    if (!this.isConnected()) {
      console.error('❌ Supabase não conectado');
      return [];
    }

    const cacheKey = `produtos_${categoria || 'all'}`;

    // Verificar cache
    if (SUPABASE_CONFIG.cache.enabled) {
      const cached = this.getCached(cacheKey);
      if (cached) {
        console.log('📦 Produtos retornados do cache');
        return cached;
      }
    }

    try {
      let query = this.client
        .from(SUPABASE_CONFIG.tables.produtos)
        .select('*')
        .eq('disponivel', true);

      if (categoria) {
        query = query.eq('categoria', categoria);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Cachear resultado
      if (SUPABASE_CONFIG.cache.enabled) {
        this.setCached(cacheKey, data);
      }

      console.log(`✅ ${data?.length || 0} produtos carregados`);
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao carregar produtos:', error);
      return [];
    }
  }

  async getProdutoById(id) {
    if (!this.isConnected()) {
      console.error('❌ Supabase não conectado');
      return null;
    }

    try {
      const { data, error } = await this.client
        .from(SUPABASE_CONFIG.tables.produtos)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao carregar produto:', error);
      return null;
    }
  }

  // ========== USUÁRIOS (PERFIL) ==========
  async salvarUsuario(perfil) {
    if (!this.isConnected()) {
      console.error('❌ Supabase não conectado para salvar usuário');
      return null;
    }

    try {
      // Upsert baseado no telefone (assumindo que a tabela permite ou via update manual caso exista)
      const { data: existingUser } = await this.client
        .from(SUPABASE_CONFIG.tables.usuarios)
        .select('*')
        .eq('telefone', perfil.phone)
        .single();

      if (existingUser) {
        const { data, error } = await this.client
          .from(SUPABASE_CONFIG.tables.usuarios)
          .update({
            nome: perfil.name,
            endereco: perfil.address || null,
            email: perfil.email || null,
            data_nascimento: perfil.birthDate || null,
            genero: perfil.gender || null
          })
          .eq('telefone', perfil.phone);
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await this.client
          .from(SUPABASE_CONFIG.tables.usuarios)
          .insert([{
            telefone: perfil.phone,
            nome: perfil.name,
            endereco: perfil.address || null,
            email: perfil.email || null,
            data_nascimento: perfil.birthDate || null,
            genero: perfil.gender || null,
            data_cadastro: new Date().toISOString()
          }]);
        if (error) throw error;
        return data;
      }

    } catch (error) {
      console.error('❌ Erro ao salvar/atualizar usuário:', error);
      return null;
    }
  }

  // ========== PEDIDOS ==========
  async salvarPedido(pedido) {
    if (!this.isConnected()) {
      console.error('❌ Supabase não conectado');
      return null;
    }

    try {
      const { data, error } = await this.client
        .from(SUPABASE_CONFIG.tables.pedidos)
        .insert([{
          items: pedido.items,
          total: pedido.total,
          endereco: pedido.endereco,
          telefone: pedido.telefone,
          status: 'pendente',
          data_pedido: new Date().toISOString()
        }]);

      if (error) throw error;
      console.log('✅ Pedido salvo com sucesso');
      return data;
    } catch (error) {
      console.error('❌ Erro ao salvar pedido:', error);
      return null;
    }
  }

  async getPedidos(limit = 100) {
    if (!this.isConnected()) {
      console.error('❌ Supabase não conectado');
      return [];
    }

    try {
      const { data, error } = await this.client
        .from(SUPABASE_CONFIG.tables.pedidos)
        .select('*')
        .order('data_pedido', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erro ao carregar pedidos:', error);
      return [];
    }
  }

  // ========== CATEGORIAS ==========
  async getCategorias() {
    if (!this.isConnected()) {
      console.error('❌ Supabase não conectado');
      return [];
    }

    const cacheKey = 'categorias_all';

    // Verificar cache
    if (SUPABASE_CONFIG.cache.enabled) {
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
    }

    try {
      let { data, error } = await this.client
        .from('categorias')
        .select('*')
        .order('nome');

      if (error) {
        const fallback = await this.client
          .from('categories')
          .select('*')
          .order('name');

        if (!fallback.error) {
          data = fallback.data;
          error = null;
        }
      }

      if (error) throw error;

      if (data && data.length > 0) {
        if (SUPABASE_CONFIG.cache.enabled) this.setCached(cacheKey, data);
        return data;
      }
    } catch (e) {
      // Silent fail
    }
    return [];
  }

  // ========== PROMOÇÕES ==========
  async getPromocoes() {
    if (!this.isConnected()) {
      console.error('❌ Supabase não conectado');
      return [];
    }

    const cacheKey = 'promocoes_all';

    if (SUPABASE_CONFIG.cache.enabled) {
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
    }

    try {
      const { data, error } = await this.client
        .from(SUPABASE_CONFIG.tables.promocoes)
        .select('*')
        .eq('ativa', true)
        .gte('data_fim', new Date().toISOString());

      if (error) throw error;

      if (SUPABASE_CONFIG.cache.enabled) {
        this.setCached(cacheKey, data);
      }

      return data || [];
    } catch (error) {
      console.error('❌ Erro ao carregar promoções:', error);
      return [];
    }
  }

  // ========== CACHE ==========
  setCached(key, value, ttl = SUPABASE_CONFIG.cache.ttl) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  getCached(key) {
    const item = this.cache.get(key);

    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  // ========== UTILITÁRIOS ==========
  async executeQuery(table, query) {
    if (!this.isConnected()) {
      console.error('❌ Supabase não conectado');
      return null;
    }

    try {
      return await this.client.from(table).select(query);
    } catch (error) {
      console.error('❌ Erro na query:', error);
      return null;
    }
  }

  getConfig() {
    return SUPABASE_CONFIG;
  }
}

// Inicializar gerenciador global
window.supabaseManager = new SupabaseManager();

// Exportar para uso
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SupabaseManager, SUPABASE_CONFIG };
}

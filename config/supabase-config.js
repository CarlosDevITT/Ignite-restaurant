// supabase-config.js - Configuração centralizada do Supabase

/**
 * 🔐 CONFIGURAÇÃO DO SUPABASE
 * Projeto: qgnqztsxfeugopuhyioq
 * URL: https://qgnqztsxfeugopuhyioq.supabase.co
 */

var SUPABASE_CONFIG = {
  // URLs e Chaves
  url: 'https://qgnqztsxfeugopuhyioq.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnbnF6dHN4ZmV1Z29wdWh5aW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MTg4MjEsImV4cCI6MjA3MzA5NDgyMX0.mW88-7P_Af3WMVAUT7ha4Mf0nyKJoSiNjMfuXiCllIA',
  publishableKey: 'QPY4rsWbKIlFHTxCeshY5w_xLrl2cwN',

  // Tabelas
  tables: {
    produtos: 'products',
    pedidos: 'orders',
    usuarios: 'customers',
    categorias: 'categorias',
    promocoes: 'promocoes',
    feed_posts: 'feed_posts',
    feed_comentarios: 'feed_comentarios'
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
        .eq('available', true);

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
      const userData = {
        name: perfil.name,
        address: perfil.address || null,
        email: perfil.email || null,
        birth_date: perfil.birthDate || null,
        gender: perfil.gender || null,
        password: perfil.password || null // NOTA: Em app real, use Argon2/Bcrypt no backend
      };

      const { data, error } = await this.client
        .from(SUPABASE_CONFIG.tables.usuarios)
        .upsert({
          phone: perfil.phone,
          ...userData,
          data_cadastro: new Date().toISOString()
        }, { onConflict: 'phone' })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erro ao salvar/atualizar usuário:', error);
      return null;
    }
  }

  async buscarUsuarioPorTelefone(telefone) {
    if (!this.isConnected()) return null;
    try {
      const { data, error } = await this.client
        .from(SUPABASE_CONFIG.tables.usuarios)
        .select('*')
        .eq('phone', telefone)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (e) {
      return null;
    }
  }

  async verificarSenha(telefone, senha) {
    const user = await this.buscarUsuarioPorTelefone(telefone);
    if (!user) return { success: false, message: 'Usuário não encontrado' };
    
    // Comparação simples (em produção usar hash)
    if ((user.password && user.password === senha) || (user.senha && user.senha === senha)) {
      return { success: true, user };
    }
    return { success: false, message: 'Senha incorreta' };
  }

  async getUserStats(telefone) {
    if (!this.isConnected()) return { ordersCount: 0, points: 0 };
    try {
      const cleanPhone = telefone.replace(/\D/g, '');
      const { count, error } = await this.client
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('phone', cleanPhone);
      
      if (error) throw error;
      return { 
        ordersCount: count || 0,
        points: (count || 0) * 10 // Gamificação simples
      };
    } catch (e) {
      return { ordersCount: 0, points: 0 };
    }
  }

  // ========== PEDIDOS ==========
  async finalizarPedido(pedido) {
    if (!this.isConnected()) {
      console.error('❌ Supabase não conectado');
      return { success: false, error: 'Sem conexão com banco' };
    }

    try {
      // 1. Sanitização e Validação
      if (!pedido.items || pedido.items.length === 0) throw new Error('Carrinho vazio');
      const cleanPhone = String(pedido.telefone).replace(/\D/g, '');
      if (cleanPhone.length < 10) throw new Error('Telefone inválido');
      const cleanName = String(pedido.nome).trim();

      // Recalcular total baseando-se nos itens para segurança
      let calculatedTotal = 0;
      let totalQuantity = 0;
      const orderItems = pedido.items.map(item => {
        const qty = parseInt(item.quantidade || item.quantity || 1, 10);
        const price = parseFloat(item.preco_unitario || item.price || 0);
        if (qty <= 0 || price < 0) throw new Error('Dados de item inválidos');
        const subtotal = qty * price;
        calculatedTotal += subtotal;
        totalQuantity += qty;
        
        // Garantir ID numérico se possível
        const pid = isNaN(item.id) ? item.id : parseInt(item.id, 10);
        
        return {
          product_id: pid,
          product_name: String(item.nome || item.name),
          quantity: qty,
          unit_price: price,
          total_price: subtotal,
          subtotal: subtotal // redundância para compatibilidade
        };
      });

      // 2. Buscar/Criar cliente
      let customerId;
      let { data: customer, error: customerError } = await this.client
        .from('customers')
        .select('id, name')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (!customer) {
         const { data: newCustomer, error: createError } = await this.client
           .from('customers')
           .insert([{ name: cleanName, phone: cleanPhone }])
           .select('id, name')
           .single();
           
         if (createError) throw new Error('Erro ao criar cliente');
         customer = newCustomer;
      }
      customerId = customer.id;

      // 3. Criar registro em "orders"
      const { data: order, error: orderError } = await this.client
        .from('orders')
        .insert([{
          customer_id: customerId,
          customer_name: customer.name,
          total: calculatedTotal,
          status: 'pending',
          items_count: totalQuantity,
          phone: cleanPhone
        }])
        .select('id')
        .single();

      if (orderError) throw new Error('Erro ao registrar pedido: ' + orderError.message);

      // 4. Inserir itens em "order_items"
      const itemsWithOrderId = orderItems.map(item => ({...item, order_id: order.id}));
      const { error: itemsError } = await this.client
        .from('order_items')
        .insert(itemsWithOrderId);

      if (itemsError) {
        // Fallback: se os itens falharem, tentar deletar a order (atomicidade básica simulada se não houver trigger)
        await this.client.from('orders').delete().eq('id', order.id);
        throw new Error('Erro ao inserir itens: ' + itemsError.message);
      }

      console.log('✅ Pedido finalizado com sucesso no Supabase');
      return { success: true, order: order };
    } catch (error) {
      console.error('❌ Erro transacional ao finalizar pedido:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Fallback legad
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
          address: pedido.endereco,
          phone: pedido.telefone,
          status: 'pendente',
          data_order: new Date().toISOString()
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

  // ========== REALTIME (WEB-SOCKETS) ==========
  subscribeToProducts(callback) {
    if (!this.isConnected()) return null;
    
    console.log('📡 Inscrevendo-se para atualizações de produtos (Realtime)...');
    const channel = this.client
      .channel('public:products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('🔄 Atualização de produto recebida:', payload);
          if (callback && typeof callback === 'function') {
            callback(payload);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Inscrição Realtime em produtos confirmada!');
        }
      });
      
    return channel;
  }

  subscribeToOrders(phone, callback) {
    if (!this.isConnected() || !phone) return null;
    
    const cleanPhone = phone.replace(/\D/g, '');
    console.log(`📡 Inscrevendo-se para atualizações de pedidos do cliente (Phone: ${cleanPhone})...`);
    
    const channel = this.client
      .channel(`public:orders:phone=${cleanPhone}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'orders',
          filter: `phone=eq.${cleanPhone}` 
        },
        (payload) => {
          console.log('🔄 Atualização de status do pedido recebida:', payload);
          if (callback && typeof callback === 'function') {
            callback(payload);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Inscrição Realtime em pedidos confirmada!');
        }
      });
      
    return channel;
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

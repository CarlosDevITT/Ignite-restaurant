import { getSupabase, supabaseRetry } from './supabase-client.js';

const STORAGE_KEY = 'ignite-orders-v1';
const CLIENT_TOKEN_KEY = 'ignite-client-token-v1';
const RECONCILE_INTERVAL_MS = 4000;
const RECONNECT_DELAY_MS = 1200;

const readLocal = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
};

const saveLocalOrder = (order) => {
  const orders = readLocal().filter(item => item?.offline !== true);
  const key = String(order.id || order.order_number || order.numero_pedido);
  const next = [order, ...orders.filter(item => String(item.id || item.order_number || item.numero_pedido) !== key)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return order;
};

function getClientToken() {
  let token = localStorage.getItem(CLIENT_TOKEN_KEY);
  if (token && token.length >= 32) return token;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(CLIENT_TOKEN_KEY, token);
  return token;
}

export async function placeOrder(payload, items) {
  const supabase = await getSupabase();
  const rpcItems = items.map(item => ({
    product_id: item.product_id,
    quantity: item.quantity,
    notes: item.notes || '',
  }));

  const { data, error } = await supabaseRetry(() => supabase.rpc('place_cardapio_order_v2', {
    p_client_token: getClientToken(),
    p_customer_name: payload.customerName,
    p_phone: payload.phone,
    p_address: payload.address || '',
    p_payment_method: payload.paymentMethod,
    p_order_type: payload.orderType,
    p_table_number: payload.tableNumber ? Number(payload.tableNumber) : null,
    p_notes: payload.notes || '',
    p_items: rpcItems,
  }));

  if (error) {
    console.error('[Pedidos] Falha ao criar pedido pela RPC V2:', { code: error.code, message: error.message });
    throw new Error(error.message || 'Não foi possível enviar o pedido.');
  }
  if (!data) throw new Error('O servidor não retornou o pedido criado.');
  return saveLocalOrder(Array.isArray(data) ? data[0] : data);
}

let cacheVersion = 0;
let loadVersion = 0;

export function cacheOrderChange(payload) {
  cacheVersion++;
  const id = payload.new?.id ?? payload.old?.id;
  if (id == null) return;
  const current = readLocal().filter(order => order?.offline !== true);
  const exists = current.some(order => String(order.id) === String(id));
  let next;
  if (payload.eventType === 'DELETE') {
    next = current.filter(order => String(order.id) !== String(id));
  } else if (exists) {
    next = current.map(order => String(order.id) === String(id) ? { ...order, ...payload.new } : order);
  } else if (payload.new) {
    next = [payload.new, ...current];
  } else {
    next = current;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function getOrders() {
  const supabase = await getSupabase();
  const request = ++loadVersion;
  const version = cacheVersion;
  const { data, error } = await supabaseRetry(() => supabase.rpc('get_cardapio_orders_v2', {
    p_client_token: getClientToken(),
  }));
  if (error) throw error;
  const remote = Array.isArray(data) ? data : [];
  if (request === loadVersion && version === cacheVersion) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
  }
  return remote;
}

export async function subscribeToOrders(onChange) {
  let stopped = false;
  const refresh = () => { if (!stopped) onChange(); };
  window.addEventListener('online', refresh);
  window.addEventListener('focus', refresh);
  const timer = setInterval(refresh, 10000);
  return () => {
    stopped = true;
    clearInterval(timer);
    window.removeEventListener('online', refresh);
    window.removeEventListener('focus', refresh);
  };
}

export async function subscribeToOrder(orderId, { onChange, onError = console.warn } = {}) {
  if (orderId == null) throw new Error('orders.id obrigatório para acompanhamento.');

  const supabase = await getSupabase();
  let stopped = false;
  let channel = null;
  let reconcileTimer = null;
  let reconnectTimer = null;
  let generation = 0;
  let lastSignature = '';

  const emitOrder = (order) => {
    if (!order || stopped) return;
    const signature = `${order.id}:${order.status}:${order.updated_at || ''}:${order.pagamento_confirmado ?? ''}`;
    if (signature === lastSignature) return;
    lastSignature = signature;
    const payload = { eventType: 'UPDATE', new: order };
    cacheOrderChange(payload);
    onChange?.(payload);
  };

  const reconcile = async () => {
    try {
      const orders = await getOrders();
      if (stopped) return;
      const order = orders.find(item => String(item.id) === String(orderId));
      if (!order) return;
      emitOrder(order);
    } catch (error) {
      if (!stopped) onError(error);
    }
  };

  const removeChannel = async () => {
    const current = channel;
    channel = null;
    if (current) await supabase.removeChannel(current).catch(() => {});
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connectRealtime();
    }, RECONNECT_DELAY_MS);
  };

  const connectRealtime = async () => {
    if (stopped || !navigator.onLine) return;
    const currentGeneration = ++generation;
    await removeChannel();
    if (stopped || currentGeneration !== generation) return;

    const nextChannel = supabase
      .channel(`cardapio-order-${orderId}-${currentGeneration}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${Number(orderId)}`,
      }, payload => {
        if (stopped || currentGeneration !== generation) return;
        emitOrder(payload.new);
        // The RPC is the capability-token-authorized source of truth and also
        // refreshes order_items/derived fields after a realtime signal.
        void reconcile();
      });

    channel = nextChannel;
    nextChannel.subscribe(status => {
      if (stopped || currentGeneration !== generation) return;
      if (status === 'SUBSCRIBED') {
        void reconcile();
        return;
      }
      if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
        scheduleReconnect();
      }
    });
  };

  const onOnline = () => {
    void reconcile();
    void connectRealtime();
  };
  const onFocus = () => {
    void reconcile();
    if (!channel && navigator.onLine) void connectRealtime();
  };

  window.addEventListener('online', onOnline);
  window.addEventListener('focus', onFocus);

  // Reconcile first so the UI never waits for a websocket event that may have
  // happened while the app was suspended/offline.
  await reconcile();
  await connectRealtime();

  // Guest orders are intentionally not exposed through broad SELECT RLS.
  // This lightweight reconciliation is therefore kept as a secure fallback;
  // authenticated customers still benefit from immediate Realtime updates.
  reconcileTimer = setInterval(reconcile, RECONCILE_INTERVAL_MS);

  return () => {
    stopped = true;
    generation++;
    clearInterval(reconcileTimer);
    clearTimeout(reconnectTimer);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('focus', onFocus);
    void removeChannel();
  };
}

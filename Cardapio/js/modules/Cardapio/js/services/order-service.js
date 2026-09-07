import { APP_CONFIG } from '../config.js';
import { createId } from '../utils/format.js';
import { getSupabase, supabaseRetry } from './supabase-client.js';

const STORAGE_KEY = 'ignite-orders-v1';

const isDev = () => {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.hostname.endsWith('.local');
  } catch { return false; }
};
const devLog = (...args) => { if (isDev()) console.log(...args); };

const readLocal = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
};

const saveLocalOrder = (order) => {
  const orders = readLocal();
  const key = String(order.id || order.order_number || order.numero_pedido);
  const next = [order, ...orders.filter((item) => String(item.id || item.order_number || item.numero_pedido) !== key)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return order;
};

export async function placeOrder(payload, items) {
  const supabase = await getSupabase();
  if (supabase) {
    const rpcItems = items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      notes: item.notes || '',
    }));
    let { data, error } = await supabaseRetry(() => supabase.rpc('place_cardapio_order_v2', {
      p_customer_name: payload.customerName,
      p_phone: payload.phone,
      p_address: payload.address,
      p_payment_method: payload.paymentMethod,
      p_order_type: payload.orderType,
      p_table_number: payload.tableNumber,
      p_notes: payload.notes || '',
      p_items: rpcItems,
    }));
    if (!error && data) {
      const order = Array.isArray(data) ? data[0] : data;
      return saveLocalOrder(order);
    }
    const rpcMissing = error && (
      ['42883', 'PGRST202'].includes(error.code)
      || /place_cardapio_order_v2.*(schema cache|could not find|não encontr)/i.test(error.message || '')
    );
    if (!rpcMissing) {
      console.error('[Pedidos] A RPC rejeitou o pedido.', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
      throw error;
    }
    if (payload.orderType === 'delivery') {
      ({ data, error } = await supabaseRetry(() => supabase.rpc('place_cardapio_order', {
        p_customer_name: payload.customerName,
        p_phone: payload.phone,
        p_address: payload.address,
        p_payment_method: payload.paymentMethod,
        p_notes: payload.notes || '',
        p_items: rpcItems,
      })));
      if (!error && data) return saveLocalOrder(Array.isArray(data) ? data[0] : data);
      if (error) throw error;
    }
    if (payload.orderType !== 'delivery') throw new Error('Atualização do checkout ainda não aplicada no servidor.');
    console.warn('[Pedidos] RPC ainda não aplicada; usando envio legado.');
    return saveLocalOrder(await placeLegacyOrder(supabase, payload, items));
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = payload.orderType === 'delivery' ? APP_CONFIG.deliveryFee : 0;
  const order = {
    id: createId(), order_number: `IG${String(Date.now()).slice(-6)}`, status: 'pending', offline: true,
    customer_name: payload.customerName, phone: payload.phone, address: payload.address,
    payment_method: payload.paymentMethod, notes: payload.notes || '', subtotal,
    order_type: payload.orderType, table_number: payload.tableNumber,
    delivery_fee: deliveryFee, total: subtotal + deliveryFee,
    created_at: new Date().toISOString(), order_items: items.map((item) => ({ ...item, unit_price: item.price, product_name: item.name })),
  };
  const orders = [order, ...readLocal()];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  return saveLocalOrder(order);
}

async function placeLegacyOrder(supabase, payload, items) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = payload.orderType === 'delivery' ? APP_CONFIG.deliveryFee : 0;
  const legacyType = payload.orderType === 'pickup' ? 'retirada' : payload.orderType;
  const orderNumber = Number(String(Date.now()).slice(-6));
  const { data: order, error } = await supabaseRetry(() => supabase.from('orders').insert({
    customer_name: payload.customerName, phone: payload.phone, total: subtotal + deliveryFee,
    status: 'pending', items_count: items.reduce((sum, item) => sum + item.quantity, 0),
    tipo: legacyType, order_type: payload.orderType, table_number: payload.tableNumber,
    taxa_entrega: deliveryFee,
    numero_pedido: orderNumber, metodo_pagamento: payload.paymentMethod,
    endereco_entrega: payload.orderType === 'delivery' ? payload.address : null, observacoes: payload.notes || '',
    items: items.map((item) => ({ product_id: item.product_id, name: item.name, quantity: item.quantity, price: item.price })),
  }).select().single());
  if (error) throw error;
  const { error: itemsError } = await supabaseRetry(() => supabase.from('order_items').insert(items.map((item) => ({
    order_id: order.id, product_id: Number(item.product_id) || null, product_name: item.name,
    quantity: item.quantity, unit_price: item.price, total_price: item.price * item.quantity,
  }))));
  if (itemsError) throw itemsError;
  return { ...order, order_number: `IG${String(order.numero_pedido || orderNumber).padStart(6, '0')}`, subtotal, delivery_fee: Number(order.taxa_entrega ?? deliveryFee), order_items: items };
}


let cacheVersion = 0;
let loadVersion = 0;
export function cacheOrderChange(payload) {
  cacheVersion++;
  const id = payload.new?.id ?? payload.old?.id;
  if (id == null) return;
  const current = readLocal();
  const next = payload.eventType === 'DELETE'
    ? current.filter(order => String(order.id) !== String(id))
    : current.map(order => String(order.id) === String(id) ? { ...order, ...payload.new } : order);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function getOrders() {
  const supabase = await getSupabase();
  const request = ++loadVersion;
  const version = cacheVersion;
  const { data, error } = await supabaseRetry(() => supabase.from('orders')
    .select('*, order_items(*)').order('created_at', { ascending: false }));
  if (error) throw error;
  // Successful server reads replace remote cache, including removed/inaccessible rows.
  const next = [...(data || []), ...readLocal().filter(order => order.offline === true)];
  if (request === loadVersion && version === cacheVersion) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

// Session/online changes discover newly visible orders without owning per-order channels.
export async function subscribeToOrders(onChange) {
  const supabase = await getSupabase();
  let stopped = false;
  const refresh = () => { if (!stopped) onChange(); };
  const { data } = supabase.auth.onAuthStateChange(() => queueMicrotask(refresh));
  window.addEventListener('online', refresh);
  window.addEventListener('focus', refresh);
  const timer = setInterval(refresh, 30000); // Also reconciles administrative DELETE under RLS.
  return () => {
    stopped = true;
    clearInterval(timer);
    data.subscription.unsubscribe();
    window.removeEventListener('online', refresh);
    window.removeEventListener('focus', refresh);
  };
}

export async function subscribeToOrder(orderId, { onChange, onError = console.warn } = {}) {
  if (orderId == null || !/^[a-zA-Z0-9-]+$/.test(String(orderId))) {
    throw new Error('orders.id ausente ou inválido para acompanhamento.');
  }
  const supabase = await getSupabase();
  let channel = null, timer = null, stopped = false, generation = 0, revision = 0, query = 0;
  const emit = payload => { cacheOrderChange(payload); onChange?.(payload); };
  const reconcile = async () => {
    const request = ++query, version = revision;
    const { data, error } = await supabaseRetry(() => supabase.from('orders')
      .select('*, order_items(*)').eq('id', orderId).maybeSingle());
    if (stopped || request !== query || version !== revision) return;
    if (error) throw error;
    emit(data ? { eventType: 'UPDATE', new: data } : { eventType: 'DELETE', old: { id: orderId } });
  };
  const schedule = () => {
    if (!stopped && timer === null) timer = setTimeout(() => { timer = null; connect(); }, 2500);
  };
  const connect = async () => {
    if (stopped) return;
    const token = ++generation;
    const old = channel;
    channel = null;
    if (old) await supabase.removeChannel(old);
    // First reconcile, then subscribe; reconcile again on SUBSCRIBED closes the gap.
    try { await reconcile(); } catch (error) { onError(error); }
    if (stopped || token !== generation) return;
    channel = supabase.channel(`order-${orderId}-${token}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        payload => { if (!stopped && token === generation) { revision++; emit(payload); } })
      .subscribe(status => {
        if (stopped || token !== generation) return;
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer); timer = null;
          reconcile().catch(error => { onError(error); schedule(); });
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) schedule();
      });
  };
  void connect();
  return () => {
    stopped = true; generation++; query++;
    clearTimeout(timer);
    if (channel) void supabase.removeChannel(channel);
  };
}

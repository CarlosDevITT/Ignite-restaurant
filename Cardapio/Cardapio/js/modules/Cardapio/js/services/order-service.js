import { APP_CONFIG } from '../config.js';
import { createId } from '../utils/format.js';
import { getSupabase } from './supabase-client.js';

const STORAGE_KEY = 'ignite-orders-v1';

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
    let { data, error } = await supabase.rpc('place_cardapio_order_v2', {
      p_customer_name: payload.customerName,
      p_phone: payload.phone,
      p_address: payload.address,
      p_payment_method: payload.paymentMethod,
      p_order_type: payload.orderType,
      p_table_number: payload.tableNumber,
      p_notes: payload.notes || '',
      p_items: rpcItems,
    });
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
      ({ data, error } = await supabase.rpc('place_cardapio_order', {
        p_customer_name: payload.customerName,
        p_phone: payload.phone,
        p_address: payload.address,
        p_payment_method: payload.paymentMethod,
        p_notes: payload.notes || '',
        p_items: rpcItems,
      }));
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
    id: createId(), order_number: `IG${String(Date.now()).slice(-6)}`, status: 'received',
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
  const { data: order, error } = await supabase.from('orders').insert({
    customer_name: payload.customerName, phone: payload.phone, total: subtotal + deliveryFee,
    status: 'pending', items_count: items.reduce((sum, item) => sum + item.quantity, 0),
    tipo: legacyType, order_type: payload.orderType, table_number: payload.tableNumber,
    taxa_entrega: deliveryFee,
    numero_pedido: orderNumber, metodo_pagamento: payload.paymentMethod,
    endereco_entrega: payload.orderType === 'delivery' ? payload.address : null, observacoes: payload.notes || '',
    items: items.map((item) => ({ product_id: item.product_id, name: item.name, quantity: item.quantity, price: item.price })),
  }).select().single();
  if (error) throw error;
  const { error: itemsError } = await supabase.from('order_items').insert(items.map((item) => ({
    order_id: order.id, product_id: Number(item.product_id) || null, product_name: item.name,
    quantity: item.quantity, unit_price: item.price, total_price: item.price * item.quantity,
  })));
  if (itemsError) throw itemsError;
  return { ...order, order_number: `IG${String(order.numero_pedido || orderNumber).padStart(6, '0')}`, subtotal, delivery_fee: Number(order.taxa_entrega ?? deliveryFee), order_items: items };
}

export async function getOrders() {
  const supabase = await getSupabase();
  if (!supabase) return readLocal();
  // Não solicite login anônimo ao abrir o cardápio: ele pode estar desativado
  // no projeto e os pedidos deste aparelho continuam disponíveis localmente.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return readLocal();
  } catch { return readLocal(); }
  const { data, error } = await supabase.from('orders').select('*, user_id, order_items(*)').order('created_at', { ascending: false });
  if (error) return readLocal();
  if (data.some((order) => !Object.prototype.hasOwnProperty.call(order, 'user_id'))) return readLocal();
  const remoteOrders = data || [];
  return [...remoteOrders, ...readLocal().filter((local) => !remoteOrders.some((remote) => String(remote.id) === String(local.id)))];
}

export async function subscribeToOrders(onChange) {
  const supabase = await getSupabase();
  if (!supabase) return () => {};
  let session;
  try {
    const result = await supabase.auth.getSession();
    session = result.data?.session;
  } catch { return () => {}; }
  if (!session?.user?.id) return () => {};
  const channel = supabase.channel(`orders-${session.user.id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${session.user.id}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}

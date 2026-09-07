import { APP_CONFIG } from '../config.js';
import { createId } from '../utils/format.js';
import { getSupabase, supabaseRetry } from './supabase-client.js';

const STORAGE_KEY = 'ignite-orders-v1';
const CLIENT_TOKEN_KEY = 'ignite-client-token-v1';
const readLocal = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } };
const saveLocalOrder = (order) => { const orders = readLocal(); const key = String(order.id || order.order_number || order.numero_pedido); const next = [order, ...orders.filter(item => String(item.id || item.order_number || item.numero_pedido) !== key)]; localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return order; };
function getClientToken() { let token = localStorage.getItem(CLIENT_TOKEN_KEY); if (token && token.length >= 32) return token; const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''); localStorage.setItem(CLIENT_TOKEN_KEY, token); return token; }

export async function placeOrder(payload, items) {
  const supabase = await getSupabase();
  if (supabase) {
    const rpcItems = items.map(item => ({ product_id: item.product_id, quantity: item.quantity, notes: item.notes || '' }));
    const { data, error } = await supabaseRetry(() => supabase.rpc('place_cardapio_order_v3', { p_client_token: getClientToken(), p_customer_name: payload.customerName, p_phone: payload.phone, p_address: payload.address || '', p_payment_method: payload.paymentMethod, p_order_type: payload.orderType, p_table_number: payload.tableNumber ? Number(payload.tableNumber) : null, p_notes: payload.notes || '', p_items: rpcItems }));
    if (error) { console.error('[Pedidos] Falha ao criar pedido:', { code: error.code, message: error.message }); throw new Error(error.message || 'Não foi possível enviar o pedido.'); }
    if (!data) throw new Error('O servidor não retornou o pedido criado.');
    return saveLocalOrder(Array.isArray(data) ? data[0] : data);
  }
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0); const deliveryFee = payload.orderType === 'delivery' ? APP_CONFIG.deliveryFee : 0;
  return saveLocalOrder({ id: createId(), order_number: `IG${String(Date.now()).slice(-6)}`, status: 'pending', offline: true, customer_name: payload.customerName, phone: payload.phone, address: payload.address, payment_method: payload.paymentMethod, notes: payload.notes || '', subtotal, order_type: payload.orderType, table_number: payload.tableNumber, delivery_fee: deliveryFee, total: subtotal + deliveryFee, created_at: new Date().toISOString(), order_items: items.map(item => ({ ...item, unit_price: item.price, product_name: item.name })) });
}
let cacheVersion = 0, loadVersion = 0;
export function cacheOrderChange(payload) { cacheVersion++; const id = payload.new?.id ?? payload.old?.id; if (id == null) return; const current = readLocal(); const next = payload.eventType === 'DELETE' ? current.filter(order => String(order.id) !== String(id)) : current.map(order => String(order.id) === String(id) ? { ...order, ...payload.new } : order); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
export async function getOrders() { const supabase = await getSupabase(); const request = ++loadVersion, version = cacheVersion; const { data, error } = await supabaseRetry(() => supabase.rpc('get_cardapio_orders_v3', { p_client_token: getClientToken() })); if (error) throw error; const remote = Array.isArray(data) ? data : []; const next = [...remote, ...readLocal().filter(order => order.offline === true)]; if (request === loadVersion && version === cacheVersion) localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return next; }
export async function subscribeToOrders(onChange) { let stopped = false; const refresh = () => { if (!stopped) onChange(); }; window.addEventListener('online', refresh); window.addEventListener('focus', refresh); const timer = setInterval(refresh, 5000); return () => { stopped = true; clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); }; }
export async function subscribeToOrder(orderId, { onChange, onError = console.warn } = {}) { if (orderId == null) throw new Error('orders.id obrigatório para acompanhamento.'); let stopped = false, lastSignature = ''; const reconcile = async () => { try { const orders = await getOrders(); if (stopped) return; const order = orders.find(item => String(item.id) === String(orderId)); if (!order) { if (lastSignature !== 'deleted') { lastSignature = 'deleted'; onChange?.({ eventType: 'DELETE', old: { id: orderId } }); } return; } const signature = `${order.id}:${order.status}:${order.updated_at || ''}`; if (signature !== lastSignature) { lastSignature = signature; cacheOrderChange({ eventType: 'UPDATE', new: order }); onChange?.({ eventType: 'UPDATE', new: order }); } } catch (error) { if (!stopped) onError(error); } }; await reconcile(); const timer = setInterval(reconcile, 3000); return () => { stopped = true; clearInterval(timer); }; }

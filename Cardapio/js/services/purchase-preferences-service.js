import { getSupabase } from './supabase-client.js';

export async function getPurchasePreferences() {
  const supabase = await getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData?.session?.user;
  if (!user?.id || user.is_anonymous === true) return { authenticated: false, preferred_payment: null, favorites: [] };
  const { data, error } = await supabase.rpc('get_my_purchase_preferences');
  if (error) throw error;
  return { authenticated: data?.authenticated === true, preferred_payment: data?.preferred_payment || null, favorites: Array.isArray(data?.favorites) ? data.favorites : [] };
}

export async function setPreferredPayment(payment) {
  const value = String(payment || '');
  if (!['pix','card','cash'].includes(value)) throw new Error('Forma de pagamento inválida.');
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('set_my_preferred_payment', { p_payment: value });
  if (error) throw error;
  return data;
}

export async function toggleProductFavorite(productId) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('toggle_product_favorite', { p_product_id: Number(productId) });
  if (error) throw error;
  return data;
}

export async function getReorderItems(orderId) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('get_my_reorder_items', { p_order_id: Number(orderId) });
  if (error) throw error;
  return data || { items: [], unavailable_count: 0 };
}

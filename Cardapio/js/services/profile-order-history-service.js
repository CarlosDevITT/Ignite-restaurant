import { getSupabase } from './supabase-client.js';

export async function getMyOrderHistory(limit = 20, offset = 0) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('get_my_order_history', {
    p_limit: Math.max(1, Math.min(Number(limit) || 20, 50)),
    p_offset: Math.max(0, Number(offset) || 0),
  });
  if (error) throw error;
  return data || { orders: [], total: 0, limit, offset };
}

export async function getMyOrderDetail(orderId) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('get_my_order_detail', { p_order_id: Number(orderId) });
  if (error) throw error;
  return data || null;
}

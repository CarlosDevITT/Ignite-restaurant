import { getSupabase } from './supabase-client.js';

const AVATAR_BUCKET = 'customer-avatars';

export async function uploadMyAvatar(file) {
  if (!(file instanceof File)) throw new Error('Selecione uma imagem válida.');
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use JPG, PNG ou WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 5 MB.');
  const supabase = await getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData?.session?.user;
  if (!user?.id || user.is_anonymous === true) throw new Error('Entre na sua conta para alterar a foto.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${user.id}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
  if (uploadError) throw uploadError;
  const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const url = `${publicData.publicUrl}?v=${Date.now()}`;
  const { data, error } = await supabase.from('customers').update({ avatar_url: url, updated_at: new Date().toISOString() }).eq('auth_user_id', user.id).select().single();
  if (error) throw error;
  return data;
}

export async function removeMyAvatar() {
  const supabase = await getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData?.session?.user;
  if (!user?.id) throw new Error('Não autenticado.');
  const { data: files } = await supabase.storage.from(AVATAR_BUCKET).list(user.id, { limit: 20 });
  const paths = (files || []).map(item => `${user.id}/${item.name}`);
  if (paths.length) await supabase.storage.from(AVATAR_BUCKET).remove(paths);
  const { data, error } = await supabase.from('customers').update({ avatar_url: null, updated_at: new Date().toISOString() }).eq('auth_user_id', user.id).select().single();
  if (error) throw error;
  return data;
}

export async function getPrivacySnapshot() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('get_my_privacy_snapshot');
  if (error) throw error;
  return data || { authenticated: false };
}

export async function requestAccountDeletion(reason = '') {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('request_my_account_deletion', { p_reason: String(reason || '').trim() || null });
  if (error) throw error;
  return data;
}

export async function cancelAccountDeletion() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('cancel_my_account_deletion');
  if (error) throw error;
  return data;
}

export async function signOutOtherSessions() {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) throw error;
}

export async function getCurrentSessionInfo() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data?.session;
  return session ? { email: session.user?.email || '', created_at: session.user?.created_at || '', last_sign_in_at: session.user?.last_sign_in_at || '', expires_at: session.expires_at || null } : null;
}

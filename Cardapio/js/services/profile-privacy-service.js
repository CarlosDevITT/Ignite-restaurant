import { getSupabase } from './supabase-client.js';

const AVATAR_BUCKET = 'customer-avatars';

function friendlyAvatarError(error) {
  const message = String(error?.message || error || '');
  if (/row-level security|policy/i.test(message)) return new Error('Não foi possível salvar a foto agora. Tente novamente em alguns segundos.');
  if (/payload too large|file size|maximum/i.test(message)) return new Error('A imagem deve ter no máximo 5 MB.');
  if (/mime|content type|unsupported/i.test(message)) return new Error('Use uma imagem JPG, PNG ou WebP.');
  return error instanceof Error ? error : new Error(message || 'Não foi possível atualizar a foto.');
}

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

  try {
    const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '3600',
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    const url = `${publicData.publicUrl}?v=${Date.now()}`;
    const { data, error } = await supabase
      .from('customers')
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq('auth_user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    throw friendlyAvatarError(error);
  }
}

export async function removeMyAvatar() {
  const supabase = await getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData?.session?.user;
  if (!user?.id) throw new Error('Não autenticado.');

  try {
    const { data: files, error: listError } = await supabase.storage.from(AVATAR_BUCKET).list(user.id, { limit: 20 });
    if (listError) throw listError;
    const paths = (files || []).map(item => `${user.id}/${item.name}`);
    if (paths.length) {
      const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove(paths);
      if (removeError) throw removeError;
    }
    const { data, error } = await supabase
      .from('customers')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('auth_user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    throw friendlyAvatarError(error);
  }
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
  return session ? {
    email: session.user?.email || '',
    created_at: session.user?.created_at || '',
    last_sign_in_at: session.user?.last_sign_in_at || '',
    expires_at: session.expires_at || null,
  } : null;
}

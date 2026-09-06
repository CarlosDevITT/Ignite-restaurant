import { getSupabase } from './supabase-client.js';

const STORAGE_KEY = 'ignite-profile-v1';

export function getLocalProfile() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { name: '', phone: '', address: '' }; }
  catch { return { name: '', phone: '', address: '' }; }
}

export async function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  const supabase = await getSupabase();
  if (!supabase) return profile;
  let session;
  try { session = (await supabase.auth.getSession()).data?.session; } catch { session = null; }
  if (!session?.user?.id) return profile;
  const { error } = await supabase.from('profiles').upsert({ id: session.user.id, ...profile, updated_at: new Date().toISOString() });
  if (error) throw error;
  return profile;
}

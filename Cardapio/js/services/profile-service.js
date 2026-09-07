import { getSupabase } from './supabase-client.js';

const STORAGE_KEY = 'ignite-profile-v1';
const PLAY_TOKEN_KEY = 'ignite-play-player-token-v1';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 13);
}

export function getLocalProfile() {
  try {
    return {
      name: '', phone: '', email: '', address: '', birth_date: '', marketing_opt_in: false,
      ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}),
    };
  } catch {
    return { name: '', phone: '', email: '', address: '', birth_date: '', marketing_opt_in: false };
  }
}

export function saveLocalProfile(profile) {
  const next = { ...getLocalProfile(), ...profile };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function getSession() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session || null;
}

export async function getAccountProfile() {
  const supabase = await getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session?.user?.id) return { session: null, profile: null };
  const { data, error } = await supabase.rpc('get_my_customer_profile');
  if (error) throw error;
  return { session, profile: data || null };
}

export async function syncCustomerAccount(seed = {}) {
  const supabase = await getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const session = sessionData?.session;
  if (!session?.user?.id) return null;

  let { data: current, error: currentError } = await supabase.rpc('get_my_customer_profile');
  if (currentError) throw currentError;

  const local = saveLocalProfile({ ...getLocalProfile(), ...seed, email: seed.email || session.user.email || getLocalProfile().email || '' });
  if (!current) {
    if (!local.name || !cleanPhone(local.phone)) return null;
    const { data, error } = await supabase.rpc('link_my_customer_profile', {
      p_name: local.name,
      p_phone: cleanPhone(local.phone),
      p_email: session.user.email || local.email || null,
    });
    if (error) throw error;
    current = data;
  }

  const playToken = localStorage.getItem(PLAY_TOKEN_KEY);
  if (playToken?.length >= 32) {
    const { error } = await supabase.rpc('link_ignite_play_player', { p_player_token: playToken });
    if (error) console.warn('[Perfil] Ignite Play não pôde ser vinculado agora:', error.message);
  }

  if (current) {
    saveLocalProfile({
      name: current.name || local.name,
      phone: current.phone || local.phone,
      email: current.email || session.user.email || local.email,
      address: current.address || local.address,
      birth_date: current.birth_date || local.birth_date || '',
      marketing_opt_in: Boolean(current.marketing_opt_in),
    });
  }
  return current;
}

export async function signUpCustomer({ name, phone, email, password }) {
  const supabase = await getSupabase();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPhone = cleanPhone(phone);
  saveLocalProfile({ name: String(name || '').trim(), phone: normalizedPhone, email: normalizedEmail });
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: { data: { full_name: String(name || '').trim(), phone: normalizedPhone } },
  });
  if (error) throw error;
  if (data?.session) await syncCustomerAccount({ name, phone: normalizedPhone, email: normalizedEmail });
  return data;
}

async function signInByPhone(supabase, phone, password) {
  const normalizedPhone = cleanPhone(phone);
  if (normalizedPhone.length < 10) throw new Error('Informe um telefone válido com DDD.');
  const { data, error } = await supabase.functions.invoke('customer-phone-login', {
    body: { phone: normalizedPhone, password },
  });
  if (error) {
    let message = 'Telefone ou senha inválidos.';
    try {
      const payload = await error.context?.json?.();
      if (payload?.error) message = payload.error;
    } catch {}
    throw new Error(message);
  }
  if (!data?.access_token || !data?.refresh_token) throw new Error(data?.error || 'Telefone ou senha inválidos.');
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (sessionError || !sessionData?.session) throw sessionError || new Error('Não foi possível iniciar sua sessão.');
  saveLocalProfile({ phone: normalizedPhone, email: sessionData.user?.email || getLocalProfile().email || '' });
  return sessionData;
}

export async function signInCustomer({ login_type = 'email', email, phone, identifier, password }) {
  const supabase = await getSupabase();
  let data;
  if (login_type === 'phone') {
    data = await signInByPhone(supabase, phone || identifier, password);
  } else {
    const normalizedEmail = String(email || identifier || '').trim().toLowerCase();
    const result = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (result.error) throw result.error;
    data = result.data;
    saveLocalProfile({ email: data?.user?.email || normalizedEmail });
  }
  await syncCustomerAccount({
    email: data?.user?.email || getLocalProfile().email || '',
    phone: login_type === 'phone' ? cleanPhone(phone || identifier) : getLocalProfile().phone || '',
  });
  return data;
}

export async function signOutCustomer() {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const supabase = await getSupabase();
  const redirectTo = `${location.origin}${location.pathname}#profile`;
  const { error } = await supabase.auth.resetPasswordForEmail(String(email || '').trim().toLowerCase(), { redirectTo });
  if (error) throw error;
}

export async function updatePassword(password) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.updateUser({ password: String(password || '') });
  if (error) throw error;
  return data?.user || null;
}

export async function saveProfile(profile) {
  const local = saveLocalProfile({
    ...profile,
    phone: cleanPhone(profile.phone),
    marketing_opt_in: Boolean(profile.marketing_opt_in),
  });
  const supabase = await getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session?.user?.id) return local;

  let { data: account } = await supabase.rpc('get_my_customer_profile');
  if (!account) account = await syncCustomerAccount(local);
  if (!account?.id) return local;

  const updates = {
    name: local.name,
    phone: cleanPhone(local.phone),
    address: local.address || null,
    birth_date: local.birth_date || null,
    marketing_opt_in: Boolean(local.marketing_opt_in),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('customers').update(updates).eq('auth_user_id', session.user.id).select().single();
  if (error) throw error;
  saveLocalProfile({ ...local, ...data, email: session.user.email || local.email });
  return data;
}

export function onAuthStateChange(callback) {
  let subscription;
  getSupabase().then((supabase) => {
    const result = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => callback?.(event, session), 0);
    });
    subscription = result?.data?.subscription;
  }).catch(console.warn);
  return () => subscription?.unsubscribe?.();
}

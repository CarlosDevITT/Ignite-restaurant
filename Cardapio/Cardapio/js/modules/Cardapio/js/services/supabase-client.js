import { APP_CONFIG, hasSupabaseConfig } from '../config.js';

let clientPromise;

export async function getSupabase() {
  if (typeof window !== 'undefined' && window.supabaseClient) return window.supabaseClient;

  if (typeof window !== 'undefined' && window.__supabaseConfigPending === true) {
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 7000);
      window.addEventListener('supabase:ready', () => { clearTimeout(timeout); resolve(); }, { once: true });
    });
    if (window.supabaseClient) return window.supabaseClient;
  }

  if (!hasSupabaseConfig()) return null;
  if (!clientPromise) {
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2').then(({ createClient }) =>
      createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    );
  }
  return clientPromise;
}

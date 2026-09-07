// The global bootstrap owns the only client; a failed SDK load is an explicit error.
export async function getSupabase() {
  if (window.supabaseClient) return window.supabaseClient;
  await new Promise((resolve, reject) => {
    const ready = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => {
      window.removeEventListener('supabase:ready', ready);
      reject(new Error('Não foi possível inicializar o Supabase. Verifique a conexão.'));
    }, 7000);
    window.addEventListener('supabase:ready', ready, { once: true });
  });
  return window.supabaseClient;
}
export async function supabaseRetry(queryFn) {
  await getSupabase();
  return window.supabaseRetry(queryFn);
}

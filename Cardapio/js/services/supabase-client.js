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

let customerSessionPromise = null;

export async function ensureCustomerSession() {
  if (customerSessionPromise) return customerSessionPromise;
  customerSessionPromise = (async () => {
    const supabase = await getSupabase();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData?.session?.user?.id) return sessionData.session;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('[Auth] Não foi possível criar sessão anônima do cliente.', { code: error.code, message: error.message });
      throw new Error('Não foi possível iniciar a sessão do cliente. Atualize a página e tente novamente.');
    }
    if (!data?.session?.user?.id) throw new Error('Não foi possível iniciar a sessão do cliente.');
    return data.session;
  })().finally(() => { customerSessionPromise = null; });
  return customerSessionPromise;
}

export async function supabaseRetry(queryFn) {
  await getSupabase();
  return window.supabaseRetry(queryFn);
}

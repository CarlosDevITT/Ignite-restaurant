const DEFAULT_DELIVERY_FEE = 7;

export const APP_CONFIG = {
  supabaseUrl: 'COLE_AQUI_SUA_SUPABASE_URL',
  supabasePublishableKey: 'COLE_AQUI_SUA_CHAVE_PUBLICAVEL',
  currency: 'BRL',
  locale: 'pt-BR',
  storeName: 'Ignite Restaurante Pub',
  get deliveryFee() {
    const runtimeFee = typeof window !== 'undefined' ? Number(window.__igniteDeliveryFee) : NaN;
    return Number.isFinite(runtimeFee) ? runtimeFee : DEFAULT_DELIVERY_FEE;
  },
  whatsappNumber: '5547974008620',
};

export const hasSupabaseConfig = () =>
  (typeof window !== 'undefined' && (Boolean(window.supabaseClient) || window.__supabaseConfigPending === true)) ||
  (APP_CONFIG.supabaseUrl.startsWith('https://') && !APP_CONFIG.supabasePublishableKey.startsWith('COLE_AQUI'));

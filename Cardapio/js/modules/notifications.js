import { getSupabase } from '../services/supabase-client.js';

const CLIENT_TOKEN_KEY = 'ignite-client-token-v1';
const PROMPTED_KEY = 'ignite-push-prompted-v1';
const VAPID_PUBLIC_KEY = 'BD7yM797q7dU1UpaYgeUitWSGY0BtOhrjY8LXT8nTsLha1mb7ghKnGXu6qapeM3zaTdFow6j_omuZosuTQ6qPps';

function getClientToken() {
  let token = localStorage.getItem(CLIENT_TOKEN_KEY);
  if (token && token.length >= 32) return token;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(CLIENT_TOKEN_KEY, token);
  return token;
}

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

function deviceName() {
  const ua = navigator.userAgent || '';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iPhone/iPad';
  if (/android/i.test(ua)) return 'Android';
  if (/windows/i.test(ua)) return 'Windows';
  if (/macintosh|mac os x/i.test(ua)) return 'Mac';
  return 'Navegador';
}

function supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function saveSubscription(subscription) {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('Supabase indisponível.');
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('O navegador não retornou uma inscrição push válida.');
  }
  const { data, error } = await supabase.rpc('upsert_push_subscription', {
    p_client_token: getClientToken(),
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth_key: json.keys.auth,
    p_device_name: deviceName(),
    p_user_agent: navigator.userAgent || '',
    p_order_updates: true,
    p_marketing: false,
    p_ignite_play: true,
  });
  if (error) throw error;
  if (!data) throw new Error('O servidor não confirmou a inscrição de notificações.');
  return subscription;
}

async function getRegistration() {
  if (!supported()) throw new Error('Notificações push não são suportadas neste aparelho.');
  return navigator.serviceWorker.ready;
}

async function getHealth(subscription) {
  const supabase = await getSupabase();
  if (!supabase) return { needs_refresh: true };
  const { data, error } = await supabase.rpc('get_push_subscription_health', {
    p_client_token: getClientToken(),
    p_endpoint: subscription.endpoint,
  });
  if (error) throw error;
  return data || { needs_refresh: true };
}

async function createFreshSubscription(registration, existing = null) {
  if (existing) {
    try { await existing.unsubscribe(); } catch (_) {}
  }
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  await saveSubscription(subscription);
  return subscription;
}

export function initNotifications() {
  const isSupported = supported();

  const getStatus = async () => {
    if (!isSupported) return { state: 'unsupported', label: 'Não suportadas' };
    if (Notification.permission === 'denied') return { state: 'blocked', label: 'Bloqueadas' };
    if (Notification.permission !== 'granted') return { state: 'disabled', label: 'Não ativadas' };
    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return { state: 'incomplete', label: 'Permissão concedida, falta ativar' };
      const health = await getHealth(subscription).catch(() => ({ needs_refresh: true }));
      if (health?.needs_refresh) return { state: 'stale', label: 'Precisa renovar' };
      return { state: 'active', label: 'Ativadas' };
    } catch (error) {
      return { state: 'error', label: 'Erro de configuração', error };
    }
  };

  const syncExistingSubscription = async () => {
    if (!isSupported || Notification.permission !== 'granted') return null;
    try {
      const registration = await getRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await createFreshSubscription(registration);
      } else {
        const health = await getHealth(subscription).catch(() => ({ needs_refresh: true }));
        if (health?.needs_refresh) {
          console.warn('[Push] Inscrição inválida/desatualizada. Renovando endpoint...');
          subscription = await createFreshSubscription(registration, subscription);
        } else {
          await saveSubscription(subscription);
        }
      }
      localStorage.setItem(PROMPTED_KEY, '1');
      return subscription;
    } catch (error) {
      localStorage.removeItem(PROMPTED_KEY);
      console.warn('[Push] Não foi possível sincronizar/renovar a inscrição:', error);
      return null;
    }
  };

  const requestEnable = async () => {
    if (!isSupported) throw new Error('Este navegador ainda não oferece notificações push para o Ignite.');
    if (Notification.permission === 'denied') {
      throw new Error('As notificações estão bloqueadas nas configurações do navegador.');
    }

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') {
      localStorage.removeItem(PROMPTED_KEY);
      throw new Error('Permissão de notificações não concedida.');
    }

    const registration = await getRegistration();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await createFreshSubscription(registration);
    } else {
      const health = await getHealth(subscription).catch(() => ({ needs_refresh: true }));
      if (health?.needs_refresh) subscription = await createFreshSubscription(registration, subscription);
      else await saveSubscription(subscription);
    }

    localStorage.setItem(PROMPTED_KEY, '1');
    return subscription;
  };

  const disable = async () => {
    if (!isSupported) return false;
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      localStorage.removeItem(PROMPTED_KEY);
      return true;
    }
    try {
      const supabase = await getSupabase();
      if (supabase) {
        await supabase.rpc('disable_push_subscription', {
          p_client_token: getClientToken(),
          p_endpoint: subscription.endpoint,
        });
      }
    } finally {
      await subscription.unsubscribe().catch(() => false);
      localStorage.removeItem(PROMPTED_KEY);
    }
    return true;
  };

  const promptAfterOrder = async () => {
    if (!isSupported) return;
    if (Notification.permission === 'denied') {
      localStorage.removeItem(PROMPTED_KEY);
      return;
    }
    if (Notification.permission === 'granted') {
      const synced = await syncExistingSubscription();
      if (synced) return;
    }
    if (!window.Swal) return;

    const result = await Swal.fire({
      icon: 'info',
      title: 'Receber atualizações do pedido?',
      text: 'A Ignite pode avisar mesmo com o PWA fechado quando seu pedido for confirmado, entrar em preparação, ficar pronto ou sair para entrega.',
      showCancelButton: true,
      confirmButtonText: 'Ativar notificações',
      cancelButtonText: 'Agora não',
      allowOutsideClick: true,
      preConfirm: async () => {
        try {
          await requestEnable();
          return true;
        } catch (error) {
          localStorage.removeItem(PROMPTED_KEY);
          Swal.showValidationMessage(error.message || 'Não foi possível ativar as notificações. Tente novamente.');
          return false;
        }
      },
    });

    if (result.isConfirmed) {
      localStorage.setItem(PROMPTED_KEY, '1');
      Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'Notificações ativadas', showConfirmButton: false, timer: 2200 });
    } else {
      localStorage.removeItem(PROMPTED_KEY);
    }
  };

  if (isSupported && Notification.permission === 'granted') {
    syncExistingSubscription();
  }

  const api = {
    supported: isSupported,
    permission: () => isSupported ? Notification.permission : 'unsupported',
    getStatus,
    requestEnable,
    disable,
    syncExistingSubscription,
    promptAfterOrder,
  };
  window.IgniteNotifications = api;
  return api;
}

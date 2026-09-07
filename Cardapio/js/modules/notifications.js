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
  const json = subscription.toJSON();
  const { error } = await supabase.rpc('upsert_push_subscription', {
    p_client_token: getClientToken(),
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh || '',
    p_auth_key: json.keys?.auth || '',
    p_device_name: deviceName(),
    p_user_agent: navigator.userAgent || '',
    p_order_updates: true,
    p_marketing: false,
    p_ignite_play: true,
  });
  if (error) throw error;
  return subscription;
}

async function getRegistration() {
  if (!supported()) throw new Error('Notificações push não são suportadas neste aparelho.');
  return navigator.serviceWorker.ready;
}

export function initNotifications() {
  const isSupported = supported();

  const syncExistingSubscription = async () => {
    if (!isSupported || Notification.permission !== 'granted') return null;
    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return null;
      return await saveSubscription(subscription);
    } catch (error) {
      console.warn('[Push] Não foi possível sincronizar a inscrição existente:', error);
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
    if (permission !== 'granted') throw new Error('Permissão de notificações não concedida.');

    const registration = await getRegistration();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await saveSubscription(subscription);
    localStorage.setItem(PROMPTED_KEY, '1');
    return subscription;
  };

  const disable = async () => {
    if (!isSupported) return false;
    const registration = await getRegistration();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;
    try {
      const supabase = await getSupabase();
      await supabase.rpc('disable_push_subscription', {
        p_client_token: getClientToken(),
        p_endpoint: subscription.endpoint,
      });
    } finally {
      await subscription.unsubscribe().catch(() => false);
    }
    return true;
  };

  const promptAfterOrder = async () => {
    if (!isSupported || Notification.permission === 'denied') return;
    if (Notification.permission === 'granted') {
      await syncExistingSubscription();
      return;
    }
    if (localStorage.getItem(PROMPTED_KEY) === '1' || !window.Swal) return;

    const result = await Swal.fire({
      icon: 'info',
      title: 'Receber atualizações do pedido?',
      text: 'A Ignite pode avisar quando seu pedido for confirmado, entrar em preparação, ficar pronto ou sair para entrega.',
      showCancelButton: true,
      confirmButtonText: 'Ativar notificações',
      cancelButtonText: 'Agora não',
      allowOutsideClick: true,
      preConfirm: async () => {
        try {
          await requestEnable();
          return true;
        } catch (error) {
          Swal.showValidationMessage(error.message || 'Não foi possível ativar as notificações.');
          return false;
        }
      },
    });
    localStorage.setItem(PROMPTED_KEY, '1');
    if (result.isConfirmed) {
      Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'Notificações ativadas', showConfirmButton: false, timer: 2200 });
    }
  };

  if (isSupported && Notification.permission === 'granted') {
    syncExistingSubscription();
  }

  return {
    supported: isSupported,
    permission: () => isSupported ? Notification.permission : 'unsupported',
    requestEnable,
    disable,
    syncExistingSubscription,
    promptAfterOrder,
  };
}

import { initAnalytics, trackEvent } from './modules/analytics.js';
import { initCarousel } from './modules/carousel.js';
import { initCart } from './modules/cart.js';
import { initCatalog } from './modules/catalog.js';
import { initChat } from './modules/chat.js';
import { initFeed } from './modules/feed.js';
import { IgnitePlay } from './modules/ignite-play/index.js';
import { initNavigation } from './modules/navigation.js';
import { initNotifications } from './modules/notifications.js';
import { initOrders, isWaitingStatus } from './modules/orders.js';
import { initProfile } from './modules/profile.js';
import { initPWA } from './modules/pwa.js';
import { getCatalog } from './services/product-service.js';

const CATALOG_BOOT_TIMEOUT_MS = 10000;
const SPLASH_FAILSAFE_MS = 12000;

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function bootstrap() {
  let pwa = null;
  let splashFailsafe = null;

  try {
    initAnalytics();
    pwa = initPWA();
    splashFailsafe = setTimeout(() => {
      console.warn('[PWA] Tempo máximo de inicialização atingido; liberando interface.');
      pwa?.markReady?.();
    }, SPLASH_FAILSAFE_MS);

    document.querySelectorAll('[data-carousel]').forEach(initCarousel);
    const grid = document.querySelector('#product-grid');
    const skeleton = document.querySelector('#product-skeleton');
    grid.replaceChildren(...Array.from({ length: 6 }, () => skeleton.content.cloneNode(true)));

    try {
      const catalog = await withTimeout(
        getCatalog(),
        CATALOG_BOOT_TIMEOUT_MS,
        'O carregamento do cardápio demorou mais que o esperado.'
      );
      const notifications = initNotifications();
      const orders = initOrders({
        onPlayRequested: (order) => {
          const orderId = order?.id;
          if (orderId == null) { console.error('Pedido sem orders.id'); return; }
          if (!isWaitingStatus(order.status)) return;
          trackEvent('ignite_play_started', {
            order_id: orderId,
            order_number: order.order_number || order.numero_pedido || orderId,
          });
          let stopWatching = () => {};
          let closed = false;
          IgnitePlay.show({
            orderId,
            orderNumber: order.order_number || order.numero_pedido || orderId,
            onClose: () => { closed = true; stopWatching(); },
          });
          stopWatching = orders.watchOrder(orderId, status => {
            if (!isWaitingStatus(status)) IgnitePlay.hide();
          });
          if (closed) stopWatching();
        },
      });
      const navigation = initNavigation({ onRoute: (route) => { if (route === 'orders') orders.load(); } });
      initCatalog(catalog);
      initChat(catalog.products);
      initFeed().catch(console.warn);
      initProfile({ requestInstall: pwa.requestInstall });
      initCart({
        onViewOrders: () => { navigation.navigate('orders'); orders.load(); },
        onCreateAccount: () => navigation.navigate('profile'),
        onOrderPlaced: (order) => {
          trackEvent('order_created', {
            order_type: order?.order_type || order?.tipo || 'cardapio',
            total: Number(order?.total || 0),
          });
          orders.load();
          notifications.promptAfterOrder().catch(error => console.warn('[Push]', error));
        },
      });

      if (catalog.source === 'demo' && window.Swal) {
        Swal.fire({ toast: true, position: 'top', icon: 'info', title: 'Modo demonstração · configure o Supabase', showConfirmButton: false, timer: 4000 });
      }
    } catch (error) {
      console.error(error);
      grid.innerHTML = '<div class="empty-state"><span>⚠️</span><h3>Não foi possível abrir o cardápio</h3><p>Atualize a página e tente novamente.</p></div>';
      if (window.Swal) Swal.fire({ icon: 'error', title: 'Erro ao iniciar', text: error.message });
    }
  } catch (error) {
    console.error('[Bootstrap] Falha antes da inicialização do cardápio:', error);
    document.documentElement.classList.remove('pwa-launch-active');
    const launch = document.querySelector('#pwa-launch');
    if (launch) launch.hidden = true;
  } finally {
    if (splashFailsafe) clearTimeout(splashFailsafe);
    await pwa?.markReady?.();
  }
}

bootstrap();

import { initAnalytics, trackEvent } from './modules/analytics.js';
import { initCarousel } from './modules/carousel.js';
import { initCart } from './modules/cart.js';
import { initCatalog } from './modules/catalog.js';
import { initChat } from './modules/chat.js';
import { initFeed } from './modules/feed.js';
import { IgnitePlay } from './modules/ignite-play/index.js';
import { initNavigation } from './modules/navigation.js';
import { initNotices } from './modules/notices.js';
import { initNotifications } from './modules/notifications.js';
import { initOrders, isWaitingStatus } from './modules/orders.js';
import { initProfile } from './modules/profile.js';
import { initPWA } from './modules/pwa.js';
import { getCatalog, getStoreSettings, subscribeToCatalog } from './services/product-service.js';
import { cartStore } from './store/cart-store.js';

const CATALOG_BOOT_TIMEOUT_MS = 10000;
const SPLASH_FAILSAFE_MS = 12000;
let storeGuardInstalled = false;

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function catalogFingerprint(catalog) {
  const categories = (catalog.categories || []).map(category => [category.id, category.name || category.nome, category.position, category.active]).join('|');
  const products = (catalog.products || []).map(product => [
    product.id, product.name, product.price, product.original_price, product.available,
    product.track_stock, product.stock, product.promo, product.promo_text, product.updated_at,
    product.category_id, product.image_url,
  ]).join('|');
  return `${categories}::${products}`;
}

function settingsFingerprint(settings) {
  return `${settings?.store_open}:${Number(settings?.delivery_fee || 0)}:${settings?.updated_at || ''}`;
}

function applyStoreSettings(settings) {
  window.__igniteStoreSettings = settings;
  window.__igniteDeliveryFee = Number(settings?.delivery_fee || 0);
  document.body?.classList.toggle('store-closed', settings?.store_open === false);
  const mini = document.querySelector('.store-mini');
  if (!mini) return;
  const title = mini.querySelector('strong');
  const copy = mini.querySelector('small');
  const dot = mini.querySelector('.status-dot');
  if (title) title.textContent = settings?.store_open === false ? 'Loja fechada' : 'Loja aberta';
  if (copy) copy.textContent = settings?.store_open === false ? 'Novos pedidos indisponíveis' : 'Pedidos online disponíveis';
  dot?.classList.toggle('is-closed', settings?.store_open === false);
}

function installStoreCheckoutGuard() {
  if (storeGuardInstalled) return;
  storeGuardInstalled = true;
  document.addEventListener('submit', event => {
    if (event.target?.id !== 'checkout-form' || window.__igniteStoreSettings?.store_open !== false) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.Swal?.fire({
      icon: 'info',
      title: 'Loja fechada no momento',
      text: 'O cardápio continua disponível para consulta, mas novos pedidos estão temporariamente pausados.',
      confirmButtonText: 'Entendi',
    });
  }, true);
}

function renderCatalogFailure(grid, error) {
  grid.innerHTML = `<div class="empty-state"><span>⚠️</span><h3>Cardápio temporariamente indisponível</h3><p>${navigator.onLine ? 'Não conseguimos sincronizar os produtos agora.' : 'Você está sem conexão. Reconecte-se para carregar o cardápio atual.'}</p><button class="button" type="button" data-catalog-retry>Tentar novamente</button></div>`;
  grid.querySelector('[data-catalog-retry]')?.addEventListener('click', () => location.reload(), { once: true });
  if (window.Swal) {
    Swal.fire({ icon: 'error', title: 'Não foi possível carregar o cardápio', text: error.message || 'Verifique sua conexão e tente novamente.', confirmButtonText: 'Entendi' });
  }
}

async function bootstrap() {
  let pwa = null;
  let splashFailsafe = null;
  let stopCatalogSync = () => {};

  try {
    initAnalytics();
    initNotices().catch(error => console.warn('[Avisos]', error));
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
      const [catalog, storeSettings] = await Promise.all([
        withTimeout(getCatalog(), CATALOG_BOOT_TIMEOUT_MS, 'O carregamento do cardápio demorou mais que o esperado.'),
        getStoreSettings().catch(error => {
          console.warn('[Loja] Não foi possível confirmar o status público da loja:', error);
          return { store_open: false, delivery_fee: 0, updated_at: null };
        }),
      ]);

      applyStoreSettings(storeSettings);
      installStoreCheckoutGuard();
      const cartSync = cartStore.reconcileCatalog(catalog.products);
      if (cartSync.removed.length && window.Swal) {
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Carrinho atualizado', text: 'Itens indisponíveis foram removidos.', showConfirmButton: false, timer: 2600 });
      }

      const notifications = initNotifications();
      const orders = initOrders({
        onPlayRequested: order => {
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

      const navigation = initNavigation({ onRoute: route => { if (route === 'orders') orders.load(); } });
      initCatalog(catalog);
      initChat(catalog.products);
      initFeed().catch(console.warn);
      initProfile({ requestInstall: pwa.requestInstall });
      initCart({
        onViewOrders: () => { navigation.navigate('orders'); orders.load(); },
        onCreateAccount: () => navigation.navigate('profile'),
        onOrderPlaced: order => {
          trackEvent('order_created', {
            order_type: order?.order_type || order?.tipo || 'cardapio',
            total: Number(order?.total || 0),
          });
          orders.load();
          notifications.promptAfterOrder().catch(error => console.warn('[Push]', error));
        },
      });

      let lastCatalogFingerprint = catalogFingerprint(catalog);
      let lastSettingsFingerprint = settingsFingerprint(storeSettings);
      let refreshingCatalog = false;
      stopCatalogSync = await subscribeToCatalog(async reason => {
        if (refreshingCatalog) return;
        refreshingCatalog = true;
        try {
          const [nextCatalog, nextSettings] = await Promise.all([
            getCatalog(),
            getStoreSettings().catch(() => window.__igniteStoreSettings || storeSettings),
          ]);
          const nextCatalogFingerprint = catalogFingerprint(nextCatalog);
          const nextSettingsFingerprint = settingsFingerprint(nextSettings);
          const catalogChanged = nextCatalogFingerprint !== lastCatalogFingerprint;
          const settingsChanged = nextSettingsFingerprint !== lastSettingsFingerprint;
          if (!catalogChanged && !settingsChanged) return;

          lastCatalogFingerprint = nextCatalogFingerprint;
          lastSettingsFingerprint = nextSettingsFingerprint;
          applyStoreSettings(nextSettings);
          cartStore.reconcileCatalog(nextCatalog.products);

          console.info('[Catálogo] Dados operacionais alterados; recarregando interface.', reason);
          location.reload();
        } catch (error) {
          console.warn('[Catálogo] Falha ao reconciliar atualização:', error);
        } finally {
          refreshingCatalog = false;
        }
      });
    } catch (error) {
      console.error('[Bootstrap] Catálogo indisponível:', error);
      renderCatalogFailure(grid, error);
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

  window.addEventListener('pagehide', () => stopCatalogSync(), { once: true });
}

bootstrap();

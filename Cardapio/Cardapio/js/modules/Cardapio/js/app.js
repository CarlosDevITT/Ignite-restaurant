import { initCarousel } from './modules/carousel.js';
import { initCart } from './modules/cart.js';
import { initCatalog } from './modules/catalog.js';
import { initChat } from './modules/chat.js';
import { initFeed } from './modules/feed.js';
import { IgnitePlay } from './modules/ignite-play/index.js';
import { initNavigation } from './modules/navigation.js';
import { initOrders, isWaitingStatus } from './modules/orders.js';
import { initProfile } from './modules/profile.js';
import { initPWA } from './modules/pwa.js';
import { getCatalog } from './services/product-service.js';

async function bootstrap() {
  document.querySelectorAll('[data-carousel]').forEach(initCarousel);
  const grid = document.querySelector('#product-grid');
  const skeleton = document.querySelector('#product-skeleton');
  grid.replaceChildren(...Array.from({ length: 6 }, () => skeleton.content.cloneNode(true)));

  const connectionBadge = document.querySelector('#connection-badge');
  const showConnection = (message, duration = 2500) => {
    connectionBadge.textContent = message;
    connectionBadge.hidden = false;
    if (duration) setTimeout(() => { connectionBadge.hidden = true; }, duration);
  };

  window.addEventListener('offline', () => showConnection('Você está offline', 0));
  window.addEventListener('online', () => showConnection('Conexão restaurada'));
  if (!navigator.onLine) showConnection('Você está offline', 0);

  try {
    const catalog = await getCatalog();
    const pwa = initPWA();
    const orders = initOrders();
    const navigation = initNavigation({ onRoute: (route) => { if (route === 'orders') orders.load(); } });
    initCatalog(catalog);
    initChat(catalog.products);
    initFeed().catch(console.warn);
    initProfile({ requestInstall: pwa.requestInstall });
    initCart({
      onViewOrders: () => { navigation.navigate('orders'); orders.load(); },
      onOrderPlaced: (order) => {
        const orderId = order?.id ?? order?.order_number ?? order?.numero_pedido;
        if (orderId == null) return;
        const stopWatching = orders.watchOrder(orderId, (status) => {
          if (isWaitingStatus(status)) return;
          IgnitePlay.hide();
          navigation.navigate('orders');
          orders.load();
        });
        IgnitePlay.show({
          orderId,
          orderNumber: order.order_number || order.numero_pedido || orderId,
          onClose: stopWatching,
        });
      },
    });

    if (catalog.source === 'demo') showConnection('Modo demonstração · configure o Supabase', 4000);
  } catch (error) {
    console.error(error);
    grid.innerHTML = '<div class="empty-state"><span>⚠️</span><h3>Não foi possível abrir o cardápio</h3><p>Atualize a página e tente novamente.</p></div>';
    Swal.fire({ icon: 'error', title: 'Erro ao iniciar', text: error.message });
  }
}

bootstrap();

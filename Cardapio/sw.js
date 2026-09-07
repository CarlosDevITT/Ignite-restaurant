const CACHE = 'ignite-cardapio-v27-ignite-play-ux-' + encodeURIComponent(self.registration.scope);
const APP_SHELL = [
  './', './index.html', './manifest.json', './styles/cardapio.css', './styles/ignite-play.css',
  './assets/bebidas.png', './assets/combos.png', './assets/pratos.png', './assets/promo%C3%A7%C3%A3o.png',
  './js/app.js', './js/config.js', './js/data/mock-products.js', './js/supabase-config.js',
  './js/utils/format.js', './js/store/cart-store.js', './js/services/supabase-client.js', './js/services/product-service.js',
  './js/services/order-service.js', './js/services/profile-service.js', './js/modules/carousel.js', './js/modules/navigation.js', './js/modules/catalog.js', './js/modules/cart.js',
  './js/modules/orders.js', './js/modules/profile.js', './js/modules/feed.js', './js/modules/chat.js', './js/modules/pwa.js',
  './js/modules/ignite-play/index.js', './js/modules/ignite-play/game-registry.js', './js/modules/ignite-play/score-store.js',
  './js/modules/ignite-play/games/snake.js', './js/modules/ignite-play/games/pong.js', './js/modules/ignite-play/games/breakout.js', './js/modules/ignite-play/games/tetris.js',
  './assets/uicons/css/uicons-regular-rounded.css','./assets/uicons/webfonts/uicons-regular-rounded.woff2','./assets/uicons/webfonts/uicons-regular-rounded.woff',
  '../../assets/images/logos/ignite.jpg','../../assets/images/logos/ignite2.png'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ignite-cardapio-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url),hosts=['cdn.jsdelivr.net','cdn-uicons.flaticon.com','fonts.googleapis.com','fonts.gstatic.com','esm.sh'];if(u.origin!==self.location.origin){if(!hosts.includes(u.hostname))return;e.respondWith(caches.open(CACHE).then(c=>c.match(e.request)).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok||r.type==='opaque')caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r;})));return;}if(e.request.mode==='navigate'||u.pathname.endsWith('.js')){e.respondWith(fetch(e.request).then(r=>{caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r;}).catch(()=>caches.open(CACHE).then(c=>c.match(e.request)).then(hit=>hit||(e.request.mode==='navigate'?caches.open(CACHE).then(c=>c.match('./index.html')):Response.error()))));return;}e.respondWith(caches.open(CACHE).then(c=>c.match(e.request)).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r;})));});

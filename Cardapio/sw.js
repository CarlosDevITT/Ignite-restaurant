const CACHE = 'ignite-cardapio-v13';
const APP_SHELL = [
  './', './index.html', './manifest.json', './styles/cardapio.css',
  './js/app.js', './js/config.js', './js/data/mock-products.js',
  './js/supabase-config.js',
  './js/utils/format.js', './js/store/cart-store.js',
  './js/services/supabase-client.js', './js/services/product-service.js',
  './js/services/order-service.js', './js/services/profile-service.js',
  './js/modules/navigation.js', './js/modules/catalog.js', './js/modules/cart.js',
  './js/modules/orders.js', './js/modules/profile.js', './js/modules/feed.js',
  './js/modules/chat.js', './js/modules/pwa.js',
  './assets/uicons/css/uicons-regular-rounded.css',
  './assets/uicons/webfonts/uicons-regular-rounded.woff2',
  './assets/uicons/webfonts/uicons-regular-rounded.woff',
  '../assets/images/logos/ignite.jpg', '../assets/images/logos/ignite2.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('ignite-cardapio-') && key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const staticHosts = ['cdn.jsdelivr.net', 'cdn-uicons.flaticon.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'esm.sh'];
  if (url.origin !== self.location.origin) {
    if (!staticHosts.includes(url.hostname)) return;
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok || response.type === 'opaque') caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
      return response;
    })));
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); return response; }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, copy)); } return response; })));
});

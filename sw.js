// sw.js — Ignite Restaurant PWA v3.0
// Estratégia: Cache First para assets, Network First para páginas HTML

const CACHE_NAME   = 'ignite-v8-order-isolation';
const OFFLINE_PAGE = '/offline.html';

const PRE_CACHE = [
  '/',
  '/index.html',
  '/Cardapio/index.html',
  '/offline.html',
  '/styles/styles.css',
  '/js/main.js',
  '/js/ui/splash-module.js',
  '/manifest.json',
  '/assets/images/logos/ignite.jpg',
  '/assets/images/logos/ignite2.png',
  '/assets/images/logos/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;
  if (url.hostname !== self.location.hostname) {
    event.respondWith(fetch(request).catch(() => new Response('')));
    return;
  }

  const isHTML = request.headers.get('accept')?.includes('text/html');
  const isJS = url.pathname.endsWith('.js');

  // HTML and JS are Network First so security/order fixes are not pinned by an old PWA cache.
  if (isHTML || isJS) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || (isHTML ? caches.match(OFFLINE_PAGE) : new Response('', { status: 408 }))))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      }).catch(() => new Response('', { status: 408 }));
    })
  );
});

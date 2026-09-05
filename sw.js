// sw.js — Ignite Restaurant PWA v3.0
// Estratégia: Cache First para assets, Network First para páginas HTML

const CACHE_NAME   = 'ignite-v7';
const OFFLINE_PAGE = '/offline.html';

// Arquivos pre-cacheados na instalação
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

/* ── INSTALL: pré-cacheia tudo ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE))
  );
  self.skipWaiting();
});

/* ── ACTIVATE: limpa caches antigos ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── FETCH ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições não-HTTP (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) return;

  // Ignora APIs externas (fonts, CDN icons, sweetalert)
  if (url.hostname !== self.location.hostname) {
    event.respondWith(fetch(request).catch(() => new Response('')));
    return;
  }

  const isHTML = request.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    // Páginas HTML → Network First; se falhar → cache; se não tiver → offline.html
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Atualiza cache com resposta fresca
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_PAGE))
        )
    );
  } else {
    // Assets (CSS, JS, imagens) → Cache First
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
  }
});

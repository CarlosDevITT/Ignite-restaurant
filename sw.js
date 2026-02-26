const CACHE_NAME = 'ignite-v2'; // Alterado para forçar atualização
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/offline.html',
    '/styles.css',
    '/main.js',
    '/manifest.json',
    '/assets/images/logos/ignite.jpg',
    '/assets/images/logos/ignite2.png',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap',
    'https://cdn.jsdelivr.net/npm/boxicons@2.0.5/css/boxicons.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Instalação do Service Worker e cache de assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Estratégia de Fetch: Network First, falling back to cache
self.addEventListener('fetch', (event) => {
    // Ignore browser-extension requests or analytics probes
    if (event.request.url.startsWith('chrome-extension') || event.request.url.includes('google-analyzer')) {
        return;
    }

    event.respondWith((async () => {
        try {
            const networkResponse = await fetch(event.request);

            // Cache same-origin successful basic responses for offline use
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                const responseToCache = networkResponse.clone();
                const cache = await caches.open(CACHE_NAME);
                cache.put(event.request, responseToCache).catch(() => { /* ignore cache put errors */ });
            }

            return networkResponse;
        } catch (err) {
            // Network failed — try cache first
            const cached = await caches.match(event.request);
            if (cached) return cached;

            // If the request looks like a navigation or accepts HTML, return offline page
            const acceptHeader = event.request.headers && event.request.headers.get && event.request.headers.get('accept');
            const isHtmlRequest = event.request.mode === 'navigate' || (acceptHeader && acceptHeader.includes('text/html'));

            if (isHtmlRequest) {
                const offline = await caches.match('/offline.html');
                if (offline) return offline;
                // As a last resort, return a basic offline Response
                return new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><h1>Você está offline</h1>', { headers: { 'Content-Type': 'text/html' } });
            }

            // For non-HTML requests, return a generic error response
            return new Response('Network error', { status: 408, statusText: 'Network error' });
        }
    })());
});

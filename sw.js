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
    // Check if the request is for a browser extension or other schemes that shouldn't be cached
    if (event.request.url.startsWith('chrome-extension') || event.request.url.includes('google-analyzer')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If the response is valid, clone it and put it in the cache
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Se falhar (offline), tenta retornar do cache
                return caches.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    // Se não estiver no cache e for uma navegação (página HTML), mostra offline.html
                    if (event.request.mode === 'navigate') {
                        return caches.match('/offline.html');
                    }
                });
            })
    );
});

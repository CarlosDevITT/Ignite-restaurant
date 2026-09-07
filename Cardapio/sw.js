const SHELL_CACHE='ignite-cardapio-v29-ignite-play-4-'+encodeURIComponent(self.registration.scope);
const GAME_CACHE='ignite-play-games-v1-'+encodeURIComponent(self.registration.scope);
const APP_SHELL=[
  './','./index.html','./manifest.json','./styles/cardapio.css','./styles/ignite-play.css',
  './assets/bebidas.png','./assets/combos.png','./assets/pratos.png','./assets/promo%C3%A7%C3%A3o.png',
  './js/app.js','./js/config.js','./js/data/mock-products.js','./js/supabase-config.js',
  './js/utils/format.js','./js/store/cart-store.js','./js/services/supabase-client.js','./js/services/product-service.js',
  './js/services/order-service.js','./js/services/profile-service.js','./js/modules/carousel.js','./js/modules/navigation.js','./js/modules/catalog.js','./js/modules/cart.js',
  './js/modules/orders.js','./js/modules/profile.js','./js/modules/feed.js','./js/modules/chat.js','./js/modules/pwa.js',
  './js/modules/ignite-play/index.js','./js/modules/ignite-play/game-registry.js','./js/modules/ignite-play/score-store.js',
  './assets/uicons/css/uicons-regular-rounded.css','./assets/uicons/webfonts/uicons-regular-rounded.woff2','./assets/uicons/webfonts/uicons-regular-rounded.woff',
  '../../assets/images/logos/ignite.jpg','../../assets/images/logos/ignite2.png'
];
const GAME_PATH='/js/modules/ignite-play/games/';
self.addEventListener('install',event=>{event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('ignite-cardapio-')&&key!==SHELL_CACHE)||(key.startsWith('ignite-play-games-')&&key!==GAME_CACHE)).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url),staticHosts=['cdn.jsdelivr.net','cdn-uicons.flaticon.com','fonts.googleapis.com','fonts.gstatic.com','esm.sh'];
  if(url.origin!==self.location.origin){
    if(!staticHosts.includes(url.hostname))return;
    event.respondWith(caches.open(SHELL_CACHE).then(cache=>cache.match(event.request)).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok||response.type==='opaque')caches.open(SHELL_CACHE).then(cache=>cache.put(event.request,response.clone()));return response;})));
    return;
  }
  if(url.pathname.includes(GAME_PATH)&&url.pathname.endsWith('.js')){
    event.respondWith(caches.open(GAME_CACHE).then(async cache=>{
      const cached=await cache.match(event.request);
      const network=fetch(event.request).then(response=>{if(response.ok)cache.put(event.request,response.clone());return response;}).catch(()=>null);
      if(cached){event.waitUntil(network);return cached;}
      const response=await network;
      return response||Response.error();
    }));
    return;
  }
  if(event.request.mode==='navigate'||url.pathname.endsWith('.js')){
    event.respondWith(fetch(event.request).then(response=>{if(response.ok)caches.open(SHELL_CACHE).then(cache=>cache.put(event.request,response.clone()));return response;}).catch(()=>caches.open(SHELL_CACHE).then(cache=>cache.match(event.request)).then(cached=>cached||(event.request.mode==='navigate'?caches.open(SHELL_CACHE).then(cache=>cache.match('./index.html')):Response.error()))));
    return;
  }
  event.respondWith(caches.open(SHELL_CACHE).then(cache=>cache.match(event.request)).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok)caches.open(SHELL_CACHE).then(c=>c.put(event.request,response.clone()));return response;})));
});

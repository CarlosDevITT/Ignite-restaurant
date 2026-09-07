const VERSION='v51-push-notifications';
const SCOPE_KEY=encodeURIComponent(self.registration.scope);
const SHELL_CACHE=`ignite-cardapio-${VERSION}-${SCOPE_KEY}`;
const GAME_CACHE=`ignite-play-games-v2-${SCOPE_KEY}`;
const IMAGE_CACHE=`ignite-product-images-v1-${SCOPE_KEY}`;
const MAX_RUNTIME_IMAGES=80;

const APP_SHELL=[
  './','./index.html','./manifest.json','./styles/cardapio.css','./styles/catalog-premium.css','./styles/catalog-vertical.css','./styles/pwa.css','./styles/profile-auth.css','./styles/ignite-play.css','./styles/ignite-play-library.css',
  './assets/bebidas.png','./assets/combos.png','./assets/pratos.png','./assets/promo%C3%A7%C3%A3o.png',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-192-maskable.png','./icons/icon-512-maskable.png','./icons/apple-touch-icon.png',
  './js/app.js','./js/config.js','./js/data/mock-products.js','./js/supabase-config.js',
  './js/utils/format.js','./js/store/cart-store.js','./js/services/supabase-client.js','./js/services/product-service.js',
  './js/services/order-service.js','./js/services/profile-service.js','./js/modules/carousel.js','./js/modules/navigation.js','./js/modules/catalog.js','./js/modules/cart.js',
  './js/modules/orders.js','./js/modules/profile.js','./js/modules/feed.js','./js/modules/chat.js','./js/modules/pwa.js','./js/modules/notifications.js',
  './js/modules/ignite-play/index.js','./js/modules/ignite-play/game-registry.js','./js/modules/ignite-play/score-store.js','./js/modules/ignite-play/score-service.js',
  './assets/uicons/css/uicons-regular-rounded.css','./assets/uicons/webfonts/uicons-regular-rounded.woff2','./assets/uicons/webfonts/uicons-regular-rounded.woff',
  '../../assets/images/logos/ignite.jpg','../../assets/images/logos/ignite2.png'
];

const GAME_PATH='/js/modules/ignite-play/games/';
const STATIC_HOSTS=new Set(['cdn.jsdelivr.net','cdn-uicons.flaticon.com','fonts.googleapis.com','fonts.gstatic.com','esm.sh']);

async function trimCache(name,maxEntries){
  const cache=await caches.open(name);
  const keys=await cache.keys();
  if(keys.length<=maxEntries)return;
  await Promise.all(keys.slice(0,keys.length-maxEntries).map(key=>cache.delete(key)));
}

async function putSafe(cacheName,request,response){
  if(!response || !(response.ok || response.type==='opaque'))return response;
  const cache=await caches.open(cacheName);
  await cache.put(request,response.clone());
  return response;
}

async function cacheFirst(request,cacheName,{refresh=false,limit=0}={}){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(request);
  if(cached){
    if(refresh){
      fetch(request).then(response=>putSafe(cacheName,request,response)).then(()=>limit&&trimCache(cacheName,limit)).catch(()=>{});
    }
    return cached;
  }
  const response=await fetch(request);
  await putSafe(cacheName,request,response);
  if(limit)trimCache(cacheName,limit).catch(()=>{});
  return response;
}

async function networkFirst(request,cacheName,fallbackRequest){
  try{
    const response=await fetch(request);
    await putSafe(cacheName,request,response);
    return response;
  }catch{
    const cache=await caches.open(cacheName);
    return (await cache.match(request)) || (fallbackRequest ? await cache.match(fallbackRequest) : null) || Response.error();
  }
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    await Promise.allSettled(APP_SHELL.map(path=>cache.add(path)));
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>
      (key.startsWith('ignite-cardapio-')&&key!==SHELL_CACHE)||
      (key.startsWith('ignite-play-games-')&&key!==GAME_CACHE)||
      (key.startsWith('ignite-product-images-')&&key!==IMAGE_CACHE)
    ).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('push',event=>{
  let payload={};
  try{ payload=event.data?.json?.() || {}; }catch{ payload={ body:event.data?.text?.() || 'Você tem uma atualização no Ignite.' }; }
  const title=payload.title || 'Ignite Restaurante';
  const options={
    body:payload.body || 'Seu pedido foi atualizado.',
    icon:payload.icon || './icons/icon-192.png',
    badge:payload.badge || './icons/icon-192-maskable.png',
    tag:payload.tag || 'ignite-order-update',
    renotify:payload.renotify !== false,
    data:payload.data || { url:'./index.html?source=push' },
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url || './index.html?source=push',self.registration.scope).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const current=windows.find(client=>client.url.startsWith(self.registration.scope));
    if(current){
      if('navigate' in current) await current.navigate(target).catch(()=>{});
      return current.focus();
    }
    return self.clients.openWindow(target);
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);

  if(request.destination==='image'){
    event.respondWith(cacheFirst(request,IMAGE_CACHE,{refresh:true,limit:MAX_RUNTIME_IMAGES}).catch(()=>Response.error()));
    return;
  }

  if(url.origin!==self.location.origin){
    if(!STATIC_HOSTS.has(url.hostname))return;
    event.respondWith(cacheFirst(request,SHELL_CACHE,{refresh:true}).catch(()=>fetch(request)));
    return;
  }

  if(url.pathname.includes(GAME_PATH)&&url.pathname.endsWith('.js')){
    event.respondWith(cacheFirst(request,GAME_CACHE,{refresh:true}).catch(()=>Response.error()));
    return;
  }

  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request,SHELL_CACHE,'./index.html'));
    return;
  }

  if(['script','style','font','manifest'].includes(request.destination)||/\.(?:js|css|woff2?|json)$/.test(url.pathname)){
    event.respondWith(networkFirst(request,SHELL_CACHE));
    return;
  }

  event.respondWith(cacheFirst(request,SHELL_CACHE,{refresh:true}).catch(()=>fetch(request)));
});

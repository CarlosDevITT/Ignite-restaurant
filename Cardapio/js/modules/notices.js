// notices.js — banners informativos administrados pela Central de Marketing v7.1
const DISMISSED_KEY = 'ignite-dismissed-marketing-notices-v1';
const REFRESH_MS = 60_000;

let channel = null;
let refreshTimer = null;
let visibilityHandler = null;

function getClient() {
  return window.supabaseClient || null;
}

function waitForSupabase(timeoutMs = 5000) {
  const existing = getClient();
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (client, error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('supabase:ready', onReady);
      error ? reject(error) : resolve(client);
    };
    const onReady = () => finish(getClient() || null, getClient() ? null : new Error('Supabase indisponível'));
    const timer = setTimeout(() => finish(null, new Error('Supabase não ficou disponível a tempo')), timeoutMs);
    window.addEventListener('supabase:ready', onReady, { once: true });
  });
}

function readDismissed() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function persistDismissed(set) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch (error) {
    console.warn('[Avisos] Não foi possível persistir o fechamento:', error);
  }
}

function ensureStyles() {
  if (document.getElementById('ignite-marketing-notices-style')) return;
  const style = document.createElement('style');
  style.id = 'ignite-marketing-notices-style';
  style.textContent = `
    .ignite-notices{display:grid;gap:14px;margin:0 0 22px;}
    .ignite-notice{position:relative;overflow:hidden;border-radius:22px;background:#111915;border:1px solid rgba(255,255,255,.08);box-shadow:0 16px 38px rgba(5,12,8,.16);isolation:isolate;}
    .ignite-notice__image{display:block;width:100%;height:auto;aspect-ratio:16/6;object-fit:cover;background:#17211b;}
    .ignite-notice__close{position:absolute;top:12px;right:12px;z-index:2;width:40px;height:40px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(8,12,10,.72);color:#fff;font:700 24px/1 system-ui,sans-serif;display:grid;place-items:center;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}
    .ignite-notice__close:hover,.ignite-notice__close:focus-visible{background:#fff;color:#111;outline:3px solid rgba(255,255,255,.35);outline-offset:2px;}
    .ignite-notice--leaving{opacity:0;transform:translateY(-8px);transition:opacity .2s ease,transform .2s ease;}
    @media (max-width:640px){.ignite-notices{margin-bottom:16px;gap:10px}.ignite-notice{border-radius:17px}.ignite-notice__image{aspect-ratio:16/7}.ignite-notice__close{top:9px;right:9px;width:36px;height:36px;font-size:22px}}
    @media (prefers-reduced-motion:reduce){.ignite-notice--leaving{transition:none}}
  `;
  document.head.appendChild(style);
}

function getContainer() {
  let container = document.getElementById('ignite-marketing-notices');
  if (container) return container;

  const home = document.getElementById('view-home');
  if (!home) return null;
  container = document.createElement('section');
  container.id = 'ignite-marketing-notices';
  container.className = 'ignite-notices';
  container.setAttribute('aria-label', 'Avisos do Ignite');
  container.setAttribute('aria-live', 'polite');
  home.prepend(container);
  return container;
}

function dismissNotice(id, article) {
  const dismissed = readDismissed();
  dismissed.add(String(id));
  persistDismissed(dismissed);
  if (!article) return;
  article.classList.add('ignite-notice--leaving');
  setTimeout(() => article.remove(), 220);
}

function render(notices) {
  ensureStyles();
  const container = getContainer();
  if (!container) return;

  const dismissed = readDismissed();
  const visible = (notices || []).filter(notice => !dismissed.has(String(notice.id)));
  container.replaceChildren();
  container.hidden = visible.length === 0;

  for (const notice of visible) {
    const article = document.createElement('article');
    article.className = 'ignite-notice';
    article.dataset.noticeId = String(notice.id);

    const image = document.createElement('img');
    image.className = 'ignite-notice__image';
    image.src = notice.image_url;
    image.alt = 'Aviso informativo do Ignite';
    image.loading = 'eager';
    image.decoding = 'async';
    article.appendChild(image);

    if (notice.allow_close) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'ignite-notice__close';
      close.setAttribute('aria-label', 'Fechar este aviso');
      close.title = 'Fechar aviso';
      close.textContent = '×';
      close.addEventListener('click', () => dismissNotice(notice.id, article));
      article.appendChild(close);
    }

    container.appendChild(article);
  }
}

async function loadNotices() {
  const client = getClient() || await waitForSupabase();
  const { data, error } = await client
    .from('marketing_notices')
    .select('id,image_url,allow_close,sort_order,starts_at,ends_at,updated_at')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  render(data || []);
  return data || [];
}

function setupRealtime(client) {
  if (channel) client.removeChannel(channel);
  channel = client
    .channel('cardapio-marketing-notices-v1')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'marketing_notices' }, () => {
      loadNotices().catch(error => console.warn('[Avisos] Realtime:', error));
    })
    .subscribe();
}

export async function initNotices() {
  try {
    const client = getClient() || await waitForSupabase();
    await loadNotices();
    setupRealtime(client);

    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (document.visibilityState === 'visible') loadNotices().catch(error => console.warn('[Avisos] Atualização:', error));
    }, REFRESH_MS);

    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') loadNotices().catch(error => console.warn('[Avisos] Retorno ao app:', error));
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  } catch (error) {
    console.warn('[Avisos] Não foi possível iniciar os banners informativos:', error);
  }

  return {
    refresh: loadNotices,
    destroy() {
      clearInterval(refreshTimer);
      refreshTimer = null;
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
      const client = getClient();
      if (channel && client) client.removeChannel(channel);
      channel = null;
    },
  };
}

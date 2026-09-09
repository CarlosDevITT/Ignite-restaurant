const ANALYTICS_SCRIPT_ID = 'ignite-vercel-analytics';
const SPEED_SCRIPT_ID = 'ignite-vercel-speed-insights';
let initialized = false;
let lastViewedProductId = null;

function ensureQueue(name, queueName) {
  if (typeof window[name] === 'function') return;
  window[name] = function () {
    (window[queueName] = window[queueName] || []).push(arguments);
  };
}

function injectScript(id, src) {
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.defer = true;
  script.src = src;
  script.dataset.igniteTelemetry = 'true';
  document.head.appendChild(script);
}

function productMeta(target) {
  const card = target?.closest?.('[data-product-card]');
  const id = target?.dataset?.product || target?.dataset?.addProduct || card?.dataset?.productCard || '';
  const name = card?.querySelector('.product-name')?.textContent?.trim() || card?.querySelector('h3')?.textContent?.trim() || '';
  return { id: String(id || ''), name: name.slice(0, 80) };
}

export function trackEvent(name, data = {}) {
  try {
    ensureQueue('va', 'vaq');
    const safe = Object.fromEntries(
      Object.entries(data)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .slice(0, 2)
        .map(([key, value]) => [key, typeof value === 'number' ? value : String(value).slice(0, 120)])
    );
    window.va('event', { name, data: safe });
  } catch (error) {
    console.warn('[Analytics] Falha ao registrar evento:', name, error);
  }
}

export function initAnalytics() {
  if (initialized) return;
  initialized = true;

  ensureQueue('va', 'vaq');
  ensureQueue('si', 'siq');
  injectScript(ANALYTICS_SCRIPT_ID, '/_vercel/insights/script.js');
  injectScript(SPEED_SCRIPT_ID, '/_vercel/speed-insights/script.js');

  window.va('beforeSend', (event) => {
    try {
      const url = new URL(event.url);
      ['phone', 'telefone', 'name', 'nome', 'address', 'endereco', 'email', 'token', 'code'].forEach((key) => url.searchParams.delete(key));
      return { ...event, url: url.toString() };
    } catch {
      return event;
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button, a');
    if (!target) return;

    if (target.matches('[data-product]')) {
      const product = productMeta(target);
      lastViewedProductId = product.id || null;
      trackEvent('product_view', { product_id: product.id, product_name: product.name });
      return;
    }

    if (target.matches('[data-add-product]')) {
      const product = productMeta(target);
      trackEvent('add_to_cart', { product_id: product.id, product_name: product.name });
      return;
    }

    if (target.id === 'checkout-button') {
      trackEvent('checkout_started', { items: document.querySelector('#cart-count')?.textContent || '0', source: 'cardapio' });
      return;
    }

    if (target.matches('[data-route]')) {
      trackEvent('route_view', { route: target.dataset.route || 'home', source: 'cardapio' });
      return;
    }

    if (target.classList.contains('swal2-confirm') && /^Adicionar\b/i.test(target.textContent || '') && lastViewedProductId) {
      trackEvent('add_to_cart', { product_id: lastViewedProductId, source: 'product_modal' });
    }
  }, true);

  window.addEventListener('appinstalled', () => trackEvent('pwa_installed', { source: 'cardapio' }));
  console.log('[Analytics] Vercel Web Analytics + Speed Insights inicializados');
}

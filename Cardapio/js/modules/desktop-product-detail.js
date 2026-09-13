const DESKTOP_QUERY = '(min-width: 1100px)';

function ensureStyle() {
  if (document.querySelector('[data-product-detail-desktop-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../styles/product-detail-desktop.css?v=20260913-1', import.meta.url).href;
  link.setAttribute('data-product-detail-desktop-style', 'true');
  document.head.appendChild(link);
}

const moneyFromText = (value = '') => {
  const raw = String(value).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
};

const formatMoney = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function enhance(dialog) {
  if (!matchMedia(DESKTOP_QUERY).matches || !dialog || dialog.dataset.desktopDetailReady === '1') return;
  const root = dialog.querySelector('.swal-product');
  if (!root) return;
  dialog.dataset.desktopDetailReady = '1';

  const visual = root.querySelector('.swal-product__visual');
  const heading = root.querySelector('.swal-product__heading');
  const description = root.querySelector('.swal-product__description');
  const price = root.querySelector('.swal-product__price');
  const fields = [...root.querySelectorAll(':scope > .field')];
  if (!visual || !heading || !price || fields.length < 2) return;

  const category = heading.querySelector('.swal-product__category');
  const title = heading.querySelector('h2');
  const promo = price.querySelector('span');

  const content = document.createElement('div');
  content.className = 'swal-product__content';

  const topline = document.createElement('div');
  topline.className = 'swal-product__topline';
  if (category) topline.appendChild(category);
  const badge = document.createElement('span');
  badge.className = `swal-product__badge${promo ? ' is-promo' : ''}`;
  badge.innerHTML = promo ? '<i class="fi fi-rr-badge-percent"></i><span>Oferta ativa</span>' : '<i class="fi fi-rr-check-circle"></i><span>Disponível agora</span>';
  topline.appendChild(badge);

  if (title) heading.prepend(topline);
  content.appendChild(heading);
  if (description) content.appendChild(description);

  const priceRow = document.createElement('div');
  priceRow.className = 'swal-product__price-row';
  priceRow.appendChild(price);
  const trust = document.createElement('span');
  trust.className = 'swal-product__trust';
  trust.innerHTML = '<i class="fi fi-rr-shield-check"></i> Valor confirmado no checkout';
  priceRow.appendChild(trust);
  content.appendChild(priceRow);

  const controls = document.createElement('div');
  controls.className = 'swal-product__controls';
  fields.forEach(field => controls.appendChild(field));
  content.appendChild(controls);

  const summary = document.createElement('div');
  summary.className = 'swal-product__summary';
  summary.innerHTML = '<div class="swal-product__summary-row"><span>Total deste item</span><strong data-product-detail-total></strong></div>';
  content.appendChild(summary);

  root.appendChild(content);

  const quantity = dialog.querySelector('#swal-quantity');
  const unitPrice = moneyFromText(price.querySelector('strong')?.textContent || '');
  const total = summary.querySelector('[data-product-detail-total]');
  const syncTotal = () => {
    const qty = Math.min(20, Math.max(1, Math.trunc(Number(quantity?.value)) || 1));
    if (total) total.textContent = formatMoney(unitPrice * qty);
  };
  quantity?.addEventListener('input', syncTotal);
  quantity?.addEventListener('change', syncTotal);
  dialog.querySelectorAll('[data-quantity-step]').forEach(button => button.addEventListener('click', () => setTimeout(syncTotal, 0)));
  syncTotal();
}

export function initDesktopProductDetail() {
  ensureStyle();
  const scan = () => document.querySelectorAll('.swal2-popup.product-dialog').forEach(enhance);
  const observer = new MutationObserver(scan);
  observer.observe(document.body, { childList: true, subtree: true });
  matchMedia(DESKTOP_QUERY).addEventListener?.('change', scan);
  scan();
  return () => observer.disconnect();
}

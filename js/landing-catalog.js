import { storefrontUnits } from './data/storefront.js';
import { getSupabase } from '../Cardapio/js/services/supabase-client.js';
import { normalizeProduct, readPublicStoreStatus, subscribeToCatalog } from '../Cardapio/js/services/product-service.js';
import { normalizeText, money } from '../Cardapio/js/utils/format.js';

const grid = document.querySelector('#landing-products');
const state = document.querySelector('#landing-menu-state');
const retry = document.querySelector('#retry-landing-menu');
const note = document.querySelector('#landing-menu-note');
const hero = document.querySelector('#hero-dish-image');
const heroLink = document.querySelector('#hero-dish-link');
const status = document.querySelector('#landing-store-status');
const categoryRoot = document.querySelector('#landing-categories');
const slug = value => normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const itemLink = product => `Cardapio/index.html?item=${encodeURIComponent(product.id)}`;
const categoryLink = name => `Cardapio/index.html?category=${encodeURIComponent(slug(name))}`;
let controller;
let lastLoad = 0;
let generation = 0;
let visibleProducts = [];
let lastFingerprint = null;
let pollingStatus = false;
let statusGeneration = 0;
let stopCatalogSync = null;
let unitsFingerprint = null;


function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function imageURL(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
function media(product, eager = false) {
  const frame = element('div', 'landing-product-media');
  const fallback = element('span', 'product-image-fallback', product.emoji || '🍽️');
  fallback.setAttribute('aria-hidden', 'true');
  frame.append(fallback);
  const url = imageURL(product.image_url);
  if (url) {
    const image = element('img');
    image.alt = product.name;
    image.width = 600; image.height = 450;
    image.loading = eager ? 'eager' : 'lazy'; image.decoding = 'async';
    image.addEventListener('error', () => image.remove(), { once: true });
    image.src = url; frame.append(image);
  }
  return frame;
}
function price(product) {
  const row = element('div', 'landing-product-price');
  if (product.promo && product.original_price > product.price) row.append(element('del', '', money(product.original_price)));
  row.append(element('strong', '', money(product.price)));
  return row;
}
function renderHero(products) {
  const product = products.find(p => !/bebida/i.test(p.category_name) && imageURL(p.image_url));
  if (!product) {
    heroLink.classList.remove('has-dish');
    hero.onerror = null; hero.src = 'assets/images/logos/ignite2.png'; hero.alt = 'Ignite Restaurante Pub'; heroLink.href = 'Cardapio/index.html';
    heroLink.setAttribute('aria-label', 'Conhecer o cardápio Ignite');
    document.querySelector('#hero-dish-caption').replaceChildren(element('small', '', 'Veja o que pedir hoje'), element('strong', '', 'Veja o cardápio'), element('span', '', 'Ver pratos e preços ↗'));
    return;
  }
  heroLink.classList.add('has-dish');
  heroLink.href = itemLink(product); heroLink.setAttribute('aria-label', `Ver ${product.name} no cardápio`);
  hero.onerror = () => { hero.onerror = null; heroLink.classList.remove('has-dish'); hero.src = 'assets/images/logos/ignite2.png'; hero.alt = 'Foto indisponível: Ignite Restaurante Pub'; };
  hero.src = imageURL(product.image_url); hero.alt = product.name;
  document.querySelector('#hero-dish-caption').replaceChildren(element('small', '', product.category_name), element('strong', '', product.name), element('span', '', `${money(product.price)} · Ver no cardápio ↗`));
}
function renderProducts(products) {
  const food = products.filter(p => !/bebida/i.test(p.category_name));
  const beverages = products.filter(p => /bebida/i.test(p.category_name));
  const picks = [...food, ...beverages].slice(0, 6);
  visibleProducts = products;
  const fragment = document.createDocumentFragment();
  for (const product of picks) {
    const card = element('a', 'landing-product-card');
    card.href = itemLink(product); card.dataset.productId = product.id;
    card.setAttribute('aria-label', `Ver ${product.name}, ${money(product.price)}, no cardápio`);
    const image = media(product);
    if (product.promo) image.append(element('span', 'landing-product-badge', 'Oferta no cardápio'));
    const copy = element('div', 'landing-product-copy');
    copy.append(element('span', 'landing-product-category', product.category_name), element('h3', '', product.name));
    const description = String(product.description || '').replace(/\s+/g, ' ').trim();
    copy.append(element('p', '', description || 'Veja os detalhes no cardápio.'));
    if (product.promo && product.promo_text) copy.append(element('p', 'landing-promo-copy', String(product.promo_text)));
    copy.append(price(product), element('span', 'landing-product-action', 'Ver no cardápio ↗'));
    card.append(image, copy); fragment.append(card);
  }
  grid.replaceChildren(fragment);
  categoryRoot.replaceChildren();
  const counts = new Map();
  for (const product of products) counts.set(product.category_name, (counts.get(product.category_name) || 0) + 1);
  for (const [name, count] of counts) {
    const link = element('a', 'landing-category-link', `${name} · ${count}`);
    link.href = categoryLink(name); categoryRoot.append(link);
  }
  const links = document.querySelectorAll('#landing-service-links a');
  const foodCategory = food[0]?.category_name;
  const drinkCategory = beverages[0]?.category_name;
  links[0].href = foodCategory ? categoryLink(foodCategory) : 'Cardapio/index.html';
  links[1].href = drinkCategory ? categoryLink(drinkCategory) : 'Cardapio/index.html';
  renderHero(products);
}
function renderUnits(units) {
  const fingerprint = JSON.stringify(units);
  if (fingerprint === unitsFingerprint) return;
  unitsFingerprint = fingerprint;
  const cards = document.querySelectorAll('#landing-units .unit-card');
  units.slice(0, cards.length).forEach((unit, index) => {
    const card = cards[index];
    const heading = element('h3', '', unit.name);
    heading.append(element('small', '', ` / ${unit.state}`));
    card.querySelector('h3').replaceWith(heading);
    card.querySelector('.service-label').textContent = unit.service;
    card.querySelector('.unit-address').textContent = [unit.address, unit.neighborhood].filter(Boolean).join(' · ');
    card.querySelector('p strong').textContent = unit.hours;
    const message = `Olá! Vim pelo site Ignite e gostaria de falar com a unidade de ${unit.name}.`;
    const phone = String(unit.phone).replace(/[^0-9]/g, '');
    const contact = card.querySelector('.unit-actions .button');
    contact.href = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
    contact.textContent = `WhatsApp ${unit.name} ↗`;
    const footerWhatsApp = document.querySelector(`[data-unit-whatsapp="${unit.id}"]`);
    if (footerWhatsApp) footerWhatsApp.href = contact.href;
    card.querySelector('.unit-phone').href = `tel:+55${phone}`;
    card.querySelector('.unit-phone').textContent = unit.displayPhone;
    const footerPhone = document.querySelector(`[data-unit-phone="${unit.id}"]`);
    if (footerPhone) { footerPhone.href = `tel:+55${phone}`; footerPhone.textContent = `${unit.name}: ${unit.displayPhone}`; }
    const map = new URL('https://www.google.com/maps/search/');
    map.searchParams.set('api', '1');
    map.searchParams.set('query', [unit.address, unit.neighborhood, unit.name, unit.state].filter(Boolean).join(', '));
    card.querySelector('.unit-actions > a:not(.button)').href = map.href;
  });
  document.querySelector('#faq-unit-info').textContent = units.map(unit => `${unit.name}: ${unit.address}${unit.neighborhood ? ", " + unit.neighborhood : ""}. ${unit.hours}. ${unit.service}.`).join(' ') + ' Consulte a unidade para orientações de acesso.';
}
renderUnits(storefrontUnits);

function setStatus(text) {
  if (status.textContent !== text) status.textContent = text;
}
function renderSettings(result) {
  const data = result.status === 'fulfilled' && !result.value.error ? result.value.data : null;
  status.classList.remove('is-open', 'is-closed');
  if (!data || typeof data.store_open !== 'boolean') {
    setStatus('Consulte a disponibilidade de pedidos com a equipe.');
    document.querySelector('#landing-delivery-copy').textContent = 'Você vê a taxa de entrega antes de finalizar o pedido. Fale com a unidade para confirmar se ela entrega no seu endereço.';
    return;
  }
  if (Array.isArray(data.units)) {
    const units = storefrontUnits.map(fallback => {
      const remote = data.units.find(unit => unit?.id === fallback.id);
      if (!remote) return fallback;
      const next = { ...fallback };
      for (const field of ['name', 'state', 'address', 'neighborhood', 'hours', 'service', 'displayPhone']) {
        if (typeof remote[field] === 'string' && remote[field].trim().length <= 300) next[field] = remote[field].trim();
      }
      if (/^[0-9]{10,11}$/.test(String(remote.phone || ''))) next.phone = String(remote.phone);
      return next;
    });
    renderUnits(units);
  }
  status.classList.add(data.store_open ? 'is-open' : 'is-closed');
  setStatus(data.store_open ? 'Pedidos online disponíveis' : 'Pedidos online pausados · Consulte o cardápio');
  if (Number.isFinite(Number(data.delivery_fee)) && data.delivery_fee !== null && Number(data.delivery_fee) >= 0) {
    document.querySelector('#landing-delivery-copy').textContent = `A taxa de entrega indicada no cardápio é ${money(Number(data.delivery_fee))}. Confira o total antes de finalizar e fale com a unidade para confirmar a entrega no seu endereço.`;
  }
}
async function loadCatalog() {
  const current = ++generation;
  statusGeneration++;
  controller?.abort(); controller = new AbortController();
  const signal = controller.signal;
  const requestController = controller;
  const timer = setTimeout(() => requestController.abort(), 12000);
  retry.disabled = true; grid.setAttribute('aria-busy', 'true');
  if (!visibleProducts.length) { state.hidden = false; state.querySelector('p').textContent = 'Carregando os pratos do cardápio…'; retry.hidden = true; state.classList.remove('is-error'); }
  try {
    const client = await getSupabase();
    if (signal.aborted) throw new Error('Timeout');
    const [catalog, settings] = await Promise.allSettled([
      client.from('cardapio_products_public').select('*').order('id', { ascending: true }).abortSignal(signal),
      readPublicStoreStatus(signal),
    ]);
    if (current !== generation) return;
    renderSettings(settings);
    if (catalog.status === 'rejected' || catalog.value.error) throw new Error('Catalog unavailable');
    const products = (catalog.value.data || []).filter(p => p.active !== false && p.ativo !== false).map(normalizeProduct).filter(p => p.available && Number.isFinite(p.price) && p.price >= 0);
    const fingerprint = JSON.stringify(products);
    if (fingerprint !== lastFingerprint) {
      renderProducts(products);
      lastFingerprint = fingerprint;
      window.dispatchEvent(new Event('landing:catalog-ready'));
    }
    lastLoad = Date.now(); note.hidden = true;
    state.hidden = products.length > 0;
    if (!products.length) { state.classList.add('is-error'); state.querySelector('p').textContent = 'Nenhum destaque disponível agora. Consulte o cardápio ou fale com a equipe.'; retry.hidden = false; }
  } catch {
    if (current !== generation) return;
    // Never substitute mock products or claim current availability after a failed request.
    setStatus('Consulte a disponibilidade de pedidos com a equipe.');
    status.classList.remove('is-open', 'is-closed');
    state.hidden = false; state.classList.add('is-error'); retry.hidden = false;
    state.querySelector('p').textContent = visibleProducts.length ? 'Não conseguimos atualizar os destaques. Confira os preços atuais no Cardápio.' : 'Não conseguimos carregar os pratos agora. Tente novamente ou abra o Cardápio.';
    if (visibleProducts.length) { note.hidden = false; note.textContent = 'Informações da última consulta. Preços e disponibilidade podem ter mudado.'; }
  } finally {
    clearTimeout(timer);
    if (current === generation) { retry.disabled = false; grid.setAttribute('aria-busy', 'false'); }
  }
}
retry.addEventListener('click', loadCatalog);
addEventListener('online', loadCatalog);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastLoad > 30000) loadCatalog(); });
// Opening/closing the PDV must reach the landing even without a product edit.
// Read the exact same public status as Cardápio; no cash-register writes.
async function pollStatus() {
  if (document.hidden || pollingStatus || grid.getAttribute('aria-busy') === 'true') return;
  pollingStatus = true;
  const version = ++statusGeneration;
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 4500);
  try {
    const value = await readPublicStoreStatus(abort.signal);
    if (version === statusGeneration) renderSettings({ status: 'fulfilled', value });
  } catch {
    if (version === statusGeneration) renderSettings({ status: 'rejected' });
  } finally { clearTimeout(timeout); pollingStatus = false; }
}
setInterval(pollStatus, 5000);
setInterval(() => { if (!document.hidden && Date.now() - lastLoad > 60000) loadCatalog(); }, 60000);
loadCatalog();
subscribeToCatalog(() => { if (!document.hidden) loadCatalog(); }).then(stop => { stopCatalogSync = stop; }).catch(() => {});
window.addEventListener('pagehide', () => { controller?.abort(); stopCatalogSync?.(); stopCatalogSync = null; });
window.addEventListener('pageshow', event => {
  if (event.persisted) {
    loadCatalog();
    subscribeToCatalog(() => { if (!document.hidden) loadCatalog(); }).then(stop => { stopCatalogSync = stop; }).catch(() => {});
  }
});

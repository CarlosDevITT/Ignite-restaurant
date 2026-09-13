import { cartStore } from '../store/cart-store.js';

function ensureStyles() {
  if (document.querySelector('link[data-ignite-cart-ux]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../styles/cart-ux.css?v=20260912-4', import.meta.url).href;
  link.dataset.igniteCartUx = 'true';
  document.head.appendChild(link);
}

function renderCartImages() {
  const cards = [...document.querySelectorAll('#cart-items .cart-item')];
  const items = cartStore.snapshot().items;

  cards.forEach((card, index) => {
    const visual = card.querySelector('.cart-item__visual');
    const item = items[index];
    if (!visual || !item) return;

    const existing = visual.querySelector('img');
    if (!item.image_url) {
      if (existing) existing.remove();
      visual.classList.remove('has-image');
      return;
    }

    visual.classList.add('has-image');
    visual.innerHTML = '';
    const image = document.createElement('img');
    image.className = 'cart-item__image';
    image.src = item.image_url;
    image.alt = item.name || 'Produto';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      visual.classList.remove('has-image');
      visual.innerHTML = `<span class="cart-item__emoji" aria-hidden="true">${item.emoji || '🍽️'}</span>`;
    }, { once: true });
    visual.appendChild(image);
  });
}

function scheduleCartImages() {
  requestAnimationFrame(() => requestAnimationFrame(renderCartImages));
}

function setupCartHeader() {
  const drawer = document.querySelector('#cart-drawer');
  const header = drawer?.querySelector('.drawer-header');
  const titleWrap = header?.querySelector('.drawer-header__title');
  const checkoutStep = document.querySelector('#checkout-step');
  if (!drawer || !header || !titleWrap || !checkoutStep) return;

  let meta = titleWrap.querySelector('.drawer-header__meta');
  if (!meta) {
    meta = document.createElement('div');
    meta.className = 'drawer-header__meta';
    titleWrap.appendChild(meta);
  }

  const update = () => {
    const { count, subtotal } = cartStore.snapshot();
    const checkout = !checkoutStep.hidden;
    drawer.classList.toggle('is-checkout-step', checkout);
    drawer.classList.toggle('is-cart-step', !checkout);
    meta.textContent = checkout
      ? 'Revise os dados antes de enviar'
      : `${count} ${count === 1 ? 'item' : 'itens'} · ${subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
  };

  const observer = new MutationObserver(update);
  observer.observe(checkoutStep, { attributes: true, attributeFilter: ['hidden'] });
  cartStore.addEventListener('change', update);
  update();
}

function enhanceCheckout() {
  const drawer = document.querySelector('#cart-drawer');
  const form = document.querySelector('#checkout-form');
  const checkoutStep = document.querySelector('#checkout-step');
  if (!drawer || !form || !checkoutStep) return;

  form.querySelectorAll('.checkout-section').forEach((section, index) => {
    section.dataset.checkoutBlock = String(index + 1);
  });

  const updateKeyboardState = () => {
    const vv = window.visualViewport;
    const open = vv ? window.innerHeight - vv.height > 140 : false;
    drawer.classList.toggle('checkout-keyboard-open', open && !checkoutStep.hidden);
  };

  window.visualViewport?.addEventListener('resize', updateKeyboardState);
  window.visualViewport?.addEventListener('scroll', updateKeyboardState);
  document.addEventListener('focusin', updateKeyboardState);
  document.addEventListener('focusout', () => setTimeout(updateKeyboardState, 80));

  form.addEventListener('change', (event) => {
    if (event.target.name === 'order_type' || event.target.name === 'payment_method') {
      event.target.closest('label')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  });
}

export function initCartUX() {
  ensureStyles();
  setupCartHeader();
  scheduleCartImages();
  cartStore.addEventListener('change', scheduleCartImages);
  const root = document.querySelector('#cart-items');
  if (root) {
    const observer = new MutationObserver(scheduleCartImages);
    observer.observe(root, { childList: true, subtree: true });
  }
  enhanceCheckout();
}

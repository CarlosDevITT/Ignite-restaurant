import { cartStore } from '../store/cart-store.js';

function ensurePurchasePolish() {
  const files = [
    ['ignite-purchase-polish', '../../styles/purchase-polish.css?v=20260912-2'],
    ['ignite-final-audit', '../../styles/final-audit.css?v=20260912-1'],
  ];
  files.forEach(([id, path]) => {
    const attribute = `data-${id}`;
    if (document.querySelector(`link[${attribute}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(path, import.meta.url).href;
    link.setAttribute(attribute, 'true');
    document.head.appendChild(link);
  });
}

function cleanupLegacyTypography() {
  document.querySelectorAll('link[href*="fonts.googleapis.com"][href*="family=Syne"]').forEach((link) => {
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
  });
}

function cleanupLegacyHeader() {
  const eyebrow = document.querySelector('.app-header .eyebrow');
  if (eyebrow && /Manaus\s*[·-]\s*AM/i.test(eyebrow.textContent || '')) eyebrow.remove();
}

function pulse(element, className, duration = 360) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), duration);
}

function setupCartFeedback() {
  const floatingCart = document.querySelector('#floating-cart');
  const itemsRoot = document.querySelector('#cart-items');
  let previous = cartStore.snapshot();

  cartStore.addEventListener('change', (event) => {
    const next = event.detail || cartStore.snapshot();
    if (next.count > previous.count) pulse(floatingCart, 'is-cart-bump', 420);
    if (next.count !== previous.count || next.subtotal !== previous.subtotal) {
      pulse(floatingCart?.querySelector('#floating-cart-total'), 'is-total-update', 380);
    }
    previous = next;
  });

  if (itemsRoot) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const cards = node.matches?.('.cart-item') ? [node] : [...node.querySelectorAll?.('.cart-item') || []];
        cards.forEach((card) => pulse(card, 'is-cart-item-entering', 320));
      }));
    });
    observer.observe(itemsRoot, { childList: true });
  }

  document.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-add-product]');
    if (addButton && !addButton.disabled) pulse(addButton, 'is-added', 420);

    const quantityButton = event.target.closest('[data-cart-change]');
    if (quantityButton) pulse(quantityButton.closest('.quantity-control'), 'is-quantity-updating', 280);

    const removeButton = event.target.closest('[data-cart-remove]');
    if (removeButton) pulse(removeButton.closest('.cart-item'), 'is-cart-item-removing', 220);
  }, true);
}

function setupDrawerMotion() {
  const drawer = document.querySelector('#cart-drawer');
  if (!drawer) return;
  const observer = new MutationObserver(() => {
    drawer.classList.toggle('is-drawer-visible', drawer.classList.contains('is-open'));
  });
  observer.observe(drawer, { attributes: true, attributeFilter: ['class'] });
  drawer.classList.toggle('is-drawer-visible', drawer.classList.contains('is-open'));
}

export function initPurchaseFeedback() {
  ensurePurchasePolish();
  cleanupLegacyTypography();
  cleanupLegacyHeader();
  setupCartFeedback();
  setupDrawerMotion();
}

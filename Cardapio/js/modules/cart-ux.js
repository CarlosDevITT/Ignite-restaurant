import { cartStore } from '../store/cart-store.js';

function ensureStyles() {
  const files = [
    ['ignite-cart-ux', '../../styles/cart-ux.css?v=20260912-5'],
    ['ignite-checkout-polish', '../../styles/checkout-polish.css?v=20260912-1'],
  ];
  files.forEach(([id, path]) => {
    if (document.querySelector(`link[data-${id}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(path, import.meta.url).href;
    link.dataset[id] = 'true';
    document.head.appendChild(link);
  });
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

  const serviceSection = form.querySelector('.service-types');
  const dataSection = form.querySelector('.checkout-fields')?.closest('.checkout-section');
  const paymentSection = form.querySelector('.payment-section');
  const addressField = form.querySelector('.checkout-address');
  const tableField = form.querySelector('.checkout-table');
  const notesField = form.querySelector('.checkout-notes');

  const helperCopy = [
    [serviceSection, 'Escolha a modalidade para mostrarmos apenas o que é necessário.'],
    [dataSection, 'Usamos estes dados para identificar e atualizar seu pedido.'],
    [paymentSection, 'Informe como pretende pagar. Nenhum valor é cobrado nesta tela.'],
  ];

  helperCopy.forEach(([section, text], index) => {
    if (!section) return;
    section.dataset.checkoutBlock = String(index + 1);
    if (section.querySelector('.checkout-section__hint')) return;
    const hint = document.createElement('p');
    hint.className = 'checkout-section__hint';
    hint.textContent = text;
    const firstContent = section.querySelector(':scope > div');
    section.insertBefore(hint, firstContent || null);
  });

  if (notesField && !notesField.querySelector('.checkout-field-hint')) {
    const hint = document.createElement('small');
    hint.className = 'checkout-field-hint';
    hint.textContent = 'Use este campo para troco, referência ou observações do preparo.';
    notesField.appendChild(hint);
  }

  let contextual = form.querySelector('.checkout-context');
  if (!contextual) {
    contextual = document.createElement('div');
    contextual.className = 'checkout-context';
    serviceSection?.insertAdjacentElement('afterend', contextual);
  }

  let paymentHint = paymentSection?.querySelector('.checkout-payment-hint');
  if (paymentSection && !paymentHint) {
    paymentHint = document.createElement('div');
    paymentHint.className = 'checkout-payment-hint';
    paymentSection.appendChild(paymentHint);
  }

  const typeCopy = {
    delivery: ['Delivery', 'Informe o endereço completo para evitar atraso na entrega.'],
    pickup: ['Retirada', 'Seu pedido será preparado para retirada no balcão.'],
    local: ['No local', 'Informe o número da mesa para identificarmos onde servir.'],
  };
  const paymentCopy = {
    pix: 'PIX selecionado. O restaurante confirmará as instruções do pagamento.',
    card: 'Cartão selecionado. Informe esta preferência ao restaurante no pedido.',
    cash: 'Dinheiro selecionado. Se precisar de troco, informe nas observações.',
  };

  const updateContext = () => {
    const type = form.elements.order_type?.value || 'delivery';
    const payment = form.elements.payment_method?.value || 'pix';
    const [title, body] = typeCopy[type] || typeCopy.delivery;
    contextual.innerHTML = `<span class="checkout-context__icon"><i class="fi ${type === 'delivery' ? 'fi-rr-motorcycle' : type === 'pickup' ? 'fi-rr-shopping-bag' : 'fi-rr-restaurant'}" aria-hidden="true"></i></span><span><strong>${title}</strong><small>${body}</small></span>`;
    if (paymentHint) paymentHint.textContent = paymentCopy[payment] || '';

    [addressField, tableField].forEach((field) => {
      if (!field) return;
      field.classList.toggle('is-context-visible', !field.hidden);
    });
  };

  const updateFieldState = (input) => {
    const field = input.closest('.field');
    if (!field) return;
    const hasValue = Boolean(String(input.value || '').trim());
    field.classList.toggle('has-value', hasValue);
    field.classList.toggle('is-invalid', input.matches(':user-invalid'));
  };

  form.querySelectorAll('input, textarea').forEach((input) => {
    updateFieldState(input);
    input.addEventListener('input', () => updateFieldState(input));
    input.addEventListener('blur', () => updateFieldState(input));
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
      updateContext();
      requestAnimationFrame(() => event.target.closest('label')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }));
    }
  });

  const stepObserver = new MutationObserver(() => {
    if (!checkoutStep.hidden) {
      updateContext();
      form.querySelectorAll('input, textarea').forEach(updateFieldState);
    }
  });
  stepObserver.observe(checkoutStep, { attributes: true, attributeFilter: ['hidden'] });
  updateContext();
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

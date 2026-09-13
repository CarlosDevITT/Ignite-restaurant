import { getAccountProfile } from '../services/profile-service.js';

const formatAddress = (address) => [
  [address.street, address.number].filter(Boolean).join(', '),
  address.neighborhood,
  [address.city, address.state].filter(Boolean).join(' - '),
  address.complement,
  address.reference ? `Ref.: ${address.reference}` : '',
].filter(Boolean).join(' · ');

function ensureStyles() {
  if (document.querySelector('[data-ignite-checkout-address-book]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../styles/checkout-address-book.css?v=20260913-1', import.meta.url).href;
  link.setAttribute('data-ignite-checkout-address-book', 'true');
  document.head.appendChild(link);
}

export function initCheckoutAddressBook() {
  ensureStyles();
  const form = document.querySelector('#checkout-form');
  const checkout = document.querySelector('#checkout-step');
  const field = form?.querySelector('.checkout-address');
  const input = form?.elements?.address;
  if (!form || !checkout || !field || !input || field.dataset.addressBookReady === '1') return;
  field.dataset.addressBookReady = '1';

  const host = document.createElement('div');
  host.className = 'checkout-address-book';
  host.hidden = true;
  field.insertAdjacentElement('beforebegin', host);

  let addresses = [];
  let loaded = false;
  let loading = false;

  const selectAddress = (address) => {
    input.value = formatAddress(address);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    host.querySelectorAll('[data-checkout-address]').forEach((button) => {
      button.classList.toggle('is-selected', String(button.dataset.checkoutAddress) === String(address.id));
      button.setAttribute('aria-pressed', String(button.dataset.checkoutAddress) === String(address.id) ? 'true' : 'false');
    });
  };

  const render = () => {
    if (!addresses.length) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    host.innerHTML = `
      <div class="checkout-address-book__head">
        <div><strong>Endereços salvos</strong><small>Escolha onde deseja receber</small></div>
        <span><i class="fi fi-rr-shield-check"></i> Sua conta</span>
      </div>
      <div class="checkout-address-book__list" role="group" aria-label="Endereços salvos">
        ${addresses.map((address) => `<button type="button" class="checkout-address-card ${address.is_default ? 'is-default' : ''}" data-checkout-address="${address.id}" aria-pressed="false">
          <span class="checkout-address-card__icon"><i class="fi fi-rr-marker"></i></span>
          <span class="checkout-address-card__copy"><strong>${String(address.label || 'Endereço').replace(/[&<>"']/g, '')}</strong><small>${formatAddress(address).replace(/[&<>"']/g, '')}</small>${address.is_default ? '<em>Padrão</em>' : ''}</span>
          <i class="fi fi-rr-angle-small-right checkout-address-card__arrow"></i>
        </button>`).join('')}
        <button type="button" class="checkout-address-card checkout-address-card--manual" data-checkout-address-manual>
          <span class="checkout-address-card__icon"><i class="fi fi-rr-pencil"></i></span><span class="checkout-address-card__copy"><strong>Outro endereço</strong><small>Digitar endereço manualmente</small></span>
        </button>
      </div>`;
    host.querySelectorAll('[data-checkout-address]').forEach((button) => button.addEventListener('click', () => {
      const address = addresses.find((item) => String(item.id) === String(button.dataset.checkoutAddress));
      if (address) selectAddress(address);
    }));
    host.querySelector('[data-checkout-address-manual]')?.addEventListener('click', () => {
      host.querySelectorAll('[data-checkout-address]').forEach((button) => { button.classList.remove('is-selected'); button.setAttribute('aria-pressed', 'false'); });
      input.value = '';
      input.focus({ preventScroll: true });
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const loadAddresses = async () => {
    if (loaded || loading) return;
    loading = true;
    try {
      const { session, profile } = await getAccountProfile();
      addresses = session && Array.isArray(profile?.addresses) ? profile.addresses : [];
      addresses.sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)) || Number(a.id) - Number(b.id));
      loaded = true;
      render();
      const defaultAddress = addresses.find((address) => address.is_default) || addresses[0];
      if (defaultAddress && !String(input.value || '').trim()) selectAddress(defaultAddress);
    } catch (error) {
      console.warn('[Checkout] Endereços salvos indisponíveis:', error);
    } finally { loading = false; }
  };

  const syncVisibility = () => {
    const isDelivery = form.elements.order_type?.value === 'delivery';
    host.hidden = !isDelivery || !addresses.length;
    if (!checkout.hidden && isDelivery) void loadAddresses();
  };

  form.querySelectorAll('[name="order_type"]').forEach((radio) => radio.addEventListener('change', syncVisibility));
  const observer = new MutationObserver(() => {
    if (!checkout.hidden) {
      void loadAddresses();
      syncVisibility();
      // Core cart previously forced autofocus here; keep checkout calm on mobile.
      setTimeout(() => {
        if (document.activeElement === form.elements.customer_name) form.elements.customer_name.blur();
      }, 80);
    }
  });
  observer.observe(checkout, { attributes: true, attributeFilter: ['hidden'] });
  syncVisibility();
}

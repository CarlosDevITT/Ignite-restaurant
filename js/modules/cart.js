import { APP_CONFIG } from '../config.js';
import { placeOrder } from '../services/order-service.js';
import { getLocalProfile, saveProfile } from '../services/profile-service.js';
import { cartStore } from '../store/cart-store.js';
import { escapeHTML, money } from '../utils/format.js';

const ORDER_TYPES = {
  delivery: { label: 'Delivery', fee: () => APP_CONFIG.deliveryFee },
  pickup: { label: 'Retirada', fee: () => 0 },
  local: { label: 'Comer no local', fee: () => 0 },
};

const PAYMENT_LABELS = { pix: 'PIX', card: 'Cartão', cash: 'Dinheiro' };
const digits = (value) => String(value || '').replace(/\D/g, '');

const friendlyOrderError = (error) => {
  const rawMessage = String(error?.message || '');
  if (/integer|numero_pedido/i.test(rawMessage)) return 'Não foi possível gerar o número do pedido. Tente novamente.';
  if (/telefone inválido|dados de entrega|forma de pagamento|pedido está vazio|quantidade inválida|produto indisponível|aguarde alguns segundos|loja está fechada|tipo de pedido|número da mesa|atualização do checkout/i.test(rawMessage)) return rawMessage;
  if (/row-level security|permission denied|policy/i.test(rawMessage)) return 'O envio está temporariamente bloqueado no servidor. Seus itens continuam no carrinho.';
  return 'Verifique sua conexão e tente novamente em instantes.';
};

const whatsappUrl = ({ order, payload, items, subtotal, fee, total }) => {
  const itemLines = items.map((item) => `• ${item.quantity}x ${item.name} — ${money(item.price * item.quantity)}${item.notes ? ` (${item.notes})` : ''}`);
  const destination = payload.orderType === 'delivery'
    ? `📍 Entrega: ${payload.address}`
    : payload.orderType === 'local'
      ? `🍽️ Mesa: ${payload.tableNumber}`
      : '🛍️ Retirada no balcão';
  const message = [
    `Olá! Quero confirmar o pedido *${order.order_number || order.numero_pedido || order.id}* feito no Cardápio Ignite.`,
    '',
    `*Cliente:* ${payload.customerName}`,
    `*Modalidade:* ${ORDER_TYPES[payload.orderType].label}`,
    destination,
    `*Pagamento:* ${PAYMENT_LABELS[payload.paymentMethod]}`,
    '',
    '*Itens:*',
    ...itemLines,
    '',
    `Subtotal: ${money(subtotal)}`,
    fee > 0 ? `Taxa de entrega: ${money(fee)}` : 'Taxa: grátis',
    `*Total: ${money(total)}*`,
    payload.notes ? `Observações: ${payload.notes}` : '',
  ].filter(Boolean).join('\n');
  return `https://wa.me/${APP_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
};

export function initCart({ onViewOrders, onOrderPlaced }) {
  let returnFocus;
  const floatingCart = document.querySelector('#floating-cart');
  const drawer = document.querySelector('#cart-drawer');
  const backdrop = document.querySelector('#backdrop');
  const cartStep = document.querySelector('#cart-step');
  const checkoutStep = document.querySelector('#checkout-step');
  const itemsRoot = document.querySelector('#cart-items');
  const checkoutButton = document.querySelector('#checkout-button');
  const checkoutBack = document.querySelector('#checkout-back');
  const title = document.querySelector('#cart-title');
  const kicker = document.querySelector('#cart-kicker');
  const form = document.querySelector('#checkout-form');
  const submitButton = document.querySelector('#submit-order');
  const addressField = form.querySelector('.checkout-address');
  const tableField = form.querySelector('.checkout-table');
  const addressInput = form.elements.address;
  const tableInput = form.elements.table_number;

  const selectedOrderType = () => form.elements.order_type.value || 'delivery';
  const checkoutValues = () => {
    const type = selectedOrderType();
    const subtotal = cartStore.subtotal;
    const fee = ORDER_TYPES[type].fee();
    return { type, subtotal, fee, total: subtotal + fee };
  };

  const updateCheckoutSummary = () => {
    const { type, subtotal, fee, total } = checkoutValues();
    addressField.hidden = type !== 'delivery';
    tableField.hidden = type !== 'local';
    addressInput.required = type === 'delivery';
    tableInput.required = type === 'local';
    document.querySelector('#checkout-subtotal').textContent = money(subtotal);
    document.querySelector('#checkout-fee-label').textContent = type === 'delivery' ? 'Taxa de entrega' : type === 'pickup' ? 'Taxa de retirada' : 'Taxa de serviço';
    document.querySelector('#checkout-fee').textContent = fee ? money(fee) : 'Grátis';
    document.querySelector('#checkout-total').textContent = money(total);
    document.querySelector('#submit-order-total').textContent = money(total);
  };

  const showCart = () => {
    checkoutStep.hidden = true;
    cartStep.hidden = false;
    checkoutBack.hidden = true;
    kicker.textContent = 'Seu pedido';
    title.textContent = 'Carrinho';
  };

  const showCheckout = () => {
    if (!cartStore.items.length) return;
    const profile = getLocalProfile();
    form.elements.customer_name.value = profile.name || '';
    form.elements.phone.value = profile.phone || '';
    form.elements.address.value = profile.address || '';
    cartStep.hidden = true;
    checkoutStep.hidden = false;
    checkoutBack.hidden = false;
    kicker.textContent = 'Última etapa';
    title.textContent = 'Finalizar pedido';
    updateCheckoutSummary();
    checkoutStep.scrollTop = 0;
    setTimeout(() => form.elements.customer_name.focus(), 50);
  };

  const close = () => {
    floatingCart.setAttribute('aria-expanded', 'false');
    if (drawer.contains(document.activeElement)) (returnFocus || floatingCart).focus();
    drawer.inert = true;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    document.body.classList.remove('no-scroll');
    showCart();
  };

  const open = () => {
    returnFocus = document.activeElement;
    floatingCart.setAttribute('aria-expanded', 'true');
    showCart();
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.inert = false;
    backdrop.hidden = false;
    document.body.classList.add('no-scroll');
    document.querySelector('#close-cart').focus();
  };

  const render = () => {
    const { items, count, subtotal } = cartStore.snapshot();
    document.querySelector('#cart-count').textContent = count;
    document.querySelector('#floating-cart-count').textContent = count;
    document.querySelector('#floating-cart-total').textContent = money(subtotal);
    document.querySelector('#floating-cart-caption').textContent = count ? `${count} ${count === 1 ? 'item' : 'itens'} · subtotal` : 'Seu pedido começa aqui';
    floatingCart.setAttribute('aria-label', `Abrir carrinho, ${count} itens, subtotal ${money(subtotal)}`);
    document.querySelector('#cart-subtotal').textContent = money(subtotal);
    checkoutButton.disabled = !items.length;
    itemsRoot.innerHTML = items.length ? items.map((item) => `
      <article class="cart-item">
        <div class="cart-item__visual" aria-hidden="true">${escapeHTML(item.emoji)}</div>
        <div class="cart-item__details">
          <h3>${escapeHTML(item.name)}</h3>
          ${item.notes ? `<p title="${escapeHTML(item.notes)}">${escapeHTML(item.notes)}</p>` : '<p>Preparado especialmente para você</p>'}
          <span class="cart-item__price">${money(item.price * item.quantity)}</span>
        </div>
        <div class="cart-item__actions">
          <div class="quantity-control" aria-label="Quantidade de ${escapeHTML(item.name)}">
            <button type="button" data-cart-change="-1" data-key="${escapeHTML(item.key)}" aria-label="Remover uma unidade"><i class="fi fi-rr-minus" aria-hidden="true"></i></button>
            <span aria-live="polite">${item.quantity}</span>
            <button type="button" data-cart-change="1" data-key="${escapeHTML(item.key)}" aria-label="Adicionar uma unidade"><i class="fi fi-rr-plus" aria-hidden="true"></i></button>
          </div>
          <button class="cart-item__remove" type="button" data-cart-remove data-key="${escapeHTML(item.key)}">Remover</button>
        </div>
      </article>`).join('') : '<div class="empty-state"><span><i class="fi fi-rr-shopping-bag" aria-hidden="true"></i></span><h3>Seu carrinho está vazio</h3><p>Escolha algo delicioso no cardápio.</p></div>';
    updateCheckoutSummary();
    if (!items.length && !checkoutStep.hidden) showCart();
  };

  itemsRoot.addEventListener('click', (event) => {
    const changeButton = event.target.closest('[data-cart-change]');
    if (changeButton) cartStore.change(changeButton.dataset.key, Number(changeButton.dataset.cartChange));
    const removeButton = event.target.closest('[data-cart-remove]');
    if (removeButton) {
      const item = cartStore.items.find((entry) => entry.key === removeButton.dataset.key);
      if (item) cartStore.change(item.key, -item.quantity);
    }
  });

  document.querySelector('#open-cart').addEventListener('click', open);
  floatingCart.addEventListener('click', open);
  document.querySelector('#close-cart').addEventListener('click', close);
  checkoutButton.addEventListener('click', showCheckout);
  checkoutBack.addEventListener('click', () => { showCart(); checkoutButton.focus(); });
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) close();
    if (event.key === 'Tab' && drawer.classList.contains('is-open')) {
      const focusable = [...drawer.querySelectorAll('button, input, textarea, select, a[href], [tabindex="0"]')]
        .filter((element) => !element.disabled && element.getClientRects().length);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  [...form.elements.order_type].forEach((input) => input.addEventListener('change', updateCheckoutSummary));
  cartStore.addEventListener('change', render);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const phoneDigits = digits(form.elements.phone.value);
    form.elements.phone.setCustomValidity(phoneDigits.length >= 10 && phoneDigits.length <= 13 ? '' : 'Informe um WhatsApp válido com DDD.');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const snapshot = cartStore.snapshot();
    if (!snapshot.items.length) return showCart();
    const { type, subtotal, fee, total } = checkoutValues();
    const payload = {
      customerName: form.elements.customer_name.value.trim(),
      phone: form.elements.phone.value.trim(),
      address: type === 'delivery' ? form.elements.address.value.trim() : '',
      tableNumber: type === 'local' ? Number(form.elements.table_number.value) : null,
      orderType: type,
      paymentMethod: form.elements.payment_method.value,
      notes: form.elements.notes.value.trim(),
    };

    submitButton.disabled = true;
    submitButton.querySelector('span').textContent = 'Enviando pedido...';
    try {
      const currentProfile = getLocalProfile();
      await saveProfile({
        name: payload.customerName,
        phone: payload.phone,
        address: type === 'delivery' ? payload.address : currentProfile.address || '',
      }).catch(console.warn);

      const order = await placeOrder(payload, snapshot.items);
      cartStore.clear();
      close();

      const result = await Swal.fire({
        icon: 'success',
        title: 'Pedido recebido!',
        html: `<div class="order-success"><div class="order-success__number">${escapeHTML(order.order_number || order.numero_pedido || order.id)}</div><div class="order-success__meta"><div><span>Modalidade</span><strong>${ORDER_TYPES[type].label}</strong></div><div><span>Pagamento</span><strong>${PAYMENT_LABELS[payload.paymentMethod]}</strong></div><div><span>Total</span><strong>${money(Number(order.total) || total)}</strong></div></div><p>Seu pedido já foi enviado. Você também pode confirmá-lo diretamente com a Ignite.</p></div>`,
        confirmButtonText: '<i class="fi fi-rr-receipt"></i> Ver pedidos',
        denyButtonText: '<i class="fi fi-rr-comment"></i> Confirmar no WhatsApp',
        showDenyButton: true,
        allowOutsideClick: false,
      });

      if (result.isDenied) {
        const url = whatsappUrl({ order, payload, items: snapshot.items, subtotal, fee, total: Number(order.total) || total });
        const popup = window.open(url, '_blank');
        if (popup) popup.opener = null;
        if (!popup) window.location.href = url;
      } else if (result.isConfirmed) {
        onViewOrders?.(order);
      }

      onOrderPlaced?.(order);
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'Não foi possível enviar', text: friendlyOrderError(error), confirmButtonText: 'Entendi' });
    } finally {
      submitButton.disabled = false;
      submitButton.querySelector('span').textContent = 'Finalizar pedido';
      updateCheckoutSummary();
    }
  });

  render();
  return { open, close };
}

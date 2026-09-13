import { cartStore } from '../store/cart-store.js';
import { getPurchasePreferences, getReorderItems, setPreferredPayment, toggleProductFavorite } from '../services/purchase-preferences-service.js';
import { escapeHTML, money } from '../utils/format.js';

const PAYMENT = { pix: ['PIX','fi-rr-qrcode'], card: ['Cartão','fi-rr-credit-card'], cash: ['Dinheiro','fi-rr-money-bill-wave'] };
let state = { authenticated: false, preferred_payment: null, favorites: [] };
let loading = null;

function ensureStyles() {
  if (document.querySelector('[data-customer-preferences-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../styles/customer-preferences.css?v=20260913-1', import.meta.url).href;
  link.setAttribute('data-customer-preferences-style', 'true');
  document.head.appendChild(link);
}
function routeProfile() { document.querySelector('[data-route="profile"]')?.click(); }
function toast(title, icon='success') { if (window.Swal) Swal.fire({ toast:true, position:'top-end', icon, title, timer:1500, showConfirmButton:false }); }
async function load(force=false) {
  if (loading && !force) return loading;
  loading = getPurchasePreferences().then(data => (state=data)).catch(error => { console.warn('[Preferências]', error); return state; }).finally(() => { loading=null; });
  return loading;
}
const favoriteIds = () => new Set((state.favorites || []).map(item => String(item.id)));

function decorateProducts() {
  const ids = favoriteIds();
  document.querySelectorAll('[data-product-card]').forEach(card => {
    const id = String(card.getAttribute('data-product-card') || '');
    if (!id || card.querySelector('[data-product-favorite]')) return;
    const visual = card.querySelector('.product-card__visual');
    if (!visual) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `product-favorite${ids.has(id) ? ' is-active' : ''}`;
    button.setAttribute('data-product-favorite', id);
    button.setAttribute('aria-pressed', ids.has(id) ? 'true' : 'false');
    button.setAttribute('aria-label', ids.has(id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
    button.innerHTML = '<i class="fi fi-rr-heart"></i>';
    visual.insertAdjacentElement('afterend', button);
  });
  document.querySelectorAll('[data-product-favorite]').forEach(button => {
    const active = ids.has(String(button.dataset.productFavorite));
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function renderProfilePreferences() {
  const hub = document.querySelector('#view-profile .profile-hub');
  if (!hub || hub.querySelector('[data-profile-preferences]')) return;
  const stats = hub.querySelector('.profile-hub__stats');
  if (!stats) return;
  const favorites = state.favorites || [];
  const section = document.createElement('section');
  section.className = 'profile-section profile-section--preferences';
  section.setAttribute('data-profile-preferences','true');
  section.innerHTML = `<div class="profile-section__head"><div><strong>Preferências de compra</strong><small>Deixe seu próximo pedido mais rápido</small></div></div>
    <div class="purchase-preference-block"><span class="purchase-preference-label">Pagamento favorito</span><div class="payment-preference-options">${Object.entries(PAYMENT).map(([id,[label,icon]])=>`<button type="button" data-preferred-payment="${id}" class="${state.preferred_payment===id?'is-active':''}"><i class="fi ${icon}"></i><span>${label}</span>${state.preferred_payment===id?'<small>Padrão</small>':''}</button>`).join('')}</div></div>
    <div class="purchase-preference-block"><div class="purchase-preference-title"><span class="purchase-preference-label">Produtos favoritos</span><small>${favorites.length} ${favorites.length===1?'item':'itens'}</small></div>${favorites.length?`<div class="profile-favorites">${favorites.slice(0,8).map(product=>`<article><div class="profile-favorite__visual">${product.image_url?`<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}">`:'<i class="fi fi-rr-utensils"></i>'}</div><div><strong>${escapeHTML(product.name)}</strong><small>${money(product.price)}</small></div><button type="button" data-favorite-add-cart="${product.id}" ${product.available===false?'disabled':''}><i class="fi fi-rr-shopping-cart-add"></i></button></article>`).join('')}</div>`:'<div class="preference-empty"><i class="fi fi-rr-heart"></i><span>Toque no coração dos produtos que você mais gosta.</span></div>'}</div>`;
  stats.insertAdjacentElement('afterend', section);
}

function decorateReorders() {
  document.querySelectorAll('#view-profile .profile-order').forEach(order => {
    if (order.querySelector('[data-repeat-order]')) return;
    const text = order.querySelector('.profile-order__copy strong')?.textContent || '';
    const match = text.match(/#(\d+)/);
    if (!match) return;
    const button = document.createElement('button');
    button.type='button'; button.className='profile-order__repeat'; button.setAttribute('data-repeat-order', match[1]);
    button.innerHTML='<i class="fi fi-rr-refresh"></i><span>Repetir</span>';
    order.appendChild(button);
  });
}

function applyCheckoutPayment() {
  if (!state.authenticated || !state.preferred_payment) return;
  const form = document.querySelector('#checkout-form');
  const target = form?.querySelector(`[name="payment_method"][value="${state.preferred_payment}"]`);
  if (target && !form.dataset.paymentPreferenceApplied) {
    target.checked = true;
    target.dispatchEvent(new Event('change',{bubbles:true}));
    form.dataset.paymentPreferenceApplied='1';
  }
}

async function refreshUI(force=false) {
  await load(force);
  decorateProducts(); renderProfilePreferences(); decorateReorders(); applyCheckoutPayment();
}

export function initCustomerPreferences() {
  ensureStyles();
  void refreshUI();
  const observer = new MutationObserver(() => { decorateProducts(); renderProfilePreferences(); decorateReorders(); applyCheckoutPayment(); });
  observer.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('click', async event => {
    const favoriteButton = event.target.closest('[data-product-favorite]');
    if (favoriteButton) {
      event.preventDefault(); event.stopPropagation();
      if (!state.authenticated) { toast('Entre na sua conta para salvar favoritos','info'); routeProfile(); return; }
      favoriteButton.disabled=true;
      try { await toggleProductFavorite(favoriteButton.dataset.productFavorite); await refreshUI(true); toast('Favoritos atualizados'); }
      catch(error){ console.warn('[Favoritos]',error); toast('Não foi possível atualizar','error'); }
      finally{ favoriteButton.disabled=false; }
      return;
    }

    const payment = event.target.closest('[data-preferred-payment]');
    if (payment) {
      try { await setPreferredPayment(payment.dataset.preferredPayment); state.preferred_payment=payment.dataset.preferredPayment; document.querySelector('[data-profile-preferences]')?.remove(); renderProfilePreferences(); applyCheckoutPayment(); toast('Pagamento favorito salvo'); }
      catch(error){ toast('Não foi possível salvar','error'); }
      return;
    }

    const addFavorite = event.target.closest('[data-favorite-add-cart]');
    if (addFavorite) {
      const product=(state.favorites||[]).find(item=>String(item.id)===String(addFavorite.dataset.favoriteAddCart));
      if (!product || product.available===false) return;
      cartStore.add(product,1); toast(`${product.name} adicionado ao carrinho`);
      return;
    }

    const repeat = event.target.closest('[data-repeat-order]');
    if (repeat) {
      repeat.disabled=true;
      try {
        const data=await getReorderItems(repeat.dataset.repeatOrder);
        const available=(data.items||[]).filter(item=>item?.id && item.available!==false);
        if (!available.length) { await Swal.fire({icon:'info',title:'Itens indisponíveis',text:'Os produtos deste pedido não estão disponíveis no momento.'}); return; }
        available.forEach(item=>cartStore.add(item,Math.max(1,Number(item.quantity||1))));
        const skipped=Number(data.unavailable_count||0);
        await Swal.fire({icon:skipped?'warning':'success',title:'Pedido adicionado ao carrinho',text:skipped?`${skipped} item(ns) indisponível(is) não foram adicionados.`:'Os itens disponíveis foram adicionados com os preços atuais.',confirmButtonText:'Ver carrinho'});
        document.querySelector('#floating-cart')?.click();
      } catch(error){ console.warn('[Repetir pedido]',error); toast('Não foi possível repetir o pedido','error'); }
      finally{ repeat.disabled=false; }
      return;
    }
  }, true);

  document.querySelector('#checkout-form')?.addEventListener('change', event => {
    if (!event.target.matches('[name="payment_method"]') || !state.authenticated) return;
    const value=event.target.value;
    if (value===state.preferred_payment) return;
    void setPreferredPayment(value).then(()=>{state.preferred_payment=value;}).catch(error=>console.warn('[Checkout] Preferência de pagamento:',error));
  });
  window.addEventListener('focus',()=>void refreshUI(true));
}

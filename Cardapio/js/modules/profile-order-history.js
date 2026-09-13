import { cartStore } from '../store/cart-store.js';
import { getReorderItems } from '../services/purchase-preferences-service.js';
import { getMyOrderDetail, getMyOrderHistory } from '../services/profile-order-history-service.js';
import { escapeHTML, money } from '../utils/format.js';

const STATUS = {
  pending: 'Pedido recebido', confirmed: 'Confirmado', preparing: 'Em preparação', ready: 'Pronto',
  out_for_delivery: 'Saiu para entrega', delivered: 'Entregue', cancelled: 'Cancelado',
};
const ORDER_TYPE = { delivery: 'Delivery', pickup: 'Retirada', local: 'No local' };
const PAYMENT = { pix: 'PIX', card: 'Cartão', cash: 'Dinheiro' };
const activeStatuses = new Set(['pending','confirmed','preparing','ready','out_for_delivery']);
const dateTime = value => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d).replace('.','');
};

function ensureStyles() {
  if (document.querySelector('[data-profile-order-history-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../styles/profile-order-history.css?v=20260913-1', import.meta.url).href;
  link.setAttribute('data-profile-order-history-style','true');
  document.head.appendChild(link);
}
function toast(title, icon='success') { window.Swal?.fire({toast:true,position:'top-end',icon,title,timer:1600,showConfirmButton:false}); }
function openOrdersRoute() { document.querySelector('[data-route="orders"]')?.click(); }

export function initProfileOrderHistory() {
  ensureStyles();
  let page = { orders: [], total: 0, offset: 0, limit: 20 };
  let loading = false;
  let sheet;

  const ensureSheet = () => {
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.className = 'profile-history-sheet';
    sheet.setAttribute('aria-hidden','true');
    sheet.innerHTML = `<section class="profile-history-panel" role="dialog" aria-modal="true" aria-label="Histórico de pedidos">
      <div class="profile-history-handle"></div>
      <header class="profile-history-head"><div><strong>Histórico de pedidos</strong><small>Compras vinculadas à sua conta Ignite</small></div><button type="button" class="profile-history-close" aria-label="Fechar"><i class="fi fi-rr-cross-small"></i></button></header>
      <div class="profile-history-body" data-history-body></div>
    </section>`;
    document.body.appendChild(sheet);
    const close = () => { sheet.classList.remove('is-open'); sheet.setAttribute('aria-hidden','true'); document.body.style.overflow=''; };
    sheet.addEventListener('click', event => { if (event.target===sheet || event.target.closest('.profile-history-close')) close(); });
    document.addEventListener('keydown', event => { if (event.key==='Escape' && sheet.classList.contains('is-open')) close(); });
    return sheet;
  };

  const decorateProfile = () => {
    const ordersSection = document.querySelector('#view-profile .profile-section--orders');
    if (!ordersSection || ordersSection.querySelector('[data-open-order-history]')) return;
    const button = document.createElement('button');
    button.type='button'; button.className='profile-history-trigger'; button.setAttribute('data-open-order-history','true');
    button.innerHTML='<span><i class="fi fi-rr-time-past"></i> Ver histórico completo</span><i class="fi fi-rr-angle-small-right"></i>';
    ordersSection.appendChild(button);
  };

  const renderOrders = () => {
    const body = ensureSheet().querySelector('[data-history-body]');
    if (!page.orders.length) {
      body.innerHTML='<div class="profile-history-state"><i class="fi fi-rr-receipt"></i><strong>Nenhum pedido encontrado</strong><small>Seus pedidos vinculados à conta aparecerão aqui.</small></div>';
      return;
    }
    body.innerHTML = page.orders.map(order => `<article class="profile-history-card" data-history-order="${order.id}">
      <button type="button" class="profile-history-card__main" data-history-detail="${order.id}" aria-expanded="false">
        <span class="profile-history-card__icon"><i class="fi fi-rr-receipt"></i></span>
        <span class="profile-history-card__copy"><strong>Pedido #${escapeHTML(order.number || order.id)}</strong><small>${escapeHTML(dateTime(order.created_at))} · ${Number(order.items_count||0)} item(ns)</small><em class="profile-history-status" data-status="${escapeHTML(order.status||'')}">${escapeHTML(STATUS[order.status]||order.status||'Pedido')}</em></span>
        <span class="profile-history-card__value">${money(order.total)}</span>
      </button>
      <div class="profile-history-detail" data-history-detail-host hidden></div>
    </article>`).join('') + (page.orders.length < page.total ? '<button type="button" class="profile-history-load" data-history-more>Carregar mais pedidos</button>' : '');
  };

  const openHistory = async () => {
    const target = ensureSheet();
    target.classList.add('is-open'); target.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
    const body = target.querySelector('[data-history-body]');
    body.innerHTML='<div class="profile-history-state"><i class="fi fi-rr-spinner"></i><strong>Carregando pedidos</strong></div>';
    loading=true;
    try { page = await getMyOrderHistory(20,0); renderOrders(); }
    catch(error){ console.warn('[Perfil/Histórico]',error); body.innerHTML='<div class="profile-history-state"><i class="fi fi-rr-wifi-exclamation"></i><strong>Não foi possível carregar</strong><small>Tente novamente em instantes.</small></div>'; }
    finally { loading=false; }
  };

  const renderDetail = (host, detail) => {
    const items = Array.isArray(detail?.items) ? detail.items : [];
    host.innerHTML = `<div class="profile-history-items">${items.length ? items.map(item => {
      const name = item.name || item.product_name || 'Produto';
      const qty = Number(item.quantity || item.qtd || 1);
      const total = Number(item.total ?? item.total_price ?? item.subtotal ?? ((item.unit_price || item.price || 0) * qty));
      return `<div class="profile-history-item"><span><strong>${qty}x</strong> ${escapeHTML(name)}</span><strong>${money(total)}</strong></div>`;
    }).join('') : '<div class="profile-history-state"><small>Itens do pedido não disponíveis.</small></div>'}</div>
      <div class="profile-history-meta">
        <div><span>Modalidade</span><strong>${escapeHTML(ORDER_TYPE[detail.order_type]||detail.order_type||'—')}</strong></div>
        <div><span>Pagamento</span><strong>${escapeHTML(PAYMENT[detail.payment_method]||detail.payment_method||'—')}</strong></div>
        ${detail.address ? `<div><span>Entrega</span><strong>${escapeHTML(detail.address)}</strong></div>` : ''}
        ${detail.table_number ? `<div><span>Mesa</span><strong>${escapeHTML(detail.table_number)}</strong></div>` : ''}
        <div><span>Taxa</span><strong>${money(detail.delivery_fee||0)}</strong></div>
        <div><span>Total</span><strong>${money(detail.total)}</strong></div>
      </div>
      ${detail.notes ? `<div class="profile-history-meta"><div style="grid-column:1/-1"><span>Observações</span><strong>${escapeHTML(detail.notes)}</strong></div></div>` : ''}
      <div class="profile-history-actions"><button type="button" class="is-primary" data-history-repeat="${detail.id}"><i class="fi fi-rr-refresh"></i> Repetir pedido</button>${activeStatuses.has(detail.status)?'<button type="button" class="is-secondary" data-history-track><i class="fi fi-rr-location-alt"></i> Acompanhar</button>':'<button type="button" class="is-secondary" data-history-close-detail>Fechar detalhes</button>'}</div>`;
  };

  document.addEventListener('click', async event => {
    if (event.target.closest('[data-open-order-history]')) { void openHistory(); return; }
    if (!sheet?.classList.contains('is-open')) return;

    const more = event.target.closest('[data-history-more]');
    if (more && !loading) {
      more.disabled=true; loading=true;
      try { const next=await getMyOrderHistory(page.limit,page.orders.length); page={...next,orders:[...page.orders,...(next.orders||[])]}; renderOrders(); }
      catch(error){ toast('Não foi possível carregar mais pedidos','error'); }
      finally{ loading=false; }
      return;
    }

    const detailButton = event.target.closest('[data-history-detail]');
    if (detailButton) {
      const card=detailButton.closest('[data-history-order]'), host=card?.querySelector('[data-history-detail-host]');
      if (!host) return;
      if (!host.hidden) { host.hidden=true; detailButton.setAttribute('aria-expanded','false'); return; }
      host.hidden=false; detailButton.setAttribute('aria-expanded','true'); host.innerHTML='<div class="profile-history-state"><i class="fi fi-rr-spinner"></i><small>Carregando detalhes...</small></div>';
      try { renderDetail(host,await getMyOrderDetail(detailButton.dataset.historyDetail)); }
      catch(error){ host.innerHTML='<div class="profile-history-state"><small>Não foi possível carregar os detalhes.</small></div>'; }
      return;
    }

    const repeat = event.target.closest('[data-history-repeat]');
    if (repeat) {
      repeat.disabled=true;
      try {
        const data=await getReorderItems(repeat.dataset.historyRepeat);
        const available=(data.items||[]).filter(item=>item?.id && item.available!==false);
        if (!available.length) { await Swal.fire({icon:'info',title:'Itens indisponíveis',text:'Os produtos deste pedido não estão disponíveis no momento.'}); return; }
        available.forEach(item=>cartStore.add(item,Math.max(1,Number(item.quantity||1))));
        const skipped=Number(data.unavailable_count||0);
        await Swal.fire({icon:skipped?'warning':'success',title:'Itens adicionados ao carrinho',text:skipped?`${skipped} item(ns) indisponível(is) foram ignorados.`:'Usamos disponibilidade e preços atuais.',confirmButtonText:'Ver carrinho'});
        sheet.classList.remove('is-open'); sheet.setAttribute('aria-hidden','true'); document.body.style.overflow=''; document.querySelector('#floating-cart')?.click();
      } catch(error){ console.warn('[Perfil/Repetir]',error); toast('Não foi possível repetir o pedido','error'); }
      finally{ repeat.disabled=false; }
      return;
    }
    if (event.target.closest('[data-history-track]')) { sheet.classList.remove('is-open'); document.body.style.overflow=''; openOrdersRoute(); return; }
    const closeDetail=event.target.closest('[data-history-close-detail]');
    if (closeDetail) { const host=closeDetail.closest('[data-history-detail-host]'); if(host) host.hidden=true; }
  });

  const observer = new MutationObserver(decorateProfile);
  observer.observe(document.body,{childList:true,subtree:true});
  decorateProfile();
}

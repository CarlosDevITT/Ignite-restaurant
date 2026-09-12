import { getOrders, subscribeToOrders, subscribeToOrder } from '../services/order-service.js';
import { escapeHTML, money, shortDate } from '../utils/format.js';

const STATUS = {
  pending: ['Pedido recebido', 1],
  confirmed: ['Pedido confirmado', 2],
  preparing: ['Em preparação', 3],
  ready: ['Pronto', 4],
  out_for_delivery: ['Saiu para entrega', 5],
  delivered: ['Entregue', 6],
  cancelled: ['Cancelado', 0],
};

const ORDER_TYPE = {
  delivery: ['Delivery', 'Entrega no endereço'],
  pickup: ['Retirada', 'Retirada no balcão'],
  retirada: ['Retirada', 'Retirada no balcão'],
  local: ['No local', 'Atendimento na mesa'],
  mesa: ['No local', 'Atendimento na mesa'],
  balcao: ['Balcão', 'Retirada no balcão'],
};

const PROGRESS_LABELS = {
  delivery: ['Recebido', 'Confirmado', 'Em preparação', 'Pronto', 'Saiu para entrega', 'Entregue'],
  pickup: ['Recebido', 'Confirmado', 'Em preparação', 'Pronto', 'Entregue'],
  retirada: ['Recebido', 'Confirmado', 'Em preparação', 'Pronto', 'Entregue'],
  local: ['Recebido', 'Confirmado', 'Em preparação', 'Pronto', 'Entregue'],
  mesa: ['Recebido', 'Confirmado', 'Em preparação', 'Pronto', 'Entregue'],
  balcao: ['Recebido', 'Confirmado', 'Em preparação', 'Pronto', 'Entregue'],
};

const statusProgress = (status, typeKey) => {
  if (status === 'cancelled') return 0;
  if (typeKey === 'delivery') return STATUS[status]?.[1] || 1;
  const localProgress = { pending: 1, confirmed: 2, preparing: 3, ready: 4, out_for_delivery: 4, delivered: 5 };
  return localProgress[status] || 1;
};

export const WAITING_STATUSES = new Set(['pending', 'confirmed', 'preparing']);
export const isWaitingStatus = status => WAITING_STATUSES.has(status);

export function initOrders({ onPlayRequested } = {}) {
  const root = document.querySelector('#order-list');
  let unsubscribe = () => {};
  let lastOrders = [];
  let destroyed = false;
  let requestVersion = 0;
  let revision = 0;
  const watchers = new Map();
  const realtimeChannels = new Map();
  const orderKey = order => String(order.id ?? '');

  const notifyWatchers = orders => orders.forEach(order => watchers.get(orderKey(order))?.forEach(callback => {
    try { callback(order.status, order); }
    catch (error) { console.warn(error); }
  }));

  const render = orders => {
    lastOrders = orders;
    syncChannels(orders);
    if (!orders.length) {
      root.innerHTML = '<div class="empty-state"><span>🧾</span><h3>Nenhum pedido ainda</h3><p>Quando você pedir, o acompanhamento aparecerá aqui.</p></div>';
      notifyWatchers(orders);
      return;
    }

    root.innerHTML = orders.map(order => {
      const label = STATUS[order.status]?.[0] || order.status;
      const items = (order.order_items || []).map(item => `${item.quantity}× ${escapeHTML(item.product_name || item.name || 'Produto')}`).join(' · ');
      const raw = order.order_number || order.numero_pedido || order.id;
      const number = order.order_number || (typeof raw === 'number' ? `IG${String(raw).padStart(6, '0')}` : raw);
      const typeKey = order.order_type || order.service_type || order.tipo || 'delivery';
      const [typeLabel, typeDetail] = ORDER_TYPE[typeKey] || [typeKey, 'Pedido Ignite'];
      const destination = ['local', 'mesa'].includes(typeKey) && order.table_number ? `${typeDetail} ${order.table_number}` : typeDetail;
      const steps = PROGRESS_LABELS[typeKey] || PROGRESS_LABELS.pickup;
      const progress = statusProgress(order.status, typeKey);
      const progressHTML = steps.map((step, index) => `<span class="${progress >= index + 1 ? 'is-done' : ''}">${escapeHTML(step)}</span>`).join('');
      const card = `<article class="order-card">
        <div class="order-card__top"><div><div class="order-card__number">Pedido ${escapeHTML(number)}</div><div class="order-card__date">${shortDate(order.created_at || order.criado_em)}</div></div><span class="status-pill" data-status="${escapeHTML(order.status)}">${escapeHTML(label)}</span></div>
        <div class="order-card__service"><strong>${escapeHTML(typeLabel)}</strong><span>${escapeHTML(destination)}</span></div>
        <p class="order-card__items">${items || 'Itens do pedido'}</p>
        <div class="order-card__footer"><span>Total</span><strong>${money(order.total)}</strong></div>
        ${order.status !== 'cancelled' ? `<div class="order-progress">${progressHTML}</div>` : ''}
      </article>`;
      const play = order.id != null && !order.offline && isWaitingStatus(order.status)
        ? `<button type="button" class="order-play-cta" data-order-key="${escapeHTML(orderKey(order))}"><span class="order-play-cta__icon"><i class="fi fi-rr-game-console-crank-handheld"></i></span><span class="order-play-cta__copy"><strong>Jogue enquanto espera</strong><small>Divirta-se enquanto preparamos seu pedido</small></span><span class="order-play-cta__arrow">&rsaquo;</span></button>`
        : '';
      return card + play;
    }).join('');
    notifyWatchers(orders);
  };

  const syncChannels = orders => {
    const ids = new Set(orders.filter(order => order.id != null && !order.offline).map(orderKey));
    realtimeChannels.forEach((entry, id) => {
      if (!ids.has(id)) {
        entry.cancelled = true;
        entry.cleanup?.();
        realtimeChannels.delete(id);
      }
    });

    orders.forEach(order => {
      if (order.offline || order.id == null) return;
      const id = orderKey(order);
      if (realtimeChannels.has(id)) return;
      const entry = { cancelled: false, cleanup: null };
      realtimeChannels.set(id, entry);
      subscribeToOrder(order.id, {
        onChange: payload => {
          if (destroyed || entry.cancelled) return;
          revision++;
          if (payload.eventType === 'DELETE') render(lastOrders.filter(item => orderKey(item) !== id));
          else render(lastOrders.map(item => orderKey(item) === id ? { ...item, ...payload.new } : item));
        },
        onError: error => console.warn('[Pedidos] Acompanhamento:', error),
      }).then(cleanup => {
        if (destroyed || entry.cancelled) cleanup();
        else entry.cleanup = cleanup;
      }).catch(error => console.warn('[Pedidos] Realtime:', error));
    });
  };

  const watchOrder = (orderId, callback) => {
    if (orderId == null) throw new Error('orders.id obrigatório.');
    const id = String(orderId);
    if (!watchers.has(id)) watchers.set(id, new Set());
    watchers.get(id).add(callback);
    const order = lastOrders.find(item => orderKey(item) === id);
    if (order) callback(order.status, order);
    return () => {
      watchers.get(id)?.delete(callback);
      if (!watchers.get(id)?.size) watchers.delete(id);
    };
  };

  const load = async () => {
    const request = ++requestVersion;
    const version = revision;
    try {
      const orders = await getOrders();
      if (destroyed || request !== requestVersion || version !== revision) return;
      render(orders);
    } catch (error) {
      console.error('[Pedidos] Falha ao carregar pedidos do cliente.', error);
      if (!destroyed && request === requestVersion && !lastOrders.length) {
        root.innerHTML = '<div class="empty-state"><h3>Não foi possível atualizar seus pedidos</h3><p>Verifique sua conexão e tente novamente.</p><button class="button" type="button" data-orders-retry>Tentar novamente</button></div>';
      }
    }
  };

  const onClick = event => {
    const retry = event.target.closest('[data-orders-retry]');
    if (retry) { void load(); return; }
    const cta = event.target.closest('.order-play-cta');
    if (!cta) return;
    const order = lastOrders.find(item => orderKey(item) === cta.dataset.orderKey);
    if (order) onPlayRequested?.(order);
  };

  root.addEventListener('click', onClick);
  const refresh = document.querySelector('#refresh-orders');
  refresh?.addEventListener('click', load);
  subscribeToOrders(load).then(cleanup => {
    if (destroyed) cleanup();
    else unsubscribe = cleanup;
  }).catch(console.warn);
  void load();

  return {
    load,
    watchOrder,
    destroy: () => {
      destroyed = true;
      requestVersion++;
      unsubscribe();
      root.removeEventListener('click', onClick);
      refresh?.removeEventListener('click', load);
      watchers.clear();
      realtimeChannels.forEach(entry => { entry.cancelled = true; entry.cleanup?.(); });
      realtimeChannels.clear();
    },
  };
}

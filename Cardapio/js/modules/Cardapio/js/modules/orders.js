import { getOrders, subscribeToOrders, subscribeToOrder } from '../services/order-service.js';
import { escapeHTML, money, shortDate } from '../utils/format.js';

const STATUS = {
  pending: ['Pedido recebido', 1], confirmed: ['Pedido confirmado', 2],
  preparing: ['Em preparação', 3], ready: ['Pronto', 4],
  out_for_delivery: ['Saiu para entrega', 5], delivered: ['Entregue', 6],
  cancelled: ['Cancelado', 0],
};

const ORDER_TYPE = {
  delivery: ['Delivery', 'Entrega no endereço'],
  pickup: ['Retirada', 'Retirada no balcão'],
  retirada: ['Retirada', 'Retirada no balcão'],
  local: ['No local', 'Atendimento na mesa'],
};

const PROGRESS_LABELS = { delivery: ['Recebido', 'Confirmado', 'Em preparação', 'Pronto', 'Saiu para entrega', 'Entregue'] };
export const WAITING_STATUSES = new Set(['pending', 'confirmed', 'preparing']);
export const isWaitingStatus = status => WAITING_STATUSES.has(status);

export function initOrders({ onPlayRequested } = {}) {
  const root = document.querySelector('#order-list');
  let unsubscribe = () => {};
  let lastOrders = [];
  let destroyed = false, requestVersion = 0, revision = 0;
  const watchers = new Map();
  const realtimeChannels = new Map(); // orderId(string) -> { cleanup, refCount, cancelled }

  const orderKey = (order) => String(order.id ?? '');

  const notifyWatchers = (orders) => {
    if (!watchers.size) return;
    orders.forEach((order) => {
      const id = orderKey(order);
      const callbacks = watchers.get(id);
      if (!callbacks || !callbacks.size) return;
      const normalizedStatus = order.status;
      callbacks.forEach((callback) => { try { callback(normalizedStatus, order); } catch (error) { console.warn(error); } });
    });
  };

  const syncChannels = orders => {
    const ids = new Set(orders.filter(o => o.id != null && !o.offline).map(orderKey));
    realtimeChannels.forEach((entry, id) => {
      if (!ids.has(id)) { entry.cancelled = true; entry.cleanup?.(); realtimeChannels.delete(id); }
    });
    orders.forEach(order => {
      if (order.offline) return;
      if (order.id == null) { console.error('Pedido remoto sem orders.id', order); return; }
      const id = orderKey(order);
      if (realtimeChannels.has(id)) return;
      const entry = { cancelled: false, cleanup: null };
      realtimeChannels.set(id, entry);
      subscribeToOrder(order.id, { onChange: payload => {
        if (destroyed || entry.cancelled) return;
        revision++;
        if (payload.eventType === 'DELETE') {
          watchers.get(id)?.forEach(callback => callback('cancelled', { id: order.id, unavailable: true }));
          render(lastOrders.filter(o => orderKey(o) !== id));
        } else {
          render(lastOrders.map(o => orderKey(o) === id ? { ...o, ...payload.new } : o));
        }
      }}).then(cleanup => {
        if (destroyed || entry.cancelled) cleanup(); else entry.cleanup = cleanup;
      }).catch(console.warn);
    });
  };

  const watchOrder = (orderId, callback) => {
    if (orderId == null) throw new Error('orders.id obrigatório.');
    const id = String(orderId);
    if (!watchers.has(id)) watchers.set(id, new Set());
    watchers.get(id).add(callback);
    const order = lastOrders.find(o => orderKey(o) === id);
    if (order) callback(order.status, order);
    return () => {
      watchers.get(id)?.delete(callback);
      if (!watchers.get(id)?.size) watchers.delete(id);
    };
  };

  const render = (orders) => {
    lastOrders = orders;
    syncChannels(orders);
    if (!orders.length) { root.innerHTML = '<div class="empty-state"><span>🧾</span><h3>Nenhum pedido ainda</h3><p>Quando você pedir, o acompanhamento aparecerá aqui.</p></div>'; notifyWatchers(orders); return; }
    root.innerHTML = orders.map((order) => {
      const normalizedStatus = order.status;
      const [label, progress] = STATUS[normalizedStatus] || [order.status, 1];
      const items = (order.order_items || []).map((item) => `${item.quantity}× ${escapeHTML(item.product_name || item.name || 'Produto')}`).join(' · ');
      const rawNumber = order.order_number || order.numero_pedido || order.id;
      const displayNumber = order.order_number || (typeof rawNumber === 'number' ? `IG${String(rawNumber).padStart(6, '0')}` : rawNumber);
      const typeKey = order.order_type || order.service_type || order.tipo || 'delivery';
      const [typeLabel, typeDetail] = ORDER_TYPE[typeKey] || [typeKey, 'Pedido Ignite'];
      const destination = typeKey === 'local' && order.table_number ? `${typeDetail} ${order.table_number}` : typeDetail;
      const progressLabels = PROGRESS_LABELS[typeKey] || PROGRESS_LABELS.delivery;
      const progressHTML = progressLabels.map((step, index) => `<span class="${progress >= index + 1 ? 'is-done' : ''}">${escapeHTML(step)}</span>`).join('');
      const card = `<article class="order-card"><div class="order-card__top"><div><div class="order-card__number">Pedido ${escapeHTML(displayNumber)}</div><div class="order-card__date">${shortDate(order.created_at || order.criado_em)}</div></div><span class="status-pill" data-status="${escapeHTML(normalizedStatus)}">${escapeHTML(label)}</span></div><div class="order-card__service"><strong>${escapeHTML(typeLabel)}</strong><span>${escapeHTML(destination)}</span></div><p class="order-card__items">${items || 'Itens do pedido'}</p><div class="order-card__footer"><span>Total</span><strong>${money(order.total)}</strong></div>${normalizedStatus !== 'cancelled' ? `<div class="order-progress">${progressHTML}</div>` : ''}</article>`;
      const playCta = order.id != null && !order.offline && isWaitingStatus(normalizedStatus) ? `<button type="button" class="order-play-cta" data-order-key="${escapeHTML(orderKey(order))}" aria-label="Jogue enquanto espera o pedido ${escapeHTML(displayNumber)}"><span class="order-play-cta__icon"><i class="fi fi-rr-game-console-crank-handheld" aria-hidden="true"></i></span><span class="order-play-cta__copy"><strong>Jogue enquanto espera</strong><small>Divirta-se enquanto preparamos seu pedido</small></span><span class="order-play-cta__arrow" aria-hidden="true">&rsaquo;</span></button>` : '';
      return card + playCta;
    }).join('');
    notifyWatchers(orders);
  };

  const load = async () => {
    const request = ++requestVersion, version = revision;
    try {
      const orders = await getOrders();
      if (destroyed || request !== requestVersion) return;
      if (version !== revision) return; // Realtime wins over earlier HTTP.
      const visible = new Set(orders.map(orderKey));
      lastOrders.filter(o => !visible.has(orderKey(o))).forEach(o =>
        watchers.get(orderKey(o))?.forEach(callback => callback('cancelled', { ...o, unavailable: true })));
      render(orders);
    } catch (error) {
      if (!destroyed && request === requestVersion && !lastOrders.length)
        root.innerHTML = `<div class="empty-state"><h3>Não foi possível carregar</h3><p>${escapeHTML(error.message)}</p></div>`;
    }
  };

  const onClick = (event) => {
    const cta = event.target.closest('.order-play-cta');
    if (!cta) return;
    const key = cta.dataset.orderKey;
    const order = lastOrders.find((candidate) => orderKey(candidate) === key);
    if (order) onPlayRequested?.(order);
  };
  root.addEventListener('click', onClick);

  document.querySelector('#refresh-orders').addEventListener('click', load);
  subscribeToOrders(load).then((cleanup) => { if (destroyed) cleanup(); else unsubscribe = cleanup; }).catch(console.warn);
  void load();
  return {
    load,
    watchOrder,
    destroy: () => {
      destroyed = true; requestVersion++;
      unsubscribe();
      root.removeEventListener('click', onClick);
      document.querySelector('#refresh-orders').removeEventListener('click', load);
      watchers.clear();
      realtimeChannels.forEach((entry) => { entry.cancelled = true; entry.cleanup?.(); });
      realtimeChannels.clear();
    },
  };
}

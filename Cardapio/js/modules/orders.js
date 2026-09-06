import { getOrders, subscribeToOrders, subscribeToOrder } from '../services/order-service.js';
import { escapeHTML, money, shortDate } from '../utils/format.js';

const STATUS = {
  received: ['Recebido', 1], preparing: ['Em preparo', 2], ready: ['Pronto', 3], delivering: ['Saiu para entrega', 3], delivered: ['Entregue', 4], cancelled: ['Cancelado', 0],
};

const ORDER_TYPE = {
  delivery: ['Delivery', 'Entrega no endereço'],
  pickup: ['Retirada', 'Retirada no balcão'],
  retirada: ['Retirada', 'Retirada no balcão'],
  local: ['No local', 'Atendimento na mesa'],
};

const PROGRESS_LABELS = {
  delivery: ['Recebido', 'Preparo', 'A caminho', 'Entregue'],
  pickup: ['Recebido', 'Preparo', 'Pronto', 'Retirado'],
  retirada: ['Recebido', 'Preparo', 'Pronto', 'Retirado'],
  local: ['Recebido', 'Preparo', 'Servindo', 'Finalizado'],
};

// Status que ainda representam "aguardando" (tela de espera / Ignite Play).
// Usa os mesmos nomes de status já existentes em STATUS acima — nada inventado.
export const WAITING_STATUSES = new Set(['received', 'preparing']);
export const isWaitingStatus = (status) => WAITING_STATUSES.has(status === 'pending' ? 'received' : status);

export function initOrders({ onPlayRequested } = {}) {
  const root = document.querySelector('#order-list');
  let unsubscribe = () => {};
  let lastOrders = [];
  const watchers = new Map();
  const realtimeChannels = new Map(); // orderId(string) -> { cleanup, refCount, cancelled }

  const orderKey = (order) => String(order.id ?? order.order_number ?? order.numero_pedido ?? '');

  const notifyWatchers = (orders) => {
    if (!watchers.size) return;
    orders.forEach((order) => {
      const id = orderKey(order);
      const callbacks = watchers.get(id);
      if (!callbacks || !callbacks.size) return;
      const normalizedStatus = order.status === 'pending' ? 'received' : order.status;
      callbacks.forEach((callback) => { try { callback(normalizedStatus, order); } catch (error) { console.warn(error); } });
    });
  };

  // Registra um callback chamado sempre que este pedido aparecer numa atualização
  // da lista (recarregada pelo botão de atualizar, pela navegação até "Pedidos" ou
  // pela subscription Realtime já existente) E abre/reaproveita um canal Realtime
  // dedicado a este pedido específico (id=eq.orderId), que não depende de sessão.
  // Vários watchers para o mesmo pedido compartilham um único canal (refCount).
  const patchOrder = (orderId, patch) => {
    const id = String(orderId);
    const index = lastOrders.findIndex((candidate) => orderKey(candidate) === id);
    if (index === -1) return;
    const next = lastOrders.slice();
    next[index] = { ...next[index], ...patch };
    render(next);
  };

  const watchOrder = (orderId, callback) => {
    const id = String(orderId);
    if (!watchers.has(id)) watchers.set(id, new Set());
    watchers.get(id).add(callback);

    let entry = realtimeChannels.get(id);
    if (!entry) {
      entry = { cleanup: null, refCount: 0, cancelled: false };
      realtimeChannels.set(id, entry);
      subscribeToOrder(orderId, {
        onChange: (payload) => { if (payload?.new) patchOrder(orderId, payload.new); },
      }).then((cleanup) => {
        if (entry.cancelled) { cleanup?.(); return; }
        entry.cleanup = cleanup;
      }).catch((error) => console.warn('[Realtime] Falha ao observar pedido', id, error));
    }
    entry.refCount += 1;

    return () => {
      watchers.get(id)?.delete(callback);
      const current = realtimeChannels.get(id);
      if (!current) return;
      current.refCount -= 1;
      if (current.refCount <= 0) {
        current.cancelled = true;
        current.cleanup?.();
        realtimeChannels.delete(id);
      }
    };
  };

  const render = (orders) => {
    lastOrders = orders;
    if (!orders.length) { root.innerHTML = '<div class="empty-state"><span>🧾</span><h3>Nenhum pedido ainda</h3><p>Quando você pedir, o acompanhamento aparecerá aqui.</p></div>'; notifyWatchers(orders); return; }
    root.innerHTML = orders.map((order) => {
      const normalizedStatus = order.status === 'pending' ? 'received' : order.status;
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
      const playCta = isWaitingStatus(normalizedStatus) ? `<button type="button" class="order-play-cta" data-order-key="${escapeHTML(orderKey(order))}" aria-label="Jogue enquanto espera o pedido ${escapeHTML(displayNumber)}"><span class="order-play-cta__icon"><i class="fi fi-rr-game-console-crank-handheld" aria-hidden="true"></i></span><span class="order-play-cta__copy"><strong>Jogue enquanto espera</strong><small>Divirta-se enquanto preparamos seu pedido</small></span><span class="order-play-cta__arrow" aria-hidden="true">&rsaquo;</span></button>` : '';
      return card + playCta;
    }).join('');
    notifyWatchers(orders);
  };

  const load = async () => {
    root.innerHTML = '<div class="empty-state"><span>⏳</span><h3>Buscando pedidos...</h3></div>';
    try { render(await getOrders()); }
    catch (error) { root.innerHTML = `<div class="empty-state"><span>⚠️</span><h3>Não foi possível carregar</h3><p>${escapeHTML(error.message)}</p></div>`; }
  };

  root.addEventListener('click', (event) => {
    const cta = event.target.closest('.order-play-cta');
    if (!cta) return;
    const key = cta.dataset.orderKey;
    const order = lastOrders.find((candidate) => orderKey(candidate) === key);
    if (order) onPlayRequested?.(order);
  });

  document.querySelector('#refresh-orders').addEventListener('click', load);
  subscribeToOrders(load).then((cleanup) => { unsubscribe = cleanup; }).catch(console.warn);
  return {
    load,
    watchOrder,
    destroy: () => {
      unsubscribe();
      realtimeChannels.forEach((entry) => { entry.cancelled = true; entry.cleanup?.(); });
      realtimeChannels.clear();
    },
  };
}

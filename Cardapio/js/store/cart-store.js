const STORAGE_KEY = 'ignite-cart-v1';

class CartStore extends EventTarget {
  constructor() {
    super();
    this.items = this.read();
  }

  read() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    this.dispatchEvent(new CustomEvent('change', { detail: this.snapshot() }));
  }

  add(product, quantity = 1, notes = '') {
    const key = `${product.id}:${notes.trim().toLowerCase()}`;
    const existing = this.items.find(item => item.key === key);
    const max = product.track_stock === true ? Math.max(0, Number(product.stock || 0)) : 50;
    if (max <= 0 || product.available === false) return;
    if (existing) existing.quantity = Math.min(max, existing.quantity + quantity);
    else this.items.push({
      key,
      product_id: product.id,
      name: product.name,
      price: Number(product.price),
      emoji: product.emoji || '🍽️',
      quantity: Math.min(max, quantity),
      notes: notes.trim(),
    });
    this.save();
  }

  change(key, amount) {
    const item = this.items.find(entry => entry.key === key);
    if (!item) return;
    item.quantity += amount;
    if (item.quantity <= 0) this.items = this.items.filter(entry => entry.key !== key);
    this.save();
  }

  reconcileCatalog(products = []) {
    const byId = new Map(products.map(product => [String(product.id), product]));
    const removed = [];
    const changed = [];
    const next = [];

    for (const item of this.items) {
      const product = byId.get(String(item.product_id));
      const unavailable = !product || product.available === false
        || (product.track_stock === true && Number(product.stock || 0) <= 0);
      if (unavailable) {
        removed.push(item.name);
        continue;
      }

      const max = product.track_stock === true ? Math.max(1, Number(product.stock || 0)) : 50;
      const reconciled = {
        ...item,
        name: product.name,
        price: Number(product.price),
        emoji: product.emoji || item.emoji || '🍽️',
        quantity: Math.min(Math.max(1, Number(item.quantity || 1)), max),
      };
      if (reconciled.price !== Number(item.price) || reconciled.quantity !== Number(item.quantity) || reconciled.name !== item.name) {
        changed.push(reconciled.name);
      }
      next.push(reconciled);
    }

    const didChange = removed.length > 0 || changed.length > 0 || next.length !== this.items.length;
    this.items = next;
    if (didChange) this.save();
    return { removed, changed, didChange };
  }

  clear() { this.items = []; this.save(); }
  get count() { return this.items.reduce((sum, item) => sum + item.quantity, 0); }
  get subtotal() { return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0); }
  snapshot() { return { items: [...this.items], count: this.count, subtotal: this.subtotal }; }
}

export const cartStore = new CartStore();

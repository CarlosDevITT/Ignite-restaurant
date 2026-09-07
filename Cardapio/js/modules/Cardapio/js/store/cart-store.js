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
    const existing = this.items.find((item) => item.key === key);
    if (existing) existing.quantity += quantity;
    else this.items.push({ key, product_id: product.id, name: product.name, price: Number(product.price), emoji: product.emoji || '🍽️', quantity, notes: notes.trim() });
    this.save();
  }

  change(key, amount) {
    const item = this.items.find((entry) => entry.key === key);
    if (!item) return;
    item.quantity += amount;
    if (item.quantity <= 0) this.items = this.items.filter((entry) => entry.key !== key);
    this.save();
  }

  clear() { this.items = []; this.save(); }
  get count() { return this.items.reduce((sum, item) => sum + item.quantity, 0); }
  get subtotal() { return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0); }
  snapshot() { return { items: [...this.items], count: this.count, subtotal: this.subtotal }; }
}

export const cartStore = new CartStore();

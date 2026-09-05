import { cartStore } from '../store/cart-store.js';
import { escapeHTML, money, normalizeText } from '../utils/format.js';

export function initCatalog({ categories, products }) {
  const categoryList = document.querySelector('#category-list');
  const grid = document.querySelector('#product-grid');
  const search = document.querySelector('#product-search');
  const resultCount = document.querySelector('#result-count');
  let activeCategory = 'all';
  let featuredOnly = false;

  // Match public category IDs as well as legacy slugs and demo categories.
  const categoryKey = (value) => normalizeText(String(value || '')).replace(/^cat-/, '').replace(/[\s_-]+/g, ' ').trim();
  const categoryGroups = {
    bebidas: ['bebidas', 'bebida', 'drinks'],
    combos: ['combos', 'combo'],
    'pratos-principais': ['pratos principais', 'pratos', 'principal', 'marmitex', 'marmitas', 'meals', 'refeicoes'],
    promocoes: ['promocoes', 'promocao'],
  };
  const matchesCategory = (product, id) => {
    if (id === 'all') return true;
    if (id === 'promocoes' && product.promo) return true;
    if (String(product.category_id) === String(id)) return true;
    const category = categories.find((item) => String(item.id) === String(id));
    const keys = categoryGroups[id] || [categoryKey(category?.name || id)];
    return [product.category_id, product.category_name].some((value) => keys.includes(categoryKey(value)));
  };
  document.querySelectorAll('[data-hero-category]').forEach((button) => {
    const id = button.dataset.heroCategory;
    if (!categories.some((category) => String(category.id) === id)) {
      categories.push({ id, name: button.dataset.categoryLabel, icon: '✦' });
    }
  });

  const renderCategories = () => {
    categoryList.innerHTML = categories.map((category) => `
      <button class="category-chip ${category.id === activeCategory ? 'is-active' : ''}" type="button" data-category="${escapeHTML(category.id)}" aria-pressed="${category.id === activeCategory}">
        <span aria-hidden="true">${escapeHTML(category.icon || '•')}</span>${escapeHTML(category.name)}
      </button>`).join('');
  };

  const filteredProducts = () => products.filter((product) => {
    const term = normalizeText(search.value);
    const categoryMatch = matchesCategory(product, activeCategory);
    const searchMatch = !term || normalizeText(`${product.name} ${product.description} ${product.category_name}`).includes(term);
    return categoryMatch && searchMatch && (!featuredOnly || product.featured);
  });

  const renderProducts = () => {
    const filtered = filteredProducts();
    resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'item' : 'itens'}`;
    if (!filtered.length) {
      grid.innerHTML = '<div class="empty-state"><span>🔎</span><h3>Nada por aqui</h3><p>Tente outro nome ou categoria.</p></div>';
      return;
    }
    grid.innerHTML = filtered.map((product) => `
      <article class="product-card ${product.available ? '' : 'is-unavailable'}">
        <button class="product-card__visual" type="button" data-product="${escapeHTML(product.id)}" style="--product-color:${escapeHTML(product.color || '#fff0e9')}" aria-label="Ver ${escapeHTML(product.name)}">
          ${product.available ? (product.featured ? '<span class="product-card__badge">Mais pedido</span>' : '') : '<span class="product-card__badge product-card__badge--unavailable">Indisponível</span>'}
          ${product.image_url ? `<img class="product-card__image" src="${escapeHTML(product.image_url)}" alt="" loading="lazy"><span class="product-card__emoji" aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>` : `<span class="product-card__emoji" aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>`}
        </button>
        <div class="product-card__content">
          <span class="product-card__category">${escapeHTML(product.category_name || 'Cardápio')}</span>
          <h3><button class="product-name" type="button" data-product="${escapeHTML(product.id)}">${escapeHTML(product.name)}</button></h3>
          <p class="product-card__description">${escapeHTML(product.description || '')}</p>
          <div class="product-card__footer"><span class="product-card__price">${money(product.price)}${product.original_price > product.price ? `<del>${money(product.original_price)}</del>` : ''}</span><button class="product-add" type="button" data-add-product="${escapeHTML(product.id)}" aria-label="Adicionar ${escapeHTML(product.name)}" ${product.available ? '' : 'disabled'}><i class="fi fi-rr-plus" aria-hidden="true"></i></button></div>
        </div>
      </article>`).join('');
  };

  const showProduct = async (product) => {
    if (!product.available) {
      await Swal.fire({ icon: 'info', title: 'Produto indisponível', text: 'Este item está sem estoque no momento.' });
      return;
    }
    const result = await Swal.fire({
      title: escapeHTML(product.name),
      customClass: { popup: 'product-dialog', htmlContainer: 'product-dialog__body', actions: 'product-dialog__actions', title: 'sr-only' },
      showCloseButton: true, closeButtonAriaLabel: 'Fechar detalhes',
      html: `<div class="swal-product">
        <div class="swal-product__visual" style="--product-color:${escapeHTML(product.color || '#fff0e9')}">
          ${product.image_url ? `<img class="swal-product__image" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}"><span class="swal-product__emoji" aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>` : `<span class="swal-product__emoji" aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>`}
        </div>
        <div class="swal-product__heading"><span class="swal-product__category">${escapeHTML(product.category_name || 'Cardápio')}</span><h2>${escapeHTML(product.name)}</h2></div>
        <p class="swal-product__description">${escapeHTML(product.description || 'Uma escolha deliciosa preparada pela Ignite.')}</p>
        <div class="swal-product__price">${money(product.price)}${product.original_price > product.price ? `<del>${money(product.original_price)}</del><span>Oferta</span>` : ''}</div>
        <label class="field"><span>Quantidade</span><span class="product-quantity"><button type="button" data-quantity-step="-1" aria-label="Diminuir quantidade">&minus;</button><input id="swal-quantity" type="number" inputmode="numeric" min="1" max="20" step="1" value="1" aria-label="Quantidade"><button type="button" data-quantity-step="1" aria-label="Aumentar quantidade">+</button></span></label>
        <label class="field"><span>Observações <small>(opcional)</small></span><textarea id="swal-notes" class="swal2-textarea" maxlength="500" rows="3" placeholder="Ex.: sem cebola, ponto da carne..."></textarea></label>
      </div>`,
      showCancelButton: true, confirmButtonText: `Adicionar · ${money(product.price)}`, cancelButtonText: 'Continuar vendo', focusConfirm: false,
      didOpen: () => {
        const image = document.querySelector('.swal-product__image');
        if (image) {
          const fallback = () => { image.hidden = true; image.nextElementSibling?.classList.add('is-visible'); };
          image.addEventListener('error', fallback, { once: true });
          if (image.complete && !image.naturalWidth) fallback();
        }
        const input = document.querySelector('#swal-quantity');
        const normalize = () => Math.min(20, Math.max(1, Math.trunc(Number(input.value)) || 1));
        const update = () => {
          const quantity = normalize();
          Swal.getConfirmButton().textContent = 'Adicionar · ' + money(product.price * quantity);
          document.querySelector('[data-quantity-step="-1"]').disabled = quantity <= 1;
          document.querySelector('[data-quantity-step="1"]').disabled = quantity >= 20;
        };
        document.querySelectorAll('[data-quantity-step]').forEach(button => button.addEventListener('click', () => {
          input.value = Math.min(20, Math.max(1, normalize() + Number(button.dataset.quantityStep)));
          update();
        }));
        input.addEventListener('input', update);
        input.addEventListener('change', () => { input.value = normalize(); update(); });
        update();
      },
      preConfirm: () => ({ quantity: Math.min(20, Math.max(1, Math.trunc(Number(document.querySelector('#swal-quantity').value)) || 1)), notes: document.querySelector('#swal-notes').value }),
    });
    if (result.isConfirmed) {
      cartStore.add(product, result.value.quantity, result.value.notes);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Adicionado ao carrinho', showConfirmButton: false, timer: 1600 });
    }
  };

  categoryList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    activeCategory = button.dataset.category;
    renderCategories(); renderProducts();
  });
  document.querySelectorAll('[data-hero-category]').forEach((button) => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.heroCategory;
      search.value = '';
      featuredOnly = false;
      document.querySelector('#filter-products').classList.remove('is-active');
      renderCategories(); renderProducts();
      const selected = categoryList.querySelector('.is-active');
      if (selected) categoryList.scrollLeft = selected.offsetLeft - categoryList.offsetLeft;
      const heading = document.querySelector('.products-carousel h2');
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      document.querySelector('#products-start').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  });
  grid.addEventListener('click', (event) => {
    const target = event.target.closest('[data-product], [data-add-product]');
    if (!target) return;
    const id = target.dataset.product || target.dataset.addProduct;
    const product = products.find((item) => String(item.id) === id);
    if (!product) return;
    if (target.matches('[data-add-product]')) {
      cartStore.add(product);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `${product.name} adicionado`, showConfirmButton: false, timer: 1400 });
    } else showProduct(product);
  });
  grid.addEventListener('error', (event) => {
    if (event.target.matches('.product-card__image')) {
      event.target.hidden = true;
      event.target.nextElementSibling?.style.setProperty('opacity', '1');
    }
  }, true);
  search.addEventListener('input', renderProducts);
  document.querySelector('#filter-products').addEventListener('click', () => {
    featuredOnly = !featuredOnly;
    document.querySelector('#filter-products').classList.toggle('is-active', featuredOnly);
    renderProducts();
    Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: featuredOnly ? 'Mostrando os mais pedidos' : 'Mostrando todos os produtos', showConfirmButton: false, timer: 1400 });
  });

  renderCategories(); renderProducts();
}

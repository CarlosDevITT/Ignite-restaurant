import { cartStore } from '../store/cart-store.js';
import { escapeHTML, money, normalizeText } from '../utils/format.js';

export function initCatalog({ categories, products }) {
  const categoryList = document.querySelector('#category-list');
  const grid = document.querySelector('#product-grid');
  const search = document.querySelector('#product-search');
  const resultCount = document.querySelector('#result-count');
  let activeCategory = 'all';
  let featuredOnly = false;

  const renderCategories = () => {
    categoryList.innerHTML = categories.map((category) => `
      <button class="category-chip ${category.id === activeCategory ? 'is-active' : ''}" type="button" data-category="${escapeHTML(category.id)}">
        <span aria-hidden="true">${escapeHTML(category.icon || '•')}</span>${escapeHTML(category.name)}
      </button>`).join('');
  };

  const filteredProducts = () => products.filter((product) => {
    const term = normalizeText(search.value);
    const categoryMatch = activeCategory === 'all'
      || (activeCategory === 'promocoes' && product.promo)
      || product.category_id === activeCategory;
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
          <h3>${escapeHTML(product.name)}</h3>
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
      title: '',
      html: `<div class="swal-product">
        <div class="swal-product__visual" style="--product-color:${escapeHTML(product.color || '#fff0e9')}">
          ${product.image_url ? `<img class="swal-product__image" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}"><span class="swal-product__emoji" aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>` : `<span class="swal-product__emoji" aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>`}
        </div>
        <div class="swal-product__heading"><span class="swal-product__category">${escapeHTML(product.category_name || 'Cardápio')}</span><h2>${escapeHTML(product.name)}</h2></div>
        <p class="swal-product__description">${escapeHTML(product.description || 'Uma escolha deliciosa preparada pela Ignite.')}</p>
        <div class="swal-product__price">${money(product.price)}${product.original_price > product.price ? `<del>${money(product.original_price)}</del><span>Oferta</span>` : ''}</div>
        <label class="field"><span>Quantidade</span><input id="swal-quantity" type="number" min="1" max="20" value="1"></label>
        <label class="field"><span>Observações <small>(opcional)</small></span><textarea id="swal-notes" class="swal2-textarea" placeholder="Ex.: sem cebola, ponto da carne..."></textarea></label>
      </div>`,
      showCancelButton: true, confirmButtonText: 'Adicionar', cancelButtonText: 'Cancelar', focusConfirm: false,
      didOpen: () => {
        const image = document.querySelector('.swal-product__image');
        if (image) image.addEventListener('error', () => { image.hidden = true; image.nextElementSibling?.classList.add('is-visible'); }, { once: true });
      },
      preConfirm: () => ({ quantity: Math.max(1, Number(document.querySelector('#swal-quantity').value) || 1), notes: document.querySelector('#swal-notes').value }),
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

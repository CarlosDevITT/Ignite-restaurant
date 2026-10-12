import { optimizedProductImage, productImageSrcset, restoreOriginalImage } from '../utils/media.js';
import { cartStore } from '../store/cart-store.js';
import { escapeHTML, money, normalizeText } from '../utils/format.js';

const STYLE_FILES = [
  ['ignite-catalog-premium', '../../styles/catalog-premium.css'],
  ['ignite-catalog-vertical', '../../styles/catalog-vertical.css'],
];

function ensureCatalogStyles() {
  STYLE_FILES.forEach(([id, path]) => {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = new URL(path, import.meta.url).href;
    document.head.appendChild(link);
  });
}

const compactText = (value = '') => String(value)
  .replace(/\r/g, '')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/^[\s\-•·]+/gm, '')
  .replace(/\s+/g, ' ')
  .trim();

const slug = (value) => normalizeText(String(value || 'outros'))
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const discountPercent = (product) => {
  const regular = Number(product.original_price || 0);
  const current = Number(product.price || 0);
  if (!product.promo || regular <= 0 || current >= regular) return 0;
  return Math.max(1, Math.round((1 - current / regular) * 100));
};

const categoryIcon = (name = '') => {
  const text = normalizeText(name);
  if (text.includes('beb')) return '🥤';
  if (text.includes('combo')) return '🍱';
  if (text.includes('entrada')) return '🥗';
  if (text.includes('porcao') || text.includes('petisco')) return '🍟';
  if (text.includes('pizza')) return '🍕';
  if (text.includes('sobremesa')) return '🍰';
  if (text.includes('principal') || text.includes('marm')) return '🍛';
  return '🍽️';
};

export function initCatalog({ categories, products }) {
  ensureCatalogStyles();

  const categoryList = document.querySelector('#category-list');
  const grid = document.querySelector('#product-grid');
  const search = document.querySelector('#product-search');
  const resultCount = document.querySelector('#result-count');
  const filterButton = document.querySelector('#filter-products');
  const productShell = document.querySelector('.products-carousel');
  if (!categoryList || !grid || !search || !resultCount || !filterButton) return;

  productShell?.removeAttribute('data-carousel');
  productShell?.querySelector(':scope > .carousel-controls')?.remove();
  grid.removeAttribute('data-carousel-track');
  grid.removeAttribute('tabindex');
  grid.setAttribute('aria-label', 'Produtos organizados por categoria');
  grid.classList.add('catalog-sections');

  let selection = 'all';
  let activeSection = 'all';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  filterButton.setAttribute('aria-label', 'Escolher categoria');
  const clearSearch = document.createElement('button');
  clearSearch.type = 'button'; clearSearch.className = 'catalog-search-clear';
  clearSearch.setAttribute('aria-label', 'Limpar busca'); clearSearch.hidden = true;
  clearSearch.innerHTML = '<i class="fi fi-rr-cross-small" aria-hidden="true"></i>';
  search.insertAdjacentElement('afterend', clearSearch);


  const productCategoryName = (product) => product.category_name || product.category || 'Outros';
  const productCategoryId = (product) => slug(productCategoryName(product));

  const baseProducts = () => products.filter((product) => product.active !== false && product.ativo !== false);

  const sectionMap = new Map();
  baseProducts().forEach((product) => {
    const id = productCategoryId(product);
    if (!sectionMap.has(id)) {
      const sourceCategory = categories.find((category) => {
        const candidate = normalizeText(category.name || category.nome || category.id || '');
        return candidate === normalizeText(productCategoryName(product));
      });
      sectionMap.set(id, {
        id,
        name: sourceCategory?.name || sourceCategory?.nome || productCategoryName(product),
        icon: sourceCategory?.icon || categoryIcon(productCategoryName(product)),
        products: [],
      });
    }
    sectionMap.get(id).products.push(product);
  });

  const sections = [...sectionMap.values()].sort((a, b) => {
    const order = ['pratos-principais', 'principal', 'combos', 'entradas', 'bebidas'];
    const ai = order.indexOf(a.id); const bi = order.indexOf(b.id);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.name.localeCompare(b.name, 'pt-BR');
  });

  const totalCount = baseProducts().length;

  let quickbar = document.querySelector('.catalog-quickbar');
  if (!quickbar) {
    quickbar = document.createElement('div');
    quickbar.className = 'catalog-quickbar';
    categoryList.insertAdjacentElement('afterend', quickbar);
  }

  let searchHint = document.querySelector('.catalog-search-hint');
  if (!searchHint) {
    searchHint = document.createElement('div');
    searchHint.className = 'catalog-search-hint';
    search.closest('.search-wrap')?.insertAdjacentElement('afterend', searchHint);
  }

  const renderCategories = () => {
    const chips = [
      { id: 'all', name: 'Todas categorias', icon: '✦', count: totalCount },
      ...sections.map((section) => ({ ...section, count: section.products.length })),
    ];
    categoryList.innerHTML = chips.map((category) => `
      <button class="category-chip ${category.id === activeSection ? 'is-active' : ''}" type="button" data-category="${escapeHTML(category.id)}" aria-pressed="${category.id === activeSection}">
        <span aria-hidden="true">${escapeHTML(category.icon || '•')}</span>
        <span>${escapeHTML(category.name)}</span>
        <span class="category-chip__count" aria-hidden="true">${category.count}</span>
      </button>`).join('');
  };

  const renderQuickbar = (visibleCount) => {
    const hasSearch = Boolean(search.value.trim());
    clearSearch.hidden = !search.value;
    quickbar.removeAttribute('aria-busy');
    quickbar.innerHTML = `
      <div class="catalog-selection" role="group" aria-label="Filtrar cardápio">
        ${[['all','Todos'],['offers','Em oferta'],['featured','Destaques']].map(([id,label]) => `<button type="button" data-catalog-selection="${id}" aria-pressed="${selection === id}">${label}</button>`).join('')}
      </div>
      ${selection !== 'all' || hasSearch ? '<button class="catalog-reset" type="button" data-catalog-reset>Limpar filtros</button>' : ''}`;
    resultCount.textContent = `${visibleCount} ${visibleCount === 1 ? 'item' : 'itens'}`;
  };

  const filteredProducts = () => {
    const term = normalizeText(search.value);
    return baseProducts().filter((product) => {
      const text = normalizeText(`${product.name} ${product.description} ${product.category_name} ${product.promo_text || ''}`);
      return (!term || text.includes(term)) && (selection === 'all' || (selection === 'offers' ? product.promo : product.featured));
    });
  };

  const productBadges = (product) => {
    if (!product.available) return '<span class="product-card__badge product-card__badge--unavailable">Indisponível</span>';
    if (product.promo) return `<span class="product-card__badge product-card__badge--promo">${escapeHTML(product.promo_text || 'Oferta')}</span>`;
    if (product.featured) return '<span class="product-card__badge product-card__badge--featured">Destaque</span>';
    return '';
  };

  const productCard = (product) => {
    const discount = discountPercent(product);
    const promoCopy = product.promo && product.promo_text ? compactText(product.promo_text) : '';
    const description = compactText(product.description || '');
    return `
      <article class="product-card product-card--premium ${product.available ? '' : 'is-unavailable'}" data-product-card="${escapeHTML(product.id)}">
        <button class="product-card__visual" type="button" data-product="${escapeHTML(product.id)}" style="--product-color:${escapeHTML(product.color || '#fff0e9')}" aria-label="Ver ${escapeHTML(product.name)}">
          <span class="product-card__badges" aria-hidden="true"><span>${productBadges(product)}</span>${discount ? `<span class="product-card__discount">-${discount}%</span>` : ''}</span>
          ${product.image_url ? `<img class="product-card__image" src="${escapeHTML(optimizedProductImage(product.image_url))}" srcset="${escapeHTML(productImageSrcset(product.image_url))}" sizes="(min-width: 900px) 300px, (min-width: 521px) 45vw, 116px" data-original-src="${escapeHTML(product.image_url)}" width="600" height="450" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async"><span class="product-card__placeholder" aria-hidden="true"><i class="fi fi-rr-restaurant"></i><small>Carregando foto</small></span>` : `<span class="product-card__placeholder" aria-hidden="true"><i class="fi fi-rr-restaurant"></i><small>Sem foto</small></span>`}
        </button>
        <div class="product-card__content">
          <span class="product-card__category">${escapeHTML(productCategoryName(product))}</span>
          <h3><button class="product-name" type="button" data-product="${escapeHTML(product.id)}">${escapeHTML(product.name)}</button></h3>
          <p class="product-card__description">${escapeHTML(description || 'Veja os detalhes deste produto.')}</p>
          ${promoCopy ? `<p class="product-card__promo-copy">${escapeHTML(promoCopy)}</p>` : ''}
          <div class="product-card__footer">
            <span class="product-card__price${product.promo ? ' is-promo' : ''}">${product.promo && product.original_price > product.price ? `<del>${money(product.original_price)}</del>` : ''}<strong>${money(product.price)}</strong></span>
            <button class="product-add" type="button" data-add-product="${escapeHTML(product.id)}" aria-label="Adicionar ${escapeHTML(product.name)}" ${product.available ? '' : 'disabled'}><i class="fi fi-rr-plus" aria-hidden="true"></i><span>Adicionar</span></button>
          </div>
        </div>
      </article>`;
  };

  const renderProducts = () => {
    const visible = filteredProducts();
    const visibleIds = new Set(visible.map((product) => String(product.id)));
    searchHint.textContent = search.value.trim() ? `Resultados para “${search.value.trim()}”` : '';
    searchHint.classList.toggle('is-visible', Boolean(search.value.trim()));
    renderQuickbar(visible.length);

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state"><i class="fi fi-rr-search" aria-hidden="true"></i><h3>Nenhum produto encontrado</h3><p>Tente outro nome ou limpe os filtros para ver o cardápio.</p><button class="button" type="button" data-catalog-reset>Ver todo o cardápio</button></div>';
      return;
    }

    grid.innerHTML = sections.map((section) => {
      const sectionProducts = section.products
        .filter((product) => visibleIds.has(String(product.id)))
        .sort((a, b) => {
          if (a.available !== b.available) return a.available ? -1 : 1;
          if (a.promo !== b.promo) return a.promo ? -1 : 1;
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return Number(a.position || 0) - Number(b.position || 0);
        });
      if (!sectionProducts.length) return '';
      return `
        <section class="catalog-section" id="catalog-section-${escapeHTML(section.id)}" data-catalog-section="${escapeHTML(section.id)}">
          <div class="catalog-section__heading">
            <div class="catalog-section__title"><span class="catalog-section__icon" aria-hidden="true">${escapeHTML(section.icon)}</span><div><span class="catalog-section__eyebrow">Categoria</span><h3>${escapeHTML(section.name)}</h3></div></div>
            <span class="catalog-section__count">${sectionProducts.length} ${sectionProducts.length === 1 ? 'item' : 'itens'}</span>
          </div>
          <div class="catalog-section__products">${sectionProducts.map(productCard).join('')}</div>
        </section>`;
    }).join('');
  };

  const showProduct = async (product) => {
    if (!product.available) {
      await Swal.fire({ icon: 'info', title: 'Produto indisponível', text: 'Este item não está disponível no momento.' });
      return;
    }
    const result = await Swal.fire({
      title: escapeHTML(product.name),
      customClass: { popup: 'product-dialog', htmlContainer: 'product-dialog__body', actions: 'product-dialog__actions', title: 'sr-only' },
      showCloseButton: true,
      closeButtonAriaLabel: 'Fechar detalhes',
      html: `<div class="swal-product">
        <div class="swal-product__visual" style="--product-color:${escapeHTML(product.color || '#fff0e9')}">${product.image_url ? `<img class="swal-product__image" src="${escapeHTML(optimizedProductImage(product.image_url, 640))}" srcset="${escapeHTML(productImageSrcset(product.image_url))}" sizes="(min-width: 1100px) 460px, 100vw" data-original-src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" decoding="async"><span class="swal-product__emoji" aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>` : `<span class="swal-product__emoji" aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>`}</div>
        <div class="swal-product__heading"><span class="swal-product__category">${escapeHTML(productCategoryName(product))}</span><h2>${escapeHTML(product.name)}</h2></div>
        <p class="swal-product__description">${escapeHTML(product.description || 'Uma escolha deliciosa preparada pela Ignite.')}</p>
        <div class="swal-product__price"><strong>${money(product.price)}</strong>${product.original_price > product.price ? `<del>${money(product.original_price)}</del><span>${escapeHTML(product.promo_text || 'Oferta')}</span>` : ''}</div>
        <label class="field"><span>Quantidade</span><span class="product-quantity"><button type="button" data-quantity-step="-1" aria-label="Diminuir quantidade">&minus;</button><input id="swal-quantity" type="number" inputmode="numeric" min="1" max="20" step="1" value="1" aria-label="Quantidade"><button type="button" data-quantity-step="1" aria-label="Aumentar quantidade">+</button></span></label>
        <label class="field"><span>Observações <small>(opcional)</small></span><textarea id="swal-notes" class="swal2-textarea" maxlength="500" rows="3" placeholder="Ex.: sem cebola, ponto da carne..."></textarea></label>
      </div>`,
      showCancelButton: true,
      confirmButtonText: `Adicionar · ${money(product.price)}`,
      cancelButtonText: 'Continuar vendo',
      focusConfirm: false,
      didOpen: () => {
        const image = document.querySelector('.swal-product__image');
        if (image) {
          const fallback = () => { if (restoreOriginalImage(image)) { image.addEventListener('error', fallback, { once: true }); return; } image.hidden = true; image.nextElementSibling?.classList.add('is-visible'); };
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
        document.querySelectorAll('[data-quantity-step]').forEach((button) => button.addEventListener('click', () => { input.value = Math.min(20, Math.max(1, normalize() + Number(button.dataset.quantityStep))); update(); }));
        input.addEventListener('input', update);
        input.addEventListener('change', () => { input.value = normalize(); update(); });
        update();
      },
      preConfirm: () => ({ quantity: Math.min(20, Math.max(1, Math.trunc(Number(document.querySelector('#swal-quantity').value)) || 1)), notes: document.querySelector('#swal-notes').value }),
    });
    if (result.isConfirmed) {
      cartStore.add(product, result.value.quantity, result.value.notes);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Adicionado ao carrinho', showConfirmButton: false, timer: 1400 });
    }
  };

  const scrollToSection = (id) => {
    activeSection = id;
    categoryList.querySelectorAll('[data-category]').forEach(button => {
      const active = button.dataset.category === id;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    if (id === 'all') {
      document.querySelector('#products-start')?.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
      return;
    }
    document.querySelector(`#catalog-section-${CSS.escape(id)}`)?.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
  };

  categoryList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    scrollToSection(button.dataset.category);
  });

  const resetFilters = () => {
    selection = 'all'; search.value = ''; renderProducts();
  };
  clearSearch.addEventListener('click', () => { search.value = ''; renderProducts(); search.focus(); });
  quickbar.addEventListener('click', event => {
    const button = event.target.closest('[data-catalog-selection], [data-catalog-reset]');
    if (!button) return;
    if (button.hasAttribute('data-catalog-reset')) resetFilters();
    else { selection = button.dataset.catalogSelection; renderProducts(); }
    quickbar.querySelector(button.hasAttribute('data-catalog-reset') ? '[data-catalog-selection="all"]' : `[data-catalog-selection="${selection}"]`)?.focus({ preventScroll: true });
  });

  document.querySelectorAll('[data-hero-category]').forEach((button) => {
    button.addEventListener('click', () => {
      search.value = '';
      selection = button.dataset.heroCategory === 'promocoes' ? 'offers' : 'all';
      renderProducts();
      const requested = slug(button.dataset.categoryLabel || button.dataset.heroCategory);
      const match = sections.find((section) => section.id === requested || normalizeText(section.name).includes(normalizeText(button.dataset.categoryLabel || button.dataset.heroCategory)));
      scrollToSection(match?.id || 'all');
    });
  });

  grid.addEventListener('click', (event) => {
    if (event.target.closest('[data-catalog-reset]')) { resetFilters(); search.focus(); return; }
    const target = event.target.closest('[data-product], [data-add-product]');
    if (!target) return;
    const id = target.dataset.product || target.dataset.addProduct;
    const product = products.find((item) => String(item.id) === id);
    if (!product) return;
    if (target.matches('[data-add-product]')) {
      if (!product.available) return;
      cartStore.add(product);
      target.classList.add('is-added');
      target.innerHTML = '<i class="fi fi-rr-check" aria-hidden="true"></i><span>Adicionado</span>';
      setTimeout(() => { if (!target.isConnected) return; target.classList.remove('is-added'); target.innerHTML = '<i class="fi fi-rr-plus" aria-hidden="true"></i><span>Adicionar</span>'; }, 850);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `${product.name} adicionado`, showConfirmButton: false, timer: 1100 });
    } else showProduct(product);
  });

  grid.addEventListener('load', event => {
    if (event.target.matches('.product-card__image')) event.target.closest('.product-card__visual')?.classList.add('is-photo-ready');
  }, true);

  grid.addEventListener('error', (event) => {
    if (event.target.matches('.product-card__image')) {
      if (restoreOriginalImage(event.target)) return;
      event.target.hidden = true;
      event.target.closest('.product-card__visual')?.classList.remove('is-photo-ready');
      event.target.nextElementSibling?.classList.add('is-visible');
      const label = event.target.nextElementSibling?.querySelector('small');
      if (label) label.textContent = 'Sem foto';
    }
  }, true);

  search.addEventListener('input', event => { if (!event.isComposing) renderProducts(); });
  search.addEventListener('compositionend', renderProducts);
  // Category selection belongs to the shared filter sheet in mobile-ux.js.

  renderCategories();
  renderProducts();

  // Resolve landing links only after the real catalog has rendered.
  if (!window.__igniteCatalogDeepLinkHandled) {
    window.__igniteCatalogDeepLinkHandled = true;
    const params = new URLSearchParams(location.search);
    const requestedItem = params.get('item');
    const requestedCategory = params.get('category');
    if (requestedItem) {
      const product = products.find(item => String(item.id) === requestedItem);
      if (product) void showProduct(product);
      else void Swal.fire({ icon: 'info', title: 'Produto não encontrado', text: 'Este item pode ter mudado. Escolha uma opção no cardápio.', confirmButtonText: 'Ver cardápio' });
    } else if (requestedCategory) {
      const section = sections.find(item => item.id === requestedCategory);
      if (section) {
        const target = document.querySelector(`#catalog-section-${CSS.escape(section.id)}`);
        const navigate = () => {
          activeSection = section.id;
          renderCategories();
          target?.scrollIntoView({ behavior: 'instant', block: 'start' });
        };
        // CSS/media may finish loading after the data, changing section geometry.
        if (document.readyState === 'complete') requestAnimationFrame(navigate);
        else window.addEventListener('load', navigate, { once: true });
      }
    }
  }
}

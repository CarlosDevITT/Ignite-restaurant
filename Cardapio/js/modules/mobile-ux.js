import { initCartUX } from './cart-ux.js';

const KEYBOARD_THRESHOLD = 140;

function setupKeyboardAwareness() {
  const viewport = window.visualViewport;
  const update = () => {
    const layoutHeight = window.innerHeight;
    const visualHeight = viewport?.height ?? layoutHeight;
    const keyboardOpen = layoutHeight - visualHeight > KEYBOARD_THRESHOLD;
    document.body.classList.toggle('keyboard-open', keyboardOpen);
  };

  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', () => setTimeout(update, 80));
  update();
}

function setupCategoryFilterSheet() {
  const filterButton = document.querySelector('#filter-products');
  const categoryList = document.querySelector('#category-list');
  if (!filterButton || !categoryList) return;

  const sheet = document.createElement('div');
  sheet.className = 'category-filter-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <button class="category-filter-sheet__backdrop" type="button" aria-label="Fechar filtros" data-filter-close></button>
    <section class="category-filter-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="category-filter-title">
      <div class="category-filter-sheet__handle" aria-hidden="true"></div>
      <div class="category-filter-sheet__header">
        <div><span>Filtros</span><h2 id="category-filter-title">Escolha uma categoria</h2></div>
        <button class="category-filter-sheet__close" type="button" data-filter-close aria-label="Fechar"><i class="fi fi-rr-cross-small" aria-hidden="true"></i></button>
      </div>
      <div class="category-filter-sheet__options" data-filter-options></div>
    </section>`;
  document.body.appendChild(sheet);

  const options = sheet.querySelector('[data-filter-options]');
  const close = () => {
    sheet.hidden = true;
    document.body.classList.remove('category-filter-open');
    filterButton.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    const chips = [...categoryList.querySelectorAll('[data-category]')];
    options.innerHTML = chips.map((chip) => {
      const id = chip.dataset.category;
      const label = chip.querySelector('span:nth-child(2)')?.textContent?.trim() || chip.textContent.trim();
      const count = chip.querySelector('.category-chip__count')?.textContent?.trim() || '';
      const active = chip.classList.contains('is-active') || chip.classList.contains('is-visible-section');
      return `<button type="button" class="category-filter-option ${active ? 'is-active' : ''}" data-filter-category="${id}"><span>${label}</span>${count ? `<small>${count}</small>` : ''}<i class="fi fi-rr-angle-small-right" aria-hidden="true"></i></button>`;
    }).join('');
    sheet.hidden = false;
    document.body.classList.add('category-filter-open');
    filterButton.setAttribute('aria-expanded', 'true');
    sheet.querySelector('.category-filter-option')?.focus({ preventScroll: true });
  };

  // Capture phase blocks the old "featured only" handler in catalog.js.
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('#filter-products');
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (sheet.hidden) open(); else close();
      return;
    }

    const category = event.target.closest('[data-filter-category]');
    if (category) {
      const original = categoryList.querySelector(`[data-category="${CSS.escape(category.dataset.filterCategory)}"]`);
      close();
      original?.click();
      return;
    }

    if (event.target.closest('[data-filter-close]')) close();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !sheet.hidden) close();
  });

  filterButton.setAttribute('aria-haspopup', 'dialog');
  filterButton.setAttribute('aria-expanded', 'false');
  filterButton.setAttribute('title', 'Filtrar por categoria');
}

export function initMobileUX() {
  setupKeyboardAwareness();
  setupCategoryFilterSheet();
  initCartUX();
}

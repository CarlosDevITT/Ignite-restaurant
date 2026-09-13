import { getFeed } from '../services/product-service.js';
import { escapeHTML } from '../utils/format.js';

function ensureFeedStyles() {
  if (document.querySelector('link[data-ignite-feed-premium]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../styles/feed-premium.css?v=20260912-1', import.meta.url).href;
  link.setAttribute('data-ignite-feed-premium', 'true');
  document.head.appendChild(link);
}

const normalizeDate = (post) => post.published_at || post.criado_em || post.created_at || null;
const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date).replace('.', '');
};
const isRecent = (value) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time <= 1000 * 60 * 60 * 24 * 7;
};
const postImage = (post) => post.image_url || post.image || post.photo_url || post.media_url || post.banner_url || null;
const postCategory = (post) => String(post.category_slug || post.category || post.label || post.tipo || '').trim();

export async function initFeed() {
  ensureFeedStyles();
  const root = document.querySelector('#feed-list');
  const view = document.querySelector('#view-feed');
  if (!root || !view) return;

  let posts = [];
  let activeFilter = 'all';
  let loading = false;

  let toolbar = view.querySelector('.feed-toolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'feed-toolbar';
    toolbar.innerHTML = `
      <div class="feed-toolbar__copy"><strong>Descubra o que está acontecendo</strong><small>Promoções, novidades e destaques do Ignite.</small></div>
      <button class="feed-refresh" type="button" aria-label="Atualizar feed" title="Atualizar feed"><i class="fi fi-rr-refresh"></i></button>`;
    view.querySelector('.section-heading--page')?.insertAdjacentElement('afterend', toolbar);
  }

  let filters = view.querySelector('.feed-filters');
  if (!filters) {
    filters = document.createElement('div');
    filters.className = 'feed-filters';
    filters.setAttribute('aria-label', 'Filtros do feed');
    toolbar.insertAdjacentElement('afterend', filters);
  }

  const renderSkeleton = () => {
    root.innerHTML = Array.from({ length: 4 }, () => '<div class="feed-skeleton" aria-hidden="true"><div></div><div class="feed-skeleton__body"><span></span><span></span><span></span></div></div>').join('');
  };

  const renderFilters = () => {
    const labels = [...new Set(posts.map(post => post.label || post.category || post.tipo || 'Ignite').filter(Boolean))];
    filters.innerHTML = [
      ['all', 'Todos'],
      ...labels.slice(0, 8).map(label => [String(label).toLowerCase(), String(label)]),
    ].map(([id, label]) => `<button class="feed-filter ${activeFilter === id ? 'is-active' : ''}" type="button" data-feed-filter="${escapeHTML(id)}">${escapeHTML(label)}</button>`).join('');
  };

  const render = () => {
    const visible = activeFilter === 'all'
      ? posts
      : posts.filter(post => String(post.label || post.category || post.tipo || 'Ignite').toLowerCase() === activeFilter);

    renderFilters();

    if (!visible.length) {
      root.innerHTML = '<div class="empty-state feed-empty"><span><i class="fi fi-rr-megaphone"></i></span><h3>Nenhuma novidade por aqui</h3><p>Quando houver novas promoções ou notícias do Ignite, elas aparecerão aqui.</p></div>';
      return;
    }

    root.innerHTML = visible.map((post, index) => {
      const image = postImage(post);
      const date = normalizeDate(post);
      const category = postCategory(post);
      const featured = index === 0 && activeFilter === 'all';
      return `<article class="feed-card ${featured ? 'feed-card--featured' : ''}">
        <div class="feed-card__visual">
          ${image ? `<img class="feed-card__image" src="${escapeHTML(image)}" alt="" loading="lazy" decoding="async">` : ''}
          <span class="feed-card__emoji" aria-hidden="true">${escapeHTML(post.emoji || '🔥')}</span>
          ${isRecent(date) ? '<span class="feed-card__badge">Novo</span>' : ''}
        </div>
        <div class="feed-card__body">
          <div class="feed-card__meta-row"><span class="feed-card__meta">${escapeHTML(post.label || 'Ignite')}</span><span class="feed-card__date">${escapeHTML(formatDate(date))}</span></div>
          <h3>${escapeHTML(post.title || 'Novidade Ignite')}</h3>
          <p>${escapeHTML(post.body || '')}</p>
          <div class="feed-card__actions">
            ${category ? `<button class="feed-card__cta" type="button" data-feed-category="${escapeHTML(category)}"><i class="fi fi-rr-shopping-bag"></i> Ver no cardápio</button>` : '<span></span>'}
            <span class="feed-card__brand">Ignite</span>
          </div>
        </div>
      </article>`;
    }).join('');

    root.querySelectorAll('.feed-card__image').forEach(image => image.addEventListener('error', () => image.classList.add('is-broken'), { once: true }));
  };

  const load = async () => {
    if (loading) return;
    loading = true;
    toolbar.querySelector('.feed-refresh')?.classList.add('is-loading');
    renderSkeleton();
    try {
      posts = await getFeed();
      render();
    } catch (error) {
      console.warn('[Feed] Falha ao carregar:', error);
      root.innerHTML = '<div class="empty-state feed-error"><span><i class="fi fi-rr-wifi-exclamation"></i></span><h3>Não foi possível atualizar o feed</h3><p>Verifique sua conexão e tente novamente.</p><button class="button" type="button" data-feed-retry>Tentar novamente</button></div>';
    } finally {
      loading = false;
      toolbar.querySelector('.feed-refresh')?.classList.remove('is-loading');
    }
  };

  filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-feed-filter]');
    if (!button) return;
    activeFilter = button.dataset.feedFilter || 'all';
    render();
  });

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-feed-retry]')) { void load(); return; }
    const button = event.target.closest('[data-feed-category]');
    if (!button) return;
    const category = button.dataset.feedCategory;
    document.querySelector('[data-route="home"]')?.click();
    requestAnimationFrame(() => {
      const chip = [...document.querySelectorAll('#category-list [data-category]')].find(item => {
        const label = item.querySelector('span:nth-child(2)')?.textContent?.trim() || '';
        return item.dataset.category === category || label.toLowerCase() === category.toLowerCase();
      });
      chip?.click();
      document.querySelector('#products-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  toolbar.querySelector('.feed-refresh')?.addEventListener('click', () => void load());
  await load();
}

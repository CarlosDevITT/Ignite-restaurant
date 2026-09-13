import { getCatalog, getFeed } from '../services/product-service.js';
import { cartStore } from '../store/cart-store.js';
import { escapeHTML, money } from '../utils/format.js';

const SAVED_KEY = 'ignite-feed-saved-v1';
const LIKED_KEY = 'ignite-feed-liked-v1';

function ensureFeedStyles() {
  if (document.querySelector('link[data-ignite-feed-premium]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../styles/feed-premium.css?v=20260912-2', import.meta.url).href;
  link.setAttribute('data-ignite-feed-premium', 'true');
  document.head.appendChild(link);
}

const readSet = (key) => {
  try { return new Set(JSON.parse(localStorage.getItem(key)) || []); }
  catch { return new Set(); }
};
const writeSet = (key, set) => localStorage.setItem(key, JSON.stringify([...set]));
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
const postImage = (post) => post.image_url || post.imagem_url || post.image || post.photo_url || post.media_url || post.banner_url || null;
const postType = (post) => String(post.tipo || post.label || post.category || 'Ignite').trim();
const postAuthor = (post) => post.user_name || post.nome_usuario || (post.tipo === 'admin' ? 'Equipe Ignite' : 'Cliente Ignite');
const postTitle = (post) => post.title || (post.tipo === 'admin' ? 'Novidade da Ignite' : `Experiência de ${postAuthor(post)}`);
const postBody = (post) => post.body || post.description || post.descricao || '';
const postId = (post) => String(post.id || '');

export async function initFeed() {
  ensureFeedStyles();
  const root = document.querySelector('#feed-list');
  const view = document.querySelector('#view-feed');
  if (!root || !view) return;

  let posts = [];
  let productMap = new Map();
  let activeFilter = 'all';
  let loading = false;
  const liked = readSet(LIKED_KEY);
  const saved = readSet(SAVED_KEY);

  let toolbar = view.querySelector('.feed-toolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'feed-toolbar';
    toolbar.innerHTML = `
      <div class="feed-toolbar__copy"><strong>Descubra o que está acontecendo</strong><small>Promoções, avaliações e produtos para pedir agora.</small></div>
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
    const labels = [...new Set(posts.map(post => postType(post)).filter(Boolean))];
    filters.innerHTML = [
      ['all', 'Todos'],
      ['saved', 'Salvos'],
      ...labels.slice(0, 7).map(label => [String(label).toLowerCase(), String(label)]),
    ].map(([id, label]) => `<button class="feed-filter ${activeFilter === id ? 'is-active' : ''}" type="button" data-feed-filter="${escapeHTML(id)}">${escapeHTML(label)}</button>`).join('');
  };

  const visiblePosts = () => {
    if (activeFilter === 'saved') return posts.filter(post => saved.has(postId(post)));
    if (activeFilter === 'all') return posts;
    return posts.filter(post => postType(post).toLowerCase() === activeFilter);
  };

  const renderProduct = (post) => {
    const product = productMap.get(String(post.produto_id ?? ''));
    if (!product) return '';
    return `<div class="feed-product">
      <div class="feed-product__visual">${product.image_url ? `<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async">` : `<span aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>`}</div>
      <div class="feed-product__copy"><small>Produto citado</small><strong>${escapeHTML(product.name)}</strong><span>${money(product.price)}</span></div>
      <button type="button" class="feed-product__add" data-feed-add-product="${escapeHTML(product.id)}" ${product.available ? '' : 'disabled'} aria-label="Adicionar ${escapeHTML(product.name)} ao carrinho"><i class="fi fi-rr-plus"></i></button>
    </div>`;
  };

  const render = () => {
    const visible = visiblePosts();
    renderFilters();

    if (!visible.length) {
      root.innerHTML = `<div class="empty-state feed-empty"><span><i class="fi fi-rr-${activeFilter === 'saved' ? 'bookmark' : 'megaphone'}"></i></span><h3>${activeFilter === 'saved' ? 'Nenhum post salvo' : 'Nenhuma novidade por aqui'}</h3><p>${activeFilter === 'saved' ? 'Use o botão de salvar nos posts que quiser rever depois.' : 'Quando houver novas promoções ou notícias do Ignite, elas aparecerão aqui.'}</p></div>`;
      return;
    }

    root.innerHTML = visible.map((post, index) => {
      const id = postId(post);
      const image = postImage(post);
      const date = normalizeDate(post);
      const featured = (post.is_featured || index === 0) && activeFilter === 'all';
      const isLiked = liked.has(id);
      const isSaved = saved.has(id);
      const likes = Math.max(0, Number(post.likes || 0) + (isLiked ? 1 : 0));
      const rating = Math.max(0, Math.min(5, Number(post.avaliacao || 0)));
      return `<article class="feed-card ${featured ? 'feed-card--featured' : ''}" data-feed-post="${escapeHTML(id)}">
        <div class="feed-card__visual">
          ${image ? `<img class="feed-card__image" src="${escapeHTML(image)}" alt="" loading="lazy" decoding="async">` : ''}
          <span class="feed-card__emoji" aria-hidden="true">${escapeHTML(post.emoji || '🔥')}</span>
          ${isRecent(date) ? '<span class="feed-card__badge">Novo</span>' : ''}
          <button class="feed-save ${isSaved ? 'is-active' : ''}" type="button" data-feed-save="${escapeHTML(id)}" aria-pressed="${isSaved}" aria-label="${isSaved ? 'Remover dos salvos' : 'Salvar publicação'}"><i class="fi fi-rr-bookmark"></i></button>
        </div>
        <div class="feed-card__body">
          <div class="feed-card__meta-row"><span class="feed-card__meta">${escapeHTML(postType(post))}</span><span class="feed-card__date">${escapeHTML(formatDate(date))}</span></div>
          <div class="feed-author"><span class="feed-author__avatar" aria-hidden="true">${escapeHTML(post.tipo === 'admin' ? 'IG' : (postAuthor(post)[0] || 'I').toUpperCase())}</span><span><strong>${escapeHTML(postAuthor(post))}</strong>${post.tipo === 'admin' ? '<small><i class="fi fi-rr-badge-check"></i> Oficial</small>' : '<small>Cliente Ignite</small>'}</span></div>
          <h3>${escapeHTML(postTitle(post))}</h3>
          <p>${escapeHTML(postBody(post))}</p>
          ${rating ? `<div class="feed-rating" aria-label="Avaliação ${rating} de 5"><span>${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span><small>${rating}/5</small></div>` : ''}
          ${renderProduct(post)}
          <div class="feed-social">
            <button class="feed-social__button ${isLiked ? 'is-active' : ''}" type="button" data-feed-like="${escapeHTML(id)}" aria-pressed="${isLiked}"><i class="fi fi-rr-heart"></i><span>${likes}</span></button>
            <span class="feed-social__stat"><i class="fi fi-rr-comment-alt"></i>${Math.max(0, Number(post.comments_count || 0))}</span>
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
      const [nextPosts, catalog] = await Promise.all([getFeed(), getCatalog().catch(() => ({ products: [] }))]);
      posts = nextPosts;
      productMap = new Map((catalog.products || []).map(product => [String(product.id), product]));
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

    const saveButton = event.target.closest('[data-feed-save]');
    if (saveButton) {
      const id = saveButton.dataset.feedSave;
      if (saved.has(id)) saved.delete(id); else saved.add(id);
      writeSet(SAVED_KEY, saved);
      render();
      return;
    }

    const likeButton = event.target.closest('[data-feed-like]');
    if (likeButton) {
      const id = likeButton.dataset.feedLike;
      if (liked.has(id)) liked.delete(id); else liked.add(id);
      writeSet(LIKED_KEY, liked);
      render();
      return;
    }

    const addButton = event.target.closest('[data-feed-add-product]');
    if (addButton) {
      const product = productMap.get(String(addButton.dataset.feedAddProduct));
      if (!product?.available) return;
      cartStore.add(product, 1, '');
      addButton.classList.add('is-added');
      const old = addButton.innerHTML;
      addButton.innerHTML = '<i class="fi fi-rr-check"></i>';
      setTimeout(() => { addButton.innerHTML = old; addButton.classList.remove('is-added'); }, 900);
    }
  });

  toolbar.querySelector('.feed-refresh')?.addEventListener('click', () => void load());
  await load();
}

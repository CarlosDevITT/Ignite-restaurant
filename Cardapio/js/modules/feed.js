import { getCatalog, getFeed } from '../services/product-service.js';
import { cartStore } from '../store/cart-store.js';
import { escapeHTML, money } from '../utils/format.js';

const SAVED_KEY = 'ignite-feed-saved-v1';
const LIKED_KEY = 'ignite-feed-liked-v1';

function ensureFeedStyles() {
  const files = [
    ['ignite-feed-premium', '../../styles/feed-premium.css?v=20260912-3'],
    ['ignite-feed-ux', '../../styles/feed-ux.css?v=20260912-1'],
  ];
  files.forEach(([id, path]) => {
    const attr = `data-${id}`;
    if (document.querySelector(`link[${attr}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL(path, import.meta.url).href;
    link.setAttribute(attr, 'true');
    document.head.appendChild(link);
  });
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
  let toastTimer = null;
  const liked = readSet(LIKED_KEY);
  const saved = readSet(SAVED_KEY);
  const expanded = new Set();

  let toolbar = view.querySelector('.feed-toolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'feed-toolbar';
    toolbar.innerHTML = `
      <div class="feed-toolbar__copy"><strong>Descubra o que está acontecendo</strong><small>Promoções, avaliações e produtos para pedir agora.</small><span class="feed-toolbar__status" data-feed-status>Atualizando novidades</span></div>
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

  let toast = document.querySelector('.feed-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'feed-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }

  const showToast = (message, icon = 'fi-rr-check') => {
    clearTimeout(toastTimer);
    toast.innerHTML = `<i class="fi ${icon}" aria-hidden="true"></i><span>${escapeHTML(message)}</span>`;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
  };

  const renderSkeleton = () => {
    root.innerHTML = Array.from({ length: 4 }, () => '<div class="feed-skeleton" aria-hidden="true"><div></div><div class="feed-skeleton__body"><span></span><span></span><span></span></div></div>').join('');
  };

  const filterDefs = () => {
    const official = posts.filter(post => post.tipo === 'admin').length;
    const customers = posts.filter(post => post.tipo === 'cliente').length;
    const defs = [['all', 'Todos', posts.length]];
    if (official) defs.push(['official', 'Oficial', official]);
    if (customers) defs.push(['customers', 'Clientes', customers]);
    defs.push(['saved', 'Salvos', posts.filter(post => saved.has(postId(post))).length]);
    return defs;
  };

  const renderFilters = () => {
    filters.innerHTML = filterDefs().map(([id, label, count]) => `<button class="feed-filter ${activeFilter === id ? 'is-active' : ''}" type="button" data-feed-filter="${id}" aria-pressed="${activeFilter === id}">${label}<span class="feed-filter__count">${count}</span></button>`).join('');
  };

  const visiblePosts = () => {
    if (activeFilter === 'saved') return posts.filter(post => saved.has(postId(post)));
    if (activeFilter === 'official') return posts.filter(post => post.tipo === 'admin');
    if (activeFilter === 'customers') return posts.filter(post => post.tipo === 'cliente');
    return posts;
  };

  const renderProduct = (post) => {
    const product = productMap.get(String(post.produto_id ?? ''));
    if (!product) return '';
    return `<div class="feed-product" data-feed-view-product="${escapeHTML(product.id)}" role="button" tabindex="0" aria-label="Ver detalhes de ${escapeHTML(product.name)}">
      <div class="feed-product__visual">${product.image_url ? `<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async">` : `<span aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>`}</div>
      <div class="feed-product__copy"><small>Produto citado</small><strong>${escapeHTML(product.name)}</strong><span>${money(product.price)}</span><span class="feed-product__details">Ver detalhes <i class="fi fi-rr-angle-small-right"></i></span></div>
      <button type="button" class="feed-product__add" data-feed-add-product="${escapeHTML(product.id)}" ${product.available ? '' : 'disabled'} aria-label="Adicionar ${escapeHTML(product.name)} ao carrinho"><i class="fi fi-rr-plus"></i></button>
    </div>`;
  };

  const render = () => {
    const visible = visiblePosts();
    renderFilters();
    const status = toolbar.querySelector('[data-feed-status]');
    if (status) status.textContent = `${posts.length} ${posts.length === 1 ? 'publicação' : 'publicações'} no feed`;

    if (!visible.length) {
      root.innerHTML = `<div class="empty-state feed-empty"><span><i class="fi fi-rr-${activeFilter === 'saved' ? 'bookmark' : 'megaphone'}"></i></span><h3>${activeFilter === 'saved' ? 'Nenhum post salvo' : 'Nada neste filtro ainda'}</h3><p>${activeFilter === 'saved' ? 'Use o botão de salvar nos posts que quiser rever depois.' : 'Escolha outro filtro para continuar explorando o Feed Ignite.'}</p></div>`;
      return;
    }

    root.innerHTML = visible.map((post, index) => {
      const id = postId(post);
      const image = postImage(post);
      const date = normalizeDate(post);
      const featured = (post.is_featured || index === 0) && activeFilter === 'all';
      const isLiked = liked.has(id);
      const isSaved = saved.has(id);
      const isExpanded = expanded.has(id);
      const likes = Math.max(0, Number(post.likes || 0) + (isLiked ? 1 : 0));
      const rating = Math.max(0, Math.min(5, Number(post.avaliacao || 0)));
      const body = postBody(post);
      const canExpand = body.length > 120;
      return `<article class="feed-card ${featured ? 'feed-card--featured' : ''} ${isExpanded ? 'is-expanded' : ''}" data-feed-post="${escapeHTML(id)}">
        <div class="feed-card__visual" ${image ? `data-feed-image="${escapeHTML(image)}" data-feed-image-title="${escapeHTML(postTitle(post))}"` : ''}>
          ${image ? `<img class="feed-card__image" src="${escapeHTML(image)}" alt="" loading="lazy" decoding="async">` : ''}
          <span class="feed-card__emoji" aria-hidden="true">${escapeHTML(post.emoji || '🔥')}</span>
          ${isRecent(date) ? '<span class="feed-card__badge">Novo</span>' : ''}
          <button class="feed-save ${isSaved ? 'is-active' : ''}" type="button" data-feed-save="${escapeHTML(id)}" aria-pressed="${isSaved}" aria-label="${isSaved ? 'Remover dos salvos' : 'Salvar publicação'}"><i class="fi fi-rr-bookmark"></i></button>
        </div>
        <div class="feed-card__body">
          <div class="feed-card__meta-row"><span class="feed-card__meta">${escapeHTML(postType(post))}</span><span class="feed-card__date">${escapeHTML(formatDate(date))}</span></div>
          <div class="feed-author"><span class="feed-author__avatar" aria-hidden="true">${escapeHTML(post.tipo === 'admin' ? 'IG' : (postAuthor(post)[0] || 'I').toUpperCase())}</span><span><strong>${escapeHTML(postAuthor(post))}</strong>${post.tipo === 'admin' ? '<small><i class="fi fi-rr-badge-check"></i> Oficial</small>' : '<small>Cliente Ignite</small>'}</span></div>
          <h3>${escapeHTML(postTitle(post))}</h3>
          <p>${escapeHTML(body)}</p>
          ${canExpand ? `<button class="feed-card__readmore" type="button" data-feed-expand="${escapeHTML(id)}">${isExpanded ? 'Mostrar menos' : 'Ler mais'}</button>` : ''}
          ${rating ? `<div class="feed-rating" aria-label="Avaliação ${rating} de 5"><span>${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span><small>${rating}/5</small></div>` : ''}
          ${renderProduct(post)}
          <div class="feed-social">
            <button class="feed-social__button ${isLiked ? 'is-active' : ''}" type="button" data-feed-like="${escapeHTML(id)}" aria-pressed="${isLiked}" aria-label="Curtir publicação"><i class="fi fi-rr-heart"></i><span>${likes}</span></button>
            <span class="feed-social__stat" aria-label="${Math.max(0, Number(post.comments_count || 0))} comentários"><i class="fi fi-rr-comment-alt"></i>${Math.max(0, Number(post.comments_count || 0))}</span>
            <button class="feed-social__button feed-social__button--share" type="button" data-feed-share="${escapeHTML(id)}" aria-label="Compartilhar publicação"><i class="fi fi-rr-share"></i></button>
          </div>
        </div>
      </article>`;
    }).join('');

    root.querySelectorAll('.feed-card__image').forEach(image => image.addEventListener('error', () => image.classList.add('is-broken'), { once: true }));
  };

  const openProduct = (productId) => {
    document.querySelector('[data-route="home"]')?.click();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const trigger = document.querySelector(`[data-product="${CSS.escape(String(productId))}"]`);
      if (trigger) trigger.click();
      else document.querySelector('#products-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  };

  const load = async () => {
    if (loading) return;
    loading = true;
    toolbar.querySelector('.feed-refresh')?.classList.add('is-loading');
    const status = toolbar.querySelector('[data-feed-status]');
    if (status) status.textContent = 'Atualizando novidades';
    renderSkeleton();
    try {
      const [nextPosts, catalog] = await Promise.all([getFeed(), getCatalog().catch(() => ({ products: [] }))]);
      posts = [...nextPosts].sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) || new Date(normalizeDate(b) || 0) - new Date(normalizeDate(a) || 0));
      productMap = new Map((catalog.products || []).map(product => [String(product.id), product]));
      render();
    } catch (error) {
      console.warn('[Feed] Falha ao carregar:', error);
      root.innerHTML = '<div class="empty-state feed-error"><span><i class="fi fi-rr-wifi-exclamation"></i></span><h3>Não foi possível atualizar o feed</h3><p>Verifique sua conexão e tente novamente.</p><button class="button" type="button" data-feed-retry>Tentar novamente</button></div>';
      if (status) status.textContent = 'Falha ao atualizar';
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

  root.addEventListener('keydown', (event) => {
    const product = event.target.closest('[data-feed-view-product]');
    if (product && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openProduct(product.dataset.feedViewProduct);
    }
  });

  root.addEventListener('click', async (event) => {
    if (event.target.closest('[data-feed-retry]')) { void load(); return; }

    const saveButton = event.target.closest('[data-feed-save]');
    if (saveButton) {
      const id = saveButton.dataset.feedSave;
      const adding = !saved.has(id);
      if (adding) saved.add(id); else saved.delete(id);
      writeSet(SAVED_KEY, saved);
      render();
      showToast(adding ? 'Publicação salva' : 'Removida dos salvos', adding ? 'fi-rr-bookmark' : 'fi-rr-cross-small');
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

    const expandButton = event.target.closest('[data-feed-expand]');
    if (expandButton) {
      const id = expandButton.dataset.feedExpand;
      if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
      render();
      document.querySelector(`[data-feed-post="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }

    const shareButton = event.target.closest('[data-feed-share]');
    if (shareButton) {
      const post = posts.find(item => postId(item) === shareButton.dataset.feedShare);
      if (!post) return;
      const shareData = { title: postTitle(post), text: postBody(post), url: location.href };
      try {
        if (navigator.share) await navigator.share(shareData);
        else {
          await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
          showToast('Link copiado para compartilhar', 'fi-rr-copy');
        }
      } catch (error) {
        if (error?.name !== 'AbortError') showToast('Não foi possível compartilhar', 'fi-rr-info');
      }
      return;
    }

    const addButton = event.target.closest('[data-feed-add-product]');
    if (addButton) {
      event.stopPropagation();
      const product = productMap.get(String(addButton.dataset.feedAddProduct));
      if (!product?.available) return;
      cartStore.add(product, 1, '');
      const old = addButton.innerHTML;
      addButton.classList.add('is-added');
      addButton.innerHTML = '<i class="fi fi-rr-check"></i>';
      showToast(`${product.name} adicionado ao carrinho`, 'fi-rr-shopping-bag');
      setTimeout(() => { if (addButton.isConnected) { addButton.innerHTML = old; addButton.classList.remove('is-added'); } }, 900);
      return;
    }

    const productCard = event.target.closest('[data-feed-view-product]');
    if (productCard) { openProduct(productCard.dataset.feedViewProduct); return; }

    const image = event.target.closest('[data-feed-image]');
    if (image && !event.target.closest('button')) {
      const src = image.dataset.feedImage;
      if (src && window.Swal) {
        await Swal.fire({ html: `<img src="${escapeHTML(src)}" alt="${escapeHTML(image.dataset.feedImageTitle || 'Publicação Ignite')}">`, showCloseButton: true, showConfirmButton: false, width: 'min(94vw, 720px)', customClass: { popup: 'feed-image-dialog' } });
      }
    }
  });

  toolbar.querySelector('.feed-refresh')?.addEventListener('click', () => void load());
  await load();
}

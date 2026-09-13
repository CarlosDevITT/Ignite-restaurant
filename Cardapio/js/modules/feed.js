import { getCatalog, getFeed } from '../services/product-service.js';
import { cartStore } from '../store/cart-store.js';
import {
  createFeedComment,
  getFeedComments,
  getFeedSessionState,
  subscribeToFeed,
  toggleFeedLike,
  toggleFeedSave,
  watchFeedAuth,
} from '../services/feed-social-service.js';
import { escapeHTML, money } from '../utils/format.js';

function ensureFeedStyles() {
  const files = [
    ['ignite-feed-premium', '../../styles/feed-premium.css?v=20260912-3'],
    ['ignite-feed-ux', '../../styles/feed-ux.css?v=20260913-2'],
    ['ignite-feed-social', '../../styles/feed-social.css?v=20260913-1'],
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

const normalizeDate = post => post.published_at || post.criado_em || post.created_at || null;
const postImage = post => post.image_url || post.imagem_url || post.image || post.photo_url || post.media_url || post.banner_url || null;
const postType = post => String(post.tipo || post.label || post.category || 'Ignite').trim();
const postAuthor = post => post.user_name || post.nome_usuario || (post.tipo === 'admin' ? 'Equipe Ignite' : 'Cliente Ignite');
const postTitle = post => post.title || (post.tipo === 'admin' ? 'Novidade da Ignite' : `Experiência de ${postAuthor(post)}`);
const postBody = post => post.body || post.description || post.descricao || '';
const postId = post => String(post.id || '');
const isRecent = value => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time <= 1000 * 60 * 60 * 24 * 7;
};
const formatDate = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date).replace('.', '');
};
const formatCommentTime = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date).replace('.', '');
};

export async function initFeed() {
  ensureFeedStyles();
  localStorage.removeItem('ignite-feed-saved-v1');
  localStorage.removeItem('ignite-feed-liked-v1');

  const root = document.querySelector('#feed-list');
  const view = document.querySelector('#view-feed');
  if (!root || !view || view.dataset.feedSocialReady === '1') return;
  view.dataset.feedSocialReady = '1';

  let posts = [];
  let productMap = new Map();
  let activeFilter = 'all';
  let loading = false;
  let toastTimer = null;
  let refreshTimer = null;
  let sessionState = { authenticated: false, liked: new Set(), saved: new Set(), user: null };
  const expanded = new Set();

  let toolbar = view.querySelector('.feed-toolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'feed-toolbar';
    toolbar.innerHTML = `
      <div class="feed-toolbar__copy">
        <strong>Feed Ignite</strong>
        <small>Novidades, experiências e produtos para pedir agora.</small>
        <span class="feed-toolbar__status" data-feed-status>Atualizando novidades</span>
      </div>
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
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1900);
  };

  const goToProfile = () => {
    const trigger = document.querySelector('[data-route="profile"]');
    trigger?.click();
  };

  const requireAccount = action => {
    if (sessionState.authenticated) return true;
    showToast(`${action} exige uma conta Ignite`, 'fi-rr-user');
    setTimeout(goToProfile, 380);
    return false;
  };

  const renderSkeleton = () => {
    root.innerHTML = Array.from({ length: 3 }, () => '<div class="feed-skeleton" aria-hidden="true"><div></div><div class="feed-skeleton__body"><span></span><span></span><span></span></div></div>').join('');
  };

  const filterDefs = () => {
    const official = posts.filter(post => post.tipo === 'admin').length;
    const customers = posts.filter(post => post.tipo === 'cliente').length;
    const defs = [['all', 'Todos', posts.length]];
    if (official) defs.push(['official', 'Oficial', official]);
    if (customers) defs.push(['customers', 'Clientes', customers]);
    if (sessionState.authenticated) defs.push(['saved', 'Salvos', posts.filter(post => sessionState.saved.has(postId(post))).length]);
    return defs;
  };

  const renderFilters = () => {
    if (activeFilter === 'saved' && !sessionState.authenticated) activeFilter = 'all';
    filters.innerHTML = filterDefs().map(([id, label, count]) => `<button class="feed-filter ${activeFilter === id ? 'is-active' : ''}" type="button" data-feed-filter="${id}" aria-pressed="${activeFilter === id}">${escapeHTML(label)}<span class="feed-filter__count">${count}</span></button>`).join('');
  };

  const visiblePosts = () => {
    if (activeFilter === 'saved') return posts.filter(post => sessionState.saved.has(postId(post)));
    if (activeFilter === 'official') return posts.filter(post => post.tipo === 'admin');
    if (activeFilter === 'customers') return posts.filter(post => post.tipo === 'cliente');
    return posts;
  };

  const renderProduct = post => {
    const product = productMap.get(String(post.produto_id ?? ''));
    if (!product) return '';
    return `<div class="feed-product" data-feed-view-product="${escapeHTML(product.id)}" role="button" tabindex="0" aria-label="Ver detalhes de ${escapeHTML(product.name)}">
      <div class="feed-product__visual">${product.image_url ? `<img src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy" decoding="async">` : `<span aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>`}</div>
      <div class="feed-product__copy"><small>Produto citado</small><strong>${escapeHTML(product.name)}</strong><span>${money(product.price)}</span><span class="feed-product__details">Ver detalhes <i class="fi fi-rr-angle-small-right"></i></span></div>
      <button type="button" class="feed-product__add" data-feed-add-product="${escapeHTML(product.id)}" ${product.available ? '' : 'disabled'} aria-label="Adicionar ${escapeHTML(product.name)} ao carrinho"><i class="fi fi-rr-plus"></i></button>
    </div>`;
  };

  const renderEmpty = () => {
    if (activeFilter === 'saved') {
      root.innerHTML = '<div class="empty-state feed-empty"><span><i class="fi fi-rr-bookmark"></i></span><h3>Nenhuma publicação salva</h3><p>Salve posts para encontrá-los aqui em qualquer aparelho conectado à sua conta.</p></div>';
      return;
    }
    if (posts.length === 0) {
      root.innerHTML = `<div class="empty-state feed-empty feed-empty--launch">
        <span><i class="fi fi-rr-sparkles"></i></span>
        <h3>O Feed Ignite está pronto</h3>
        <p>As próximas promoções, lançamentos, experiências e novidades oficiais vão aparecer aqui. O ambiente foi limpo para começar apenas com conteúdo real.</p>
        <div class="feed-empty__chips"><span>Promoções</span><span>Novos pratos</span><span>Experiências</span><span>Comunicados</span></div>
      </div>`;
      return;
    }
    root.innerHTML = '<div class="empty-state feed-empty"><span><i class="fi fi-rr-filter"></i></span><h3>Nada neste filtro</h3><p>Escolha outro filtro para continuar explorando o Feed Ignite.</p></div>';
  };

  const render = () => {
    const visible = visiblePosts();
    renderFilters();
    const status = toolbar.querySelector('[data-feed-status]');
    if (status) {
      status.textContent = `${posts.length} ${posts.length === 1 ? 'publicação' : 'publicações'}`;
      status.classList.add('is-live');
    }
    if (!visible.length) { renderEmpty(); return; }

    root.innerHTML = visible.map((post, index) => {
      const id = postId(post);
      const image = postImage(post);
      const date = normalizeDate(post);
      const featured = (post.is_featured || index === 0) && activeFilter === 'all';
      const isLiked = sessionState.liked.has(id);
      const isSaved = sessionState.saved.has(id);
      const isExpanded = expanded.has(id);
      const likes = Math.max(0, Number(post.likes || 0));
      const comments = Math.max(0, Number(post.comments_count || 0));
      const rating = Math.max(0, Math.min(5, Number(post.avaliacao || 0)));
      const body = postBody(post);
      const canExpand = body.length > 120;
      const loginNudge = !sessionState.authenticated ? `<div class="feed-login-nudge"><span><strong>Entre para participar</strong><small>Curta, salve e comente usando sua conta Ignite.</small></span><button type="button" data-feed-login>Entrar</button></div>` : '';
      return `<article class="feed-card ${featured ? 'feed-card--featured' : ''} ${isExpanded ? 'is-expanded' : ''}" data-feed-post="${escapeHTML(id)}">
        <div class="feed-card__visual" ${image ? `data-feed-image="${escapeHTML(image)}" data-feed-image-title="${escapeHTML(postTitle(post))}"` : ''}>
          ${image ? `<img class="feed-card__image" src="${escapeHTML(image)}" alt="${escapeHTML(postTitle(post))}" loading="lazy" decoding="async">` : ''}
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
          ${loginNudge}
          <div class="feed-social">
            <button class="feed-social__button ${isLiked ? 'is-active' : ''}" type="button" data-feed-like="${escapeHTML(id)}" aria-pressed="${isLiked}" aria-label="Curtir publicação"><i class="fi fi-rr-heart"></i><span>${likes}</span></button>
            <button class="feed-social__stat feed-comments-trigger" type="button" data-feed-comments="${escapeHTML(id)}" aria-label="Abrir ${comments} comentários"><i class="fi fi-rr-comment-alt"></i><span>${comments}</span></button>
            <button class="feed-social__button feed-social__button--share" type="button" data-feed-share="${escapeHTML(id)}" aria-label="Compartilhar publicação"><i class="fi fi-rr-share"></i></button>
          </div>
        </div>
      </article>`;
    }).join('');

    root.querySelectorAll('.feed-card__image').forEach(image => image.addEventListener('error', () => image.classList.add('is-broken'), { once: true }));
  };

  const openProduct = productId => {
    document.querySelector('[data-route="home"]')?.click();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const trigger = document.querySelector(`[data-product="${CSS.escape(String(productId))}"]`);
      if (trigger) trigger.click();
      else document.querySelector('#products-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  };

  const ensureCommentsSheet = () => {
    let sheet = document.querySelector('.feed-comments-sheet');
    if (sheet) return sheet;
    sheet = document.createElement('div');
    sheet.className = 'feed-comments-sheet';
    sheet.setAttribute('aria-hidden', 'true');
    sheet.innerHTML = `<section class="feed-comments-panel" role="dialog" aria-modal="true" aria-label="Comentários da publicação">
      <div class="feed-comments-handle"></div>
      <header class="feed-comments-head"><div><strong>Comentários</strong><small data-comments-subtitle>Conversa da comunidade</small></div><button class="feed-comments-close" type="button" aria-label="Fechar comentários"><i class="fi fi-rr-cross-small"></i></button></header>
      <div class="feed-comments-list" data-comments-list></div>
      <div data-comments-form></div>
    </section>`;
    document.body.appendChild(sheet);
    const close = () => { sheet.classList.remove('is-open'); sheet.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; };
    sheet.addEventListener('click', event => { if (event.target === sheet || event.target.closest('.feed-comments-close')) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && sheet.classList.contains('is-open')) close(); });
    return sheet;
  };

  const openComments = async postIdValue => {
    const sheet = ensureCommentsSheet();
    const list = sheet.querySelector('[data-comments-list]');
    const formHost = sheet.querySelector('[data-comments-form]');
    const post = posts.find(item => postId(item) === String(postIdValue));
    sheet.querySelector('[data-comments-subtitle]').textContent = post ? postTitle(post) : 'Conversa da comunidade';
    list.innerHTML = '<div class="feed-comments-state"><i class="fi fi-rr-spinner"></i><strong>Carregando comentários</strong></div>';
    formHost.innerHTML = sessionState.authenticated
      ? `<form class="feed-comment-form"><textarea name="comment" maxlength="500" rows="1" placeholder="Escreva um comentário..." aria-label="Novo comentário" required></textarea><button type="submit" aria-label="Enviar comentário"><i class="fi fi-rr-paper-plane"></i></button></form>`
      : `<div class="feed-comment-form"><div class="feed-comment-form__login"><span>Entre na sua conta para participar da conversa.</span><button type="button" data-feed-login>Entrar</button></div></div>`;
    sheet.classList.add('is-open');
    sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const renderComments = comments => {
      if (!comments.length) {
        list.innerHTML = '<div class="feed-comments-state"><i class="fi fi-rr-comment-alt"></i><strong>Seja o primeiro a comentar</strong><small>Compartilhe sua experiência com a comunidade Ignite.</small></div>';
        return;
      }
      list.innerHTML = comments.map(comment => {
        const name = comment.nome_usuario || 'Cliente Ignite';
        return `<article class="feed-comment"><span class="feed-comment__avatar">${escapeHTML((name[0] || 'I').toUpperCase())}</span><div class="feed-comment__body"><div class="feed-comment__meta"><strong>${escapeHTML(name)}</strong><time>${escapeHTML(formatCommentTime(comment.criado_em))}</time></div><p>${escapeHTML(comment.texto || '')}</p></div></article>`;
      }).join('');
    };

    try { renderComments(await getFeedComments(postIdValue)); }
    catch (error) { console.warn('[Feed] Comentários indisponíveis:', error); list.innerHTML = '<div class="feed-comments-state"><i class="fi fi-rr-wifi-exclamation"></i><strong>Não foi possível carregar</strong><small>Tente novamente em instantes.</small></div>'; }

    const form = formHost.querySelector('form');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const textarea = form.elements.comment;
      const value = String(textarea.value || '').trim();
      if (!value) return;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await createFeedComment(postIdValue, value);
        textarea.value = '';
        const comments = await getFeedComments(postIdValue);
        renderComments(comments);
        const targetPost = posts.find(item => postId(item) === String(postIdValue));
        if (targetPost) targetPost.comments_count = comments.length;
        render();
        showToast('Comentário publicado', 'fi-rr-comment-alt');
      } catch (error) {
        console.warn('[Feed] Falha ao comentar:', error);
        if (String(error?.message || '').includes('registered_account_required')) { sessionState.authenticated = false; goToProfile(); }
        else showToast('Não foi possível publicar o comentário', 'fi-rr-exclamation');
      } finally { button.disabled = false; }
    });
  };

  const syncSessionState = async () => {
    try { sessionState = await getFeedSessionState(); }
    catch (error) { console.warn('[Feed] Estado social indisponível:', error); sessionState = { authenticated: false, liked: new Set(), saved: new Set(), user: null }; }
  };

  const load = async ({ silent = false } = {}) => {
    if (loading) return;
    loading = true;
    toolbar.querySelector('.feed-refresh')?.classList.add('is-loading');
    const status = toolbar.querySelector('[data-feed-status]');
    if (!silent) renderSkeleton();
    if (status) status.textContent = silent ? 'Sincronizando' : 'Atualizando novidades';
    try {
      const [nextPosts, catalog] = await Promise.all([getFeed(), getCatalog().catch(() => ({ products: [] })), syncSessionState()]);
      posts = [...nextPosts].sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)) || new Date(normalizeDate(b) || 0) - new Date(normalizeDate(a) || 0));
      productMap = new Map((catalog.products || []).map(product => [String(product.id), product]));
      render();
    } catch (error) {
      console.warn('[Feed] Falha ao carregar:', error);
      if (!silent) root.innerHTML = '<div class="empty-state feed-error"><span><i class="fi fi-rr-wifi-exclamation"></i></span><h3>Não foi possível atualizar o feed</h3><p>Verifique sua conexão e tente novamente.</p><button class="button" type="button" data-feed-retry>Tentar novamente</button></div>';
      if (status) status.textContent = 'Falha ao atualizar';
    } finally {
      loading = false;
      toolbar.querySelector('.feed-refresh')?.classList.remove('is-loading');
    }
  };

  const scheduleRealtimeRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { void load({ silent: true }); }, 220);
  };

  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-feed-filter]');
    if (!button) return;
    activeFilter = button.dataset.feedFilter || 'all';
    render();
  });

  root.addEventListener('keydown', event => {
    const product = event.target.closest('[data-feed-view-product]');
    if (product && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openProduct(product.dataset.feedViewProduct); }
  });

  root.addEventListener('click', async event => {
    if (event.target.closest('[data-feed-retry]')) { void load(); return; }
    if (event.target.closest('[data-feed-login]')) { goToProfile(); return; }

    const saveButton = event.target.closest('[data-feed-save]');
    if (saveButton) {
      if (!requireAccount('Salvar publicação')) return;
      const id = saveButton.dataset.feedSave;
      saveButton.classList.add('is-busy');
      try {
        const result = await toggleFeedSave(id);
        if (result.saved) sessionState.saved.add(id); else sessionState.saved.delete(id);
        render();
        showToast(result.saved ? 'Publicação salva na sua conta' : 'Removida dos salvos', result.saved ? 'fi-rr-bookmark' : 'fi-rr-cross-small');
      } catch (error) { console.warn('[Feed] Falha ao salvar:', error); showToast('Não foi possível salvar agora', 'fi-rr-exclamation'); }
      finally { saveButton.classList.remove('is-busy'); }
      return;
    }

    const likeButton = event.target.closest('[data-feed-like]');
    if (likeButton) {
      if (!requireAccount('Curtir publicação')) return;
      const id = likeButton.dataset.feedLike;
      likeButton.classList.add('is-busy');
      try {
        const result = await toggleFeedLike(id);
        if (result.liked) sessionState.liked.add(id); else sessionState.liked.delete(id);
        const post = posts.find(item => postId(item) === id);
        if (post) post.likes = result.likes;
        render();
      } catch (error) { console.warn('[Feed] Falha ao curtir:', error); showToast('Não foi possível curtir agora', 'fi-rr-exclamation'); }
      finally { likeButton.classList.remove('is-busy'); }
      return;
    }

    const commentsButton = event.target.closest('[data-feed-comments]');
    if (commentsButton) { void openComments(commentsButton.dataset.feedComments); return; }

    const expandButton = event.target.closest('[data-feed-expand]');
    if (expandButton) {
      const id = expandButton.dataset.feedExpand;
      if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
      render();
      document.querySelector(`[data-feed-post="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }

    const addButton = event.target.closest('[data-feed-add-product]');
    if (addButton) {
      event.stopPropagation();
      const product = productMap.get(String(addButton.dataset.feedAddProduct));
      if (!product?.available) return;
      cartStore.add(product, 1);
      addButton.classList.add('is-added');
      showToast(`${product.name} adicionado ao carrinho`, 'fi-rr-shopping-cart-add');
      setTimeout(() => addButton.classList.remove('is-added'), 700);
      return;
    }

    const product = event.target.closest('[data-feed-view-product]');
    if (product) { openProduct(product.dataset.feedViewProduct); return; }

    const shareButton = event.target.closest('[data-feed-share]');
    if (shareButton) {
      const post = posts.find(item => postId(item) === shareButton.dataset.feedShare);
      if (!post) return;
      const shareData = { title: postTitle(post), text: `${postTitle(post)}\n${postBody(post)}`.trim(), url: location.href };
      try {
        if (navigator.share) await navigator.share(shareData);
        else { await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`); showToast('Publicação copiada para compartilhar', 'fi-rr-copy'); }
      } catch (error) { if (error?.name !== 'AbortError') showToast('Não foi possível compartilhar', 'fi-rr-exclamation'); }
      return;
    }

    const visual = event.target.closest('[data-feed-image]');
    if (visual && !event.target.closest('button')) {
      const image = visual.dataset.feedImage;
      const title = visual.dataset.feedImageTitle || 'Feed Ignite';
      if (image && window.Swal) {
        window.Swal.fire({ title, html: `<img src="${escapeHTML(image)}" alt="${escapeHTML(title)}">`, showConfirmButton: false, showCloseButton: true, width: 620, customClass: { popup: 'feed-image-dialog' } });
      }
    }
  });

  toolbar.querySelector('.feed-refresh')?.addEventListener('click', () => { void load(); });
  const commentsSheet = ensureCommentsSheet();
  commentsSheet.addEventListener('click', event => { if (event.target.closest('[data-feed-login]')) goToProfile(); });

  await load();
  subscribeToFeed(scheduleRealtimeRefresh).then(stop => { window.addEventListener('beforeunload', stop, { once: true }); }).catch(error => console.warn('[Feed] Realtime indisponível:', error));
  watchFeedAuth(async () => { await syncSessionState(); render(); }).then(stop => { window.addEventListener('beforeunload', stop, { once: true }); }).catch(() => {});
  window.addEventListener('online', scheduleRealtimeRefresh);
  window.addEventListener('focus', scheduleRealtimeRefresh);
}

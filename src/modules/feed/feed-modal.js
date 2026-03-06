// feed-modal.js - Gerenciamento da seção Feed (lista, stories, paginação)

let _feedPage = 0;
let _feedLoading = false;
let _feedEnd = false;
let _currentPhone = null;

function navOpenFeed() {
  closeAllModals();
  const modal = document.getElementById('feed-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  highlightNav('feed');

  // reset state
  _feedPage = 0;
  _feedEnd = false;
  document.getElementById('feed-posts-container').innerHTML = '';

  _currentPhone = getUserPhone();
  _renderStories();
  loadFeedPosts();

  // attach scroll listener (remove previous to avoid duplicates)
  modal.removeEventListener('scroll', _onFeedScroll);
  modal.addEventListener('scroll', _onFeedScroll);
}

function _onFeedScroll() {
  const modal = document.getElementById('feed-modal');
  if (!modal) return;
  if (modal.scrollHeight - modal.scrollTop - modal.clientHeight < 150) {
    loadMorePosts();
  }
}

async function loadFeedPosts() {
  if (_feedLoading || _feedEnd) return;
  _feedLoading = true;
  document.getElementById('feed-loading').classList.remove('hidden');

  const limit = 10;
  const from = _feedPage * limit;
  const to = from + limit - 1;

  try {
    const { data: posts, error } = await window.supabaseManager.client
      .from('feed_posts')
      .select('*')
      .eq('aprovado', true)
      .order('criado_em', { ascending: false })
      .range(from, to);

    if (error) throw error;

    if (!posts || posts.length === 0) {
      _feedEnd = true;
    } else {
      // marcar quais posts o usuário curtiu
      const likedIds = new Set();
      if (_currentPhone && posts.length) {
        const { data: likesData } = await window.supabaseManager.client
          .from('feed_likes')
          .select('post_id')
          .eq('telefone', _currentPhone)
          .in('post_id', posts.map(p => p.id));
        likesData?.forEach(l => likedIds.add(l.post_id));
      }

      // enriquecer cada post com dados extras
      for (const post of posts) {
        post.user_liked = likedIds.has(post.id);

        if (post.produto_id) {
          try {
            const { data: prod } = await window.supabaseManager.client
              .from('produtos')
              .select('nome')
              .eq('id', post.produto_id)
              .single();
            post.produto_nome = prod?.nome || '';
          } catch (e) {
            console.warn('Erro ao buscar nome do produto:', e);
          }
        }

        // pegar dois últimos comentários
        try {
          const { data: comm } = await window.supabaseManager.client
            .from('feed_comentarios')
            .select('*')
            .eq('post_id', post.id)
            .order('criado_em', { ascending: false })
            .limit(2);
          post.comments = comm || [];
        } catch (e) {
          post.comments = [];
        }
      }

      const container = document.getElementById('feed-posts-container');
      posts.forEach(p => {
        container.insertAdjacentHTML('beforeend', renderPost(p));
        // inserir preview de comentários
        if (p.comments && p.comments.length) {
          const cEl = document.getElementById(`comments-preview-${p.id}`);
          p.comments
            .slice()
            .reverse()
            .forEach(c => {
              const html = `<p class="text-sm"><span class="font-bold">${c.nome_usuario}</span> ${c.texto}</p>`;
              cEl.insertAdjacentHTML('beforeend', html);
            });
        }
      });

      _feedPage++;
      if (posts.length < limit) _feedEnd = true;
    }
  } catch (e) {
    console.error('Erro carregando feed:', e);
  } finally {
    _feedLoading = false;
    document.getElementById('feed-loading').classList.add('hidden');
  }
}

function renderPost(post) {
  return `
  <article class="bg-white border-b border-gray-100" id="post-${post.id}">
    <div class="flex items-center gap-3 px-4 py-3">
      <div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm
        ${post.tipo === 'restaurante' ? 'bg-primary' : 'bg-gradient-to-br from-orange-400 to-pink-500'}">
        ${post.tipo === 'restaurante'
          ? '<img src="../assets/images/logos/logo.png" class="w-9 h-9 rounded-full object-cover">'
          : post.nome_usuario.charAt(0).toUpperCase()}
      </div>
      <div class="flex-1">
        <p class="font-bold text-sm text-gray-800">
          ${post.nome_usuario}
          ${post.tipo === 'restaurante' ? '<i class="fas fa-check-circle text-primary text-xs ml-1"></i>' : ''}
        </p>
        <p class="text-xs text-gray-400">${timeAgo(post.criado_em)}</p>
      </div>
      <i class="fas fa-ellipsis-h text-gray-400"></i>
    </div>

    ${post.imagem_url ? `
    <div class="w-full aspect-square bg-gray-100 overflow-hidden">
      <img src="${post.imagem_url}" alt="Post" class="w-full h-full object-cover" loading="lazy">
    </div>` : ''}

    <div class="flex items-center gap-4 px-4 py-3">
      <button onclick="toggleLike('${post.id}')" class="like-btn flex items-center gap-1" data-post-id="${post.id}">
        <i class="${post.user_liked ? 'fas text-red-500' : 'far text-gray-700'} fa-heart text-2xl"></i>
      </button>
      <button onclick="openComments('${post.id}')">
        <i class="far fa-comment text-2xl text-gray-700"></i>
      </button>
      <button onclick="sharePost('${post.id}')">
        <i class="far fa-paper-plane text-2xl text-gray-700"></i>
      </button>
      ${post.avaliacao ? `
      <div class="ml-auto flex items-center gap-1">
        ${[1,2,3,4,5].map(s => `<i class="fas fa-star text-sm ${s <= post.avaliacao ? 'text-yellow-400' : 'text-gray-200'}"></i>`).join('')}
      </div>` : ''}
    </div>

    <p id="likes-count-${post.id}" class="px-4 text-sm font-bold text-gray-800 mb-1">${post.likes} curtidas</p>

    ${post.descricao ? `
    <p class="px-4 text-sm text-gray-700 mb-2">
      <span class="font-bold">${post.nome_usuario}</span> ${post.descricao}
    </p>` : ''}

    ${post.produto_nome ? `
    <div class="mx-4 mb-3 bg-gray-50 rounded-lg p-2 flex items-center gap-2 border border-gray-100">
      <i class="fas fa-utensils text-primary text-xs"></i>
      <span class="text-xs text-gray-600">Pediu: <strong>${post.produto_nome}</strong></span>
    </div>` : ''}

    <div id="comments-preview-${post.id}" class="px-4 pb-3">
      <!-- previews -->
    </div>

  </article>`;
}

function loadMorePosts() {
  loadFeedPosts();
}

async function checkUserCanPost(telefone) {
  if (!telefone) return false;
  try {
    const { count, error } = await window.supabaseManager.client
      .from('pedidos')
      .select('id', { head: true, count: 'exact' })
      .eq('telefone', telefone)
      .limit(1);
    if (error) throw error;
    return (count || 0) > 0;
  } catch (e) {
    console.error('Erro verificando pedidos:', e);
    return false;
  }
}

function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  const intervals = [
    { label: 'ano', seconds: 31536000 },
    { label: 'mês', seconds: 2592000 },
    { label: 'dia', seconds: 86400 },
    { label: 'hora', seconds: 3600 },
    { label: 'minuto', seconds: 60 },
    { label: 'segundo', seconds: 1 }
  ];
  for (const i of intervals) {
    const count = Math.floor(seconds / i.seconds);
    if (count >= 1) {
      return count === 1 ? `há 1 ${i.label}` : `há ${count} ${i.label}s`;
    }
  }
  return 'agora';
}

function getUserPhone() {
  const profile = JSON.parse(
    localStorage.getItem('ignite_user_profile') ||
      localStorage.getItem('userProfile') ||
      '{}'
  );
  return profile.phone || profile.telefone || null;
}

// tornar acessíveis globalmente
window.navOpenFeed = navOpenFeed;
window.loadMorePosts = loadMorePosts;
window.checkUserCanPost = checkUserCanPost;
window.timeAgo = timeAgo;
window.getUserPhone = getUserPhone;

// inicialização de stories (apenas restaurante). chamada ao carregar o feed
function _renderStories() {
  const bar = document.getElementById('feed-stories-bar');
  if (!bar) return;
  bar.innerHTML = `
    <div class="story-item flex flex-col items-center cursor-pointer">
      <div class="w-14 h-14 rounded-full bg-primary flex items-center justify-center overflow-hidden">
        <img src="../assets/images/logos/logo.png" class="w-full h-full object-cover" />
      </div>
      <span class="text-[0.65rem] mt-1">Ignite</span>
    </div>
  `;
}

// chamar quando modal abrir
// já faz parte de loadFeedPosts antes de renderizar os posts


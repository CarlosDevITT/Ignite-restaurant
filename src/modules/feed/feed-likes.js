// feed-likes.js - likes, comentários e compartilhamento do feed

let currentCommentPostId = null;

async function toggleLike(postId) {
  const telefone = getUserPhone();
  if (!telefone) {
    Swal.fire({ icon: 'warning', title: 'Faça login para curtir' });
    return;
  }

  const btn = document.querySelector(`button.like-btn[data-post-id="${postId}"] i`);
  if (!btn) return;
  const liked = btn.classList.contains('fas');

  try {
    if (liked) {
      // remove like record
      await window.supabaseManager.client
        .from('feed_likes')
        .delete()
        .eq('post_id', postId)
        .eq('telefone', telefone);
      btn.classList.remove('fas', 'text-red-500');
      btn.classList.add('far', 'text-gray-700');
    } else {
      // add like
      await window.supabaseManager.client
        .from('feed_likes')
        .insert([{ post_id: postId, telefone }]);
      btn.classList.remove('far', 'text-gray-700');
      btn.classList.add('fas', 'text-red-500');
    }
    // always refresh count from backend (keeps consistency)
    try {
      const { data: postData } = await window.supabaseManager.client
        .from('feed_posts')
        .select('likes')
        .eq('id', postId)
        .single();
      if (postData) {
        const el = document.getElementById(`likes-count-${postId}`);
        if (el) el.textContent = `${postData.likes} curtidas`;
      }
    } catch (e) {
      console.warn('Não foi possível atualizar contador de likes', e);
    }
  } catch (e) {
    console.error('Erro toggling like', e);
  }
}

function _updateLikesCount(postId, delta) {
  const el = document.getElementById(`likes-count-${postId}`);
  if (!el) return;
  const current = parseInt(el.textContent) || 0;
  el.textContent = `${current + delta} curtidas`;
}

function sharePost(postId) {
  const url = `${window.location.origin}/cart-pay/index.html?feed=${postId}`;
  if (navigator.share) {
    navigator.share({ title: 'Veja este post no Feed Ignite', url });
  } else {
    navigator.clipboard.writeText(url);
    if (typeof Swal !== 'undefined') {
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Link copiado!', showConfirmButton: false, timer: 2000 });
    }
  }
}

function openComments(postId) {
  currentCommentPostId = postId;
  const sheet = document.getElementById('comments-sheet');
  if (!sheet) return;
  sheet.classList.remove('hidden');
  _loadComments(postId);
}

function closeComments() {
  const sheet = document.getElementById('comments-sheet');
  if (sheet) sheet.classList.add('hidden');
}

async function _loadComments(postId) {
  const list = document.getElementById('comments-list');
  if (!list) return;
  list.innerHTML = '<p class="text-center text-gray-400 text-sm">Carregando...</p>';
  try {
    const { data } = await window.supabaseManager.client
      .from('feed_comentarios')
      .select('*')
      .eq('post_id', postId)
      .order('criado_em', { ascending: true });
    list.innerHTML = '';
    if (data && data.length) {
      data.forEach(c => {
        const el = document.createElement('div');
        el.className = 'text-sm';
        el.innerHTML = `<span class="font-bold">${c.nome_usuario}</span> ${c.texto}`;
        list.appendChild(el);
      });
    } else {
      list.innerHTML = '<p class="text-center text-gray-400 text-sm">Seja o primeiro a comentar</p>';
    }
  } catch (e) {
    console.error('Erro carregando comentários:', e);
    list.innerHTML = '<p class="text-center text-red-500 text-sm">Erro ao carregar</p>';
  }
}

async function submitComment(postId) {
  const textarea = document.getElementById('comment-input');
  if (!textarea) return;
  const texto = textarea.value.trim();
  if (!texto) return;
  const telefone = getUserPhone();
  if (!telefone) {
    Swal.fire({ icon: 'warning', title: 'Faça login para comentar' });
    return;
  }
  const profile = JSON.parse(
    localStorage.getItem('ignite_user_profile') ||
      localStorage.getItem('userProfile') ||
      '{}'
  );
  const nome = profile.name || profile.nome || telefone;

  try {
    await window.supabaseManager.client
      .from('feed_comentarios')
      .insert([{ post_id: postId, telefone, nome_usuario: nome, texto }]);
    textarea.value = '';
    _loadComments(postId);
  } catch (e) {
    console.error('Erro enviando comentário', e);
  }
}

window.toggleLike = toggleLike;
window.sharePost = sharePost;
window.openComments = openComments;
window.closeComments = closeComments;
window.submitComment = submitComment;
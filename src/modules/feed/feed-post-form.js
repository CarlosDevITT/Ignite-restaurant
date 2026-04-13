// feed-post-form.js - gerenciamento do formulário de novo post

let _selectedImageFile = null;
let _starRating = 0;

function openNewPostForm() {
  const telefone = getUserPhone();
  if (!telefone) {
    Swal.fire({ icon: 'warning', title: 'Faça login para postar!' });
    return;
  }

  checkUserCanPost(telefone).then(can => {
    if (!can) {
      Swal.fire({ icon: 'info', title: 'Faça seu primeiro pedido para participar do Feed! 🍔' });
      return;
    }

    // limpar form
    document.getElementById('post-image-preview').innerHTML = `
      <div class="text-center text-gray-400">
        <i class="fas fa-camera text-3xl mb-2"></i>
        <p class="text-sm">Toque para adicionar foto</p>
      </div>`;
    document.getElementById('post-descricao').value = '';
    _selectedImageFile = null;
    _starRating = 0;
    document.querySelectorAll('.star-input').forEach(s => {
      s.classList.remove('text-yellow-400');
      s.classList.add('text-gray-300');
    });
    const productSelect = document.getElementById('post-produto-select');
    if (productSelect) productSelect.selectedIndex = 0;

    // carregar produtos para select
    if (window.supabaseManager && typeof window.supabaseManager.getProdutos === 'function') {
      window.supabaseManager.getProdutos().then(products => {
        const sel = document.getElementById('post-produto-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">Vincular a um produto (opcional)</option>';
        products.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.nome || p.name || 'Produto';
          sel.appendChild(opt);
        });
      });
    }

    const sheet = document.getElementById('new-post-sheet');
    sheet.classList.remove('hidden');
    sheet.removeAttribute('aria-hidden');
  });
}

function closeNewPostForm() {
  document.getElementById('new-post-sheet').classList.add('hidden');
}

function handleImageSelect(file) {
  if (!file) return;
  // compress if necessary
  compressImage(file, 0.7, 1024).then(blob => {
    _selectedImageFile = blob;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('post-image-preview').innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover rounded-xl"/>`;
    };
    reader.readAsDataURL(blob);
  });
}

function compressImage(file, quality = 0.8, maxWidth = 1024) {
  return new Promise(resolve => {
    const img = document.createElement('img');
    const reader = new FileReader();
    reader.onload = e => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (blob.size > 1024 * 1024) {
          // se ainda estiver >1MB, reduzir qualidade mais
          canvas.toBlob(b2 => resolve(b2), 'image/jpeg', quality / 2);
        } else {
          resolve(blob);
        }
      }, 'image/jpeg', quality);
    };
  });
}

async function uploadImageToSupabase(file) {
  if (!file) return null;
  const ext = file.type.split('/').pop();
  const fileName = `feed_${Date.now()}.${ext}`;
  try {
    const { data, error } = await window.supabaseManager.client
      .storage
      .from('feed-images')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    // construir URL pública manualmente (bucket público)
    const url = `${SUPABASE_CONFIG.url.replace(/\/$/, '')}/storage/v1/object/public/feed-images/${fileName}`;
    return url;
  } catch (e) {
    console.error('Erro upload imagem:', e);
    return null;
  }
}

async function submitPost() {
  const descricao = document.getElementById('post-descricao').value.trim();
  const produtoId = document.getElementById('post-produto-select').value || null;
  const rawPhone = getUserPhone();
  const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '') : null;
  if (!cleanPhone) {
    Swal.fire({ icon: 'warning', title: 'Faça login para postar' });
    return;
  }
 
  if (!_selectedImageFile && !descricao) {
    Swal.fire({ icon: 'warning', title: 'Insira uma imagem ou descrição' });
    return;
  }
 
  if (descricao.length > 300) {
    Swal.fire({ icon: 'warning', title: 'Descrição limitada a 300 caracteres' });
    return;
  }
 
  const profile = JSON.parse(localStorage.getItem('igniteProfile') || '{}');
  const nomeUsuario = profile.name || profile.nome || rawPhone;
  const tipo = cleanPhone === '92999999999' ? 'restaurante' : 'cliente';

  // mostrar loading
  const btn = document.querySelector('#new-post-sheet button[onclick="submitPost()"]');
  if (btn) btn.disabled = true;

  let imagemUrl = null;
  if (_selectedImageFile) {
    imagemUrl = await uploadImageToSupabase(_selectedImageFile);
  }

  try {
    const { error } = await window.supabaseManager.client
      .from('feed_posts')
      .insert([{
        usuario_id: profile.id || null,
        telefone: cleanPhone,
        nome_usuario: nomeUsuario,
        tipo,
        imagem_url: imagemUrl,
        descricao: descricao || null,
        produto_id: (produtoId && !isNaN(produtoId)) ? parseInt(produtoId) : produtoId,
        pedido_id: null,
        avaliacao: _starRating || null,
        likes: 0,
        aprovado: tipo === 'restaurante'
      }]);
    if (error) throw error;

    closeNewPostForm();
    if (tipo === 'restaurante') {
      Swal.fire({ icon: 'success', title: 'Post publicado!' });
      // recarregar feed imediatamente
      if (typeof navOpenFeed === 'function') navOpenFeed();
    } else {
      Swal.fire({ icon: 'success', title: 'Seu post está em análise! ✅' });
      // podemos também recarregar para mostrar futuros posts aprovados
      if (typeof navOpenFeed === 'function') navOpenFeed();
    }
  } catch (e) {
    console.error('Erro enviando post:', e);
    Swal.fire({ icon: 'error', title: 'Falha ao publicar' });
  } finally {
    if (btn) btn.disabled = false;
  }
}

// eventos auxiliares

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('post-image-input');
  if (input) {
    input.addEventListener('change', e => handleImageSelect(e.target.files[0]));
  }

  document.querySelectorAll('.star-input').forEach(star => {
    star.addEventListener('click', () => {
      _starRating = parseInt(star.dataset.value);
      document.querySelectorAll('.star-input').forEach(s => {
        const val = parseInt(s.dataset.value);
        s.classList.toggle('text-yellow-400', val <= _starRating);
        s.classList.toggle('text-gray-300', val > _starRating);
      });
    });
  });

  const textarea = document.getElementById('post-descricao');
  if (textarea) {
    textarea.addEventListener('input', () => {
      if (textarea.value.length > 300) textarea.value = textarea.value.slice(0, 300);
    });
  }
});

// expor globalmente
window.openNewPostForm = openNewPostForm;
window.closeNewPostForm = closeNewPostForm;
window.handleImageSelect = handleImageSelect;
window.submitPost = submitPost;
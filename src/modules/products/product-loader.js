// product-loader.js — v2.0
// Stories slider + cart listeners, totalmente refatorado
(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────────────────
   * CONSTANTES & ESTADO
   * ──────────────────────────────────────────────────────────────────────── */
  const STORY_DURATION  = 5000;   // ms por slide
  const MAX_RETRIES     = 50;
  const RETRY_INTERVAL  = 100;    // ms entre tentativas

  const state = {
    currentIndex : 0,
    isFullscreen : false,
    autoPlayTimer: null,
    progressTimer: null,
    retryCount   : 0,
    touchStartX  : 0,
    isPaused     : false,
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * UTILITÁRIOS
   * ──────────────────────────────────────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);

  function getDisplayPrice(product) {
    if (typeof window.getDisplayPrice === 'function') {
      return window.getDisplayPrice(product);
    }
    const price = parseFloat(product.price) || 0;
    const promo = parseFloat(product.promo_price);
    if (!isNaN(promo) && promo < price) {
      return { final: promo, original: price, hasPromo: true };
    }
    return { final: price, hasPromo: false };
  }

  function formatPrice(value) {
    return value.toFixed(2).replace('.', ',');
  }

  function getFeaturedProducts() {
    return (window.products || []).filter(p => p.featured && p.available !== false);
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * AGUARDAR CART MANAGER
   * ──────────────────────────────────────────────────────────────────────── */
  function waitForCart() {
    const hasCart = typeof window.addToCart === 'function' || !!window.cartManager;

    if (hasCart) {
      initProductLoaders();
      return;
    }

    if (state.retryCount < MAX_RETRIES) {
      state.retryCount++;
      setTimeout(waitForCart, RETRY_INTERVAL);
    } else {
      console.warn('[ProductLoader] Cart não encontrado após tentativas — iniciando mesmo assim.');
      initProductLoaders();
    }
  }

  function initProductLoaders() {
    initStoriesSlider();
    attachCartListeners();
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * STORIES SLIDER
   * ──────────────────────────────────────────────────────────────────────── */
  function initStoriesSlider() {
    const featured = getFeaturedProducts();

    if (featured.length === 0) {
      showEmptyStories();
      return;
    }

    renderProgressBars(featured);
    renderStories(featured);
    setupSliderEvents(featured);
    startAutoplay(featured);
  }

  /* Estado vazio ─────────────────────────────────────────────────────────── */
  function showEmptyStories() {
    const hide = ['stories-container', 'progress-container', 'prev-story', 'next-story', 'toggle-fullscreen'];
    hide.forEach(id => $( id)?.classList.add('hidden'));
    $('stories-empty')?.classList.remove('hidden');
  }

  /* Barras de progresso ──────────────────────────────────────────────────── */
  function renderProgressBars(featured) {
    const container = $('progress-container');
    if (!container) return;

    container.innerHTML = featured.map((_, i) => `
      <div class="h-[3px] flex-1 ${i > 0 ? 'ml-1' : ''} bg-white bg-opacity-30 rounded-full overflow-hidden">
        <div id="progress-fill-${i}" class="h-full bg-white rounded-full w-0"></div>
      </div>
    `).join('');

    container.classList.remove('hidden');
  }

  function animateProgressBar(index) {
    // Reset todas
    document.querySelectorAll('[id^="progress-fill-"]').forEach((bar, i) => {
      bar.style.transition = 'none';
      bar.style.width = i < index ? '100%' : '0%';
    });

    // Animar atual
    const bar = $(`progress-fill-${index}`);
    if (!bar) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.transition = `width ${STORY_DURATION}ms linear`;
        bar.style.width = '100%';
      });
    });
  }

  /* Renderizar slides ─────────────────────────────────────────────────────── */
  function renderStories(featured) {
    const container = $('stories-container');
    if (!container) return;

    container.innerHTML = '';
    container.style.width = `${featured.length * 100}%`;
    container.classList.remove('hidden');
    $('stories-empty')?.classList.add('hidden');

    featured.forEach((product, index) => {
      const priceInfo = getDisplayPrice(product);
      const slide = document.createElement('div');

      slide.className = 'w-full flex-shrink-0 relative story-card';
      slide.style.width = `${100 / featured.length}%`;
      slide.setAttribute('data-id', product.id);
      slide.setAttribute('data-index', index);

      const discountPct = priceInfo.hasPromo
        ? Math.round((1 - priceInfo.final / priceInfo.original) * 100)
        : null;

      slide.innerHTML = `
        <div class="w-full h-64 md:h-96 relative overflow-hidden bg-gray-900">

          ${product.image_url
            ? `<img
                src="${product.image_url}"
                alt="${product.name}"
                class="w-full h-full object-cover"
                style="transition: transform 6s ease; transform: scale(1.06);"
                onload="this.style.transform='scale(1)'"
                onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center bg-gray-800\\'><i class=\\'fas fa-utensils text-6xl text-gray-600\\'></i></div>'"
              >`
            : `<div class="w-full h-full flex items-center justify-center bg-gray-800">
                 <i class="fas fa-utensils text-6xl text-gray-600"></i>
               </div>`
          }

          ${discountPct ? `
            <div class="absolute top-14 right-4 z-10 flex flex-col items-center justify-center
                        w-14 h-14 rounded-full text-white font-black text-sm shadow-lg"
                 style="background: linear-gradient(135deg,#ff4444,#ff6b35); box-shadow:0 3px 12px rgba(255,68,68,0.5);">
              -${discountPct}%
            </div>
          ` : product.promo ? `
            <div class="absolute top-14 right-4 z-10 bg-red-500 text-white text-xs font-bold
                        px-3 py-1.5 rounded-full shadow-lg uppercase tracking-wide">
              <i class="fas fa-fire mr-1"></i>Promo
            </div>
          ` : ''}

          <!-- Gradiente inferior -->
          <div class="absolute inset-0 pointer-events-none"
               style="background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 50%, transparent 100%);">
          </div>

          <!-- Conteúdo inferior -->
          <div class="absolute bottom-0 left-0 right-0 p-5 text-white">
            <p class="text-[0.65rem] font-semibold uppercase tracking-[0.12em] opacity-60 mb-1">
              ${product.category || 'Destaque'}
            </p>
            <h3 class="font-black text-xl leading-tight mb-1" style="font-family:'Poppins',sans-serif; letter-spacing:-0.02em;">
              ${product.name}
            </h3>
            ${product.description
              ? `<p class="text-xs opacity-75 leading-relaxed mb-3 line-clamp-2"
                    style="font-family:'Inter',sans-serif; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                  ${product.description}
                </p>`
              : '<div class="mb-3"></div>'
            }

            <div class="flex items-center justify-between gap-3">
              <div class="flex flex-col">
                ${priceInfo.hasPromo ? `
                  <span class="text-[0.7rem] line-through opacity-50 leading-none">
                    R$ ${formatPrice(priceInfo.original)}
                  </span>
                  <span class="text-2xl font-black leading-none" style="color:#ff6b6b; text-shadow:0 1px 4px rgba(0,0,0,0.4);">
                    R$ ${formatPrice(priceInfo.final)}
                  </span>
                ` : `
                  <span class="text-2xl font-black leading-none" style="color:#4ade80; text-shadow:0 1px 4px rgba(0,0,0,0.4);">
                    R$ ${formatPrice(priceInfo.final)}
                  </span>
                `}
              </div>

              <button
                class="add-to-cart-story flex items-center gap-2 font-bold text-sm text-white
                       px-4 py-2.5 rounded-xl flex-shrink-0 transition-all duration-200
                       active:scale-95 hover:shadow-lg"
                style="background: linear-gradient(135deg,#069C54,#04a85a); box-shadow:0 3px 12px rgba(6,156,84,0.4);"
                data-id="${product.id}">
                <i class="fas fa-cart-plus text-base"></i>
                <span>Adicionar</span>
              </button>
            </div>

            ${product.promo_text ? `
              <div class="mt-3 rounded-xl px-3 py-2 flex items-center gap-2"
                   style="background:rgba(255,220,0,0.12); border:1px solid rgba(255,220,0,0.25);">
                <i class="fas fa-bullhorn text-yellow-300 text-xs flex-shrink-0"></i>
                <p class="text-xs text-yellow-200 leading-snug">${product.promo_text}</p>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      container.appendChild(slide);
    });

    goToSlide(state.currentIndex, featured);
  }

  /* Navegação ────────────────────────────────────────────────────────────── */
  function goToSlide(index, featured) {
    if (!featured || featured.length === 0) return;

    state.currentIndex = ((index % featured.length) + featured.length) % featured.length;
    const container = $('stories-container');
    if (!container) return;

    const translateX = -(100 / featured.length) * state.currentIndex;
    container.style.transition = 'transform 0.4s cubic-bezier(0.4,0,0.2,1)';
    container.style.transform  = `translateX(${translateX}%)`;

    animateProgressBar(state.currentIndex);
    announceToScreenReader(`Produto ${state.currentIndex + 1} de ${featured.length}: ${featured[state.currentIndex].name}`);
  }

  function goToNext() {
    const featured = getFeaturedProducts();
    goToSlide(state.currentIndex + 1, featured);
    resetAutoplay(featured);
  }

  function goToPrev() {
    const featured = getFeaturedProducts();
    goToSlide(state.currentIndex - 1, featured);
    resetAutoplay(featured);
  }

  /* Autoplay ─────────────────────────────────────────────────────────────── */
  function startAutoplay(featured) {
    if (!featured) featured = getFeaturedProducts();
    if (featured.length <= 1) return;
    clearInterval(state.autoPlayTimer);
    state.autoPlayTimer = setInterval(() => {
      if (!state.isPaused) goToNext();
    }, STORY_DURATION);
  }

  function resetAutoplay(featured) {
    clearInterval(state.autoPlayTimer);
    startAutoplay(featured);
  }

  /* Eventos do slider ────────────────────────────────────────────────────── */
  function setupSliderEvents(featured) {
    const prevBtn = $('prev-story');
    const nextBtn = $('next-story');
    const fsBtn   = $('toggle-fullscreen');
    const slider  = $('stories-slider');

    prevBtn?.addEventListener('click', (e) => { e.stopPropagation(); goToPrev(); });
    nextBtn?.addEventListener('click', (e) => { e.stopPropagation(); goToNext(); });
    fsBtn  ?.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });

    // Touch swipe
    if (slider) {
      slider.addEventListener('touchstart', (e) => {
        state.touchStartX = e.touches[0].clientX;
        state.isPaused = true;
      }, { passive: true });

      slider.addEventListener('touchend', (e) => {
        const delta = e.changedTouches[0].clientX - state.touchStartX;
        state.isPaused = false;
        if (Math.abs(delta) > 40) {
          delta < 0 ? goToNext() : goToPrev();
        }
      });

      // Pausar autoplay ao hover (desktop)
      slider.addEventListener('mouseenter', () => { state.isPaused = true; });
      slider.addEventListener('mouseleave', () => { state.isPaused = false; });
    }

    // Teclado quando fullscreen
    document.addEventListener('keydown', (e) => {
      if (!state.isFullscreen) return;
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'ArrowLeft')  goToPrev();
      if (e.key === 'Escape')     toggleFullscreen();
    });
  }

  /* Fullscreen ───────────────────────────────────────────────────────────── */
  function toggleFullscreen() {
    const slider  = $('stories-slider');
    const fsBtn   = $('toggle-fullscreen');
    const progBar = $('progress-container');
    const prevBtn = $('prev-story');
    const nextBtn = $('next-story');
    if (!slider) return;

    if (!state.isFullscreen) {
      // Entrar em fullscreen
      slider.style.cssText = `
        position: fixed; top: 0; left: 0;
        width: 100vw; height: 100vh; max-height: 100vh;
        z-index: 9990; background: #000;
        border-radius: 0;
      `;
      slider.classList.remove('rounded-xl', 'shadow-lg');

      fsBtn && (fsBtn.innerHTML = '<i class="fas fa-compress"></i>');
      progBar && (progBar.style.cssText = 'padding: 1.5rem 1.25rem 0;');
      prevBtn && (prevBtn.style.cssText = 'width:3rem; height:3rem; font-size:1.125rem;');
      nextBtn && (nextBtn.style.cssText = 'width:3rem; height:3rem; font-size:1.125rem;');

      document.body.style.overflow   = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      if (window.innerWidth <= 768) showMobileInstructions();

    } else {
      // Sair de fullscreen
      slider.style.cssText = '';
      slider.classList.add('rounded-xl', 'shadow-lg');

      fsBtn && (fsBtn.innerHTML = '<i class="fas fa-expand"></i>');
      if (progBar) progBar.style.cssText = '';
      if (prevBtn) prevBtn.style.cssText = '';
      if (nextBtn) nextBtn.style.cssText = '';

      document.body.style.overflow   = '';
      document.documentElement.style.overflow = '';

      hideMobileInstructions();
    }

    state.isFullscreen = !state.isFullscreen;

    // Atualizar posição após repaint
    setTimeout(() => goToSlide(state.currentIndex, getFeaturedProducts()), 50);
  }

  /* Instruções mobile ────────────────────────────────────────────────────── */
  function showMobileInstructions() {
    if (sessionStorage.getItem('ignite_story_tips')) return;

    const el = document.createElement('div');
    el.id = 'mobile-instructions';
    el.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);';
    el.innerHTML = `
      <div style="background:#fff;border-radius:20px;padding:1.75rem;max-width:320px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="width:56px;height:56px;background:linear-gradient(135deg,#069C54,#04a85a);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
          <i class="fas fa-hand-pointer" style="color:#fff;font-size:1.4rem;"></i>
        </div>
        <h3 style="font-family:'Poppins',sans-serif;font-weight:800;font-size:1.1rem;margin-bottom:.5rem;color:#1a1a2e;">Como navegar</h3>
        <p style="font-family:'Inter',sans-serif;font-size:0.82rem;color:#64748b;line-height:1.7;margin-bottom:1.25rem;">
          👈 Deslize para <strong>voltar</strong><br>
          👉 Deslize para <strong>avançar</strong><br>
          🔲 Toque no ícone para sair
        </p>
        <button onclick="(function(){
            var el=document.getElementById('mobile-instructions');
            if(el){el.style.opacity='0';el.style.transition='opacity .25s';setTimeout(function(){el.remove();},260);}
            sessionStorage.setItem('ignite_story_tips','1');
          })()"
          style="background:linear-gradient(135deg,#069C54,#04a85a);color:#fff;border:none;border-radius:12px;padding:11px 24px;font-family:'Poppins',sans-serif;font-weight:700;font-size:.9rem;width:100%;cursor:pointer;box-shadow:0 4px 14px rgba(6,156,84,0.35);">
          Entendi!
        </button>
      </div>
    `;
    document.body.appendChild(el);

    // Auto-remover em 6s
    setTimeout(() => {
      const existing = document.getElementById('mobile-instructions');
      if (existing) { existing.style.opacity = '0'; existing.style.transition = 'opacity .25s'; setTimeout(() => existing.remove(), 260); }
      sessionStorage.setItem('ignite_story_tips', '1');
    }, 6000);
  }

  function hideMobileInstructions() {
    const el = document.getElementById('mobile-instructions');
    if (el) el.remove();
  }

  /* Acessibilidade ─────────────────────────────────────────────────────── */
  function announceToScreenReader(message) {
    let el = document.getElementById('sr-story-announcer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sr-story-announcer';
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;';
      document.body.appendChild(el);
    }
    el.textContent = message;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * CART LISTENERS
   * ──────────────────────────────────────────────────────────────────────── */
  function attachCartListeners() {
    // Delegação única para stories + cards do menu
    document.addEventListener('click', (e) => {
      const storyBtn = e.target.closest('.add-to-cart-story');
      const cardBtn  = e.target.closest('.btn-add[data-id]');
      const btn      = storyBtn || cardBtn;
      if (!btn) return;

      e.stopImmediatePropagation();
      e.preventDefault();

      // Debounce simples
      if (btn.dataset.pending === '1') return;
      btn.dataset.pending = '1';
      setTimeout(() => { btn.dataset.pending = ''; }, 600);

      handleAddToCart(btn.getAttribute('data-id'), btn);
    });
  }

  function handleAddToCart(productId, btn) {
    const addFn = typeof window.addToCart === 'function' ? window.addToCart : null;

    if (addFn) {
      addFn(productId);
      feedbackAdded(btn);
      return;
    }

    if (window.cartManager) {
      const product = (window.products || []).find(p => String(p.id) === String(productId));
      if (product) {
        window.cartManager.addItem({
          id   : product.id,
          name : product.name,
          price: parseFloat(product.price) || 0,
          image: product.image_url,
        });
        feedbackAdded(btn);
      }
      return;
    }

    console.error('[ProductLoader] Nenhum gerenciador de carrinho disponível.');
  }

  function feedbackAdded(btn) {
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML  = '<i class="fas fa-check"></i><span style="margin-left:6px">Adicionado!</span>';
    btn.disabled   = true;
    btn.style.background = 'linear-gradient(135deg,#4CAF50,#43A047)';

    setTimeout(() => {
      btn.innerHTML  = original;
      btn.disabled   = false;
      btn.style.background = '';
    }, 2000);
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * API PÚBLICA
   * ──────────────────────────────────────────────────────────────────────── */
  window.refreshStoriesSlider = function () {
    state.currentIndex = 0;
    clearInterval(state.autoPlayTimer);
    initStoriesSlider();
  };

  /* ─────────────────────────────────────────────────────────────────────────
   * BOOT
   * ──────────────────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForCart);
  } else {
    waitForCart();
  }

})();
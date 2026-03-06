// main.js — Ignite Restaurant Landing Page v3.0
// Handles: nav, theme, scroll, reveal, share, PWA install
(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────
   * UTILITY
   * ──────────────────────────────────────────────────────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ─────────────────────────────────────────────────────────
   * NAVIGATION — mobile toggle
   * ──────────────────────────────────────────────────────── */
  const navMenu   = $('#nav-menu');
  const navToggle = $('#nav-toggle');
  const navClose  = $('#nav-close');

  function openMenu() {
    navMenu?.classList.add('show-menu');
    navToggle && (navToggle.innerHTML = "<i class='bx bx-x'></i>");
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    navMenu?.classList.remove('show-menu');
    navToggle && (navToggle.innerHTML = "<i class='bx bx-menu'></i>");
    document.body.style.overflow = '';
  }

  navToggle?.addEventListener('click', () => {
    navMenu?.classList.contains('show-menu') ? closeMenu() : openMenu();
  });

  navClose?.addEventListener('click', closeMenu);

  // Close on nav link click
  $$('.nav__link').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (navMenu?.classList.contains('show-menu') &&
        !navMenu.contains(e.target) &&
        !navToggle?.contains(e.target)) {
      closeMenu();
    }
  });

  /* ─────────────────────────────────────────────────────────
   * ACTIVE LINK on scroll
   * ──────────────────────────────────────────────────────── */
  const sections = $$('section[id]');

  function updateActiveLink() {
    const scrollY = window.scrollY;

    sections.forEach(section => {
      const top    = section.offsetTop - 100;
      const height = section.offsetHeight;
      const id     = section.getAttribute('id');
      const link   = $(`.nav__link[href="#${id}"]`);

      if (!link) return;

      if (scrollY >= top && scrollY < top + height) {
        $$('.nav__link').forEach(l => l.classList.remove('active-link'));
        link.classList.add('active-link');
      }
    });
  }

  /* ─────────────────────────────────────────────────────────
   * SCROLL HEADER — shadow on scroll
   * ──────────────────────────────────────────────────────── */
  const header = $('#header');

  function scrollHeader() {
    if (window.scrollY >= 50) {
      header?.classList.add('scroll-header');
    } else {
      header?.classList.remove('scroll-header');
    }
  }

  /* ─────────────────────────────────────────────────────────
   * SCROLL TOP button
   * ──────────────────────────────────────────────────────── */
  const scrollTopBtn = $('#scroll-top');

  function handleScrollTop() {
    if (window.scrollY >= 400) {
      scrollTopBtn?.classList.add('show-scroll');
    } else {
      scrollTopBtn?.classList.remove('show-scroll');
    }
  }

  /* ─────────────────────────────────────────────────────────
   * SCROLL REVEAL — IntersectionObserver
   * ──────────────────────────────────────────────────────── */
  function initReveal() {
    const elements = $$('.reveal');
    if (!elements.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    elements.forEach(el => observer.observe(el));
  }

  /* ─────────────────────────────────────────────────────────
   * ANIMATED COUNTER for stats
   * ──────────────────────────────────────────────────────── */
  function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target)) return;

    const duration  = 1600;
    const startTime = performance.now();

    function update(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-expo
      const eased    = 1 - Math.pow(2, -10 * progress);
      el.textContent = Math.round(eased * target) + (el.dataset.suffix || '');
      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  function initCounters() {
    const counters = $$('[data-count]');
    if (!counters.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(el => observer.observe(el));
  }

  /* ─────────────────────────────────────────────────────────
   * DARK / LIGHT THEME
   * ──────────────────────────────────────────────────────── */
  const themeBtn  = $('#theme-button');
  const THEME_KEY = 'igniteTheme';

  const ICONS = {
    dark:  "<i class='bx bx-moon change-theme' id='theme-button'></i>",
    light: "<i class='bx bx-sun change-theme' id='theme-button'></i>",
  };

  function applyTheme(isDark) {
    document.body.classList.toggle('dark-theme', isDark);
    if (themeBtn) {
      themeBtn.className = 'change-theme';
      themeBtn.innerHTML = '';
      const icon = document.createElement('i');
      icon.className = isDark ? 'bx bx-sun' : 'bx bx-moon';
      themeBtn.appendChild(icon);
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved ? saved === 'dark' : prefersDark);
  }

  function toggleTheme() {
    const isDark = !document.body.classList.contains('dark-theme');
    applyTheme(isDark);
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  }

  // Theme button — re-query after DOM mutations
  document.addEventListener('click', (e) => {
    if (e.target.closest('#theme-button') || e.target.closest('.change-theme')) {
      toggleTheme();
    }
  });

  /* ─────────────────────────────────────────────────────────
   * WEB SHARE
   * ──────────────────────────────────────────────────────── */
  function showToast(msg, icon = 'success') {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon,
        title: msg,
        showConfirmButton: false,
        timer: 2200,
        timerProgressBar: true,
      });
    }
  }

  async function sharePage() {
    const shareData = {
      title: 'Ignite – Restaurante Pub',
      text: 'Confira os melhores pratos da cidade no Ignite! 🔥',
      url: window.location.href,
    };

    if (navigator.share) {
      try { await navigator.share(shareData); }
      catch (err) { if (err.name !== 'AbortError') console.error(err); }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showToast('Link copiado! 🔗');
      } catch {
        showToast('Não foi possível copiar', 'error');
      }
    }
  }

  $('#share-button')?.addEventListener('click', sharePage);

  // Expose globally for inline onclick uses
  window.shareProduct = async function (name, desc, id) {
    const url  = `${window.location.origin}/cart-pay/index.html?item=${id}`;
    const text = `Olha esse ${name} do Ignite! 😋`;
    if (navigator.share) {
      try { await navigator.share({ title: name, text, url }); }
      catch (err) { if (err.name !== 'AbortError') console.error(err); }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {});
      showToast('Link copiado!');
    }
  };

  /* ─────────────────────────────────────────────────────────
   * PWA INSTALL BANNER
   * ──────────────────────────────────────────────────────── */
  let deferredPrompt  = null;
  const installBanner = $('#install-banner');
  const btnInstall    = $('#btn-install');
  const btnCloseBanner = $('#btn-close-banner');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    if (!sessionStorage.getItem('installBannerClosed')) {
      setTimeout(() => installBanner?.classList.add('show'), 4500);
    }
  });

  btnInstall?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);
    deferredPrompt = null;
    installBanner?.classList.remove('show');
  });

  btnCloseBanner?.addEventListener('click', () => {
    installBanner?.classList.remove('show');
    sessionStorage.setItem('installBannerClosed', 'true');
  });

  window.addEventListener('appinstalled', () => {
    installBanner?.classList.remove('show');
    deferredPrompt = null;
    showToast('App instalado com sucesso! 🎉');
  });

  /* ─────────────────────────────────────────────────────────
   * SERVICE WORKER
   * ──────────────────────────────────────────────────────── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[SW] Registered:', reg.scope))
        .catch(err => console.warn('[SW] Registration failed:', err));
    });
  }

  /* ─────────────────────────────────────────────────────────
   * SMOOTH SCROLL for hash links
   * ──────────────────────────────────────────────────────── */
  $$('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = $(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const headerH = header?.offsetHeight || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - headerH - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  /* ─────────────────────────────────────────────────────────
   * SCROLL EVENT (throttled)
   * ──────────────────────────────────────────────────────── */
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      scrollHeader();
      handleScrollTop();
      updateActiveLink();
      ticking = false;
    });
  }, { passive: true });

  /* ─────────────────────────────────────────────────────────
   * SERVICES CARD — stagger via CSS delay
   * ──────────────────────────────────────────────────────── */
  function staggerServiceCards() {
    $$('.services__content').forEach((card, i) => {
      card.classList.add('reveal');
      card.style.transitionDelay = `${i * 0.1}s`;
    });
  }

  /* ─────────────────────────────────────────────────────────
   * INIT
   * ──────────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    staggerServiceCards();
    initReveal();
    initCounters();

    // Trigger initial checks
    scrollHeader();
    handleScrollTop();
    updateActiveLink();

    // Mark home link active on load
    const homeLink = $('.nav__link[href="#home"]');
    if (homeLink && window.scrollY < 100) {
      $$('.nav__link').forEach(l => l.classList.remove('active-link'));
      homeLink.classList.add('active-link');
    }
  });

})();
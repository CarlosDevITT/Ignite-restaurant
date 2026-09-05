// main.js — Ignite Restaurant v3.2
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ── THEME (pode rodar antes do DOMContentLoaded) ── */
  const THEME_KEY = 'igniteTheme';

  function applyTheme(isDark) {
    document.body.classList.toggle('dark-theme', isDark);
    const btn = document.getElementById('theme-button');
    if (btn) {
      btn.innerHTML = '';
      const icon = document.createElement('i');
      icon.className = isDark ? 'bx bx-sun' : 'bx bx-moon';
      btn.appendChild(icon);
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved ? saved === 'dark' : prefersDark);
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('#theme-button') || e.target.closest('.change-theme')) {
      const isDark = !document.body.classList.contains('dark-theme');
      applyTheme(isDark);
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    }
  });

  /* ── TUDO O MAIS roda após DOM pronto ── */
  document.addEventListener('DOMContentLoaded', function () {

    initTheme();

    /* NAV */
    const navMenu   = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');

    function openMenu() {
      if (!navMenu) return;
      navMenu.classList.add('show-menu');
      if (navToggle) {
        navToggle.innerHTML = "<i class='bx bx-x' aria-hidden='true'></i>";
        navToggle.setAttribute('aria-expanded', 'true');
        navToggle.setAttribute('aria-label', 'Fechar menu');
      }
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      if (!navMenu) return;
      navMenu.classList.remove('show-menu');
      if (navToggle) {
        navToggle.innerHTML = "<i class='bx bx-menu' aria-hidden='true'></i>";
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Abrir menu');
      }
      document.body.style.overflow = '';
    }

    if (navToggle) {
      navToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        navMenu && navMenu.classList.contains('show-menu') ? closeMenu() : openMenu();
      });
    }

    $$('.nav__link').forEach(function (link) {
      link.addEventListener('click', function () {
        if (navMenu && navMenu.classList.contains('show-menu')) closeMenu();
      });
    });

    document.addEventListener('click', function (e) {
      if (
        navMenu && navMenu.classList.contains('show-menu') &&
        !navMenu.contains(e.target) &&
        navToggle && !navToggle.contains(e.target)
      ) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navMenu && navMenu.classList.contains('show-menu')) {
        closeMenu();
        if (navToggle) navToggle.focus();
      }
    });

    /* ACTIVE LINK */
    const sections = $$('section[id]');
    const header   = document.getElementById('header');

    function updateActiveLink() {
      const scrollY = window.scrollY;
      sections.forEach(function (section) {
        const top    = section.offsetTop - 100;
        const height = section.offsetHeight;
        const id     = section.getAttribute('id');
        const link   = $(`.nav__link[href="#${id}"]`);
        if (!link) return;
        if (scrollY >= top && scrollY < top + height) {
          $$('.nav__link').forEach(function (l) { l.classList.remove('active-link'); });
          link.classList.add('active-link');
        }
      });
    }

    /* SCROLL HEADER */
    function scrollHeader() {
      if (header) header.classList.toggle('scroll-header', window.scrollY >= 50);
    }

    /* SCROLL TOP */
    const scrollTopBtn = document.getElementById('scroll-top');
    function handleScrollTop() {
      if (scrollTopBtn) scrollTopBtn.classList.toggle('show-scroll', window.scrollY >= 400);
    }

    /* REVEAL */
    const revealEls = $$('.reveal');
    if (revealEls.length && 'IntersectionObserver' in window) {
      const revealObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      revealEls.forEach(function (el) { revealObs.observe(el); });
    }

    /* COUNTERS */
    const counters = $$('[data-count]');
    if (counters.length && 'IntersectionObserver' in window) {
      const countObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            countObs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });
      counters.forEach(function (el) { countObs.observe(el); });
    }

    function animateCounter(el) {
      const target = parseInt(el.dataset.count, 10);
      if (isNaN(target)) return;
      const duration = 1600;
      const startTime = performance.now();
      function update(now) {
        const elapsed  = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased    = 1 - Math.pow(2, -10 * progress);
        el.textContent = Math.round(eased * target) + (el.dataset.suffix || '');
        if (progress < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    }

    /* SERVICES STAGGER */
    $$('.services__content').forEach(function (card, i) {
      card.classList.add('reveal');
      card.style.transitionDelay = (i * 0.1) + 's';
    });

    /* SMOOTH SCROLL */
    $$('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        var hval = anchor.getAttribute('href');
        if (!hval || hval === '#') return;
        var target = document.querySelector(hval);
        if (!target) return;
        e.preventDefault();
        var headerH = header ? header.offsetHeight : 0;
        var top = target.getBoundingClientRect().top + window.scrollY - headerH - 16;
        window.scrollTo({ top: top, behavior: 'smooth' });
      });
    });

    /* SHARE */
    function showToast(msg, icon) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          toast: true, position: 'top-end', icon: icon || 'success',
          title: msg, showConfirmButton: false, timer: 2200, timerProgressBar: true,
        });
      }
    }

    var shareBtn = document.getElementById('share-button');
    if (shareBtn) {
      shareBtn.addEventListener('click', async function () {
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
          } catch { showToast('Não foi possível copiar', 'error'); }
        }
      });
    }

    window.shareProduct = async function (name, desc, id) {
      var url  = window.location.origin + '/Cardapio/index.html?item=' + id;
      var text = 'Olha esse ' + name + ' do Ignite! 😋';
      if (navigator.share) {
        try { await navigator.share({ title: name, text: text, url: url }); }
        catch (err) { if (err.name !== 'AbortError') console.error(err); }
      } else {
        await navigator.clipboard.writeText(text + '\n' + url).catch(function () {});
        showToast('Link copiado!');
      }
    };

    /* PWA INSTALL */
    var deferredPrompt   = null;
    var installBanner    = document.getElementById('install-banner');
    var btnInstall       = document.getElementById('btn-install');
    var btnCloseBanner   = document.getElementById('btn-close-banner');

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (!sessionStorage.getItem('installBannerClosed')) {
        setTimeout(function () {
          if (installBanner) installBanner.classList.add('show');
        }, 4500);
      }
    });

    if (btnInstall) {
      btnInstall.addEventListener('click', async function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        var result = await deferredPrompt.userChoice;
        console.log('[PWA]', result.outcome);
        deferredPrompt = null;
        if (installBanner) installBanner.classList.remove('show');
      });
    }

    if (btnCloseBanner) {
      btnCloseBanner.addEventListener('click', function () {
        if (installBanner) installBanner.classList.remove('show');
        sessionStorage.setItem('installBannerClosed', 'true');
      });
    }

    window.addEventListener('appinstalled', function () {
      if (installBanner) installBanner.classList.remove('show');
      deferredPrompt = null;
      showToast('App instalado com sucesso! 🎉');
    });

    /* OFFLINE TOAST */
    var toast = document.getElementById('offline-toast');
    if (toast) {
      function showOffline() {
        toast.style.display = 'flex';
        toast.innerHTML = "<i class='bx bx-wifi-off' style='margin-right:.4rem'></i> Você está offline";
      }
      function showOnline() {
        toast.style.display = 'flex';
        toast.innerHTML = "<i class='bx bx-wifi' style='margin-right:.4rem'></i> Conexão restaurada!";
        setTimeout(function () { toast.style.display = 'none'; }, 3000);
      }
      window.addEventListener('offline', showOffline);
      window.addEventListener('online', showOnline);
      if (!navigator.onLine) showOffline();
    }

    /* SCROLL EVENT */
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        scrollHeader();
        handleScrollTop();
        updateActiveLink();
        ticking = false;
      });
    }, { passive: true });

    /* INITIAL STATE */
    scrollHeader();
    handleScrollTop();
    updateActiveLink();

    var homeLink = $('.nav__link[href="#home"]');
    if (homeLink && window.scrollY < 100) {
      $$('.nav__link').forEach(function (l) { l.classList.remove('active-link'); });
      homeLink.classList.add('active-link');
    }

  }); // fim DOMContentLoaded

  /* ── SERVICE WORKER (fora do DOMContentLoaded) ── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function (reg) { console.log('[SW] Registered:', reg.scope); })
        .catch(function (err) { console.warn('[SW] Failed:', err); });
    });
  }

})();

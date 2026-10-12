// Landing page: native navigation, progressive motion and local feedback.
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const icon = name => `<i class="fi fi-rr-${({ menu: "menu-burger", close: "cross-small", moon: "moon", sun: "sun" })[name]} site-icon" aria-hidden="true"></i>`;
  const read = (store, key) => { try { return window[store].getItem(key); } catch { return null; } };
  const write = (store, key, value) => { try { window[store].setItem(key, value); } catch { /* Storage is optional. */ } };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const animations = new Set();
  const menu = $('#nav-menu');
  const toggle = $('#nav-toggle');
  const theme = $('#theme-button');
  const header = $('#header');
  const progress = $('#reading-progress');
  const hero = $('.hero-fire-stage');
  const topLink = $('#scroll-top');
  let menuOpen = false;
  let statusTimer;
  let frame;

  function applyTheme(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.body.classList.toggle('dark-theme', dark);
    theme.innerHTML = icon(dark ? 'sun' : 'moon') + `<span>${dark ? 'Tema claro' : 'Tema escuro'}</span>`;
    theme.title = dark ? 'Ativar tema claro' : 'Ativar tema escuro';
    theme.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
    theme.setAttribute('aria-pressed', String(dark));
  }
  applyTheme(document.documentElement.dataset.theme === 'dark');
  theme.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    applyTheme(dark);
    write('localStorage', 'igniteTheme', dark ? 'dark' : 'light');
  });
  function setMenu(open, restoreFocus = false) {
    menuOpen = open;
    menu.classList.toggle('show-menu', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    toggle.innerHTML = icon(open ? 'close' : 'menu');
    if (open) menu.querySelector('a')?.focus();
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', event => { event.stopPropagation(); setMenu(!menuOpen); });
  menu.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('click', event => { if (menuOpen && !event.composedPath().includes(menu) && !event.composedPath().includes(toggle)) setMenu(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menuOpen) setMenu(false, true); });

  document.addEventListener('focusin', event => {
    if (menuOpen && !menu.contains(event.target) && !toggle.contains(event.target)) setMenu(false);
  });

  function notify(message) {
    const status = $('#site-status');
    clearTimeout(statusTimer);
    status.textContent = message;
    status.classList.add('is-visible');
    statusTimer = setTimeout(() => status.classList.remove('is-visible'), 5000);
  }
  async function share(data) {
    try {
      if (navigator.share) await navigator.share(data);
      else {
        if (!navigator.clipboard) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(data.url);
        notify('Link copiado. Agora é só compartilhar.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') notify('Não foi possível compartilhar. Copie o endereço na barra do navegador.');
    }
  }
  $('#share-button').addEventListener('click', () => share({ title: document.title, text: 'Conheça o Ignite Restaurante Pub.', url: location.href }));

  function animate(element, keyframes, options) {
    if (motion.matches || document.documentElement.hasAttribute('data-effects-paused') || !element.animate) return;
    const animation = element.animate(keyframes, { duration: 850, easing: 'cubic-bezier(.16,1,.3,1)', ...options });
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
  }
  // One entrance per element: scroll boundaries never restart opacity or transform.
  const revealElements = all('.reveal, .services__content, .menu-preview-heading, .unit-card, .faq-section > div, .footer__content, .how-order');
  const visibleMedia = new Set();
  let mediaObserver;
  if ('IntersectionObserver' in window) {
    const revealed = new WeakSet();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const element = entry.target;
        if (!entry.isIntersecting || revealed.has(element)) return;
        revealed.add(element);
        observer.unobserve(element);
        element.classList.add('visible');
        const siblings = [...element.parentElement.children];
        const card = element.matches('.services__content, .landing-product-card, .unit-card, .footer__content');
        const index = card ? siblings.indexOf(element) % 3 : 0;
        const offset = card ? 24 : 18;
        animate(element, [
          { opacity: .65, transform: `translateY(${offset}px) scale(${card ? '.985' : '1'})` },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ], { delay: index * 70, duration: 650, fill: 'backwards' });
      });
    }, { threshold: .08 });
    revealElements.forEach(element => observer.observe(element));
    mediaObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visibleMedia.add(entry.target);
        else visibleMedia.delete(entry.target);
      });
      scheduleScroll();
    }, { rootMargin: '160px 0px' });
    const watchCatalog = () => {
      visibleMedia.forEach(frame => {
        if (!frame.isConnected) { visibleMedia.delete(frame); mediaObserver.unobserve(frame); }
      });
      all('.landing-product-card').forEach(element => { if (!revealed.has(element)) observer.observe(element); });
      all('.landing-product-media').forEach(frame => mediaObserver.observe(frame));
    };
    addEventListener('landing:catalog-ready', watchCatalog);
    addEventListener('landing:reviews-ready', () => all('.google-review-card').forEach(card => { if (!revealed.has(card)) observer.observe(card); }));
    watchCatalog();
  }
  const sections = all('section[id]');
  function updateScroll() {
    frame = null;
    const y = window.scrollY;
    const distance = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    progress.style.transform = `scaleX(${Math.min(1, y / distance)})`;
    header.classList.toggle('scroll-header', y > 32);
    const showTop = y > 400;
    topLink.classList.toggle('show-scroll', showTop);
    topLink.tabIndex = showTop ? 0 : -1;
    const motionAllowed = !motion.matches && !document.documentElement.hasAttribute('data-effects-paused') && !document.hidden;
    hero.style.transform = motionAllowed && finePointer.matches ? `translateY(${Math.min(24, y * .045)}px)` : '';
    // Only visible photos participate; transform updates share the scroll RAF.
    const travel = finePointer.matches ? 10 : 5;
    visibleMedia.forEach(frame => {
      const image = frame.querySelector('img');
      if (!image) return;
      if (!motionAllowed) { image.style.transform = ''; return; }
      const rect = frame.getBoundingClientRect();
      const position = Math.max(-1, Math.min(1, (innerHeight / 2 - rect.top - rect.height / 2) / (innerHeight / 2)));
      image.style.transform = `translateY(${position * travel}px) scale(${finePointer.matches ? 1.12 : 1.08})`;
    });
    let active = sections[0]?.id;
    for (const section of sections) { if (section.getBoundingClientRect().top <= header.offsetHeight + 70) active = section.id; }
    all('.nav__link[href^="#"]').forEach(link => {
      const selected = link.hash === `#${active}`;
      link.classList.toggle('active-link', selected);
      if (selected) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
  }
  function scheduleScroll() { if (!frame) frame = requestAnimationFrame(updateScroll); }
  addEventListener('scroll', scheduleScroll, { passive: true });
  addEventListener('resize', () => { if (innerWidth > 920) setMenu(false); scheduleScroll(); });
  motion.addEventListener('change', () => { if (motion.matches) animations.forEach(animation => animation.cancel()); scheduleScroll(); });
  finePointer.addEventListener('change', scheduleScroll);
  const pauseObserver = new MutationObserver(() => {
    if (document.documentElement.hasAttribute('data-effects-paused')) animations.forEach(animation => animation.cancel());
    scheduleScroll();
  });
  pauseObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-effects-paused'] });
  document.addEventListener('visibilitychange', scheduleScroll);
  all('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
    // Preserve anchor semantics and move keyboard focus without a second scroll.
    if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
    try { history.replaceState(null, '', link.hash); } catch { /* Optional URL state. */ }
  }));
  updateScroll();

  const installBanner = $('#install-banner');
  const installButton = $('#btn-install');
  let installPrompt = null;
  let installTimer;
  function hideInstall() {
    clearTimeout(installTimer);
    if (installBanner.contains(document.activeElement)) $('.nav__logo').focus();
    installBanner.classList.remove('show');
    installBanner.hidden = true;
  }
  addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    if (!read('sessionStorage', 'installBannerClosed')) {
      installTimer = setTimeout(() => {
        if (installPrompt && !read('sessionStorage', 'installBannerClosed')) { installBanner.hidden = false; installBanner.classList.add('show'); }
      }, 7000);
    }
  });
  $('#btn-close-banner').addEventListener('click', () => { hideInstall(); write('sessionStorage', 'installBannerClosed', 'true'); });
  installButton.addEventListener('click', async () => {
    if (!installPrompt || installButton.disabled) return;
    installButton.disabled = true;
    try { await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; hideInstall(); }
    catch { notify('Não foi possível instalar agora. Tente novamente pelo menu do navegador.'); }
    finally { installButton.disabled = false; }
  });
  addEventListener('appinstalled', () => { installPrompt = null; hideInstall(); notify('Ignite instalado.'); });
  function connectivity() {
    const toast = $('#offline-toast');
    toast.hidden = navigator.onLine;
    toast.textContent = 'Você está offline. Alguns recursos podem não estar disponíveis.';
  }
  addEventListener('offline', connectivity);
  addEventListener('online', () => { connectivity(); notify('Conexão restaurada.'); });
  connectivity();
  $('#copyright-year').textContent = String(new Date().getFullYear());
  if ('serviceWorker' in navigator) addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => console.warn('Service worker indisponível:', error.message));
  });
})();

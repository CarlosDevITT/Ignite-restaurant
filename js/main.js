// Landing page: native navigation, progressive motion and local feedback.
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const icon = name => `<svg class="site-icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
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
  const hero = $('.home__img');
  const topLink = $('#scroll-top');
  let menuOpen = false;
  let statusTimer;
  let frame;

  function applyTheme(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.body.classList.toggle('dark-theme', dark);
    theme.innerHTML = icon(dark ? 'sun' : 'moon');
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
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', event => { event.stopPropagation(); setMenu(!menuOpen); });
  menu.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('click', event => { if (menuOpen && !event.composedPath().includes(menu) && !event.composedPath().includes(toggle)) setMenu(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menuOpen) setMenu(false, true); });

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
  window.shareProduct = (name, description, id) => share({ title: name, text: description, url: `${location.origin}/Cardapio/index.html?item=${encodeURIComponent(id)}` });

  function animate(element, keyframes, options) {
    if (motion.matches || !element.animate) return;
    const animation = element.animate(keyframes, { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)', ...options });
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
  }
  // Content stays visible by default; effects enhance it rather than gate it.
  const revealElements = all('.reveal, .services__content');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const element = entry.target;
        const index = element.classList.contains('services__content') ? all('.services__content').indexOf(element) : 0;
        animate(element, [{ opacity: .25, transform: 'translateY(28px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: index * 80 });
        element.classList.add('visible');
        observer.unobserve(element);
      });
    }, { threshold: .12 });
    revealElements.forEach(element => observer.observe(element));
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
    hero.style.transform = !motion.matches && finePointer.matches && y < innerHeight ? `translateY(${Math.min(24, y * .045)}px)` : '';
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
  addEventListener('resize', () => { if (innerWidth > 768) setMenu(false); scheduleScroll(); });
  motion.addEventListener('change', () => { if (motion.matches) animations.forEach(animation => animation.cancel()); scheduleScroll(); });
  finePointer.addEventListener('change', scheduleScroll);
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
    toast.style.display = navigator.onLine ? 'none' : 'flex';
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

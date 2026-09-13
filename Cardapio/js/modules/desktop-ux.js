function ensureDesktopStyles() {
  if (document.querySelector('[data-desktop-polish-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../styles/desktop-polish.css?v=20260913-1', import.meta.url).href;
  link.setAttribute('data-desktop-polish-style', 'true');
  document.head.appendChild(link);
}

export function initDesktopUX() {
  ensureDesktopStyles();
  const media = window.matchMedia('(min-width: 1100px)');
  const syncMode = () => document.documentElement.classList.toggle('desktop-ui', media.matches);
  media.addEventListener?.('change', syncMode);
  syncMode();

  document.addEventListener('keydown', (event) => {
    if (!media.matches) return;
    const target = event.target;
    const typing = target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable);
    if ((event.key === '/' && !typing) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) {
      event.preventDefault();
      const search = document.querySelector('#product-search');
      const home = document.querySelector('[data-route="home"]');
      if (document.querySelector('#view-home')?.hidden) home?.click();
      requestAnimationFrame(() => {
        search?.focus({ preventScroll: true });
        search?.closest('.search-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  });

  const search = document.querySelector('#product-search');
  if (search && !search.dataset.desktopHint) {
    search.dataset.desktopHint = '1';
    search.setAttribute('title', 'Buscar no cardápio — atalho / ou Ctrl+K');
  }
}

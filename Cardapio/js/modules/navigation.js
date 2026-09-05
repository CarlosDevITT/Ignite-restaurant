const TITLES = {
  home: 'O que vai pedir hoje?', orders: 'Acompanhe seus pedidos', profile: 'Seu perfil',
  feed: 'Novidades do Ignite', chat: 'Converse com a Ignite IA',
};

export function initNavigation({ onRoute }) {
  const title = document.querySelector('#view-title');
  const quickSheet = document.querySelector('#quick-sheet');
  const mobileNav = document.querySelector('.mobile-bottom-nav');
  const mobilePlus = document.querySelector('.mobile-nav-plus');
  const backdrop = document.querySelector('#backdrop');

  const closeQuick = () => {
    quickSheet.classList.remove('is-open');
    quickSheet.setAttribute('aria-hidden', 'true');
    quickSheet.inert = true;
    mobileNav.classList.remove('is-fan-open');
    mobilePlus.setAttribute('aria-expanded', 'false');
    if (!document.querySelector('#cart-drawer.is-open')) backdrop.hidden = true;
    document.body.classList.remove('no-scroll');
  };

  const openQuick = () => {
    if (window.matchMedia('(max-width: 899px)').matches) {
      const willOpen = !mobileNav.classList.contains('is-fan-open');
      mobileNav.classList.toggle('is-fan-open', willOpen);
      mobilePlus.setAttribute('aria-expanded', String(willOpen));
      return;
    }
    quickSheet.classList.add('is-open');
    quickSheet.setAttribute('aria-hidden', 'false');
    quickSheet.inert = false;
    backdrop.hidden = false;
    document.body.classList.add('no-scroll');
    quickSheet.querySelector('[data-close-quick]')?.focus();
  };

  const navigate = (route) => {
    if (!document.querySelector(`[data-view="${route}"]`)) route = 'home';
    document.querySelectorAll('[data-view]').forEach((view) => {
      const active = view.dataset.view === route;
      view.hidden = !active;
      view.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-route]').forEach((button) => {
      const active = button.dataset.route === route;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    title.textContent = TITLES[route] || TITLES.home;
    history.replaceState(null, '', `#${route}`);
    closeQuick();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onRoute?.(route);
  };

  document.querySelectorAll('[data-route]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.route)));
  document.querySelectorAll('[data-open-quick]').forEach((button) => button.addEventListener('click', openQuick));
  document.querySelectorAll('[data-close-quick]').forEach((button) => button.addEventListener('click', closeQuick));
  document.querySelectorAll('[data-quick-route]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.quickRoute)));
  backdrop.addEventListener('click', closeQuick);
  document.addEventListener('click', (event) => {
    if (mobileNav.classList.contains('is-fan-open') && !mobileNav.contains(event.target)) closeQuick();
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeQuick(); });
  document.querySelector('[data-scroll-products]')?.addEventListener('click', () => document.querySelector('#products-start')?.scrollIntoView({ behavior: 'smooth' }));

  const initialRoute = location.hash.slice(1);
  if (TITLES[initialRoute]) navigate(initialRoute);

  return { navigate, closeQuick };
}

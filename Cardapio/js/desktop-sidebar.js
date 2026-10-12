// Local desktop sidebar preferences. No catalog/order state is changed.
const sidebar = document.querySelector('.desktop-sidebar');
if (sidebar) {
  const toggle = sidebar.querySelector('[data-sidebar-collapse]');
  const choices = [...sidebar.querySelectorAll('[data-sidebar-theme-choice]')];
  let collapsed = false;
  let theme = 'dark';
  try {
    collapsed = localStorage.getItem('ignite-sidebar-collapsed') === 'true';
    theme = localStorage.getItem('ignite-sidebar-theme') === 'light' ? 'light' : 'dark';
  } catch { /* Preferences are optional. */ }
  sidebar.querySelectorAll('.nav-item').forEach(button => {
    const label = button.textContent.trim(); button.setAttribute('aria-label', label); button.title = label;
  });
  const render = () => {
    document.documentElement.toggleAttribute('data-sidebar-collapsed', collapsed);
    sidebar.dataset.sidebarTheme = theme;
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
    toggle.title = collapsed ? 'Expandir menu' : 'Recolher menu';
    toggle.innerHTML = `<i class="fi fi-rr-angle-small-${collapsed ? 'right' : 'left'}" aria-hidden="true"></i>`;
    choices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sidebarThemeChoice === theme)));
  };
  const save = () => {
    try { localStorage.setItem('ignite-sidebar-collapsed', String(collapsed)); localStorage.setItem('ignite-sidebar-theme', theme); } catch { /* UI remains functional without storage. */ }
    render();
  };
  toggle.addEventListener('click', () => { collapsed = !collapsed; save(); });
  choices.forEach(button => button.addEventListener('click', () => { theme = button.dataset.sidebarThemeChoice; save(); }));
  render();
}

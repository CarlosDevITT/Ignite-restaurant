// Native Canvas 2D: pooled particles, cached sprites and one visibility-gated RAF.
export function initScrollFire(root = document) {
  if (!('IntersectionObserver' in window)) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  const mobile = matchMedia('(max-width: 767px)');
  const zones = [...root.querySelectorAll('canvas[data-fire-watch]')].map(canvas => ({
    canvas, ctx: canvas.getContext('2d', { alpha: true }),
    watcher: root.querySelector(canvas.dataset.fireWatch),
    sectionVisible: false, elementVisible: false, hero: canvas.dataset.fireKind === 'hero', visible: false, width: 0, height: 0, particles: [],
  })).filter(zone => zone.ctx && zone.watcher);
  if (!zones.length) return () => {};
  let raf = 0, previous = 0, lastDraw = 0, boost = 0, targetBoost = 0;
  let sampledY = scrollY, sampledAt = performance.now(), lastDownAt = 0, disposed = false;
  const buttons = [...root.querySelectorAll('[data-fire-toggle]')];
  let enabled = true;
  try { enabled = localStorage.getItem('ignite-fire-effects') !== 'off'; } catch { /* Optional preference. */ }
  const allowed = () => enabled && !disposed && !reduced.matches && !forced.matches && !document.hidden;
  const active = () => allowed() && zones.some(zone => zone.visible);
  function reset(zone, p, seed = false) {
    p.x = Math.random() * zone.width;
    p.y = seed ? Math.random() * zone.height : zone.height + 12;
    p.life = 20 + Math.random() * 16;
    p.age = seed ? Math.random() * p.life : 0;
    p.speed = 14 + Math.random() * 22;
    p.size = .7 + Math.random() * 1.8;
    p.phase = Math.random() * Math.PI * 2;
    p.warm = Math.random() > .3;
  }
  function clear(zone) { zone.ctx.clearRect(0, 0, zone.width, zone.height); }
  function resize(zone) {
    const rect = zone.canvas.getBoundingClientRect();
    zone.width = rect.width; zone.height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, mobile.matches ? 1 : 1.5);
    zone.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    zone.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    zone.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = mobile.matches ? 28 : 65;
    zone.particles = Array.from({ length: count }, () => { const p = {}; reset(zone, p, true); return p; });
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; previous = 0; lastDraw = 0; boost = 0; targetBoost = 0;
    sampledY = scrollY; sampledAt = performance.now();
    zones.forEach(zone => { clear(zone); zone.canvas.dataset.fireState = 'paused'; });
  }
  function sync() {
    document.documentElement.toggleAttribute('data-effects-paused', !allowed());
    buttons.forEach(button => {
      button.hidden = reduced.matches || forced.matches;
      button.setAttribute('aria-pressed', String(enabled));
      button.textContent = enabled ? 'Pausar efeitos' : 'Ativar efeitos';
    });
    zones.forEach(zone => {
      const running = allowed() && zone.visible;
      zone.canvas.dataset.fireState = running ? 'running' : 'paused';
      if (!running) clear(zone);
    });
    if (!active()) stop();
    else if (!raf) { previous = 0; lastDraw = 0; raf = requestAnimationFrame(tick); }
  }
  function draw(zone, dt, now) {
    clear(zone);
    const air = 1 + boost * 3;
    for (const p of zone.particles) {
      p.age += dt * (1 + boost * .35); p.y -= p.speed * air * dt;
      if (p.age >= p.life || p.y < 0) reset(zone, p);
      const fade = Math.sin(Math.PI * Math.min(1, p.age / p.life));
      zone.ctx.globalAlpha = Math.max(0, fade) *  .65;
      const x = p.x + Math.sin(now * .0015 + p.phase) * 12;
      zone.ctx.fillStyle = p.warm ? '#ffab45' : '#ffda85';
      zone.ctx.beginPath();
      zone.ctx.ellipse(x, p.y, p.size * .65, p.size * (1.3 + boost), -.3, 0, Math.PI * 2);
      zone.ctx.fill();
    }
    zone.ctx.globalAlpha = 1;
  }
  function tick(now) {
    raf = 0;
    if (!active()) { stop(); return; }
    const interval = 1000 / (mobile.matches ? 24 : 30);
    if (!lastDraw || now - lastDraw >= interval - 1) {
      const dt = Math.min(.065, previous ? (now - previous) / 1000 : interval / 1000);
      if (now - lastDownAt > 160) targetBoost = 0;
      boost += (targetBoost - boost) * (1 - Math.exp(-dt * 7));
      zones.forEach(zone => { if (zone.visible) draw(zone, dt, now); });
      previous = now; lastDraw = now;
    }
    raf = requestAnimationFrame(tick);
  }
  function onScroll() {
    if (!active()) return;
    const now = performance.now();
    const elapsed = now - sampledAt;
    if (elapsed < 60) return; // No layout reads and at most ~16 scroll samples/sec.
    const delta = scrollY - sampledY;
    targetBoost = Math.min(1.8, Math.max(0, delta / Math.max(1, elapsed)) / 1.2);
    if (delta > 0) lastDownAt = now;
    sampledY = scrollY; sampledAt = now;
  }
  const watchers = [...new Set(zones.flatMap(zone => [zone.watcher, zone.canvas.parentElement]))];
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) zones.forEach(zone => {
      const visible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (zone.watcher === entry.target) zone.sectionVisible = visible;
      if (zone.canvas.parentElement === entry.target) zone.elementVisible = visible;
      zone.visible = zone.sectionVisible && zone.elementVisible;
    });
    sync();
  }, { threshold: 0 });
  const heroStage = root.querySelector('.hero-fire-stage');
  const plateObserver = new IntersectionObserver(entries => {
    heroStage?.classList.toggle('is-visible', entries[0].isIntersecting);
  });
  if (heroStage) plateObserver.observe(heroStage);
  zones.forEach(resize); watchers.forEach(watcher => observer.observe(watcher));
  const resizer = 'ResizeObserver' in window ? new ResizeObserver(entries => {
    for (const entry of entries) { const zone = zones.find(zone => zone.canvas === entry.target); if (zone) resize(zone); }
    sync();
  }) : null;
  zones.forEach(zone => resizer?.observe(zone.canvas));
  const onResize = () => { zones.forEach(resize); sync(); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', sync);
  const onPreference = () => { if (allowed()) zones.forEach(resize); sync(); };
  const onToggle = () => {
    enabled = !enabled;
    try { localStorage.setItem('ignite-fire-effects', enabled ? 'on' : 'off'); } catch { /* Optional preference. */ }
    onPreference();
  };
  buttons.forEach(button => button.addEventListener('click', onToggle));
  reduced.addEventListener('change', onPreference); forced.addEventListener('change', onPreference); mobile.addEventListener('change', onResize);
  sync();
  return () => {
    disposed = true; stop(); observer.disconnect(); plateObserver.disconnect(); resizer?.disconnect();
    window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', sync);
    buttons.forEach(button => button.removeEventListener('click', onToggle));
    reduced.removeEventListener('change', onPreference); forced.removeEventListener('change', onPreference); mobile.removeEventListener('change', onResize);
  };
}
let dispose = initScrollFire();
window.addEventListener('pagehide', () => { dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) dispose = initScrollFire(); });

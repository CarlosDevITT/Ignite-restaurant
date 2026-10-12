// Native Canvas 2D: pooled particles, cached sprites and one visibility-gated RAF.
export function initScrollFire(root = document) {
  if (!('IntersectionObserver' in window)) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const forced = matchMedia('(forced-colors: active)');
  const mobile = matchMedia('(max-width: 767px)');
  const zones = [...root.querySelectorAll('canvas[data-fire-watch]')].map(canvas => ({
    canvas, ctx: canvas.getContext('2d', { alpha: true }),
    watcher: root.querySelector(canvas.dataset.fireWatch),
    sectionVisible: false, elementVisible: false, visible: false, width: 0, height: 0, particles: [],
  })).filter(zone => zone.ctx && zone.watcher);
  if (!zones.length) return () => {};
  // Three cached ember sprites: gradients are never created inside the RAF.
  const colors = ['#ffd98c', '#ffab50', '#ee7136'];
  const glows = colors.map(color => {
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = 32;
    const ctx = sprite.getContext('2d');
    const halo = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    halo.addColorStop(0, '#fff2ce'); halo.addColorStop(.12, color);
    halo.addColorStop(.35, color + '55'); halo.addColorStop(1, color + '00');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, 32, 32); return sprite;
  });
  const trail = document.createElement('canvas'); trail.width = 8; trail.height = 64;
  const tc = trail.getContext('2d');
  const tail = tc.createLinearGradient(0, 0, 0, 64);
  tail.addColorStop(0, 'rgba(255,181,84,.55)'); tail.addColorStop(1, 'rgba(255,120,35,0)');
  tc.fillStyle = tail; tc.beginPath(); tc.moveTo(0, 0); tc.lineTo(8, 0); tc.lineTo(4, 64); tc.fill();
  let raf = 0, previous = 0, lastDraw = 0, boost = 0, targetBoost = 0;
  let sampledY = scrollY, sampledAt = performance.now(), lastDownAt = 0, disposed = false;
  const buttons = [...root.querySelectorAll('[data-fire-toggle]')];
  let enabled = true;
  try { enabled = localStorage.getItem('ignite-fire-effects') !== 'off'; } catch { /* Optional preference. */ }
  const allowed = () => enabled && !disposed && !reduced.matches && !forced.matches && !document.hidden;
  const active = () => allowed() && zones.some(zone => zone.visible);
  function reset(zone, p, seed = false) {
    p.depth = .35 + Math.random() * .65;
    p.speed = 20 + Math.random() * 28;
    p.life = (zone.height + 64) / (p.speed * p.depth);
    p.age = seed ? Math.random() * p.life : 0;
    p.x = Math.random() * zone.width;
    p.y = zone.height + 24 - p.age * p.speed * p.depth;
    p.drift = (Math.random() - .5) * 14;
    p.size = (.6 + Math.random() * 1.4) * (.65 + p.depth * .5);
    p.phase = Math.random() * Math.PI * 2;
    p.color = Math.random() < .25 ? 2 : Math.random() < .5 ? 1 : 0;
    p.glowing = Math.random() > .55;
  }
  function clear(zone) { zone.ctx.clearRect(0, 0, zone.width, zone.height); }
  function resize(zone) {
    const rect = zone.canvas.getBoundingClientRect();
    zone.width = rect.width; zone.height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, mobile.matches ? 1 : 1.5);
    zone.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    zone.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    zone.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = mobile.matches ? 24 : Math.min(60, Math.max(36, Math.round(rect.width * rect.height / 23000)));
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
    const air = 1 + boost * 1.3;
    for (const p of zone.particles) {
      p.age += dt * air;
      p.y -= p.speed * p.depth * air * dt;
      p.x += (p.drift + Math.sin(p.age * .8 + p.phase) * 7) * dt;
      if (p.age >= p.life || p.y < -32 || p.x < -24 || p.x > zone.width + 24) reset(zone, p);
      const progress = p.age / p.life;
      const fade = Math.min(1, progress / .08, (1 - progress) / .18);
      const shimmer = .88 + .12 * Math.sin(now * .0012 + p.phase);
      const alpha = Math.max(0, fade) * (.25 + p.depth * .5) * shimmer;
      zone.ctx.globalAlpha = alpha;
      if (p.glowing) {
        const radius = p.size * (4 + p.depth * 2);
        zone.ctx.drawImage(glows[p.color], p.x - radius, p.y - radius, radius * 2, radius * 2);
        // Sparse, tapered trails grow gently with scroll speed.
        zone.ctx.globalAlpha = alpha * .5;
        zone.ctx.drawImage(trail, p.x - p.size * .45, p.y, p.size * .9, p.size * (5 + boost * 5));
      }
      zone.ctx.globalAlpha = alpha;
      zone.ctx.fillStyle = colors[p.color];
      zone.ctx.beginPath();
      zone.ctx.ellipse(p.x, p.y, p.size * .55, p.size * (1 + p.depth * .6), p.drift * .02, 0, Math.PI * 2);
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

export function initCarousel(root) {
  const track = root.querySelector('[data-carousel-track]');
  const previous = root.querySelector('[data-carousel-prev]');
  const next = root.querySelector('[data-carousel-next]');
  const status = root.querySelector('[data-carousel-status]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const autoplay = root.hasAttribute('data-carousel-autoplay');
  const toggle = root.querySelector('[data-carousel-toggle]');
  let timer;
  let paused = motion.matches;
  let hovered = false;
  let visible = false;
  let touching = false;
  const stop = () => clearTimeout(timer);
  const schedule = () => {
    stop();
    if (!autoplay || paused || motion.matches || hovered || touching || !visible || document.hidden || root.contains(document.activeElement)) return;
    timer = setTimeout(() => {
      if (document.body.matches('.no-scroll, .swal2-shown')) { schedule(); return; }
      const last = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
      track.scrollTo({ left: last ? 0 : track.scrollLeft + track.clientWidth, behavior: 'smooth' });
      schedule();
    }, 5000);
  };
  const update = () => {
    previous.disabled = track.scrollLeft < 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    if (status && track.clientWidth) {
      status.textContent = `${Math.round(track.scrollLeft / track.clientWidth) + 1} / ${track.children.length}`;
    }
  };
  const move = (direction) => {
    track.scrollBy({ left: direction * track.clientWidth, behavior: motion.matches ? 'instant' : 'smooth' });
    schedule();
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('scroll', update, { passive: true });
  if (autoplay) {
    // Automatic changes should not interrupt screen-reader announcements.
    status?.setAttribute('aria-live', 'off');
    const updateToggle = () => {
      if (!toggle) return;
      toggle.textContent = paused ? 'Reproduzir' : 'Pausar';
      toggle.setAttribute('aria-label', paused ? 'Reproduzir carrossel automaticamente' : 'Pausar carrossel automático');
      toggle.disabled = motion.matches;
    };
    toggle?.addEventListener('click', () => { paused = !paused; updateToggle(); schedule(); });
    root.addEventListener('mouseenter', () => { hovered = true; stop(); });
    root.addEventListener('mouseleave', () => { hovered = false; schedule(); });
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', () => setTimeout(schedule, 0));
    root.addEventListener('pointerdown', () => { touching = true; stop(); }, { passive: true });
    window.addEventListener('pointerup', () => { touching = false; schedule(); }, { passive: true });
    window.addEventListener('pointercancel', () => { touching = false; schedule(); }, { passive: true });
    track.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    motion.addEventListener('change', () => { paused = motion.matches; updateToggle(); schedule(); });
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }, { threshold: .2 }).observe(root);
    updateToggle();
  }
  track.addEventListener('keydown', (event) => {
    if (event.target !== track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  });
  new ResizeObserver(update).observe(track);
  new MutationObserver(() => { track.scrollLeft = 0; update(); }).observe(track, { childList: true });
  update();
}

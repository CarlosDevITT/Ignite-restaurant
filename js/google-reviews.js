// Official Google Places content only; no hard-coded scores or testimonials.
const section = document.querySelector('#avaliacoes');
if (section) {
  const status = section.querySelector('[data-reviews-status]');
  const grid = section.querySelector('[data-reviews-grid]');
  const summary = section.querySelector('[data-reviews-summary]');
  const retry = section.querySelector('[data-reviews-retry]');
  const profile = section.querySelector('[data-google-profile]');
  const safeGoogleUrl = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && (url.hostname === 'google.com' || url.hostname.endsWith('.google.com') || url.hostname === 'maps.app.goo.gl') ? url.href : null;
    } catch { return null; }
  };
  const node = (tag, cls, text) => {
    const el = document.createElement(tag); el.className = cls; el.textContent = text; return el;
  };
  const number = new Intl.NumberFormat('pt-BR');
  let controller;
  async function load() {
    controller?.abort();
    const current = new AbortController(); controller = current;
    const timeout = setTimeout(() => current.abort(), 10000);
    retry.disabled = true; grid.setAttribute('aria-busy', 'true');
    status.textContent = 'Consultando avaliações do Google…';
    try {
      const response = await fetch('/api/google-reviews', { signal: current.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      if (controller !== current) return;
      if (!data.available) {
        status.textContent = 'Confira as avaliações e os comentários diretamente no perfil do Google.';
        retry.hidden = true; return;
      }
      const url = safeGoogleUrl(data.url);
      if (url) profile.href = url;
      if (typeof data.rating === 'number' && data.rating >= 0 && data.rating <= 5 && Number.isInteger(data.count) && data.count >= 0) {
        summary.textContent = `${number.format(data.rating)} de 5 · ${number.format(data.count)} avaliações no Google`;
        summary.hidden = false;
      }
      const cards = [];
      for (const review of (data.reviews || []).slice(0, 5)) {
        if (!review.text || !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) continue;
        const card = node('article', 'google-review-card', '');
        const authorUrl = safeGoogleUrl(review.authorUrl);
        const author = node(authorUrl ? 'a' : 'span', 'google-review-author', review.author);
        if (authorUrl) { author.href = authorUrl; author.target = '_blank'; author.rel = 'noopener'; }
        const stars = node('span', 'google-review-stars', '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating));
        stars.setAttribute('aria-label', `${review.rating} de 5 estrelas`);
        const quote = node('blockquote', '', review.text);
        card.append(author, stars, quote);
        const date = new Date(review.date);
        if (!Number.isNaN(date.getTime())) {
          const time = node('time', 'google-review-date', date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
          time.dateTime = date.toISOString(); card.append(time);
        }
        const reviewUrl = safeGoogleUrl(review.url);
        if (reviewUrl) {
          const link = node('a', 'google-review-link', 'Ver avaliação no Google ↗');
          link.href = reviewUrl; link.target = '_blank'; link.rel = 'noopener'; card.append(link);
        }
        cards.push(card);
      }
      grid.replaceChildren(...cards);
      const attributions = section.querySelector('[data-reviews-attributions]');
      attributions.replaceChildren(...(data.attributions || []).map(item => {
        let url = null;
        try { const parsed = new URL(item.providerUri); if (parsed.protocol === 'https:') url = parsed.href; } catch { /* Text attribution remains available. */ }
        const el = node(url ? 'a' : 'span', '', item.provider || '');
        if (url) { el.href = url; el.target = '_blank'; el.rel = 'noopener'; } return el;
      }));
      status.textContent = cards.length ? 'Avaliações fornecidas pelo Google Maps, ordenadas por relevância.' : 'Veja os comentários disponíveis no perfil do Google.';
      retry.hidden = true;
      window.dispatchEvent(new Event('landing:reviews-ready'));
    } catch {
      if (controller !== current || document.hidden) return;
      status.textContent = 'Não foi possível carregar os comentários agora. Você pode consultá-los no Google.';
      retry.hidden = false;
    } finally {
      clearTimeout(timeout);
      if (controller === current) { retry.disabled = false; grid.setAttribute('aria-busy', 'false'); }
    }
  }
  retry.addEventListener('click', load);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect(); load();
    }, { rootMargin: '150px' });
    observer.observe(section);
  } else load();
  window.addEventListener('pagehide', () => controller?.abort());
}

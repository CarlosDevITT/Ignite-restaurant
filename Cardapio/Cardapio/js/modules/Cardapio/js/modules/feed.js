import { getFeed } from '../services/product-service.js';
import { escapeHTML } from '../utils/format.js';

export async function initFeed() {
  const root = document.querySelector('#feed-list');
  const posts = await getFeed();
  root.innerHTML = posts.map((post) => `<article class="feed-card"><div class="feed-card__visual"><span aria-hidden="true">${escapeHTML(post.emoji || '🔥')}</span></div><div class="feed-card__body"><span class="feed-card__meta">${escapeHTML(post.label || 'Ignite')}</span><h3>${escapeHTML(post.title)}</h3><p>${escapeHTML(post.body)}</p></div></article>`).join('');
}

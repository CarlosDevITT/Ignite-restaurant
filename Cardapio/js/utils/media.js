// Vercel optimizes only this project's public product photos. Other sources stay intact.
export function optimizedProductImage(source, width = 320) {
  try {
    const url = new URL(source);
    if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return source;
    if (url.protocol !== 'https:' || url.hostname !== 'qgnqztsxfeugopuhyioq.supabase.co' || !url.pathname.startsWith('/storage/v1/object/public/products/')) return source;
    return `/_vercel/image?url=${encodeURIComponent(url.href)}&w=${width}&q=75`;
  } catch { return source; }
}
export function productImageSrcset(source) {
  if (optimizedProductImage(source) === source) return '';
  return [320, 640, 960].map(width => `${optimizedProductImage(source, width)} ${width}w`).join(', ');
}
export function restoreOriginalImage(image) {
  const original = image.dataset.originalSrc;
  if (!original || image.dataset.originalRestored === 'true' || image.src === original) return false;
  image.dataset.originalRestored = 'true'; image.removeAttribute('srcset'); image.src = original;
  return true;
}

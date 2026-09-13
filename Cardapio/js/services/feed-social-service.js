import { getSupabase, supabaseRetry } from './supabase-client.js';

const isRegistered = user => Boolean(user?.id) && user?.is_anonymous !== true;

export async function getFeedSessionState() {
  const supabase = await getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData?.session?.user || null;
  if (!isRegistered(user)) return { authenticated: false, liked: new Set(), saved: new Set(), user: null };

  const { data, error } = await supabaseRetry(() => supabase.rpc('get_my_feed_state'));
  if (error) throw error;
  return {
    authenticated: data?.authenticated === true,
    liked: new Set((data?.liked || []).map(String)),
    saved: new Set((data?.saved || []).map(String)),
    user,
  };
}

export async function toggleFeedLike(postId) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('toggle_feed_like', { p_post_id: postId });
  if (error) throw error;
  return { liked: data?.liked === true, likes: Math.max(0, Number(data?.likes || 0)) };
}

export async function toggleFeedSave(postId) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('toggle_feed_save', { p_post_id: postId });
  if (error) throw error;
  return { saved: data?.saved === true };
}

export async function getFeedComments(postId, limit = 50) {
  const supabase = await getSupabase();
  const { data, error } = await supabaseRetry(() => supabase.rpc('get_feed_comments', {
    p_post_id: postId,
    p_limit: Math.max(1, Math.min(Number(limit) || 50, 100)),
  }));
  if (error) throw error;
  return data || [];
}

export async function createFeedComment(postId, text) {
  const supabase = await getSupabase();
  const value = String(text || '').trim();
  if (!value || value.length > 500) throw new Error('Comentário deve ter entre 1 e 500 caracteres.');
  const { data, error } = await supabase.rpc('create_feed_comment', { p_post_id: postId, p_text: value });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data;
}

export async function trackFeedEvent(postId, eventType, productId = null) {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc('track_feed_event', {
      p_post_id: postId,
      p_event_type: eventType,
      p_product_id: productId ? Number(productId) : null,
    });
    if (error) throw error;
  } catch (error) {
    console.debug('[Feed] Métrica não registrada:', error?.message || error);
  }
}

export async function subscribeToFeed(onChange) {
  const supabase = await getSupabase();
  const channel = supabase
    .channel(`cardapio-feed-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts' }, payload => onChange?.({ source: 'feed_posts', payload }))
    .subscribe(status => {
      if (status === 'SUBSCRIBED') onChange?.({ source: 'subscribed' });
      if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) onChange?.({ source: 'recovery' });
    });
  return () => { void supabase.removeChannel(channel); };
}

export async function watchFeedAuth(onChange) {
  const supabase = await getSupabase();
  const { data } = supabase.auth.onAuthStateChange(() => { void onChange?.(); });
  return () => data?.subscription?.unsubscribe?.();
}

function setupFeedInstrumentation() {
  if (window.__igniteFeedMetricsReady) return;
  window.__igniteFeedMetricsReady = true;
  const viewed = new Set();
  let observer = null;

  const observePosts = () => {
    if (!('IntersectionObserver' in window)) return;
    if (!observer) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.55) return;
          const id = entry.target.getAttribute('data-feed-post');
          if (!id || viewed.has(id)) return;
          viewed.add(id);
          void trackFeedEvent(id, 'view');
        });
      }, { threshold: [0.55] });
    }
    document.querySelectorAll('[data-feed-post]').forEach(node => observer.observe(node));
  };

  const mutation = new MutationObserver(observePosts);
  mutation.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    const card = event.target.closest?.('[data-feed-post]');
    const postId = card?.getAttribute('data-feed-post');
    if (!postId) return;
    if (event.target.closest('[data-feed-share]')) void trackFeedEvent(postId, 'share');
    const product = event.target.closest('[data-feed-view-product]');
    if (product) void trackFeedEvent(postId, 'product_open', product.getAttribute('data-feed-view-product'));
    const add = event.target.closest('[data-feed-add-product]');
    if (add) void trackFeedEvent(postId, 'add_to_cart', add.getAttribute('data-feed-add-product'));
  }, { capture: true });
  observePosts();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') setupFeedInstrumentation();

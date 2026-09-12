import { getSupabase, supabaseRetry } from './supabase-client.js';

const slug = value => `cat-${String(value || 'outros').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
const categoryIcon = value => {
  const text = String(value || '').toLowerCase();
  if (text.includes('beb')) return '🥤';
  if (text.includes('combo')) return '🍱';
  if (text.includes('promo')) return '🏷️';
  if (text.includes('entrada')) return '🥗';
  if (text.includes('por') || text.includes('petisco')) return '🍟';
  if (text.includes('pizza')) return '🍕';
  if (text.includes('marm') || text.includes('princ') || text.includes('refei')) return '🍛';
  return '🍽️';
};

const defaultCategories = [
  { id: 'entradas', name: 'Entradas', icon: '🥗', position: 1 },
  { id: 'pratos-principais', name: 'Pratos Principais', icon: '🍛', position: 2 },
  { id: 'bebidas', name: 'Bebidas', icon: '🥤', position: 3 },
  { id: 'combos', name: 'Combos', icon: '🍱', position: 4 },
  { id: 'promocoes', name: 'Promoções', icon: '🏷️', position: 5 },
  { id: 'principal', name: 'principal', icon: '🍽️', position: 6 },
];

const isDevelopment = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

async function developmentCatalog(error) {
  if (!isDevelopment()) throw error;
  const { mockCategories, mockProducts } = await import('../data/mock-products.js');
  console.warn('[Catálogo] Ambiente local usando mocks de desenvolvimento:', error?.message || error);
  return { categories: mockCategories, products: mockProducts, source: 'development-mock' };
}

export function normalizeProduct(product, index = 0) {
  const categoryName = product.category_name || product.category || 'Outros';
  const regularPrice = Number(product.price || 0);
  const promoPrice = Number(product.promo_price);
  const hasValidPromo = Boolean(product.promo)
    && product.promo_price !== null
    && product.promo_price !== undefined
    && product.promo_price !== ''
    && Number.isFinite(promoPrice)
    && promoPrice >= 0
    && promoPrice < regularPrice;

  const trackStock = product.track_stock === true;
  const stock = Number.isFinite(Number(product.stock)) ? Math.max(0, Number(product.stock)) : 0;
  const manualAvailable = product.available !== false;
  const available = manualAvailable && (!trackStock || stock > 0);

  return {
    ...product,
    id: String(product.id),
    category_id: product.category_slug || (product.category_id ? String(product.category_id) : slug(categoryName)),
    category_name: categoryName,
    name: product.name || 'Produto Ignite',
    description: product.description || '',
    price: hasValidPromo ? promoPrice : regularPrice,
    original_price: regularPrice,
    promo: hasValidPromo,
    image_url: product.image_url && !String(product.image_url).includes('ignite-restaurant-kappa.vercel.app')
      ? product.image_url : null,
    emoji: product.emoji || categoryIcon(categoryName),
    color: product.color || '#fff0e9',
    featured: Boolean(product.featured),
    available,
    track_stock: trackStock,
    stock,
    position: product.position ?? index,
  };
}

export async function getCatalog() {
  try {
    const supabase = await getSupabase();
    const [categoryResult, productResult] = await Promise.all([
      supabaseRetry(() => supabase.from('cardapio_categories_public').select('*').order('position', { ascending: true })),
      supabaseRetry(() => supabase.from('cardapio_products_public').select('*').order('id', { ascending: true })),
    ]);

    if (categoryResult.error) throw categoryResult.error;
    if (productResult.error) throw productResult.error;

    const products = (productResult.data || [])
      .filter(product => product.active !== false && product.ativo !== false)
      .map(normalizeProduct);
    const dbCategories = (categoryResult.data || []).map(category => ({
      ...category,
      id: category.slug || String(category.id),
      name: category.name || category.nome,
    }));
    const productCategories = [...new Map(products.map(product => [
      product.category_id,
      { id: product.category_id, name: product.category_name, icon: categoryIcon(product.category_name) },
    ])).values()];
    const availableCategories = dbCategories.length ? dbCategories : productCategories;
    const categories = [
      { id: 'all', name: 'Todas categorias', icon: '✦', position: 0 },
      ...defaultCategories,
      ...availableCategories.filter(category => !defaultCategories.some(item => item.id === String(category.id))),
    ];

    return { source: 'supabase', categories, products };
  } catch (error) {
    return developmentCatalog(error);
  }
}

export async function getStoreSettings() {
  const supabase = await getSupabase();
  const { data, error } = await supabaseRetry(() => supabase
    .from('cardapio_store_status_public')
    .select('store_open,delivery_fee,updated_at')
    .maybeSingle());
  if (error) throw error;
  return {
    store_open: data?.store_open !== false,
    delivery_fee: Number(data?.delivery_fee || 0),
    updated_at: data?.updated_at || null,
  };
}

export async function subscribeToCatalog(onInvalidate) {
  const supabase = await getSupabase();
  let stopped = false;
  let timer = null;
  const invalidate = reason => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => onInvalidate?.(reason), 180);
  };

  const channel = supabase
    .channel(`cardapio-catalog-${Date.now()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => invalidate('products'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => invalidate('categories'))
    .subscribe(status => {
      if (status === 'SUBSCRIBED') invalidate('subscribed');
      if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) invalidate('realtime-recovery');
    });

  const online = () => invalidate('online');
  const focus = () => invalidate('focus');
  window.addEventListener('online', online);
  window.addEventListener('focus', focus);

  return () => {
    stopped = true;
    clearTimeout(timer);
    window.removeEventListener('online', online);
    window.removeEventListener('focus', focus);
    void supabase.removeChannel(channel);
  };
}

export async function getFeed() {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabaseRetry(() => supabase.from('cardapio_feed_public').select('*'));
    if (error) throw error;
    return (data || [])
      .filter(post => post.active !== false && post.aprovado !== false)
      .sort((a, b) => new Date(b.published_at || b.criado_em || b.created_at || 0) - new Date(a.published_at || a.criado_em || a.created_at || 0))
      .map(post => ({
        ...post,
        title: post.title || post.user_name || post.nome_usuario || 'Novidade Ignite',
        body: post.body || post.description || post.descricao || post.content || '',
        label: post.label || post.category || post.tipo || 'Ignite',
        emoji: post.emoji || '🔥',
      }));
  } catch (error) {
    if (isDevelopment()) {
      const { mockFeed } = await import('../data/mock-products.js');
      return mockFeed;
    }
    console.warn('[Feed] Conteúdo indisponível:', error?.message || error);
    return [];
  }
}

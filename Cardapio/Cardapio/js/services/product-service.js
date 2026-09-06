import { mockCategories, mockProducts, mockFeed } from '../data/mock-products.js';
import { getSupabase } from './supabase-client.js';

const slug = (value) => `cat-${String(value || 'outros').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
const categoryIcon = (value) => {
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
  const available = product.available !== undefined ? Boolean(product.available) : product.stock === undefined || Number(product.stock) > 0;
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
    // URLs antigas do projeto apontam para uma rota que não existe mais.
    image_url: product.image_url && !String(product.image_url).includes('ignite-restaurant-kappa.vercel.app')
      ? product.image_url : null,
    emoji: product.emoji || categoryIcon(categoryName),
    color: product.color || '#fff0e9',
    featured: Boolean(product.featured),
    available,
    position: product.position ?? index,
  };
}

export async function getCatalog() {
  const supabase = await getSupabase();
  if (!supabase) return { categories: mockCategories, products: mockProducts, source: 'demo' };

  try {
    let [categoryResult, productResult] = await Promise.all([
      supabase.from('cardapio_categories_public').select('*').order('position', { ascending: true }),
      supabase.from('cardapio_products_public').select('*').order('id', { ascending: true }),
    ]);
    const migrationPending = [categoryResult.error, productResult.error].some((error) =>
      error && (/cardapio_.*public/i.test(error.message || '') || ['42P01', 'PGRST205'].includes(error.code))
    );
    if (migrationPending) {
      [categoryResult, productResult] = await Promise.all([
        supabase.from('categories').select('*').order('position', { ascending: true }),
        supabase.from('products').select('*').order('id', { ascending: true }),
      ]);
    }
    if (productResult.error) throw productResult.error;
    const products = productResult.data
      .filter((product) => product.active !== false && product.ativo !== false)
      .map(normalizeProduct);
    const dbCategories = !categoryResult.error && categoryResult.data?.length
      ? categoryResult.data.map((category) => ({
        ...category,
        id: category.slug || String(category.id),
        name: category.name || category.nome,
      }))
      : [];
    const productCategories = [...new Map(products.map((product) => [product.category_id, { id: product.category_id, name: product.category_name, icon: categoryIcon(product.category_name) }])).values()];
    const availableCategories = dbCategories.length ? dbCategories : productCategories;
    const categories = [{ id: 'all', name: 'Todas categorias', icon: '✦', position: 0 }, ...defaultCategories, ...availableCategories.filter((category) => !defaultCategories.some((item) => item.id === String(category.id)))];
    return {
      source: 'supabase',
      categories,
      products,
    };
  } catch (error) {
    console.warn('[Catálogo] Usando dados locais:', error.message);
    return { categories: mockCategories, products: mockProducts, source: 'demo' };
  }
}

export async function getFeed() {
  const supabase = await getSupabase();
  if (!supabase) return mockFeed;
  try {
    let { data, error } = await supabase.from('cardapio_feed_public').select('*');
    if (error && (/cardapio_feed_public/i.test(error.message || '') || ['42P01', 'PGRST205'].includes(error.code))) {
      ({ data, error } = await supabase.from('feed_posts').select('*'));
    }
    if (error || !data?.length) return mockFeed;
    return data
      .filter((post) => post.active !== false && post.aprovado !== false)
      .sort((a, b) => new Date(b.published_at || b.criado_em || b.created_at || 0) - new Date(a.published_at || a.criado_em || a.created_at || 0))
      .map((post) => ({
        ...post,
        title: post.title || post.user_name || post.nome_usuario || 'Novidade Ignite',
        body: post.body || post.description || post.descricao || post.content || '',
        label: post.label || post.category || post.tipo || 'Ignite',
        emoji: post.emoji || '🔥',
      }));
  } catch {
    return mockFeed;
  }
}

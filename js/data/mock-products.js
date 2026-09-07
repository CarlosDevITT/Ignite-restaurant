export const mockCategories = [
  { id: 'all', name: 'Todos', icon: '✦', position: 0 },
  { id: 'burgers', name: 'Hambúrgueres', icon: '🍔', position: 1 },
  { id: 'pizzas', name: 'Pizzas', icon: '🍕', position: 2 },
  { id: 'meals', name: 'Marmitex', icon: '🍛', position: 3 },
  { id: 'sides', name: 'Porções', icon: '🍟', position: 4 },
  { id: 'drinks', name: 'Bebidas', icon: '🥤', position: 5 },
];

export const mockProducts = [
  { id: 'burger-ignite', category_id: 'burgers', category_name: 'Hambúrgueres', name: 'Ignite Bacon', description: 'Pão brioche, carne 160g, bacon crocante, cheddar e molho da casa.', price: 32.9, emoji: '🍔', color: '#fff0e8', featured: true, available: true, position: 1 },
  { id: 'burger-double', category_id: 'burgers', category_name: 'Hambúrgueres', name: 'Double Fire', description: 'Dois burgers, queijo duplo, cebola caramelizada e maionese defumada.', price: 39.9, emoji: '🍔', color: '#f8e9d8', featured: true, available: true, position: 2 },
  { id: 'pizza-calabresa', category_id: 'pizzas', category_name: 'Pizzas', name: 'Calabresa Especial', description: 'Calabresa, muçarela, cebola roxa, azeitonas e orégano.', price: 49.9, emoji: '🍕', color: '#fff1dc', featured: false, available: true, position: 3 },
  { id: 'pizza-frango', category_id: 'pizzas', category_name: 'Pizzas', name: 'Frango Cremoso', description: 'Frango temperado, catupiry, milho e muçarela.', price: 52.9, emoji: '🍕', color: '#f9eed8', featured: true, available: true, position: 4 },
  { id: 'marmita-picanha', category_id: 'meals', category_name: 'Marmitex', name: 'Picanha Acebolada', description: 'Arroz, feijão, farofa, salada e picanha acebolada.', price: 36.9, emoji: '🍛', color: '#edf5e8', featured: true, available: true, position: 5 },
  { id: 'marmita-frango', category_id: 'meals', category_name: 'Marmitex', name: 'Frango Fit', description: 'Frango grelhado, arroz integral, legumes e salada fresca.', price: 29.9, emoji: '🥗', color: '#e4f5e8', featured: false, available: true, position: 6 },
  { id: 'fries', category_id: 'sides', category_name: 'Porções', name: 'Fritas da Casa', description: 'Batatas crocantes com páprica e molho especial Ignite.', price: 19.9, emoji: '🍟', color: '#fff5d9', featured: false, available: true, position: 7 },
  { id: 'onion', category_id: 'sides', category_name: 'Porções', name: 'Onion Rings', description: 'Anéis de cebola empanados, sequinhos e crocantes.', price: 22.9, emoji: '🧅', color: '#f8eddc', featured: false, available: true, position: 8 },
  { id: 'soda', category_id: 'drinks', category_name: 'Bebidas', name: 'Refrigerante Lata', description: 'Escolha o sabor no campo de observações.', price: 7, emoji: '🥤', color: '#e8eff8', featured: false, available: true, position: 9 },
  { id: 'juice', category_id: 'drinks', category_name: 'Bebidas', name: 'Suco Natural', description: 'Copo de 400ml. Consulte os sabores disponíveis.', price: 10.9, emoji: '🍹', color: '#e7f6e9', featured: false, available: true, position: 10 },
];

export const mockFeed = [
  { id: 'feed-1', title: 'Combo Ignite em destaque', body: 'Ignite Bacon, fritas e refrigerante para matar a fome com estilo.', emoji: '🔥', label: 'Oferta da semana' },
  { id: 'feed-2', title: 'Novas opções leves', body: 'Nosso Frango Fit chegou com ingredientes frescos e muito sabor.', emoji: '🥗', label: 'Novidade' },
  { id: 'feed-3', title: 'Acompanhe pelo app', body: 'Faça seu pedido e veja cada mudança de status na área Pedidos.', emoji: '📱', label: 'Dica Ignite' },
];

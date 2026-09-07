import { cartStore } from '../store/cart-store.js';
import { getSupabase } from '../services/supabase-client.js';
import { escapeHTML, money, normalizeText } from '../utils/format.js';

const STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'eu', 'me',
  'o', 'os', 'para', 'por', 'qual', 'quais', 'que', 'tem', 'uma', 'um', 'voce', 'voces', 'meu', 'minha',
]);

const SYNONYM_GROUPS = [
  ['horario', 'funcionamento', 'abre', 'aberto', 'fecha', 'fechado'],
  ['endereco', 'onde', 'localizacao', 'fica', 'rua'],
  ['pagamento', 'pagar', 'pix', 'cartao', 'credito', 'debito', 'dinheiro'],
  ['entrega', 'delivery', 'entregar'],
  ['tempo', 'demora', 'prazo', 'minutos'],
  ['taxa', 'frete', 'entrega'],
  ['cancelamento', 'cancelar', 'cancelo'],
  ['vegetariano', 'vegetariana', 'vegano', 'vegana', 'fit', 'leve'],
  ['promocao', 'promocoes', 'oferta', 'ofertas', 'desconto'],
  ['produto', 'produtos', 'cardapio', 'comida', 'prato', 'pratos'],
  ['bebida', 'bebidas', 'drink', 'drinks'],
  ['combo', 'combos'],
];

const PRODUCT_INTENT = /produto|cardapio|comida|prato|lanche|hamb|burger|pizza|marmitex|marmita|bebida|drink|combo|lasanha|batata|porcao|salada|veget|vegano|fit|promoc|oferta|mais pedido|popular|preco|valor|quanto custa/;

const normalize = (value) => normalizeText(String(value || ''));

function tokensFor(value) {
  const base = normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  const tokens = new Set(base);
  SYNONYM_GROUPS.forEach((group) => {
    if (group.some((word) => tokens.has(word))) group.forEach((word) => tokens.add(word));
  });
  return [...tokens];
}

async function loadKnowledge() {
  const supabase = await getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id,categoria,titulo,conteudo,ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true });
  if (error) throw error;
  return data || [];
}

function scoreKnowledge(item, question, tokens) {
  const title = normalize(item.titulo);
  const category = normalize(item.categoria);
  const content = normalize(item.conteudo);
  let score = 0;
  if (title && question.includes(title)) score += 12;
  tokens.forEach((token) => {
    if (title.includes(token)) score += 5;
    if (category.includes(token)) score += 3;
    if (content.includes(token)) score += 1;
  });
  return score;
}

function findKnowledge(knowledge, question) {
  const normalizedQuestion = normalize(question);
  const tokens = tokensFor(question);
  return knowledge
    .map((item) => ({ item, score: scoreKnowledge(item, normalizedQuestion, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(a.item.ordem || 0) - Number(b.item.ordem || 0));
}

function scoreProduct(product, question, tokens) {
  const name = normalize(product.name);
  const category = normalize(product.category_name);
  const description = normalize(product.description);
  let score = 0;
  tokens.forEach((token) => {
    if (name.includes(token)) score += 7;
    if (category.includes(token)) score += 4;
    if (description.includes(token)) score += 2;
  });
  if (/promoc|oferta|desconto/.test(question) && product.promo) score += 10;
  if (/mais pedido|popular|recomend/.test(question) && product.featured) score += 10;
  return score;
}

function findProducts(products, question) {
  const normalizedQuestion = normalize(question);
  if (!PRODUCT_INTENT.test(normalizedQuestion)) return [];
  const tokens = tokensFor(question);
  const ranked = products
    .filter((product) => product.available !== false)
    .map((product) => ({ product, score: scoreProduct(product, normalizedQuestion, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ product }) => product);

  if (ranked.length) return ranked.slice(0, 8);

  const promoted = products
    .filter((product) => product.available !== false)
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Number(Boolean(b.promo)) - Number(Boolean(a.promo)));
  return promoted.slice(0, 8);
}

function productCard(product) {
  const promo = product.original_price > product.price;
  return `
    <article class="product-card" style="flex:0 0 220px;min-width:220px;scroll-snap-align:start">
      <div class="product-card__visual" style="--product-color:${escapeHTML(product.color || '#fff0e9')};cursor:default">
        ${product.featured ? '<span class="product-card__badge">Mais pedido</span>' : ''}
        ${product.image_url
          ? `<img class="product-card__image" src="${escapeHTML(product.image_url)}" alt="${escapeHTML(product.name)}" loading="lazy"><span class="product-card__emoji" aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>`
          : `<span class="product-card__emoji" aria-hidden="true">${escapeHTML(product.emoji || '🍽️')}</span>`}
      </div>
      <div class="product-card__content">
        <span class="product-card__category">${escapeHTML(product.category_name || 'Cardápio')}</span>
        <h3>${escapeHTML(product.name)}</h3>
        <p class="product-card__description">${escapeHTML(product.description || '')}</p>
        <div class="product-card__footer">
          <span class="product-card__price">${money(product.price)}${promo ? `<del>${money(product.original_price)}</del>` : ''}</span>
          <button class="product-add" type="button" data-chat-add-product="${escapeHTML(product.id)}" aria-label="Adicionar ${escapeHTML(product.name)} ao carrinho"><i class="fi fi-rr-plus" aria-hidden="true"></i></button>
        </div>
      </div>
    </article>`;
}

export function initChat(products) {
  const messages = document.querySelector('#chat-messages');
  const form = document.querySelector('#chat-form');
  const input = document.querySelector('#chat-input');
  const suggestions = document.querySelector('#chat-suggestions');
  if (!messages || !form || !input) return;

  let knowledge = [];
  let knowledgeReady = false;
  const knowledgePromise = loadKnowledge()
    .then((items) => {
      knowledge = items;
      knowledgeReady = true;
      return items;
    })
    .catch((error) => {
      console.warn('[Chat Ignite] Não foi possível carregar knowledge_base:', error.message);
      knowledgeReady = true;
      return [];
    });

  const scrollToBottom = () => { messages.scrollTop = messages.scrollHeight; };

  const addMessage = (text, user = false) => {
    messages.insertAdjacentHTML('beforeend', `<div class="message ${user ? 'message--user' : ''}">${escapeHTML(text)}</div>`);
    scrollToBottom();
  };

  const addProductCarousel = (items) => {
    if (!items.length) return;
    const id = `chat-products-${Date.now()}`;
    messages.insertAdjacentHTML('beforeend', `
      <div class="message" style="max-width:100%;width:100%">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px">
          <strong>Produtos que encontrei</strong><small>Deslize para ver mais</small>
        </div>
        <div id="${id}" aria-label="Produtos encontrados" tabindex="0" style="display:flex;gap:12px;overflow-x:auto;padding:2px 2px 12px;scroll-snap-type:x proximity;overscroll-behavior-inline:contain">
          ${items.map(productCard).join('')}
        </div>
      </div>`);
    scrollToBottom();
  };

  const respond = async (question) => {
    if (!knowledgeReady) await knowledgePromise;
    const normalizedQuestion = normalize(question);
    const productMatches = findProducts(products, question);
    const knowledgeMatches = findKnowledge(knowledge, question);
    const bestKnowledge = knowledgeMatches[0];
    const knowledgeThreshold = productMatches.length ? 5 : 3;

    if (bestKnowledge && bestKnowledge.score >= knowledgeThreshold) {
      const prefix = bestKnowledge.item.titulo ? `${bestKnowledge.item.titulo}: ` : '';
      addMessage(`${prefix}${bestKnowledge.item.conteudo}`);
    } else if (productMatches.length) {
      if (/promoc|oferta|desconto/.test(normalizedQuestion)) addMessage('Separei as ofertas e destaques disponíveis no cardápio.');
      else if (/mais pedido|popular|recomend/.test(normalizedQuestion)) addMessage('Separei alguns dos destaques do Ignite para você.');
      else addMessage('Encontrei estas opções no nosso cardápio:');
    } else {
      addMessage('Ainda não encontrei essa informação na base do Ignite. Você pode perguntar sobre produtos, horário, endereço, entrega, pagamento, promoções ou políticas do restaurante.');
    }

    if (productMatches.length) addProductCarousel(productMatches);
  };

  const send = async (text) => {
    const question = text.trim();
    if (!question) return;
    addMessage(question, true);
    input.value = '';
    input.disabled = true;
    form.querySelector('button[type="submit"]')?.setAttribute('disabled', '');
    try {
      await respond(question);
    } catch (error) {
      console.error('[Chat Ignite] Falha ao responder:', error);
      addMessage('Não consegui consultar as informações agora. Tente novamente em instantes.');
    } finally {
      input.disabled = false;
      form.querySelector('button[type="submit"]')?.removeAttribute('disabled');
      input.focus();
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    send(input.value);
  });

  suggestions?.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) send(button.textContent);
  });

  messages.addEventListener('click', (event) => {
    const button = event.target.closest('[data-chat-add-product]');
    if (!button) return;
    const product = products.find((item) => String(item.id) === String(button.dataset.chatAddProduct));
    if (!product || product.available === false) return;
    cartStore.add(product);
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `${product.name} adicionado`, showConfirmButton: false, timer: 1400 });
  });

  messages.addEventListener('error', (event) => {
    if (!event.target.matches('.product-card__image')) return;
    event.target.hidden = true;
    event.target.nextElementSibling?.style.setProperty('opacity', '1');
  }, true);

  addMessage('Olá! Eu sou a assistente do Ignite. Posso consultar o cardápio e as informações cadastradas pelo restaurante. O que você quer saber?');
}

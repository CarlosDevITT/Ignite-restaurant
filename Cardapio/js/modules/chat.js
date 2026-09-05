import { escapeHTML, money, normalizeText } from '../utils/format.js';

export function initChat(products) {
  const messages = document.querySelector('#chat-messages');
  const form = document.querySelector('#chat-form');
  const input = document.querySelector('#chat-input');

  const addMessage = (text, user = false) => {
    messages.insertAdjacentHTML('beforeend', `<div class="message ${user ? 'message--user' : ''}">${escapeHTML(text)}</div>`);
    messages.scrollTop = messages.scrollHeight;
  };

  const reply = (question) => {
    const text = normalizeText(question);
    const featured = products.filter((item) => item.featured);
    const vegetarian = products.find((item) => normalizeText(`${item.name} ${item.description}`).match(/fit|salada|veget|legume/));
    if (text.match(/oferta|promoc/)) return featured.length ? `Hoje os destaques são ${featured.slice(0, 3).map((item) => item.name).join(', ')}.` : 'As ofertas serão publicadas em breve.';
    if (text.match(/veget|leve|fit/)) return vegetarian ? `Sugiro ${vegetarian.name}, por ${money(vegetarian.price)}. Parece uma ótima escolha!` : 'Ainda não encontrei uma opção vegetariana cadastrada. Confirme com a equipe.';
    if (text.match(/mais pedido|popular|recomend/)) return featured[0] ? `O ${featured[0].name} é um dos favoritos, por ${money(featured[0].price)}.` : 'Posso ajudar a escolher entre hambúrguer, pizza e marmitex.';
    if (text.match(/entrega|tempo|demora/)) return 'A previsão atual é de 35 a 50 minutos. O tempo final aparece na confirmação do pedido.';
    return 'Posso sugerir produtos, informar preços, ofertas e opções leves. Para alergias, confirme sempre com a equipe antes de pedir.';
  };

  const send = (text) => { if (!text.trim()) return; addMessage(text, true); input.value = ''; setTimeout(() => addMessage(reply(text)), 350); };
  form.addEventListener('submit', (event) => { event.preventDefault(); send(input.value); });
  document.querySelector('#chat-suggestions').addEventListener('click', (event) => { const button = event.target.closest('button'); if (button) send(button.textContent); });
  addMessage('Olá! Eu sou a assistente do Ignite. O que você gostaria de comer hoje?');
}

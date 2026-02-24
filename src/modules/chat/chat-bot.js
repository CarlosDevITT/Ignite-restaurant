// chat-bot.js - Atendente Inteligente Ignite com Integração Supabase
// Design Elegante e Efeitos de Digitação

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMessagesContainer = document.getElementById('chat-messages');

    if (!chatInput || !chatSendBtn || !chatMessagesContainer) return;

    // Configurações Basicas
    const BOT_NAME = "Ignite Assistente";
    const INITIAL_MESSAGE = "Olá! Sou o assistente virtual do Ignite. Como posso ajudar você hoje? Posso te mostrar o cardápio, dar informações sobre entrega ou tirar dúvidas!";

    // Inicialização
    appendMessage('bot', INITIAL_MESSAGE, true); // true para mensagem instantânea no início

    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Limpar e desabilitar
        chatInput.value = '';
        chatInput.disabled = true;

        // 1. Mostrar mensagem do usuário
        appendMessage('user', text);

        // 2. Mostrar indicador de digitando
        const loadingId = showTypingIndicator();

        try {
            // Pequeno delay para simular pensamento
            await new Promise(resolve => setTimeout(resolve, 800));

            // 3. Lógica de Resposta (Supabase + Inteligência Básica)
            const response = await generateElegantResponse(text);

            // 4. Remover loading e mostrar resposta com efeito
            removeTypingIndicator(loadingId);
            await appendMessageWithEffect('bot', response);

        } catch (error) {
            console.error("Erro no Chat Bot:", error);
            removeTypingIndicator(loadingId);
            appendMessage('bot', "Desculpe, tive um probleminha técnico. Pode repetir?");
        } finally {
            chatInput.disabled = false;
            chatInput.focus();
        }
    }

    /**
     * Lógica Principal de Resposta
     */
    async function generateElegantResponse(query) {
        const q = query.toLowerCase();

        // 1. Informações fixas do restaurante
        if (q.includes('endereço') || q.includes('onde fica') || q.includes('localização')) {
            return "Temos duas unidades para melhor te atender:\n📍 **Manaus:** Vieiralves, 04.\n📍 **Itajaí:** R. Fridolim Herthal Júnior, 97.";
        }

        if (q.includes('horário') || q.includes('aberto') || q.includes('fecha')) {
            return "Nosso horário de funcionamento é todos os dias, das **09:00h às 22:00h**. Ficaremos felizes em te receber!";
        }

        if (q.includes('taxa') || q.includes('entrega') || q.includes('valor do frete')) {
            return "Nossa taxa de entrega é calculada por distância: R$ 5,00 fixos + R$ 1,50 por KM. Você pode calcular o valor exato clicando no botão **'Calcular taxa e tempo de entrega'** no topo do cardápio!";
        }

        // 2. Busca de Produtos (Supabase/Global)
        const products = window.products || [];
        if (q.includes('cardápio') || q.includes('comida') || q.includes('comer') || q.includes('ver itens')) {
            if (products.length > 0) {
                const categorias = [...new Set(products.map(p => p.category || p.categoria))].slice(0, 4);
                return `Nosso cardápio é variado! Temos **${categorias.join(', ')}** e muito mais. Qual categoria você gostaria de ver?`;
            }
            return "Você pode conferir todo o nosso cardápio rolando a página principal! Temos hambúrgueres, lanches e bebidas geladinhas.";
        }

        // Busca específica de produto
        const foundProduct = products.find(p => {
            const name = (p.name || p.nome || '').toLowerCase();
            return q.includes(name) && name.length > 3;
        });

        if (foundProduct) {
            return `O **${foundProduct.name || foundProduct.nome}** é uma ótima escolha! Ele sai por **R$ ${foundProduct.price.toFixed(2).replace('.', ',')}**. Quer que eu te ajude a adicionar ao carrinho?`;
        }

        // 3. Fallback Gemini (se chave configurada) ou Resposta Genérica
        return "Legal! Como assistente virtual, ainda estou aprendendo. Você gostaria de saber mais sobre nosso **cardápio**, **horários** ou **unidades**? Se quiser falar com um humano, é só pedir!";
    }

    /**
     * Efeito de Digitação (Elegant Typing)
     */
    async function appendMessageWithEffect(sender, text) {
        const timeSt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const div = document.createElement('div');
        div.className = "bg-white border border-gray-100 text-gray-800 p-3 rounded-2xl rounded-tl-none max-w-[85%] self-start shadow-sm text-sm break-words transition-all duration-300 opacity-0 translate-y-2 mb-2";

        // Estrutura básica
        div.innerHTML = `
            <div class="message-content"></div>
            <span class="block text-[10px] text-gray-400 mt-1 text-right">${timeSt}</span>
        `;

        chatMessagesContainer.appendChild(div);

        // Fade in
        setTimeout(() => {
            div.classList.remove('opacity-0', 'translate-y-2');
        }, 50);

        const contentDiv = div.querySelector('.message-content');

        // Efeito de aparecer texto
        let lines = text.split('\n');
        for (let line of lines) {
            let p = document.createElement('p');
            p.className = "mb-1 last:mb-0";
            contentDiv.appendChild(p);

            // Parse simples de negrito
            let formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            // Simular digitação por palavras para ser mais fluido e "elegante"
            let words = formattedLine.split(' ');
            for (let word of words) {
                p.innerHTML += word + ' ';
                scrollToBottom();
                await new Promise(r => setTimeout(r, 40));
            }
        }
    }

    function appendMessage(sender, text, instant = false) {
        const timeSt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const div = document.createElement('div');

        let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/\n/g, '<br>');

        if (sender === 'user') {
            div.className = "bg-primary text-white p-3 rounded-2xl rounded-tr-none max-w-[85%] self-end shadow-md text-sm break-words mb-2 animate-in fade-in slide-in-from-right-2 duration-300";
            div.innerHTML = `
                ${formattedText}
                <span class="block text-[10px] text-green-100 mt-1 text-right">${timeSt}</span>
            `;
        } else {
            div.className = "bg-white border border-gray-100 text-gray-800 p-3 rounded-2xl rounded-tl-none max-w-[85%] self-start shadow-sm text-sm break-words mb-2";
            div.innerHTML = `
                ${formattedText}
                <span class="block text-[10px] text-gray-400 mt-1 text-right">${timeSt}</span>
            `;
        }

        chatMessagesContainer.appendChild(div);
        scrollToBottom();
    }

    function showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = "bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none self-start shadow-sm text-sm flex gap-1.5 items-center h-[42px] mb-2 px-4";
        div.innerHTML = `
            <div class="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></div>
            <div class="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
            <div class="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
        `;
        chatMessagesContainer.appendChild(div);
        scrollToBottom();
        return id;
    }

    function removeTypingIndicator(id) {
        const div = document.getElementById(id);
        if (div) div.remove();
    }

    function scrollToBottom() {
        chatMessagesContainer.scrollTo({
            top: chatMessagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }
});

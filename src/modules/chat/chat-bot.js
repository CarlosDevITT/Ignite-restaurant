// chat-bot.js - Integração do Google Gemini API para Chat Inteligente

/*
  IMPORTANTE: 
  Para usar este bot, você precisa de uma chave de API do Google Gemini.
  1. Acesse: https://aistudio.google.com/
  2. Crie um projeto e gere uma API Key.
  3. Cole a chave na variável GEMINI_API_KEY abaixo.
*/
const GEMINI_API_KEY = "COLE_SUA_API_KEY_AQUI";

const CHAT_SYSTEM_PROMPT = `Você é o assistente virtual do "Ignite Restaurant". 
Sua função é atender os clientes de forma educada, amigável e concisa. 
Responda sempre em português do Brasil.
O restaurante serve lanches variados, hambúrgueres (como X-Salada, X-Egg, X-Burger) e bebidas.
As entregas são feitas em Manaus e Itajaí.
Se não souber a resposta, diga que um atendente humano poderá ajudar em breve.
Seja breve nas respostas, em formato de chat. Não use formatação markdown complexa, no máximo negrito (**texto**).`;

let conversationHistory = [];

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMessagesContainer = document.getElementById('chat-messages');

    if (!chatInput || !chatSendBtn || !chatMessagesContainer) return;

    // Inicializar histórico com a mensagem de boas-vindas já presente no HTML
    conversationHistory.push({
        role: "model",
        parts: [{ text: "Olá! Como podemos ajudar com seu pedido hoje?" }]
    });

    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    async function sendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // 1. Mostrar a mensagem do usuário na interface
        appendMessage('user', text);
        chatInput.value = '';
        chatInput.disabled = true;

        // Adicionar ao histórico do Gemini
        conversationHistory.push({
            role: "user",
            parts: [{ text: text }]
        });

        // 2. Mostrar indicador de "digitando..."
        const loadingId = showTypingIndicator();

        try {
            // Validar chave de API
            if (GEMINI_API_KEY === "COLE_SUA_API_KEY_AQUI" || !GEMINI_API_KEY) {
                throw new Error("API Key não configurada. Por favor, adicione sua chave Gemini no arquivo chat-bot.js.");
            }

            // 3. Fazer a requisição para a API do Gemini
            const response = await callGeminiAPI(text);

            // 4. Remover indicador de carregamento
            removeTypingIndicator(loadingId);

            // 5. Exibir resposta do bot
            if (response) {
                appendMessage('bot', response);
                conversationHistory.push({
                    role: "model",
                    parts: [{ text: response }]
                });
            } else {
                throw new Error("Resposta em branco da API.");
            }

        } catch (error) {
            console.error("Erro no Chat Bot:", error);
            removeTypingIndicator(loadingId);
            appendMessage('error', `Desculpe, ocorreu um erro de conexão. ${error.message}`);
            // Remover a última mensagem do usuário do histórico para não corromper o fluxo em caso de erro
            conversationHistory.pop();
        } finally {
            chatInput.disabled = false;
            chatInput.focus();
        }
    }

    async function callGeminiAPI(messageText) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const payload = {
            system_instruction: {
                parts: [{ text: CHAT_SYSTEM_PROMPT }]
            },
            contents: conversationHistory,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 250,
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Erro na requisição Gemni.");
        }

        const data = await response.json();
        if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
            return data.candidates[0].content.parts[0].text;
        }

        return null;
    }

    function appendMessage(sender, text) {
        const timeSt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let formattedText = text;
        // Simples parser de asteriscos do markdown para <strong>
        formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedText = formattedText.replace(/\n/g, '<br>');

        const div = document.createElement('div');

        if (sender === 'user') {
            div.className = "bg-primary text-white p-3 rounded-lg rounded-tr-none max-w-[85%] self-end shadow-sm text-sm break-words";
            div.innerHTML = `
                ${formattedText}
                <span class="block text-[10px] text-green-100 mt-1 text-right">${timeSt}</span>
            `;
        } else if (sender === 'bot') {
            div.className = "bg-white border border-gray-100 text-gray-800 p-3 rounded-lg rounded-tl-none max-w-[85%] self-start shadow-sm text-sm break-words";
            div.innerHTML = `
                ${formattedText}
                <span class="block text-[10px] text-gray-400 mt-1 text-right">${timeSt}</span>
            `;
        } else if (sender === 'error') {
            div.className = "bg-red-50 text-red-600 p-2 rounded-lg max-w-[90%] self-center shadow-sm text-xs text-center border border-red-100";
            div.innerHTML = formattedText;
        }

        chatMessagesContainer.appendChild(div);
        scrollToBottom();
    }

    function showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = "bg-white border border-gray-100 p-3 rounded-lg rounded-tl-none self-start shadow-sm text-sm flex gap-1 items-center h-[42px]";
        div.innerHTML = `
            <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
            <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
            <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
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
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
});

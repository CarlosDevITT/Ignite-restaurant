/**
 * @file chat-bot.js
 * @description Atendente Inteligente Ignite — v3.0
 *              Integração: Supabase · Gemini · DeepSeek
 *              Novidades: Chips · Histórico · Carrossel · Avaliação 👍👎
 *
 * Arquitetura (módulos IIFE isolados):
 * ┌────────────────────────────────────────────────────────────┐
 * │  CHAT_CONFIG     — fonte única de verdade (config/tokens)  │
 * │  HistoryStore    — persiste conversa no localStorage       │
 * │  FeedbackStore   — salva avaliações 👍👎 no localStorage   │
 * │  AIProvider      — Gemini → DeepSeek com fallback local    │
 * │  ProductCard     — card único de produto                   │
 * │  ProductCarousel — carrossel de múltiplos produtos         │
 * │  UIManager       — renderização, chips, avaliação, scroll  │
 * │  SupabaseService — carrega e normaliza produtos            │
 * │  ChatBot         — orquestrador principal                  │
 * └────────────────────────────────────────────────────────────┘
 */

// ============================================================
// ⚙️  CONFIGURAÇÃO CENTRALIZADA
// ============================================================
const CHAT_CONFIG = {
    bot: {
        nome: "Ignite Assistente",
        avatar: "🔥",
        mensagemInicial:
            "Olá! Sou o assistente do **Ignite** 🔥\n" +
            "Posso te mostrar o cardápio, informar preços e tirar dúvidas sobre entrega.\n" +
            "Como posso ajudar?",
    },

    restaurante: {
        unidades: [
            { cidade: "Manaus", endereco: "Vieiralves, 04" },
            { cidade: "Itajaí", endereco: "R. Fridolim Herthal Júnior, 97" },
        ],
        horario: "Todos os dias das 09:00 às 22:00",
        entrega: { base: 5.00, porKm: 1.50 },
    },

    // ─── Sugestões rápidas exibidas como chips clicáveis ──────
    chips: [
        { label: "🍔 Ver cardápio", texto: "Quero ver o cardápio completo com todos os produtos" },
        { label: "🛵 Entrega", texto: "Como funciona a taxa de entrega?" },
        { label: "⏰ Horários", texto: "Qual o horário de funcionamento?" },
        { label: "📍 Localização", texto: "Onde ficam as unidades do Ignite?" },
        { label: "🔥 Promoções", texto: "Quais são as promoções e mais vendidos?" },
        { label: "💳 Formas de pagamento", texto: "Quais formas de pagamento vocês aceitam?" },
    ],

    // ─── Chaves de API ────────────────────────────────────────
    // ⚠️  Para produção: use um backend proxy para não expor chaves no frontend.
    ai: {
        gemini: {
            enabled: true,
            apiKey: (typeof process !== 'undefined' && process.env && process.env.REACT_APP_GEMINI_KEY) || "SUA_CHAVE_GEMINI_AQUI",
            model: "gemini-1.5-flash",
            endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
        },
        deepseek: {
            enabled: false,
            apiKey: (typeof process !== 'undefined' && process.env && process.env.REACT_APP_DEEPSEEK_KEY) || "SUA_CHAVE_DEEPSEEK_AQUI",
            model: "deepseek-chat",
            endpoint: "https://api.deepseek.com/v1/chat/completions",
        },
        provedor: "local", // provedor principal: "local" (fallback) | "gemini" | "deepseek"
        usarFallbackLocal: true, // usar sempre fallback inteligente quando API falhar
    },

    ui: {
        velocidadeDigitacao: 20,  // ms por palavra no efeito de digitação (mais rápido)
        delayPensamento: 400, // ms de "pensamento" antes de responder
        animacaoAtivada: true, // ativar animações suaves
    },

    storage: {
        historicoKey: "ignite_chat_historico", // chave no localStorage
        feedbackKey: "ignite_chat_feedback",  // chave no localStorage
        maxMensagens: 40,                      // máximo salvo no localStorage
    },
};

// ============================================================
// 💾  HISTORY STORE — Persiste conversa no localStorage
// ============================================================
const HistoryStore = (() => {
    const { historicoKey, maxMensagens } = CHAT_CONFIG.storage;

    /**
     * Carrega o histórico salvo.
     * @returns {Array<{role: string, content: string}>}
     */
    function carregar() {
        try {
            const raw = localStorage.getItem(historicoKey);
            return raw ? JSON.parse(raw) : [];
        } catch {
            // JSON corrompido — limpa e recomeça
            localStorage.removeItem(historicoKey);
            return [];
        }
    }

    /**
     * Salva o histórico, truncando ao limite configurado.
     * @param {Array} historico
     */
    function salvar(historico) {
        try {
            localStorage.setItem(historicoKey, JSON.stringify(historico.slice(-maxMensagens)));
        } catch (e) {
            console.warn("⚠️ HistoryStore: falha ao salvar (localStorage cheio?):", e.message);
        }
    }

    /** Apaga o histórico. */
    function limpar() {
        localStorage.removeItem(historicoKey);
    }

    return { carregar, salvar, limpar };
})();

// ============================================================
// 👍  FEEDBACK STORE — Salva avaliações 👍👎 no localStorage
// ============================================================
const FeedbackStore = (() => {
    const { feedbackKey } = CHAT_CONFIG.storage;

    /**
     * Registra uma avaliação.
     * @param {string}       msgId    — ID único da mensagem
     * @param {"up"|"down"}  voto
     * @param {string}       pergunta — texto que gerou a resposta avaliada
     */
    function registrar(msgId, voto, pergunta) {
        try {
            const dados = _carregar();
            dados.push({ id: msgId, voto, pergunta: pergunta.slice(0, 200), ts: Date.now() });
            localStorage.setItem(feedbackKey, JSON.stringify(dados));
            console.info(`📊 Feedback registrado: ${voto === "up" ? "👍" : "👎"} — "${pergunta.slice(0, 60)}"`);
        } catch (e) {
            console.warn("⚠️ FeedbackStore: falha ao salvar:", e.message);
        }
    }

    /** Resumo dos feedbacks — útil para analytics. */
    function resumo() {
        const dados = _carregar();
        return {
            total: dados.length,
            positivos: dados.filter(d => d.voto === "up").length,
            negativos: dados.filter(d => d.voto === "down").length,
            itens: dados,
        };
    }

    function _carregar() {
        try { return JSON.parse(localStorage.getItem(feedbackKey) || "[]"); }
        catch { return []; }
    }

    // Utilitário de debug acessível no console do browser
    window.chatFeedback = () => {
        const r = resumo();
        console.info(`📊 Feedback: ${r.total} total | 👍 ${r.positivos} | 👎 ${r.negativos}`);
        console.table(r.itens);
    };

    return { registrar, resumo };
})();

// ============================================================
// 🤖  AI PROVIDER — Gemini + DeepSeek com fallback local
// ============================================================
const AIProvider = (() => {

    /**
     * Monta o system prompt com contexto completo do restaurante e produtos.
     * Inclui as diretivas especiais que a IA pode usar para mostrar produtos.
     */
    function _buildSystemPrompt(produtos) {
        const { restaurante } = CHAT_CONFIG;
        const unidades = restaurante.unidades.map(u => `${u.cidade}: ${u.endereco}`).join(" | ");
        const produtosTxt = produtos.length
            ? produtos.slice(0, 50)
                .map(p => `- ${p.nome} (${p.categoria}) — R$ ${Number(p.preco).toFixed(2)}`)
                .join("\n")
            : "Cardápio temporariamente indisponível.";

        return `Você é o assistente virtual do restaurante Ignite, especializado em hambúrgueres artesanais.
Responda SEMPRE em português brasileiro, de forma amigável, objetiva e com emojis leves.
Use **negrito** para destacar nomes de produtos e preços.
Nunca invente informações. Se não souber, diga honestamente.

=== DADOS DO RESTAURANTE ===
Unidades: ${unidades}
Horário: ${restaurante.horario}
Taxa de entrega: R$ ${restaurante.entrega.base.toFixed(2)} + R$ ${restaurante.entrega.porKm.toFixed(2)}/km

=== CARDÁPIO ATUAL ===
${produtosTxt}

=== DIRETIVAS ESPECIAIS (use quando necessário) ===
Para mostrar UM produto específico, inclua ao final da resposta:
  [MOSTRAR_PRODUTO: nome exato do produto]

Para mostrar MÚLTIPLOS produtos em carrossel (máx 5), inclua ao final:
  [CARROSSEL_PRODUTOS: Produto A | Produto B | Produto C]

=== REGRAS ===
- Respostas curtas e diretas (máx 3 parágrafos).
- Ao recomendar produtos, mencione nome e preço.
- Use [CARROSSEL_PRODUTOS] quando o usuário pedir sugestões, categorias ou mais vendidos.`;
    }

    /** Chama Google Gemini (modelo gratuito: gemini-1.5-flash). */
    async function _chamarGemini(mensagem, historico, produtos) {
        const { gemini } = CHAT_CONFIG.ai;
        const contents = [
            { role: "user", parts: [{ text: _buildSystemPrompt(produtos) }] },
            { role: "model", parts: [{ text: "Entendido! Pronto para atender. 🔥" }] },
            ...historico.map(h => ({
                role: h.role === "assistant" ? "model" : "user",
                parts: [{ text: h.content }],
            })),
            { role: "user", parts: [{ text: mensagem }] },
        ];

        const res = await fetch(
            `${gemini.endpoint}/${gemini.model}:generateContent?key=${gemini.apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 600 } }),
            }
        );

        if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
        const json = await res.json();
        return json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    /** Chama DeepSeek (compatível com formato OpenAI). */
    async function _chamarDeepSeek(mensagem, historico, produtos) {
        const { deepseek } = CHAT_CONFIG.ai;
        const messages = [
            { role: "system", content: _buildSystemPrompt(produtos) },
            ...historico,
            { role: "user", content: mensagem },
        ];

        const res = await fetch(deepseek.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${deepseek.apiKey}` },
            body: JSON.stringify({ model: deepseek.model, messages, max_tokens: 600, temperature: 0.7 }),
        });

        if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
        const json = await res.json();
        return json.choices?.[0]?.message?.content || "";
    }

    /**
     * Ponto de entrada público com prioridade para fallback local.
     * Fluxo: local inteligente → API (se chave disponível) → fallback local.
     */
    async function responder(mensagem, historico, produtos) {
        const { provedor, gemini, deepseek, usarFallbackLocal } = CHAT_CONFIG.ai;

        // Guard: não chama API com chave placeholder
        const geminiOk = gemini.enabled && !gemini.apiKey.includes("SUA_CHAVE");
        const deepseekOk = deepseek.enabled && !deepseek.apiKey.includes("SUA_CHAVE");

        // Se nenhuma chave válida, usar fallback local imediatamente
        if (!geminiOk && !deepseekOk) {
            console.info("ℹ️ Usando fallback local — sem chave de API configurada.");
            return _fallbackLocal(mensagem, produtos);
        }

        // Se configurado para usar fallback local como padrão
        if (usarFallbackLocal && (provedor === "local")) {
            return _fallbackLocal(mensagem, produtos);
        }

        try {
            if (provedor === "gemini" && geminiOk) return await _chamarGemini(mensagem, historico, produtos);
            if (provedor === "deepseek" && deepseekOk) return await _chamarDeepSeek(mensagem, historico, produtos);
            throw new Error("Provedor principal indisponível.");
        } catch (erro) {
            console.warn(`⚠️ AIProvider '${provedor}' falhou:`, erro.message);
            try {
                if (provedor === "gemini" && deepseekOk) return await _chamarDeepSeek(mensagem, historico, produtos);
                if (provedor === "deepseek" && geminiOk) return await _chamarGemini(mensagem, historico, produtos);
            } catch (e2) {
                console.error("❌ Fallback de API falhou:", e2.message);
            }
            // Salvaguarda: usar fallback local
            return _fallbackLocal(mensagem, produtos);
        }
    }

    /** Respostas locais com IA aprimorada e melhor UX. */
    function _fallbackLocal(q, produtos) {
        const t = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const { restaurante } = CHAT_CONFIG;

        // Saudações
        if (/^(oi|ola|hey|sup|tudo bem|como vai|como vc)/i.test(q)) {
            return "Opa! 👋 Tudo bem? Bem-vindo ao **Ignite**! 🔥\n" +
                   "Posso te ajudar com:\n" +
                   "✨ Cardápio e produtos\n" +
                   "📦 Informações de entrega\n" +
                   "💳 Formas de pagamento\n" +
                   "⏰ Horários e localização\n" +
                   "O que você gostaria de saber?";
        }

        // Endereço/Localização
        if (/enderec|onde fica|unidade|localiza|rua|avenida|vieiralves|fridolin|itajai/.test(t)) {
            return "📍 **Nossas Unidades:**\n\n" +
                   restaurante.unidades.map(u => `🔥 **${u.cidade}**\n${u.endereco}`).join("\n\n") +
                   "\n\n📱 Passe por uma de nossas unidades e aproveite!";
        }

        // Horários
        if (/hor[aá]rio|abre|fecha|funciona|aberto|funcionamento/.test(t)) {
            const agora = new Date();
            const hora = agora.getHours();
            const estaAberto = hora >= 9 && hora < 22;
            const status = estaAberto ? "✅ Estamos abertos agora!" : "🔒 Estamos fechados no momento";
            return `⏰ ${status}\n\n**Horário de Funcionamento:**\n📅 Todos os dias das **09:00 às 22:00**\n\nVenha nos visitar! 🍔`;
        }

        // Entrega
        if (/entrega|taxa|frete|envio|quanto custa/.test(t)) {
            return `🛵 **Informações de Entrega:**\n\n` +
                   `💰 Taxa Base: **R$ ${restaurante.entrega.base.toFixed(2)}**\n` +
                   `📍 Adicional por km: **R$ ${restaurante.entrega.porKm.toFixed(2)}/km**\n\n` +
                   `⏱️ Tempo estimado: **30-45 minutos**\n\n` +
                   `*Valores podem variar conforme a localização*`;
        }

        // Bebidas (resposta mais direta e, quando possível, apresentar carrossel de produtos)
        if (/bebida|bebidas|refrigerante|suco|cerveja|cervejas|agua|água|drink|drinks|vinho|bebidas alco|alcool|álcool/.test(t)) {
            // tentar encontrar produtos por categoria ou nome
            const lista = produtos || [];
            const encontradas = lista.filter(p => {
                const cat = (p.categoria || p.category || '').toLowerCase();
                const nomep = (p.nome || p.name || '').toLowerCase();
                return cat.includes('beb') || /cerveja|refrigerante|suco|água|agua|vinho|drink|bebida/.test(nomep);
            });

            if (encontradas.length > 0) {
                const nomes = encontradas.slice(0, 5).map(p => p.nome || p.name).join(' | ');
                return `🍹 **Temos estas bebidas disponíveis:**\n\nConfira algumas opções abaixo:\n[CARROSSEL_PRODUTOS: ${nomes}]\n\nQuer que eu adicione alguma ao seu pedido?`;
            }

            return `🍹 Temos diversas bebidas: refrigerantes, sucos, água e cervejas. Quer que eu mostre as opções disponíveis no cardápio?`;
        }

        // Formas de pagamento
        if (/pagamento|credito|debito|pix|dinheiro|como pagar|aceita/.test(t)) {
            return `💳 **Formas de Pagamento Aceitas:**\n\n` +
                   `✅ Cartão de Crédito\n` +
                   `✅ Cartão de Débito\n` +
                   `✅ PIX (instantâneo)\n` +
                   `✅ Dinheiro na entrega\n\n` +
                   `Escolha a forma mais conveniente para você!`;
        }

        // Cardápio - com carrossel (seleção representativa por categoria)
        if (/card[aá]pio|produtos|o que tem|opcoes|ver itens|menu|ofertas/.test(t) && produtos.length) {
            // Normalizar categoria
            const normalizeCat = c => (String(c || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')).trim();

            // Categorizar produtos
            const catMap = new Map();
            for (const p of produtos) {
                const cat = normalizeCat(p.categoria || p.category || 'outros') || 'outros';
                if (!catMap.has(cat)) catMap.set(cat, []);
                catMap.get(cat).push(p);
            }

            // Preferir categorias não relacionadas a bebida primeiro
            const bebidaRegex = /bebida|cerveja|refrigerante|suco|agua|água|drink|vinho/;
            const cats = Array.from(catMap.keys());
            const nonBebidas = cats.filter(c => !bebidaRegex.test(c));
            const bebidas = cats.filter(c => bebidaRegex.test(c));

            const pick = [];

            // pick one from top non-bebida categories
            for (const c of nonBebidas) {
                const arr = catMap.get(c) || [];
                if (arr.length) pick.push(arr[0]);
                if (pick.length >= 4) break; // reserve space for at least one bebida
            }

            // add one or two bebidas if available
            for (const c of bebidas) {
                const arr = catMap.get(c) || [];
                if (arr.length && pick.length < 5) pick.push(arr[0]);
                if (pick.length >= 5) break;
            }

            // fill up with featured or remaining products
            if (pick.length < 5) {
                const remaining = produtos.filter(p => !pick.find(x => String(x.id) === String(p.id)));
                // prefer featured first
                const featured = remaining.filter(p => p.featured || p.destaque);
                for (const f of featured) {
                    if (pick.length >= 5) break;
                    pick.push(f);
                }
                for (const r of remaining) {
                    if (pick.length >= 5) break;
                    if (!pick.find(x => String(x.id) === String(r.id))) pick.push(r);
                }
            }

            const nomes = pick.slice(0, 5).map(p => p.nome || p.name).filter(Boolean).join(' | ');
            if (!nomes) return `Desculpe, não encontrei itens do cardápio agora.`;

            return `🍔 **Nosso Cardápio Premium!**\n\n` +
                   `Confira os destaques:\n[CARROSSEL_PRODUTOS: ${nomes}]\n\n` +
                   `*Deslize para ver mais opções incríveis!*`;
        }

        // Mais vendidos / Recomendações
        if (/mais vendido|popular|destaque|recomenda|sugestao|qual me recomenda|melhor/.test(t) && produtos.length) {
            const maisVendidos = produtos.slice(0, 5).map(p => p.nome || p.name).join(" | ");
            return `🔥 **Favoritos dos Clientes!**\n\n` +
                   `Esses produtos são SENSACIONAIS:\n[CARROSSEL_PRODUTOS: ${maisVendidos}]\n\n` +
                   `👌 Todos vêm com a qualidade Ignite garantida!`;
        }

        // Buscar por nome de produto específico
        if (produtos.length > 0 && q.length > 2) {
            const achado = produtos.find(p => {
                const nome = (p.nome || p.name || "").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return nome.includes(t) && q.length > 2;
            });
            if (achado && achado.nome) {
                const preco = Number(achado.preco || achado.price || 0);
                const desc = achado.descricao || achado.description || "Produto delicioso do Ignite";
                return `👌 **${achado.nome}** é uma ótima escolha!\n\n` +
                       `📝 ${desc}\n` +
                       `💰 Preço: **R$ ${preco.toFixed(2).replace(".", ",")}**\n\n[MOSTRAR_PRODUTO: ${achado.nome}]`;
            }
        }

         // Resposta padrão amigável (fallback final) — ser mais acionável
         return `Desculpe, não entendi bem. Posso ajudar com exemplos rápidos:\n\n` +
             `• Peça o cardápio: "Ver cardápio" ou "Quais bebidas vocês têm?"\n` +
             `• Pergunte sobre entrega: "Qual a taxa de entrega?"\n` +
             `• Horários: "Que horas vocês abrem?"\n\n` +
             `Também posso mostrar sugestões rápidas se você clicar em um dos chips acima. Quer que eu mostre o cardápio agora?`;
    }

    return { responder };
})();

// ============================================================
// 🃏  PRODUCT CARD — Card único de produto
// ============================================================
/** Normaliza texto (remove acentos e coloca em minúsculas) */
function _normalizeText(str) {
    try {
        return String(str || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9\s]/g, ' ').trim();
    } catch (e) {
        return String(str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    }
}

/** Concatena campos relevantes do produto para busca */
function _productSearchIndex(p) {
    const parts = [];
    parts.push(p.nome || p.name || '');
    parts.push(p.descricao || p.description || '');
    parts.push(p.categoria || p.category || '');
    parts.push(p.tags || p.etiquetas || '');
    parts.push(p.sku || p.codigo || '');
    parts.push(String(p.id || p._id || ''));
    return _normalizeText(parts.join(' '));
}

const ProductCard = {
    /**
     * Busca produto pelo nome (exato → parcial, case-insensitive).
     * @param {string} nome
     * @param {Array}  lista
     * @returns {Object|null}
     */
    buscar(nome, lista) {
        if (!nome || !lista || !Array.isArray(lista) || lista.length === 0) return null;

        // Normalize query and split into tokens
        const q = _normalizeText(nome);
        const tokens = q.split(/\s+/).filter(Boolean);

        // 1) Exact name/id match
        let found = lista.find(p => _normalizeText(p.nome || p.name) === q || String(p.id) === nome || String(p.id) === q);
        if (found) return found;

        // 2) All tokens present in product index (AND match) — stronger match
        found = lista.find(p => {
            const idx = _productSearchIndex(p);
            return tokens.every(t => idx.includes(t));
        });
        if (found) return found;

        // 3) Any token present (OR match) — weaker match
        found = lista.find(p => {
            const idx = _productSearchIndex(p);
            return tokens.some(t => idx.includes(t));
        });
        if (found) return found;

        // 4) Fallback: partial name contains
        found = lista.find(p => _normalizeText(p.nome || p.name).includes(q));

        return found || null;
    },

    /**
     * Cria o elemento DOM do card.
     * @param {Object}  produto
     * @param {boolean} compacto — versão menor para uso dentro do carrossel
     * @returns {HTMLElement}
     */
    criar(produto, compacto = false) {
        const preco = Number(produto.preco || produto.price || 0);
        const nome = produto.nome || produto.name || "Produto";
        const descricao = produto.descricao || produto.description || "";
        const imagem = produto.imagem_url || produto.image_url || produto.foto || "";
        const categoria = produto.categoria || produto.category || "";

        const card = document.createElement("div");
        card.className = compacto ? "produto-card produto-card--compacto" : "produto-card";
        card.setAttribute("role", "article");
        card.setAttribute("aria-label", `Produto: ${nome}`);

                card.innerHTML = `
            <div class="produto-card__info">
                ${imagem
                    ? `<div class="produto-card__imagem-wrap">
                     <img data-src="${imagem}" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 120'><rect width='200' height='120' fill='%23fff7ed'/><ellipse cx='100' cy='30' rx='70' ry='24' fill='%23f4c27d'/><rect x='40' y='44' width='120' height='24' rx='12' fill='%237b3f24'/><path d='M40 56c20-10 40-10 60 0c20-10 40-10 60 0v8H40z' fill='%237fdc6f' opacity='0.9'/><ellipse cx='100' cy='86' rx='70' ry='18' fill='%23e6a969'/><text x='100' y='70' font-size='14' text-anchor='middle' fill='%23ffffff' opacity='0.6'>Ignite</text></svg>" alt="${nome}" class="produto-card__imagem" loading="lazy" onerror="this.closest('.produto-card__imagem-wrap').style.display='none'">
                     </div>`
                    : `<div class="produto-card__imagem-placeholder" aria-hidden="true"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 120' width='100%' height='100%'><rect width='200' height='120' fill='#fff7ed'/><ellipse cx='100' cy='30' rx='70' ry='24' fill='#f4c27d'/><rect x='40' y='44' width='120' height='24' rx='12' fill='#7b3f24'/><path d='M40 56c20-10 40-10 60 0c20-10 40-10 60 0v8H40z' fill='#7fdc6f' opacity='0.9'/><ellipse cx='100' cy='86' rx='70' ry='18' fill='#e6a969'/></svg></div>`}
                ${categoria ? `<span class="produto-card__badge">${categoria}</span>` : ""}
                <h4 class="produto-card__nome">${nome}</h4>
                ${descricao && !compacto ? `<p class="produto-card__descricao">${descricao}</p>` : ""}
                <div class="produto-card__rodape">
                    <span class="produto-card__preco">R$ ${preco.toFixed(2).replace(".", ",")}</span>
                    <button class="produto-card__btn-add"
                                    data-produto-id="${produto.id || ""}"
                                    data-produto-nome="${nome}"
                                    aria-label="Adicionar ${nome} ao carrinho">
                        + Adicionar
                    </button>
                </div>
            </div>
        `;

        // Integração com o carrinho global do site
        card.querySelector(".produto-card__btn-add").addEventListener("click", function () {
            if (typeof window.adicionarAoCarrinho === "function") {
                window.adicionarAoCarrinho(produto);
            } else {
                window.dispatchEvent(new CustomEvent("ignite:add-to-cart", { detail: produto }));
            }
            this.textContent = "✓ Adicionado!";
            this.disabled = true;
            setTimeout(() => { this.textContent = "+ Adicionar"; this.disabled = false; }, 2200);
        });

        // Lazy-load: observar a imagem criada (se houver)
        const imgEl = card.querySelector('.produto-card__imagem[data-src]');
        if (imgEl) {
            if (window.observeChatLazyImage) {
                try { window.observeChatLazyImage(imgEl); } catch (e) { imgEl.src = imgEl.dataset.src; }
            } else if ('IntersectionObserver' in window && window.__chatLazyObserver) {
                try { window.__chatLazyObserver.observe(imgEl); } catch (e) { imgEl.src = imgEl.dataset.src; }
            } else {
                // Fallback imediato
                imgEl.src = imgEl.dataset.src;
            }
        }

        return card;
    },
};

// ============================================================
// 🎠  PRODUCT CAROUSEL — Carrossel horizontal de produtos
// ============================================================
const ProductCarousel = {
    /**
     * Cria o wrapper do carrossel com faixa rolável e setas de navegação.
     * @param {Array<Object>} produtos — máx 5 itens
     * @returns {HTMLElement}
     */
    criar(produtos) {
        const wrapper = document.createElement("div");
        wrapper.className = "produto-carrossel";
        wrapper.setAttribute("role", "region");
        wrapper.setAttribute("aria-label", "Produtos recomendados");

        const faixa = document.createElement("div");
        faixa.className = "produto-carrossel__faixa";

        produtos.forEach(p => faixa.appendChild(ProductCard.criar(p, true)));

        const btnPrev = _criarSeta("prev", "Produto anterior", () => _navegar(faixa, -1));
        const btnNext = _criarSeta("next", "Próximo produto", () => _navegar(faixa, 1));

        wrapper.appendChild(btnPrev);
        wrapper.appendChild(faixa);
        wrapper.appendChild(btnNext);

        // Atualiza visibilidade das setas conforme posição do scroll
        const atualizar = () => _atualizarSetas(faixa, btnPrev, btnNext);
        requestAnimationFrame(atualizar);
        faixa.addEventListener("scroll", atualizar, { passive: true });

        return wrapper;
    },

    /**
     * Busca múltiplos produtos por nomes separados por "|".
     * @param {string} nomesStr — "Produto A | Produto B | Produto C"
     * @param {Array}  lista
     * @returns {Array<Object>}
     */
    buscarMultiplos(nomesStr, lista) {
        return nomesStr
            .split("|")
            .map(n => ProductCard.buscar(n.trim(), lista))
            .filter(Boolean)
            .slice(0, 5);
    },
};

/** Cria botão de seta do carrossel. */
function _criarSeta(dir, label, onClick) {
    const btn = document.createElement("button");
    btn.className = `produto-carrossel__seta produto-carrossel__seta--${dir}`;
    btn.setAttribute("aria-label", label);
    btn.textContent = dir === "prev" ? "‹" : "›";
    btn.addEventListener("click", onClick);
    return btn;
}

/** Rola a faixa um card para a direção indicada. */
function _navegar(faixa, direcao) {
    const card = faixa.querySelector(".produto-card");
    const delta = card ? card.offsetWidth + 12 : 200; // 12px = gap entre cards
    faixa.scrollBy({ left: direcao * delta, behavior: "smooth" });
}

/** Mostra/oculta setas conforme posição do scroll na faixa. */
function _atualizarSetas(faixa, prev, next) {
    const semOverflow = faixa.scrollWidth <= faixa.clientWidth;
    if (semOverflow) { prev.style.display = next.style.display = "none"; return; }
    prev.style.display = faixa.scrollLeft <= 0 ? "none" : "flex";
    next.style.display = faixa.scrollLeft + faixa.clientWidth >= faixa.scrollWidth - 1 ? "none" : "flex";
}

// ============================================================
// 🖥️  UI MANAGER — Renderização completa do chat
// ============================================================
const UIManager = (() => {
    let container = null;
    let chipsEl = null;
    let ultimaPerg = ""; // rastreia última pergunta para vincular ao feedback

    // Flag: se usuário rolou para cima, não interrompe com auto-scroll
    let _usuarioRolou = false;

    /** Define o container de mensagens e detecta scroll manual do usuário. */
    function setContainer(el) {
        container = el;
        el.addEventListener("scroll", () => {
            _usuarioRolou = el.scrollTop + el.clientHeight < el.scrollHeight - 40;
        }, { passive: true });
    }

    /** Define o container dos chips. */
    function setChipsContainer(el) { chipsEl = el; }

    // ─── Scroll inteligente ────────────────────────────────────
    function scrollParaBaixo(forcar = false) {
        if (!container || (_usuarioRolou && !forcar)) return;
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }

    // ─── Chips de sugestão rápida ─────────────────────────────
    /**
     * Renderiza os chips e conecta o callback de envio.
     * @param {Function} onChipClick — recebe o texto da sugestão
     */
    function renderizarChips(onChipClick) {
        if (!chipsEl) return;
        CHAT_CONFIG.chips.forEach(chip => {
            const btn = document.createElement("button");
            btn.className = "chat-chip";
            btn.textContent = chip.label;
            btn.setAttribute("aria-label", `Perguntar: ${chip.texto}`);
            btn.addEventListener("click", () => {
                _esconderChips();
                onChipClick(chip.texto);
            });
            chipsEl.appendChild(btn);
        });
    }

    /** Esconde os chips com animação após a primeira interação. */
    function _esconderChips() {
        if (!chipsEl) return;
        chipsEl.classList.add("chat-chips--saindo");
        setTimeout(() => { chipsEl.style.display = "none"; }, 350);
    }

    // ─── Criação do wrapper de mensagem ───────────────────────
    function _criarWrapper(remetente) {
        const hora = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const div = document.createElement("div");
        div.setAttribute("role", "listitem");

        if (remetente === "user") {
            div.className = "chat-msg chat-msg--user";
            div.setAttribute("aria-label", "Você");
            div.innerHTML = `
        <div class="chat-msg__balao chat-msg__balao--user">
          <div class="chat-msg__conteudo"></div>
          <time class="chat-msg__hora">${hora}</time>
        </div>`;
        } else {
            // Gera ID único para associar feedback à mensagem correta
            const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            div.className = "chat-msg chat-msg--bot";
            div.dataset.id = msgId;
            div.setAttribute("aria-label", CHAT_CONFIG.bot.nome);
            div.innerHTML = `
        <div class="chat-msg__avatar" aria-hidden="true">${CHAT_CONFIG.bot.avatar}</div>
        <div class="chat-msg__balao chat-msg__balao--bot">
          <div class="chat-msg__conteudo"></div>
          <div class="chat-msg__rodape">
            <time class="chat-msg__hora">${hora}</time>
            <div class="chat-avaliacao" data-msg-id="${msgId}" aria-label="Avaliar esta resposta">
              <button class="chat-avaliacao__btn chat-avaliacao__btn--up"   aria-label="Resposta útil">👍</button>
              <button class="chat-avaliacao__btn chat-avaliacao__btn--down" aria-label="Resposta ruim">👎</button>
            </div>
          </div>
        </div>`;

            // Registra feedback ao clicar e transforma o widget em confirmação visual
            div.querySelectorAll(".chat-avaliacao__btn").forEach(btn => {
                btn.addEventListener("click", function () {
                    const voto = this.classList.contains("chat-avaliacao__btn--up") ? "up" : "down";
                    const avalEl = this.closest(".chat-avaliacao");
                    FeedbackStore.registrar(msgId, voto, ultimaPerg);
                    avalEl.innerHTML = `<span class="chat-avaliacao__obrigado">${voto === "up" ? "👍 Ótimo!" : "👎 Vou melhorar!"}</span>`;
                });
            });
        }

        return div;
    }

    // ─── Parser de Markdown básico ────────────────────────────
    function _md(texto) {
        return texto
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br>");
    }

    // ─── Extrator de diretivas especiais ──────────────────────
    /**
     * Extrai [MOSTRAR_PRODUTO] e [CARROSSEL_PRODUTOS] do texto da IA.
     * Remove as diretivas do texto exibido ao usuário.
     */
    function _extrairDiretivas(texto) {
        const reProd = /\[MOSTRAR_PRODUTO:\s*([^\]]+)\]/i;
        const reCar = /\[CARROSSEL_PRODUTOS:\s*([^\]]+)\]/i;
        const mP = texto.match(reProd);
        const mC = texto.match(reCar);
        return {
            textoLimpo: texto.replace(reProd, "").replace(reCar, "").trim(),
            nomeProduto: mP ? mP[1].trim() : null,
            nomesCarrossel: mC ? mC[1].trim() : null,
        };
    }

    // ─── Mensagem instantânea ─────────────────────────────────
    /**
     * Adiciona mensagem ao chat sem efeito de digitação.
     * Usado para mensagens do usuário, erros e restauração de histórico.
     */
    function adicionarMensagem(remetente, texto) {
        if (!container) return;
        if (remetente === "user") ultimaPerg = texto;
        const msg = _criarWrapper(remetente);
        msg.querySelector(".chat-msg__conteudo").innerHTML = _md(texto);
        container.appendChild(msg);
        scrollParaBaixo(true);
    }

    // ─── Mensagem com efeito de digitação ─────────────────────
    /**
     * Exibe a resposta do bot palavra a palavra.
     * Após digitar, renderiza card único ou carrossel se a IA inseriu diretiva.
     *
     * @param {string} texto    — resposta bruta (pode conter diretivas)
     * @param {Array}  produtos — lista para buscar produtos
     */
    async function adicionarMensagemComEfeito(texto, produtos = []) {
        if (!container) return;

        const msg = _criarWrapper("bot");
        const conteudo = msg.querySelector(".chat-msg__conteudo");
        container.appendChild(msg);
        scrollParaBaixo(true);

        const { textoLimpo, nomeProduto, nomesCarrossel } = _extrairDiretivas(texto);

        // Digita linha a linha, palavra a palavra
        for (const linha of textoLimpo.split("\n")) {
            if (!linha.trim()) {
                conteudo.appendChild(document.createElement("br"));
                continue;
            }
            const p = document.createElement("p");
            p.className = "mb-1";
            conteudo.appendChild(p);
            for (const palavra of linha.split(" ")) {
                p.innerHTML += palavra + " ";
                scrollParaBaixo();
                await _esperar(CHAT_CONFIG.ui.velocidadeDigitacao);
            }
        }
        conteudo.querySelector("p:last-child")?.classList.replace("mb-1", "mb-0");

        // Carrossel tem prioridade sobre produto único
        if (nomesCarrossel) {
            const lista = ProductCarousel.buscarMultiplos(nomesCarrossel, produtos);
            if (lista.length > 0) {
                const el = ProductCarousel.criar(lista);
                el.classList.add("chat-produto-carrossel");
                container.appendChild(el);
                scrollParaBaixo(true);
            }
        } else if (nomeProduto) {
            const produto = ProductCard.buscar(nomeProduto, produtos);
            if (produto) {
                const el = ProductCard.criar(produto);
                el.classList.add("chat-produto-card");
                container.appendChild(el);
                scrollParaBaixo(true);
            }
        }
    }

    // ─── Indicador "digitando..." ─────────────────────────────
    function mostrarDigitando() {
        if (!container) return "";
        const id = `typing-${Date.now()}`;
        const div = document.createElement("div");
        div.id = id;
        div.className = "chat-digitando";
        div.setAttribute("role", "status");
        div.setAttribute("aria-label", "Assistente digitando");
        div.innerHTML = `
      <div class="chat-msg__avatar" aria-hidden="true">${CHAT_CONFIG.bot.avatar}</div>
      <div class="chat-digitando__bolinhas"><span></span><span></span><span></span></div>`;
        container.appendChild(div);
        scrollParaBaixo(true);
        return id;
    }

    function removerDigitando(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.transition = "opacity .2s, transform .2s";
        el.style.opacity = "0";
        el.style.transform = "scale(0.95)";
        setTimeout(() => el.remove(), 220);
    }

    // ─── Helper ───────────────────────────────────────────────
    function _esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

    // API pública
    return {
        setContainer, setChipsContainer,
        renderizarChips,
        adicionarMensagem, adicionarMensagemComEfeito,
        mostrarDigitando, removerDigitando,
    };
})();

// ============================================================
// 🗄️  SUPABASE SERVICE — Carrega e normaliza produtos
// ============================================================
const SupabaseService = (() => {

    async function carregarProdutos() {
        // Fonte 1: window.products já populado pelo script.js principal
        const globais = window.products || window.produtos || window.$produtos;
        if (Array.isArray(globais) && globais.length > 0) {
            const norm = _normalizar(globais);
            console.log(`✅ ChatBot: ${norm.length} produtos reutilizados de window.products.`);
            return norm;
        }

        // Fonte 2: query direta na tabela 'products' (nome inglês confirmado pelo erro anterior)
        try {
            if (!window.supabaseManager?.isConnected()) await _aguardarConexao();
            const { data, error } = await window.supabaseManager.client
                .from("products")
                .select("*")
                .eq("available", true);
            if (error) throw error;
            if (!data?.length) { console.warn("⚠️ Tabela 'products' vazia."); return []; }
            const norm = _normalizar(data);
            window.products = norm; // expõe globalmente
            console.log(`✅ ChatBot: ${norm.length} produtos carregados do Supabase.`);
            return norm;
        } catch (e) {
            console.error("❌ SupabaseService.carregarProdutos:", e.message);
            return [];
        }
    }

    /** Normaliza campos para garantir acesso consistente (pt-br e en). */
    function _normalizar(lista) {
        return lista.map(p => ({
            ...p,
            nome: p.nome || p.name || "Produto",
            preco: p.preco || p.price || 0,
            categoria: p.categoria || p.category || "",
            descricao: p.descricao || p.description || "",
            imagem_url: p.imagem_url || p.image_url || p.foto || "",
            disponivel: p.disponivel !== false && p.available !== false,
        }));
    }

    /** Aguarda o SupabaseManager conectar (máx 5 s). */
    function _aguardarConexao(tentativas = 0) {
        return new Promise((resolve, reject) => {
            const t = setInterval(() => {
                tentativas++;
                if (window.supabaseManager?.isConnected()) { clearInterval(t); resolve(); }
                else if (tentativas > 50) { clearInterval(t); reject(new Error("Timeout aguardando Supabase")); }
            }, 100);
        });
    }

    return { carregarProdutos };
})();

// ============================================================
// 🧠  CHATBOT — Orquestrador principal
// ============================================================
const ChatBot = (() => {
    const estado = {
        produtos: [],    // cache local de produtos normalizados
        historico: [],    // [{role, content}] — espelho em memória do localStorage
        ocupado: false,
    };

    async function init() {
        // ── Elementos DOM ─────────────────────────────────────────
        const inputEl = document.getElementById("chat-input");
        const btnEnviarEl = document.getElementById("chat-send-btn");
        const mensagensEl = document.getElementById("chat-messages");
        const chipsEl = document.getElementById("chat-chips"); // opcional

        if (!inputEl || !btnEnviarEl || !mensagensEl) {
            console.warn("⚠️ ChatBot: elementos DOM ausentes. IDs necessários: chat-input, chat-send-btn, chat-messages.");
            return;
        }

        // ── Configura UI ──────────────────────────────────────────
        UIManager.setContainer(mensagensEl);
        mensagensEl.setAttribute("role", "list");
        mensagensEl.setAttribute("aria-label", "Conversa com o assistente Ignite");

        if (chipsEl) {
            UIManager.setChipsContainer(chipsEl);
            // Os chips disparam _processar diretamente, simulando o usuário digitar
            UIManager.renderizarChips(texto => _processar(texto, inputEl));
        }

        // ── Restaura histórico do localStorage ───────────────────
        const historicoSalvo = HistoryStore.carregar();
        if (historicoSalvo.length > 0) {
            estado.historico = historicoSalvo;
            historicoSalvo.forEach(h =>
                UIManager.adicionarMensagem(h.role === "user" ? "user" : "bot", h.content)
            );
            console.log(`📂 Histórico restaurado: ${historicoSalvo.length} mensagens.`);
        } else {
            UIManager.adicionarMensagem("bot", CHAT_CONFIG.bot.mensagemInicial);
        }

        // ── Carrega produtos em background ────────────────────────
        // Aguarda 1.5s para que o script.js popule window.products antes de checar
        setTimeout(async () => {
            estado.produtos = await SupabaseService.carregarProdutos();
        }, 1500);

        // ── Event listeners ───────────────────────────────────────
        inputEl.addEventListener("input", () => _autoExpand(inputEl));
        btnEnviarEl.addEventListener("click", () => _enviar(inputEl));
        inputEl.addEventListener("keydown", e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); _enviar(inputEl); }
        });
    }

    /** Lê o input, limpa o campo e delega ao _processar. */
    function _enviar(inputEl) {
        const texto = inputEl.value.trim();
        if (!texto || estado.ocupado) return;
        inputEl.value = "";
        inputEl.style.height = "auto";
        _processar(texto, inputEl);
    }

    /**
     * Fluxo principal: exibe mensagem → pensa → responde → salva histórico.
     * @param {string}     texto
     * @param {HTMLElement} inputEl
     */
    async function _processar(texto, inputEl) {
        if (estado.ocupado) return;

        estado.ocupado = true;
        inputEl.disabled = true;

        // 1️⃣  Exibe mensagem do usuário
        UIManager.adicionarMensagem("user", texto);
        estado.historico.push({ role: "user", content: texto });

        // 2️⃣  Indicador de digitando
        const digitandoId = UIManager.mostrarDigitando();

        try {
            await _esperar(CHAT_CONFIG.ui.delayPensamento);

            // Produtos: estado local → fallback para window.products
            const produtosCtx = estado.produtos.length
                ? estado.produtos
                : (window.products || window.produtos || []);

            // 3️⃣  Chama IA
            const resposta = await AIProvider.responder(
                texto,
                estado.historico.slice(-10), // últimas 10 mensagens para contexto
                produtosCtx
            );

            // 4️⃣  Exibe resposta com efeito de digitação + cards
            UIManager.removerDigitando(digitandoId);
            await UIManager.adicionarMensagemComEfeito(resposta, produtosCtx);

            // 5️⃣  Persiste no histórico (memória + localStorage)
            estado.historico.push({ role: "assistant", content: resposta });
            HistoryStore.salvar(estado.historico);

        } catch (erro) {
            console.error("❌ ChatBot._processar:", erro);
            UIManager.removerDigitando(digitandoId);
            UIManager.adicionarMensagem("bot", "Ops! Tive um probleminha técnico. Pode tentar novamente? 🙏");
        } finally {
            estado.ocupado = false;
            inputEl.disabled = false;
            inputEl.focus();
        }
    }

    /** Auto-expande o textarea conforme o conteúdo digitado. */
    function _autoExpand(el) {
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 120) + "px";
        el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
    }

    function _esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ── Utilitários de debug (acessíveis no console do browser) ─
    // window.chatLimpar()   → apaga o histórico e reinicia o chat
    // window.chatFeedback() → exibe tabela de feedbacks no console
    window.chatLimpar = () => {
        HistoryStore.limpar();
        estado.historico = [];
        const el = document.getElementById("chat-messages");
        if (el) el.innerHTML = "";
        UIManager.adicionarMensagem("bot", CHAT_CONFIG.bot.mensagemInicial);
        console.info("🗑️ Histórico do chat apagado.");
    };

    return { init };
})();

// ============================================================
// 🚀  BOOTSTRAP — Inicializa após o DOM estar pronto
// ============================================================
// Expor módulos importantes no `window` para compatibilidade com outros scripts/tests
window.ChatBot = window.ChatBot || ChatBot;
window.AIProvider = window.AIProvider || AIProvider;
window.UIManager = window.UIManager || UIManager;
window.ProductCard = window.ProductCard || ProductCard;
window.ProductCarousel = window.ProductCarousel || ProductCarousel;
window.HistoryStore = window.HistoryStore || HistoryStore;
window.FeedbackStore = window.FeedbackStore || FeedbackStore;
window.SupabaseService = window.SupabaseService || SupabaseService;

document.addEventListener("DOMContentLoaded", () => ChatBot.init());
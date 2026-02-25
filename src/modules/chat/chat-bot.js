/**
 * @file chat-bot.js
 * @description Atendente Inteligente Ignite — Integração Supabase + IA (Gemini / DeepSeek)
 * @author Ignite Dev Team
 * @version 2.0.0
 *
 * Arquitetura:
 *  ┌─────────────────────────────────────────┐
 *  │            ChatBot (orquestrador)        │
 *  │  ┌──────────────┐  ┌──────────────────┐ │
 *  │  │  UIManager   │  │  AIProvider      │ │
 *  │  │  (Renderiza) │  │  (Gemini/Deep.)  │ │
 *  │  └──────────────┘  └──────────────────┘ │
 *  │  ┌──────────────┐  ┌──────────────────┐ │
 *  │  │ ProductCard  │  │ SupabaseService  │ │
 *  │  │  (UI Prod.)  │  │  (Dados)         │ │
 *  │  └──────────────┘  └──────────────────┘ │
 *  └─────────────────────────────────────────┘
 */

// ============================================================
// ⚙️  CONFIGURAÇÃO CENTRALIZADA
// ============================================================
const CHAT_CONFIG = {
    bot: {
        nome: "Ignite Assistente",
        avatar: "🔥",
        mensagemInicial: "Olá! Sou o assistente do **Ignite** 🔥\nPosso te mostrar o cardápio, informar preços e tirar dúvidas sobre entrega. Como posso ajudar?",
    },

    restaurante: {
        unidades: [
            { cidade: "Manaus", endereco: "Vieiralves, 04" },
            { cidade: "Itajaí", endereco: "R. Fridolim Herthal Júnior, 97" },
        ],
        horario: "Todos os dias das 09:00 às 22:00",
        entrega: { base: 5.00, porKm: 1.50 },
    },

    // -------------------------------------------------------
    // 🔑 Chaves de API — substitua pelos valores reais
    // Para produção considere usar variáveis de ambiente ou
    // um backend proxy para não expor as chaves no frontend.
    // -------------------------------------------------------
    ai: {
        // Google Gemini (modelo gratuito): gemini-1.5-flash
        gemini: {
            enabled: true,
            apiKey: "SUA_CHAVE_GEMINI_AQUI",           // 🔑 Google AI Studio → makersuite.google.com
            model: "gemini-1.5-flash",
            endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
        },
        // DeepSeek (modelo gratuito): deepseek-chat
        deepseek: {
            enabled: false,
            apiKey: "SUA_CHAVE_DEEPSEEK_AQUI",          // 🔑 platform.deepseek.com
            model: "deepseek-chat",
            endpoint: "https://api.deepseek.com/v1/chat/completions",
        },
        // Qual provedor usar primeiro ("gemini" | "deepseek")
        provedor: "gemini",
    },

    ui: {
        // Velocidade do efeito de digitação em ms por palavra
        velocidadeDigitacao: 28,
        // Delay simulando "pensamento" do bot em ms
        delayPensamento: 700,
    },
};

// ============================================================
// 🤖  SERVIÇO DE IA — Gemini + DeepSeek com fallback
// ============================================================
const AIProvider = (() => {
    /**
     * Monta o system prompt com contexto dinâmico do restaurante e produtos.
     * @param {Array} produtos - Lista de produtos carregados do Supabase
     * @returns {string}
     */
    function _buildSystemPrompt(produtos) {
        const { restaurante } = CHAT_CONFIG;
        const unidadesTxt = restaurante.unidades
            .map(u => `${u.cidade}: ${u.endereco}`)
            .join(" | ");

        // Serializa os produtos em formato compacto para o contexto da IA
        const produtosTxt = produtos.length
            ? produtos
                .slice(0, 40) // Limita para não exceder contexto
                .map(p => `- ${p.nome || p.name} (${p.categoria || p.category}) — R$ ${Number(p.preco || p.price).toFixed(2)}`)
                .join("\n")
            : "Cardápio temporariamente indisponível.";

        return `Você é o assistente virtual do restaurante Ignite, especializado em hambúrgueres artesanais.
Responda SEMPRE em português brasileiro, de forma amigável, objetiva e com emojis leves.
Use **negrito** para destacar nomes de produtos e preços.
Nunca invente informações; se não souber, diga que vai verificar.

=== DADOS DO RESTAURANTE ===
Unidades: ${unidadesTxt}
Horário: ${restaurante.horario}
Taxa de entrega: R$ ${restaurante.entrega.base.toFixed(2)} + R$ ${restaurante.entrega.porKm.toFixed(2)}/km

=== CARDÁPIO ATUAL ===
${produtosTxt}

=== REGRAS ===
- Ao recomendar produtos, mencione o nome e preço.
- Se o usuário pedir ver um produto, inclua no final da resposta uma linha especial:
  [MOSTRAR_PRODUTO: nome exato do produto]
- Máximo 3 parágrafos por resposta.
- Não faça perguntas desnecessárias; resolva direto.`;
    }

    /**
     * Chama a API do Google Gemini.
     * @param {string} mensagem
     * @param {Array}  historico - [{role, content}]
     * @param {Array}  produtos
     * @returns {Promise<string>}
     */
    async function _chamarGemini(mensagem, historico, produtos) {
        const { gemini } = CHAT_CONFIG.ai;
        const systemPrompt = _buildSystemPrompt(produtos);

        // Gemini usa "contents" com roles "user" e "model"
        const contents = [
            // Injeta o system prompt como primeira mensagem do usuário
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: "Entendido! Estou pronto para atender. 🔥" }] },
            // Histórico da conversa
            ...historico.map(h => ({
                role: h.role === "assistant" ? "model" : "user",
                parts: [{ text: h.content }],
            })),
            // Mensagem atual
            { role: "user", parts: [{ text: mensagem }] },
        ];

        const url = `${gemini.endpoint}/${gemini.model}:generateContent?key=${gemini.apiKey}`;
        const resposta = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents,
                generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
            }),
        });

        if (!resposta.ok) throw new Error(`Gemini HTTP ${resposta.status}`);
        const json = await resposta.json();
        return json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    /**
     * Chama a API do DeepSeek (compatível OpenAI).
     * @param {string} mensagem
     * @param {Array}  historico
     * @param {Array}  produtos
     * @returns {Promise<string>}
     */
    async function _chamarDeepSeek(mensagem, historico, produtos) {
        const { deepseek } = CHAT_CONFIG.ai;

        const messages = [
            { role: "system", content: _buildSystemPrompt(produtos) },
            ...historico,
            { role: "user", content: mensagem },
        ];

        const resposta = await fetch(deepseek.endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${deepseek.apiKey}`,
            },
            body: JSON.stringify({
                model: deepseek.model,
                messages,
                max_tokens: 512,
                temperature: 0.7,
            }),
        });

        if (!resposta.ok) throw new Error(`DeepSeek HTTP ${resposta.status}`);
        const json = await resposta.json();
        return json.choices?.[0]?.message?.content || "";
    }

    /**
     * Ponto de entrada público — chama o provedor configurado com fallback.
     * @param {string} mensagem
     * @param {Array}  historico
     * @param {Array}  produtos
     * @returns {Promise<string>}
     */
    async function responder(mensagem, historico, produtos) {
        const { provedor, gemini, deepseek } = CHAT_CONFIG.ai;

        // Guard: evita chamadas com chave placeholder — vai direto ao fallback local
        const geminiPronto = gemini.enabled && gemini.apiKey && !gemini.apiKey.includes("SUA_CHAVE");
        const deepseekPronto = deepseek.enabled && deepseek.apiKey && !deepseek.apiKey.includes("SUA_CHAVE");

        if (!geminiPronto && !deepseekPronto) {
            console.warn("⚠️ Nenhuma chave de API configurada — usando respostas locais.");
            return _respostaLocalFallback(mensagem, produtos);
        }

        try {
            if (provedor === "gemini" && geminiPronto) {
                return await _chamarGemini(mensagem, historico, produtos);
            }
            if (provedor === "deepseek" && deepseekPronto) {
                return await _chamarDeepSeek(mensagem, historico, produtos);
            }
            throw new Error("Provedor principal não disponível.");
        } catch (erro) {
            console.warn(`⚠️ Provedor '${provedor}' falhou:`, erro.message);

            // Fallback automático para o outro provedor
            try {
                if (provedor === "gemini" && deepseekPronto) {
                    console.info("🔄 Usando DeepSeek como fallback...");
                    return await _chamarDeepSeek(mensagem, historico, produtos);
                }
                if (provedor === "deepseek" && geminiPronto) {
                    console.info("🔄 Usando Gemini como fallback...");
                    return await _chamarGemini(mensagem, historico, produtos);
                }
            } catch (erroFallback) {
                console.error("❌ Fallback também falhou:", erroFallback.message);
            }

            // Fallback local quando ambas as APIs falham
            return _respostaLocalFallback(mensagem, produtos);
        }
    }

    /**
     * Respostas locais de emergência (sem API).
     * @param {string} q
     * @param {Array}  produtos
     * @returns {string}
     */
    function _respostaLocalFallback(q, produtos) {
        const texto = q.toLowerCase();
        const { restaurante } = CHAT_CONFIG;

        if (/endere[çc]o|onde fica|localiza[çc]/.test(texto)) {
            return restaurante.unidades
                .map(u => `📍 **${u.cidade}:** ${u.endereco}`)
                .join("\n");
        }
        if (/hor[áa]rio|abre|fecha/.test(texto)) {
            return `⏰ Estamos abertos **${restaurante.horario}**.`;
        }
        if (/entrega|taxa|frete/.test(texto)) {
            return `🛵 Taxa de entrega: **R$ ${restaurante.entrega.base.toFixed(2)}** + **R$ ${restaurante.entrega.porKm.toFixed(2)}/km**.`;
        }
        if (/card[áa]pio|produtos|opç[õo]es/.test(texto) && produtos.length) {
            const categorias = [...new Set(produtos.map(p => p.categoria || p.category))];
            return `🍔 Temos **${categorias.join(", ")}**. Qual categoria você prefere?`;
        }

        const produtoAchado = produtos.find(p =>
            texto.includes((p.nome || p.name || "").toLowerCase())
        );
        if (produtoAchado) {
            const preco = Number(produtoAchado.preco || produtoAchado.price);
            return `😍 **${produtoAchado.nome || produtoAchado.name}** por **R$ ${preco.toFixed(2)}**!`;
        }

        return "Eita, estou com dificuldade técnica agora. Pode perguntar sobre cardápio, endereço ou horários!";
    }

    // API pública do módulo
    return { responder };
})();

// ============================================================
// 🃏  CARD DE PRODUTO — Renderiza produto no chat
// ============================================================
const ProductCard = {
    /**
     * Busca produto pelo nome (case-insensitive) na lista global.
     * @param {string} nomeProduto
     * @param {Array}  produtos
     * @returns {Object|null}
     */
    buscar(nomeProduto, produtos) {
        const busca = nomeProduto.toLowerCase().trim();
        return (
            produtos.find(p => (p.nome || p.name || "").toLowerCase() === busca) ||
            produtos.find(p => (p.nome || p.name || "").toLowerCase().includes(busca)) ||
            null
        );
    },

    /**
     * Cria elemento DOM do card do produto.
     * @param {Object} produto
     * @returns {HTMLElement}
     */
    criar(produto) {
        const preco = Number(produto.preco || produto.price || 0);
        const nome = produto.nome || produto.name || "Produto";
        const descricao = produto.descricao || produto.description || "";
        const imagem = produto.imagem_url || produto.image_url || produto.foto || "";
        const categoria = produto.categoria || produto.category || "";

        const card = document.createElement("div");
        card.className = "produto-card";
        card.setAttribute("role", "article");
        card.setAttribute("aria-label", `Produto: ${nome}`);

        card.innerHTML = `
      <div class="produto-card__inner">
        ${imagem
                ? `<div class="produto-card__imagem-wrap">
               <img src="${imagem}" alt="${nome}" class="produto-card__imagem" loading="lazy"
                    onerror="this.parentElement.style.display='none'">
             </div>`
                : `<div class="produto-card__imagem-placeholder" aria-hidden="true">🍔</div>`
            }
        <div class="produto-card__info">
          ${categoria ? `<span class="produto-card__badge">${categoria}</span>` : ""}
          <h4 class="produto-card__nome">${nome}</h4>
          ${descricao ? `<p class="produto-card__descricao">${descricao}</p>` : ""}
          <div class="produto-card__rodape">
            <span class="produto-card__preco">R$ ${preco.toFixed(2).replace(".", ",")}</span>
            <button class="produto-card__btn-add" data-produto-id="${produto.id || ""}" data-produto-nome="${nome}">
              + Adicionar
            </button>
          </div>
        </div>
      </div>
    `;

        // Evento de adicionar ao carrinho — integra com a lógica global do site
        const btnAdd = card.querySelector(".produto-card__btn-add");
        btnAdd.addEventListener("click", () => {
            if (typeof window.adicionarAoCarrinho === "function") {
                window.adicionarAoCarrinho(produto);
                btnAdd.textContent = "✓ Adicionado!";
                btnAdd.disabled = true;
                setTimeout(() => {
                    btnAdd.textContent = "+ Adicionar";
                    btnAdd.disabled = false;
                }, 2000);
            } else {
                // Caso a função global não exista, dispara evento customizado
                window.dispatchEvent(new CustomEvent("ignite:add-to-cart", { detail: produto }));
                btnAdd.textContent = "✓ Adicionado!";
                btnAdd.disabled = true;
                setTimeout(() => {
                    btnAdd.textContent = "+ Adicionar";
                    btnAdd.disabled = false;
                }, 2000);
            }
        });

        return card;
    },
};

// ============================================================
// 🖥️  GERENCIADOR DE UI — Responsável apenas por renderização
// ============================================================
const UIManager = (() => {
    let container = null;

    /** Referência ao container de mensagens */
    function setContainer(el) { container = el; }

    /**
     * Rola suavemente ao final do chat.
     */
    function scrollParaBaixo() {
        if (!container) return;
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }

    /**
     * Cria e retorna o wrapper base de uma mensagem.
     * @param {"user"|"bot"} remetente
     * @returns {HTMLElement}
     */
    function _criarWrapperMensagem(remetente) {
        const hora = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const div = document.createElement("div");

        div.setAttribute("role", "listitem");
        div.setAttribute("aria-label", remetente === "user" ? "Você" : CHAT_CONFIG.bot.nome);

        if (remetente === "user") {
            div.className = "chat-msg chat-msg--user";
            div.innerHTML = `
        <div class="chat-msg__balao chat-msg__balao--user">
          <div class="chat-msg__conteudo"></div>
          <time class="chat-msg__hora">${hora}</time>
        </div>
      `;
        } else {
            div.className = "chat-msg chat-msg--bot";
            div.innerHTML = `
        <div class="chat-msg__avatar" aria-hidden="true">${CHAT_CONFIG.bot.avatar}</div>
        <div class="chat-msg__balao chat-msg__balao--bot">
          <div class="chat-msg__conteudo"></div>
          <time class="chat-msg__hora">${hora}</time>
        </div>
      `;
        }

        return div;
    }

    /**
     * Parseia Markdown básico (**negrito**, \n → <br>).
     * @param {string} texto
     * @returns {string} HTML sanitizado básico
     */
    function _parseMarkdown(texto) {
        return texto
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\n/g, "<br>");
    }

    /**
     * Exibe mensagem instantaneamente (sem efeito).
     * @param {"user"|"bot"} remetente
     * @param {string}       texto
     */
    function adicionarMensagem(remetente, texto) {
        if (!container) return;
        const msg = _criarWrapperMensagem(remetente);
        msg.querySelector(".chat-msg__conteudo").innerHTML = _parseMarkdown(texto);
        container.appendChild(msg);
        scrollParaBaixo();
    }

    /**
     * Exibe mensagem do bot com efeito de digitação palavra a palavra.
     * @param {string} texto
     * @returns {Promise<void>}
     */
    async function adicionarMensagemComEfeito(texto) {
        if (!container) return;

        const msg = _criarWrapperMensagem("bot");
        const conteudo = msg.querySelector(".chat-msg__conteudo");
        container.appendChild(msg);
        scrollParaBaixo();

        // Separa o texto da diretiva especial [MOSTRAR_PRODUTO: ...]
        const { textoLimpo, nomeProduto } = _extrairDiretivaProduto(texto);
        const linhas = textoLimpo.split("\n");

        for (let i = 0; i < linhas.length; i++) {
            const linha = linhas[i];
            if (!linha.trim()) {
                conteudo.appendChild(document.createElement("br"));
                continue;
            }

            const p = document.createElement("p");
            p.className = i < linhas.length - 1 ? "mb-1" : "mb-0";
            conteudo.appendChild(p);

            // Digita palavra por palavra
            const palavras = linha.split(" ");
            for (const palavra of palavras) {
                p.innerHTML += palavra + " ";
                scrollParaBaixo();
                await _esperar(CHAT_CONFIG.ui.velocidadeDigitacao);
            }
        }

        // Se a IA pediu para mostrar um produto, renderiza o card abaixo
        if (nomeProduto) {
            const produtos = _getProdutosGlobais();
            const produto = ProductCard.buscar(nomeProduto, produtos);
            if (produto) {
                const cardEl = ProductCard.criar(produto);
                cardEl.classList.add("chat-produto-card");
                container.appendChild(cardEl);
                scrollParaBaixo();
            }
        }
    }

    /**
     * Extrai a diretiva [MOSTRAR_PRODUTO: nome] da resposta da IA.
     * @param {string} texto
     * @returns {{ textoLimpo: string, nomeProduto: string|null }}
     */
    function _extrairDiretivaProduto(texto) {
        const regex = /\[MOSTRAR_PRODUTO:\s*([^\]]+)\]/i;
        const match = texto.match(regex);
        const nomeProduto = match ? match[1].trim() : null;
        const textoLimpo = texto.replace(regex, "").trim();
        return { textoLimpo, nomeProduto };
    }

    /**
     * Mostra indicador de "digitando..." e retorna id para removê-lo.
     * @returns {string} id do elemento
     */
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
      <div class="chat-digitando__bolinhas">
        <span></span><span></span><span></span>
      </div>
    `;
        container.appendChild(div);
        scrollParaBaixo();
        return id;
    }

    /**
     * Remove indicador de "digitando..." com transição suave.
     * @param {string} id
     */
    function removerDigitando(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.transition = "opacity 0.2s ease, transform 0.2s ease";
        el.style.opacity = "0";
        el.style.transform = "scale(0.95)";
        setTimeout(() => el.remove(), 220);
    }

    // Helpers internos -------------------------------------------

    /** Aguarda N milissegundos */
    function _esperar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /** Retorna lista de produtos do escopo global do site */
    function _getProdutosGlobais() {
        return (
            window.produtos ||
            window.products ||
            window.$produtos ||
            []
        );
    }

    // API pública
    return {
        setContainer,
        adicionarMensagem,
        adicionarMensagemComEfeito,
        mostrarDigitando,
        removerDigitando,
    };
})();

// ============================================================
// 🗄️  SERVIÇO SUPABASE — Carrega e expõe produtos
// ============================================================
const SupabaseService = (() => {
    /**
     * Carrega produtos do Supabase via `window.supabaseManager` (supabase-config.js).
     * Normaliza os campos para garantir compatibilidade.
     * @returns {Promise<Array>}
     */
    async function carregarProdutos() {
        // ─── Estratégia de múltiplas fontes ───────────────────────
        // 1. Tenta reutilizar produtos já carregados pelo script.js (window.products)
        // 2. Faz query direta no Supabase buscando pela tabela correta ('products')
        // 3. Cai no fallback de array vazio (respostas locais ainda funcionam)
        // ──────────────────────────────────────────────────────────

        // Fonte 1: window.products já populado pelo script principal (42 produtos nos logs)
        const globais = window.products || window.produtos || window.$produtos;
        if (Array.isArray(globais) && globais.length > 0) {
            const normalizados = _normalizar(globais);
            console.log(`✅ ChatBot: ${normalizados.length} produtos reutilizados de window.products.`);
            return normalizados;
        }

        // Fonte 2: aguarda o SupabaseManager e faz query direto na tabela correta
        try {
            if (!window.supabaseManager?.isConnected()) {
                console.warn("⚠️ SupabaseManager ainda não conectado; aguardando...");
                await _aguardarConexao();
            }

            // O hint do erro mostrou que a tabela correta é 'products' (inglês)
            const { data, error } = await window.supabaseManager.client
                .from("products")
                .select("*")
                .eq("available", true);

            if (error) throw error;

            if (!data || data.length === 0) {
                console.warn("⚠️ Nenhum produto retornado da tabela 'products'.");
                return [];
            }

            const normalizados = _normalizar(data);

            // Disponibiliza globalmente para que o script.js e outros módulos usem
            window.products = normalizados;
            window.produtos = normalizados;

            console.log(`✅ ChatBot: ${normalizados.length} produtos carregados da tabela 'products'.`);
            return normalizados;
        } catch (erro) {
            console.error("❌ Erro ao carregar produtos para o chatbot:", erro);
            return [];
        }
    }

    /**
     * Normaliza campos da API para nomes consistentes em pt-br.
     * Garante que tanto tabelas em inglês quanto em português funcionem.
     * @param {Array} lista
     * @returns {Array}
     */
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

    /**
     * Aguarda até o SupabaseManager estar conectado (max 5s).
     * @returns {Promise<void>}
     */
    function _aguardarConexao(tentativas = 0) {
        return new Promise((resolve, reject) => {
            const intervalo = setInterval(() => {
                tentativas++;
                if (window.supabaseManager?.isConnected()) {
                    clearInterval(intervalo);
                    resolve();
                } else if (tentativas > 50) { // 50 × 100ms = 5 segundos
                    clearInterval(intervalo);
                    reject(new Error("Supabase não conectou em 5 segundos."));
                }
            }, 100);
        });
    }

    return { carregarProdutos };
})();

// ============================================================
// 🧠  CHATBOT — Orquestrador principal
// ============================================================
const ChatBot = (() => {
    // Estado interno
    const estado = {
        produtos: [],   // Cache local de produtos
        historico: [],   // [{role: "user"|"assistant", content: "..."}]
        ocupado: false,
    };

    /**
     * Inicializa o chatbot: conecta elementos DOM, carrega dados e exibe msg inicial.
     */
    async function init() {
        const inputEl = document.getElementById("chat-input");
        const btnEnviarEl = document.getElementById("chat-send-btn");
        const mensagensEl = document.getElementById("chat-messages");

        // Guard: elementos obrigatórios devem existir no DOM
        if (!inputEl || !btnEnviarEl || !mensagensEl) {
            console.warn("⚠️ ChatBot: elementos DOM não encontrados. Verifique os IDs.");
            return;
        }

        // Configura o gerenciador de UI
        UIManager.setContainer(mensagensEl);
        mensagensEl.setAttribute("role", "list");
        mensagensEl.setAttribute("aria-label", "Conversa com o assistente");

        // Mensagem de boas-vindas imediata — não bloqueia na carga de produtos
        UIManager.adicionarMensagem("bot", CHAT_CONFIG.bot.mensagemInicial);

        // Carrega produtos em background (não trava o chat)
        // Aguarda um tick para o script.js ter chance de popular window.products
        setTimeout(async () => {
            estado.produtos = await SupabaseService.carregarProdutos();
            if (estado.produtos.length) {
                console.log(`✅ ChatBot pronto com ${estado.produtos.length} produtos.`);
            }
        }, 1500); // 1.5s é suficiente: os logs mostram produtos em ~1s

        // Auto-expansão da textarea
        inputEl.addEventListener("input", () => _autoExpand(inputEl));

        // Enviar com botão
        btnEnviarEl.addEventListener("click", () => _enviarMensagem(inputEl));

        // Enviar com Enter (Shift+Enter = quebra de linha)
        inputEl.addEventListener("keydown", e => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                _enviarMensagem(inputEl);
            }
        });
    }

    /**
     * Processa e envia a mensagem do usuário.
     * @param {HTMLTextAreaElement|HTMLInputElement} inputEl
     */
    async function _enviarMensagem(inputEl) {
        const texto = inputEl.value.trim();
        if (!texto || estado.ocupado) return;

        // Bloqueia novos envios enquanto processa
        estado.ocupado = true;
        inputEl.value = "";
        inputEl.style.height = "auto";
        inputEl.disabled = true;

        // 1️⃣ Exibe mensagem do usuário
        UIManager.adicionarMensagem("user", texto);

        // 2️⃣ Registra no histórico
        estado.historico.push({ role: "user", content: texto });

        // 3️⃣ Mostra "digitando..."
        const digitandoId = UIManager.mostrarDigitando();

        try {
            // Delay de "pensamento"
            await _esperar(CHAT_CONFIG.ui.delayPensamento);

            // 4️⃣ Obtém resposta da IA — usa produtos do estado ou do window como fallback
            const produtosContexto = estado.produtos.length
                ? estado.produtos
                : (window.products || window.produtos || []);
            const resposta = await AIProvider.responder(
                texto,
                estado.historico.slice(-10), // Últimas 10 trocas para contexto
                produtosContexto              // Produtos com fallback para window.products
            );

            // 5️⃣ Remove indicador e exibe resposta com efeito
            UIManager.removerDigitando(digitandoId);
            await UIManager.adicionarMensagemComEfeito(resposta);

            // 6️⃣ Registra resposta no histórico
            estado.historico.push({ role: "assistant", content: resposta });

            // Limita histórico a 20 mensagens para não explodir o contexto
            if (estado.historico.length > 20) {
                estado.historico = estado.historico.slice(-20);
            }

        } catch (erro) {
            console.error("❌ ChatBot._enviarMensagem:", erro);
            UIManager.removerDigitando(digitandoId);
            UIManager.adicionarMensagem(
                "bot",
                "Ops! Tive um probleminha técnico. Pode tentar novamente? 🙏"
            );
        } finally {
            estado.ocupado = false;
            inputEl.disabled = false;
            inputEl.focus();
        }
    }

    /**
     * Expande textarea conforme conteúdo digitado.
     * @param {HTMLTextAreaElement} el
     */
    function _autoExpand(el) {
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 120) + "px";
        el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
    }

    /** Aguarda N milissegundos */
    function _esperar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // API pública
    return { init };
})();

// ============================================================
// 🚀  BOOTSTRAP — Aguarda DOM e inicializa
// ============================================================
document.addEventListener("DOMContentLoaded", () => ChatBot.init());
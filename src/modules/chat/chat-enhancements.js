/**
 * @file chat-enhancements.js
 * @description Melhorias adicionais do chat: animações, limpeza histórico, atalhos
 */

(function () {
  'use strict';

  // Aguardar DOM estar pronto
  function ensureEnhancements() {
    // ────────────────────────────────────────────────────────────
    // 1. Adicionar botão "Limpar histórico" ao header do chat
    // ────────────────────────────────────────────────────────────
    const chatHeader = document.querySelector('#chat-modal .bg-primary');
    if (chatHeader && !document.getElementById('chat-clear-history-btn')) {
      const btn = document.createElement('button');
      btn.id = 'chat-clear-history-btn';
      btn.className = 'text-white text-sm opacity-70 hover:opacity-100 transition-opacity border-none bg-transparent p-0 cursor-pointer';
      btn.innerHTML = '<i class="fas fa-trash text-xs"></i>';
      btn.title = 'Limpar histórico';
      btn.type = 'button';

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Deseja limpar o histórico da conversa?')) {
          if (typeof window.chatLimpar === 'function') {
            window.chatLimpar();
          } else {
            localStorage.removeItem('ignite_chat_historico');
            location.reload();
          }
        }
      });

      chatHeader.appendChild(btn);
    }

    // ────────────────────────────────────────────────────────────
    // 2. Melhorar input com Ctrl+Enter para enviar
    // ────────────────────────────────────────────────────────────
    const chatInput = document.getElementById('chat-input');
    if (chatInput && !chatInput.dataset.enhancedKey) {
      chatInput.dataset.enhancedKey = 'true';

      // Restaurar foco após scrollar (melhor UX)
      chatInput.addEventListener('focus', () => {
        setTimeout(() => {
          chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
      });

      // Enter normal = enviar, Shift+Enter = nova linha
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
          e.preventDefault();
          const sendBtn = document.getElementById('chat-send-btn');
          if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
          }
        }
      });
    }

    // ────────────────────────────────────────────────────────────
    // 3. Adicionar indicador de mensagens não lidas (se houver modal)
    // ────────────────────────────────────────────────────────────
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages && !chatMessages.dataset.enhancedScroll) {
      chatMessages.dataset.enhancedScroll = 'true';

      // Auto-scroll para última mensagem quando nova chegar
      const observer = new MutationObserver(() => {
        const lastMsg = chatMessages.lastElementChild;
        if (lastMsg) {
          setTimeout(() => {
            lastMsg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 50);
        }
      });

      observer.observe(chatMessages, { childList: true });
    }

    // ────────────────────────────────────────────────────────────
    // 4. Melhorar UX do botão enviar com spinner
    // ────────────────────────────────────────────────────────────
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn && !sendBtn.dataset.enhancedLoader) {
      sendBtn.dataset.enhancedLoader = 'true';

      const originalHTML = sendBtn.innerHTML;

      // Observar input para detectar quando está ocupado
      const observer = new MutationObserver(() => {
        if (sendBtn.disabled) {
          sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        } else {
          sendBtn.innerHTML = originalHTML;
        }
      });

      observer.observe(sendBtn, { attributes: true, attributeFilter: ['disabled'] });
    }

    // ────────────────────────────────────────────────────────────
    // 5. Adicionar easter egg: emojis digitáveis no input
    // ────────────────────────────────────────────────────────────
    const emojiMap = {
      ':ignite:': '🔥',
      ':ok:': '✅',
      ':sad:': '😢',
      ':happy:': '😊',
      ':think:': '🤔',
    };

    if (chatInput && !chatInput.dataset.emojiMap) {
      chatInput.dataset.emojiMap = 'true';

      chatInput.addEventListener('blur', () => {
        let text = chatInput.value;
        Object.entries(emojiMap).forEach(([code, emoji]) => {
          text = text.replace(code, emoji);
        });
        chatInput.value = text;
      });
    }

    // ────────────────────────────────────────────────────────────
    // 6. Melhorar estilos do chat em modo responsivo
    // ────────────────────────────────────────────────────────────
    const addResponsiveListener = () => {
      const modal = document.getElementById('chat-modal');
      if (!modal) return;

      const updateResponsive = () => {
        const width = window.innerWidth;
        const msgs = modal.querySelectorAll('.chat-msg');

        if (width < 480) {
          modal.style.maxWidth = '100vw';
          modal.style.borderRadius = '0';
          msgs.forEach(msg => {
            msg.querySelector('.chat-msg__balao').style.maxWidth = '95%';
          });
        } else {
          modal.style.maxWidth = '100%';
          msgs.forEach(msg => {
            msg.querySelector('.chat-msg__balao').style.maxWidth = '85%';
          });
        }
      };

      updateResponsive();
      window.addEventListener('resize', updateResponsive);
    };

    addResponsiveListener();

    // ────────────────────────────────────────────────────────────
    // 7. Integração com chat-cart: melhorar visibilidade
    // ────────────────────────────────────────────────────────────
    const checkoutBtn = document.getElementById('chat-checkout-btn');
    const clearBtn = document.getElementById('cart-count');

    if (checkoutBtn && clearBtn) {
      // Sincronizar visibilidade do botão Finalizar com carrinho
      const syncCheckoutBtn = () => {
        const cartCount = parseInt(clearBtn.textContent || '0');
        checkoutBtn.style.opacity = cartCount > 0 ? '1' : '0.5';
        checkoutBtn.style.pointerEvents = cartCount > 0 ? 'auto' : 'none';
      };

      // Observar mudanças no contador
      const observer = new MutationObserver(syncCheckoutBtn);
      observer.observe(clearBtn, { characterData: true, childList: true });
      syncCheckoutBtn(); // Sincronizar inicialmente
    }

    // ────────────────────────────────────────────────────────────
    // 8. Melhorar feedback visual ao clicar em produtos
    // ────────────────────────────────────────────────────────────
    document.addEventListener('click', (e) => {
      const btnAdd = e.target.closest('.produto-card__btn-add');
      if (btnAdd) {
        // Adicionar animação de pulse
        btnAdd.style.animation = 'none';
        setTimeout(() => {
          btnAdd.style.animation = 'pulse 0.6s ease-in-out';
        }, 10);

        // Remover depois
        setTimeout(() => {
          btnAdd.style.animation = '';
        }, 600);
      }
    });

    // ────────────────────────────────────────────────────────────
    // 9. Adicionar suporte a atalho Ctrl+K para focar no chat
    // ────────────────────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const modal = document.getElementById('chat-modal');
        const input = document.getElementById('chat-input');

        if (modal && input) {
          modal.classList.remove('hidden');
          modal.classList.add('flex');
          input.focus();
        }
      }
    });

    // ────────────────────────────────────────────────────────────
    // 10. Melhorar performance: lazy load de imagens no chat
    // ────────────────────────────────────────────────────────────
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              observer.unobserve(img);
            }
          }
        });
      });

      // Expor para outros módulos (ProductCard pode reutilizar)
      window.__chatLazyObserver = observer;
      window.observeChatLazyImage = function (img) {
        try { observer.observe(img); } catch (e) { /* noop */ }
      };

      document.querySelectorAll('.produto-card__imagem[data-src]').forEach(img => {
        observer.observe(img);
      });
    } else {
      // Fallback: função utilitária que carrega diretamente
      window.observeChatLazyImage = function (img) {
        if (img && img.dataset && img.dataset.src) img.src = img.dataset.src;
      };
    }

    // ────────────────────────────────────────────────────────────
    // 11. Menu de ações (+ button em mobile)
    // ────────────────────────────────────────────────────────────
    const actionsToggle = document.getElementById('chat-actions-toggle');
    const actionsMenu = document.getElementById('chat-actions-menu');

    if (actionsToggle && actionsMenu && !actionsToggle.dataset.enhancedActions) {
      actionsToggle.dataset.enhancedActions = 'true';

      // Toggle menu ao clicar no botão "+"
      actionsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = actionsMenu.classList.contains('hidden');
        if (isHidden) {
          actionsMenu.classList.remove('hidden');
          // Trigger animation
          setTimeout(() => actionsMenu.classList.add('animate-in'), 10);
        } else {
          actionsMenu.classList.add('hidden');
        }
      });

      // Fechar menu ao clicar em uma ação
      actionsMenu.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          actionsMenu.classList.add('hidden');

          // Ações específicas
          if (btn.innerHTML.includes('Anexar') || btn.innerHTML.includes('imagem')) {
            // Abrir file picker para imagem
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.addEventListener('change', (evt) => {
              const file = evt.target.files?.[0];
              if (file && chatInput) {
                chatInput.value += chatInput.value ? `\n📷 ${file.name}` : `📷 ${file.name}`;
                chatInput.focus();
                chatInput.style.height = 'auto';
                chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
              }
            });
            input.click();
          } else if (btn.innerHTML.includes('cardápio') || btn.innerHTML.includes('Cardápio') || btn.innerHTML.includes('utensils')) {
            // Enviar mensagem pré-programada
            if (chatInput) {
              chatInput.value = 'Ver cardápio';
              const sendBtn = document.getElementById('chat-send-btn');
              if (sendBtn && !sendBtn.disabled) {
                setTimeout(() => sendBtn.click(), 50);
              }
            }
          }
        });
      });

      // Fechar menu ao clicar fora
      document.addEventListener('click', (e) => {
        const isClickInside = actionsToggle.contains(e.target) || actionsMenu.contains(e.target);
        if (!isClickInside && !actionsMenu.classList.contains('hidden')) {
          actionsMenu.classList.add('hidden');
        }
      });
    }

    console.log('✨ Chat enhancements aplicados com sucesso!');
  }

  // Executar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureEnhancements);
  } else {
    ensureEnhancements();
  }

  // Também tentar após 1s (caso o chat seja renderizado depois)
  setTimeout(ensureEnhancements, 1000);

  // Exposição global para debug
  window.chatEnhancementsReady = true;
})();

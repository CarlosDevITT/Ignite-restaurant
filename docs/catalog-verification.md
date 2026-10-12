# Revisão do catálogo digital

Validação no Chromium em 320px e 390px com toque e em 1440px desktop, usando o catálogo público real do Supabase (26 produtos no momento da verificação):

- Busca por Lasanha retorna um resultado; busca sem correspondência permite voltar ao catálogo completo.
- Limpar busca restaura produtos e foco; Todos / Em oferta / Destaques combinam com busca.
- Abrir painel de categorias não altera o filtro de produtos. Tab e Shift+Tab ficam no painel; Escape fecha, restaura o fundo e o foco.
- Botão Adicionar tem 44px de altura; inclusão local incrementa contador; detalhes abrem com quantidade. Nenhum pedido real foi enviado.
- Fotos carregadas preservam o nome do produto; ausência/erro usa indicação neutra. Sem fotografia inventada.
- Sem rolagem horizontal ou erros de JavaScript nos três tamanhos. Syntax checks de catalog.js e mobile-ux.js e lint de DESIGN.md passaram.

A auditoria estática premium não passou globalmente: baseline anterior tinha 57 apontamentos; revisão tem 58. O novo apontamento trata o botão de seleção criado por template como sem ação, embora o handler delegado e os testes de Todos/Em oferta/Destaques confirmem sua operação. Os demais apontamentos são anteriores, inclusive formulários de outras telas e limitações da análise de eventos delegados. Esses números não representam 58 falhas confirmadas em execução, nem validam o aplicativo completo. Não alterar fluxos de perfil/checkout somente para satisfazer um detector estático nesta revisão do catálogo.

Divergência visual resolvida: o README/landing descrevia a marca, enquanto os cards efetivamente usam DM Sans e CSS de produto próprio. DESIGN.md agora distingue os dois registros. product-ux-v4.css e frontend-polish.css continham medidas conflitantes de texto/botão; ambas foram alinhadas na implementação existente, sem acrescentar outra folha de overrides.

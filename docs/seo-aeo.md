# SEO, AEO e GEO do Ignite

- URL canônica da landing: `https://ignite-restaurant-kappa.vercel.app/`. `/index.html` mantém acesso e aponta para a mesma canônica.
- URL canônica do cardápio: `https://ignite-restaurant-kappa.vercel.app/Cardapio/index.html`. Parâmetros de navegação não são novas páginas de produto indexáveis.
- Metadados: títulos/descrições locais, Open Graph e Twitter completos para as duas páginas, idioma pt-BR e imagens com texto alternativo.
- JSON-LD da landing: Organization com duas Restaurant, WebSite, WebPage e FAQPage. Endereços, modalidades e telefones confirmados. Sem coordenadas, notas, faixa de preço ou dias de funcionamento presumidos.
- FAQPage usa as perguntas e respostas realmente visíveis em HTML. O Google restringe rich results de FAQ principalmente a sites de saúde/governo: a marcação não promete esse resultado para o restaurante.
- Cardápio: WebPage e BreadcrumbList; não publicar produtos/preços estáticos que divergem do catálogo em tempo real.
- llms.txt: referência editorial pública em Markdown, com informações e links confirmados. É uma proposta de convenção; não garante indexação, citação ou posição em respostas de IA.
- robots.txt libera recursos e llms.txt. Não é mecanismo de segurança. sitemap.xml contém somente as duas páginas HTML canônicas.

## Manutenção

Atualizar `js/data/storefront.js`, HTML visível, JSON-LD e `llms.txt` juntos quando mudar endereço, contato ou modalidade. Se dados públicos de unidades no Supabase substituírem o fallback, atualizar também as fontes estáticas: o JSON-LD e llms.txt não são atualmente gerados a partir do banco.

Atualizar o FAQPage ao mudar as respostas visíveis. Atualizar o lastmod da página correspondente no sitemap quando seu código/conteúdo público mudar; não usar a data de cada acesso.

Após publicar, enviar o sitemap no Google Search Console e Bing Webmaster Tools usando as contas verificadas do proprietário. Validar os dados no Schema Markup Validator e no Google Rich Results Test. As verificações locais confirmam sintaxe e consistência, não garantem aceitação dos buscadores.

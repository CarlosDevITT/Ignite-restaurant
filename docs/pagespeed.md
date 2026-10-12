# Revisão PageSpeed — Cardápio

Relatório informado pelo proprietário: https://pagespeed.web.dev/analysis/https-ignite-restaurant-kappa-vercel-app-Cardapio-index-html/h8sup4hkr8?form_factor=mobile

Referência do relatório mobile: Performance 30, Accessibility 96, Best Practices 96, SEO 100; FCP 6,3 s; LCP 93,3 s; CLS 1,412; TBT 10 ms; transferência 41.665 KiB. Não havia dados de campo CrUX nesse relatório.

## Alterações

- Quatro banners PNG: 9.214.943 bytes. Variantes WebP 640px: 152.978 bytes somadas (98,3% menores); variantes 1280px: 403.468 bytes. HTML usa srcset/sizes e a primeira imagem mantém alta prioridade. Originais preservados.
- Vercel image optimization configurada apenas para fotos públicas de products deste Supabase, em larguras 320/640/960, qualidade 75 e WebP. Helper compartilhado no catálogo/detalhes. Se a otimização falhar, tenta a origem uma vez; erro final continua com placeholder. Não altera produtos ou o banco.
- CSS do catálogo/typografia carregado pelo HTML antes da primeira pintura; import CSS em cadeia removido. Categorias e filtros reservam altura para o estado de carregamento.
- DM Sans hospedada localmente, fonte variável com display optional e licença OFL. Removidas as duas requisições de tipografia Google/Syne redundantes.
- Carrossel inicia pausado; usuário mantém próximo/anterior, deslize e reprodução explícita.
- Perfil, chat, feed e jogo deixam de ser imports iniciais e carregam em seus gatilhos existentes. Módulos não essenciais e banners PNG saíram do precache inicial. Scripts visitados continuam no cache de runtime; dados do Supabase continuam fora do service worker.
- Assets versionados/fontes recebem cache HTTP longo; miniaturas otimizadas têm cache de imagens limitado a 80 entradas no PWA.
- Corrigidos contraste dos textos de promoção/preço anterior no mobile e role group em slides, usando divs semanticamente compatíveis. Telemetria Vercel não é injetada em localhost.

## Verificação

Busca, limpar busca, inclusão local, abrir carrinho e abrir perfil sob demanda testados em 390px e 1366px, sem erros JavaScript ou overflow horizontal. Nenhum pedido real enviado. Configuração validada contra o schema oficial da Vercel.

Primeira auditoria Lighthouse local após entrega das imagens/estilos: CLS 0, LCP 11,3 s, transferência 1.842 KiB. Esse teste foi feito em localhost, sem otimização nativa das fotos e com CSS sem compressão do servidor Python; não comparar sua nota diretamente com o PageSpeed de produção. Os apontamentos de contraste/roles encontrados nesse teste foram corrigidos posteriormente.

## Manutenção

Ao editar um banner ou fonte, gerar novo nome versionado: o cache immutable não aceita substituir bytes no mesmo URL. Fotos continuam vindo do Supabase; o otimizador não publica catálogo estático nem preços. URLs e medidas das miniaturas são de Cardapio/js/utils/media.js. Manter domains/path allowlist restritos. Perfil/chat iniciam apenas no primeiro acesso; login e checkout mantêm seus responsáveis existentes.

## Medição no site publicado

Lighthouse mobile em 12/10/2026, após o deploy 4b53c85: Performance 65, Accessibility 100, Best Practices 100, SEO 100; FCP 4,4 s; LCP 8,5 s; CLS 0; TBT 35 ms; transferência 1.589 KiB. Execução de laboratório, não dados de campo; notas variam por rede, servidor e execução. Comparado ao relatório recebido, a transferência caiu aproximadamente 96%. O LCP ainda exige acompanhamento e otimização.

Endpoint nativo da Vercel verificado com uma foto real do Supabase: HTTP 200, Content-Type image/webp, 23.452 bytes e cache HIT; imagem carregada sem recorrer à origem.

Após essa medição, adicionada variante de banner 960px para evitar o salto direto de 640 para 1280 em celulares com alta densidade; folha UIcons minificada (326.911 → 215.805 bytes antes de compressão HTTP), preservando as classes e fonte; badges decorativos não sobrescrevem mais o nome acessível do botão de produto.

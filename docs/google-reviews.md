# Avaliações do Google na landing page

Perfil enviado pelo proprietário: https://share.google/vL5oBr2LOXtuQyCfm
O link redireciona para IGNITE RESTAURANTE PUB (Knowledge Graph `/g/11z2yml2sx`). Esse identificador **não** é um Place ID. A unidade ainda não foi confirmada pelo Google neste ambiente: a página exigiu verificação antirrobô.

## Ativar na Vercel

1. No Google Cloud, habilitar **Places API (New)** e o faturamento exigido pelo Google. Configurar quota e limites de orçamento adequados.
2. Criar uma chave restrita à Places API (New). Salvar somente em **Vercel → Project → Settings → Environment Variables**, como `GOOGLE_PLACES_API_KEY`; não colocar a chave no HTML, JavaScript público ou chat.
3. Encontrar e confirmar o Place ID do perfil correto em https://developers.google.com/maps/documentation/places/web-service/place-id . Configurar `GOOGLE_PLACE_ID` na Vercel. Não usar o Knowledge Graph ID como Place ID.
4. Fazer um novo deploy após definir as duas variáveis.
5. Abrir `/api/google-reviews` e conferir `available: true`, o nome do restaurante e o link do perfil. A chave não é retornada. Conferir autores, avaliações e links na seção “Avaliações no Google”.

A API retorna no máximo cinco avaliações, escolhidas por relevância pelo Google. A integração não tem acesso a todos os comentários do Google Business Profile. Para todos os comentários é necessária outra integração autenticada com uma conta autorizada do proprietário.

Sem configuração, o site oferece o link do perfil e não mostra notas ou depoimentos. Erros de rede oferecem nova tentativa. A chave fica no proxy da Vercel. Não há scraping, persistência em Supabase, localStorage ou cache de avaliações. O endpoint não recebe Place IDs arbitrários do visitante.

Referências: https://developers.google.com/maps/documentation/places/web-service/place-details e https://developers.google.com/maps/documentation/places/web-service/policies .

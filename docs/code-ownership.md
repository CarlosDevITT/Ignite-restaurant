# Code ownership and legacy cleanup

Active application sources:

- `index.html`: marketing landing. `js/main.js` owns navigation and progressive motion; `js/landing-catalog.js` owns read-only public catalog previews; `js/data/storefront.js` owns owner-confirmed contact fallback.
- `Cardapio/index.html`: canonical Cardápio application. Its modules, services, store, data and configuration live exclusively under `Cardapio/js/`.
- `styles/styles.css`: landing base components; `styles/brand.css`: canonical brand tokens; `styles/header.css`: header; `styles/landing-menu.css`: menu preview and units.
- `offline.html`: self-contained offline layout using locally cached UIcons, without remote font/icon dependencies.

The unused root `js/app.js`, config, services, store, format helpers, mock data and old Cardápio screen modules were retired after checking HTML entrypoints and recursive imports. The old launch splash had no active consumer and was removed from the service worker precache. Do not add a second Cardápio implementation at the repository root.

Root `js/modules/ignite-play/` paths remain compatibility reexports of canonical `Cardapio/js/modules/ignite-play/` files. The two legacy stylesheet URLs `styles/cardapio.css` and `styles/ignite-play.css` are import aliases; implementation remains in `Cardapio/styles/`. The older Cardapio/js/modules/ignite-play/snake.js entrypoint also delegates to games/snake.js, which is the engine already used by game-registry.js. Preserve these aliases rather than duplicating game engines or styles.

Old hidden reveal CSS, stats badges, decorative rings/blobs, unused image/icon containers and generic skeleton/loader rules were removed from the landing. Real loading states belong to `landing-catalog.js`/`landing-menu.css`; entry motion belongs to `main.js`. Brand/header variables must not be redeclared with stale values in the base stylesheet.

The cleanup does not change the database schema, public API, storage keys, prices or order submission implementation. Media assets were retained because they can be referenced through the public catalog and historical URLs.

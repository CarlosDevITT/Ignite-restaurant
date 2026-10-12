# Landing page and shared Supabase data

The landing is a read-only consumer of the same public catalog used by Cardápio:

- `cardapio_products_public`: photos, names, descriptions, availability, normal and promotional prices. The shared `normalizeProduct` function owns price and stock semantics. No development mocks are presented as live products.
- `cardapio_store_status_public`: the shared `readPublicStoreStatus` reader is also called by Cardápio's existing `getStoreSettings`. A false `store_open` pauses online orders; the landing continues linking to menu consultation. It does not infer physical opening from the clock or change the PDV's register state.
- Existing `subscribeToCatalog`: real-time catalog invalidation, plus visible-page 60-second reconciliation. Online-order status is reconciled every 5 seconds while visible, with timeout and unknown-state fallback. Actual opening/closing of the register was not performed during validation; transitions were verified by intercepted API responses only.

At implementation, the accessible public status view returned only `store_open`, `delivery_fee`, `updated_at`. The API schema endpoint did not permit introspection. Addresses and contacts were confirmed by the owner and stored in `js/data/storefront.js`, with matching static HTML for no-JavaScript access. No private PDV/cash/customer tables are queried, and no database migrations or writes are made.

To synchronize business-contact updates, a maintained public view may expose a `units` JSON array of public metadata. Supported fields: `id` (`itajai` / `manaus`), `name`, `state`, `address`, `neighborhood`, `hours`, `service`, `phone` (10–11 Brazilian digits without country prefix), `displayPhone`. Strings are rendered as text; unit contacts and map links are validated/built locally. Only the two known units can be overridden. Do not expose credentials or internal PDV configuration. Publishing such database metadata requires inspecting the actual maintained schema; this change does not invent or deploy a SQL migration.

Product links use `?item=ID`; category links use `?category=normalized-category-name`. Cardápio resolves them after catalog rendering, using the existing product dialog/category navigation. No items are added or orders submitted automatically. Backend validation remains authoritative at checkout.

Restaurant hours supplied by the owner: 18:00–23:30, with no weekday calendar supplied. Itajaí: Rua Frindolim Heathl Junior, delivery only, +55 47 97400-8620. Manaus: Rua São José, Lírio do Vale 1, delivery and on-site dining, +55 92 98513-0951. No street number, weekday schedule, radius, or opening status was invented.

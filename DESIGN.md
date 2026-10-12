---
version: alpha
name: Ignite
description: Restaurant identity
colors:
  primary: '#146447'
  accent: '#c44b25'
  background: '#f6f8f2'
  surface: '#ffffff'
  text: '#183c2b'
  body: '#526151'
typography:
  display:
    fontFamily: 'Syne, sans-serif'
  body:
    fontFamily: 'DM Sans, sans-serif'
rounded:
  card: '24px'
  button: '999px'
spacing:
  page-max: '1200px'
  section: '70px'
components:
  button:
    height: '48px'
    backgroundColor: '{colors.primary}'
    textColor: '{colors.surface}'
  heading:
    textColor: '{colors.text}'
  paragraph:
    textColor: '{colors.body}'
  focus:
    backgroundColor: '{colors.accent}'
---

# Ignite visual identity

## Overview
The landing page should feel like the welcoming sign outside a Brazilian neighborhood restaurant pub. Its signature is a real public-catalog dish photograph in the arched hero, with its current name and price; the existing mark remains in navigation and is the image fallback. Audience: people choosing lunch, dinner or delivery in Manaus and Itajaí, as described by index.html and Cardapio/README.md. Portuguese (Brazil), mobile first. The landing page uses a brand register; /Cardapio/ remains a functional commerce surface with its existing design and behavior.

Runtime CSS remains canonical (Model B). This document mirrors the landing identity. The landing now previews the shared public catalog; no database writes or new checkout policy are introduced. Catalog links resolve after data loads in the existing Cardápio module.

## Colors
Green owns navigation and primary actions. Burnt orange accents only the word “acende.” Pale green surfaces keep the daylight view calm. The logo panel retains the asset's green background; yellow marks hospitality rather than success or availability. Dark mode changes surfaces and text, retaining the same hierarchy; its orange accent is #ee8b5d for contrast. No static claim that the restaurant is currently open. Online-order availability comes only from cardapio_store_status_public; false means online orders paused, not a claim about the physical restaurant. Addresses, hours, services and contacts of Itajaí/Manaus use the owner-confirmed fallback in js/data/storefront.js. Do not infer physical hours from store_open. The public view currently exposes only store_open, delivery_fee and updated_at; optional units metadata can override the two known unit records when explicitly exposed by the public view.

## Typography
Syne carries titles and the wordmark; DM Sans supports paragraphs and controls, with sans-serif fallback for Portuguese accents. Titles use short lines and tight tracking; body uses 1.65–1.8 line height. Avoid extended uppercase body copy.

## Layout
1200px maximum content width; desktop side margins 40px, phone 20px. Split hero becomes a single column at 768px, text before illustration. Natural document scrolling; sticky navigation is 88px on desktop and 76px up to 920px. styles/header.css is the sole canonical owner of landing header rules, replacing the former styles/styles.css and styles/brand.css overrides. The Cardápio CTA remains outside the disclosure and visible at every width. Mobile navigation is a non-modal disclosure. Its closed links must not receive focus. Reserve image dimensions; never hide essential content while waiting for animation.

## Elevation & Depth
Borders and tonal surfaces carry hierarchy. Avoid glowing buttons and decorative gradients. The logo may move at most 24px in response to document scroll on fine-pointer devices. A small solid shadow anchors the hospitality seal only.

## Shapes
Pill actions, 24px card radius, and one arched hero panel. The arch belongs to the brand hero, not every card.

## Components
Mapping: colors.primary → styles/brand.css --green → .button and navigation; accent → --ember → hero accent and focus; background → --bg → body/header; surface → --surface → cards; text → --title → headings; body → --body → copy. Typography maps to --font-display and --font-body. Rounded.card → --radius; rounded.button → .button; spacing.page-max → --max-w. The existing styles/styles.css supplies base components and brand.css supplies landing variants.

Buttons retain labels and valid destinations. Theme and menu actions use native buttons with accessible names and states. Focus uses a visible orange outline. Disabled controls use opacity and a not-allowed cursor. Scrollbars use shared thumb, track, hover and active tokens, with system colors in forced-color mode. Motion uses progressive Web Animations: 650ms entrances once per element with subtle scale, 70ms card/column stagger and backwards fill during delay, a reading-progress bar and a maximum 24px hero scroll displacement. All entrances/parallax stop with reduced motion; content is always visible if scripts fail. Header, navigation and progress share one requestAnimationFrame scroll scheduler. The landing uses the same locally hosted Flaticon UIcons 4.0 Regular Rounded font as Cardápio. Custom SVG sprites have been retired. Core actions retain text. Theme choice initializes before paint, storage failure is nonfatal, and feedback uses one localized status live region. Installation is a non-modal aside, only shown when the browser supplies an install prompt. Landing previews use native links, a localized loading indicator/live region, explicit retry, empty and stale states. No mock catalog is used for commercial previews. Canonical data: Cardapio/js/services/product-service.js normalizeProduct; canonical API/auth: Cardapio/js/supabase-config.js and services/supabase-client.js; catalog destinations: Cardapio/js/modules/catalog.js; scrollbar: styles/brand.css; feedback: #site-status/js/main.js; FAQ: native details/summary. Product media has fixed 4:3 geometry and remote image error fallback. Category/item parameters only open the existing category/details workflow; never automatically add items or submit orders. Cardápio links remain in the header and page content; the mobile fixed CTA and its reserved space were removed. Products revalidate through the existing subscribeToCatalog owner, after visibility/reconnect and every 60 seconds while visible; online-order status is read every 5 seconds while visible from the same readPublicStoreStatus/getStoreSettings source as Cardápio; failed refreshes label stale previews and never claim current status. On fresh failure/empty, the Cardápio/contact links remain available. Public views are read only, with abortable 12-second requests and latest-response ownership.

## Do's and Don'ts
- Do make the Cardápio action immediately visible.
- Do preserve native navigation, local theme choice and the existing PWA behavior.
- Don't invent ratings, hours, availability or food photography.
- Don't spread the hero's expressive composition into commerce controls.

Code ownership and retired legacy entrypoints are documented in docs/code-ownership.md. Landing base CSS retains geometry/components; brand values and motion must not be duplicated there.

### Ambient motion and landing footer
Root landing only. js/scroll-fire.js owns one visibility-gated Canvas loop, pooled ember particles, a cached glow sprite and 60ms passive scroll sampling. Soft amber trails, depth variation and smooth upward drift replace localized flames. Drawing caps: desktop 30 FPS / mobile 24 FPS; DPR 1.5 / 1; particle count 36–60 based on desktop viewport area / 24 mobile. Decorative negative layers never intercept input. Hidden tabs, manual pause, reduced motion and forced colors cancel RAF and clear the canvas. Hero dish uses circular geometry and a 48-second independent rotate animation paused offscreen. Existing logo artwork has no tinted backing. A continuous full-document gradient with radial accents uses the primary #146447 in both themes, with a green gradient contact section and full-width dark green footer. Footer uses semantic navigation, distinct canonical unit WhatsApp and phone links, 44px targets, responsive columns and no unverified email or mislabeled destinations. Visible icon attribution was removed at the owner's explicit request.

Hero parallax acts only on the stage wrapper; independent rotate animates the dish image on desktop and mobile without sharing transform ownership. Product cards, unit cards, FAQ columns and footer columns enter through the same IntersectionObserver owner.

Scroll depth: catalog photos receive at most 10px desktop / 5px mobile vertical movement inside clipped media, with small overscan to prevent exposed edges. A dedicated IntersectionObserver maintains only visible photo targets; updates share the existing scroll RAF. Transform stays independent from the dish rotate. Pause, reduced motion and hidden tabs disable depth; pause also cancels active entrance animations. A green-to-gold reading indicator tracks actual page progress.

### Google reviews
The owner-provided profile https://share.google/vL5oBr2LOXtuQyCfm is the fallback CTA. No invented ratings or copied testimonials. api/google-reviews.js uses Google Places (New) with server-only GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID, a fixed field mask and timeout. Only official returned reviews are displayed, with author attribution, dates, ratings and original links. Reviews are selected by Google relevance, not filtered to positive ratings. Loading is deferred until near viewport; failure retains the profile link and a native retry. Neither the proxy nor the service worker caches review content. Empty/unconfigured states have no score or fabricated cards. Cards use existing brand tokens and natural document scrolling.

### Editorial voice
Landing copy uses familiar Brazilian Portuguese and describes what visitors can do: see the menu, order delivery, visit Manaus or contact their unit. Keep the established “Sabor que acende bons momentos” brand signature, but avoid repeating vague moment/sabor metaphors in each section. Do not imply lunch service when the confirmed hours begin at 18h. Product descriptions and Google testimonials remain their original source text. Visible FAQ answers and JSON-LD must stay aligned; dynamic delivery-fee copy retains its actual data source.

Scroll stability fix: entrance observation ends before an element animates and a WeakSet prevents re-observation of revealed cards. Observe stable media frames rather than the translated photos; a 160px pre-entry margin computes photo depth before visibility. Leaving view stops updates without clearing the photo transform. Hero parallax saturates at 24px instead of resetting at a viewport-height boundary.

Ember refinement: three cached gold/amber/copper glow sprites, sparse tapered trails and a mix of distant dust and nearer embers. Lifetime derives from viewport height and rise speed, so particles can traverse the screen. Seed the initial population across its lifetime; fade on birth/death and use gentle lateral drift rather than synchronized wobble or flickering. Scroll increases upward airflow with easing. No per-frame gradient, shadow or particle allocation.

### Digital menu product surface
Cardápio is a product register with canonical DM Sans typography and its own shared primary/surface tokens in Cardapio/styles/cardapio.css. Keep that functional palette independent from the landing. catalog.js owns local product search, explicit Todos / Em oferta / Destaques filters, category scroll links, product dialogs and local cart adds. Featured is an editorial flag, never a measured sales ranking. mobile-ux.js owns the category sheet; its trigger must not also toggle featured products. Sheet uses escaped canonical labels, focus containment/restoration and preserved background inert state. Search clear is a native 44px button, local filtering waits for IME composition and reset preserves keyboard focus. Mobile product-ux-v4.css owns horizontal cards, readable 0.8rem descriptions and 44px add controls; catalog-premium.css owns shared cards/filter controls; catalog-vertical.css owns category geometry. Missing photos use an explicit neutral placeholder, not an invented dish image. Supabase remains the product/price/availability source; checkout/order/auth policy is unchanged.

Desktop Cardápio sidebar (900px+): warm pale surface, centered original logo, menu caption and Cardápio / Meus pedidos / Minha conta. Novidades routes directly to the existing feed. Keep mobile markup and styling unchanged; active section remains exposed by aria-current.

Desktop sidebar preferences: default dark green #10291e; optional white background. desktop-sidebar.js owns persisted theme/collapse only. Collapsed rail is 88px with labeled icon navigation, native expand control and theme controls. All appearance and geometry rules are inside min-width:900px; mobile layout ignores saved desktop preferences.

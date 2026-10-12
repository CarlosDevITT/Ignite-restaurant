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

Buttons retain labels and valid destinations. Theme and menu actions use native buttons with accessible names and states. Focus uses a visible orange outline. Disabled controls use opacity and a not-allowed cursor. Scrollbars use shared thumb, track, hover and active tokens, with system colors in forced-color mode. Motion uses progressive Web Animations: 650ms section entrances, 80ms service-card stagger, a reading-progress bar and a maximum 24px hero scroll displacement. All entrances/parallax stop with reduced motion; content is always visible if scripts fail. Header, navigation and progress share one requestAnimationFrame scroll scheduler. The landing uses the same locally hosted Flaticon UIcons 4.0 Regular Rounded font as Cardápio. Custom SVG sprites have been retired. Core actions retain text. Theme choice initializes before paint, storage failure is nonfatal, and feedback uses one localized status live region. Installation is a non-modal aside, only shown when the browser supplies an install prompt. Landing previews use native links, a localized loading indicator/live region, explicit retry, empty and stale states. No mock catalog is used for commercial previews. Canonical data: Cardapio/js/services/product-service.js normalizeProduct; canonical API/auth: Cardapio/js/supabase-config.js and services/supabase-client.js; catalog destinations: Cardapio/js/modules/catalog.js; scrollbar: styles/brand.css; feedback: #site-status/js/main.js; FAQ: native details/summary. Product media has fixed 4:3 geometry and remote image error fallback. Category/item parameters only open the existing category/details workflow; never automatically add items or submit orders. A mobile menu CTA reserves 84px document space and notices appear above it. Products revalidate through the existing subscribeToCatalog owner, after visibility/reconnect and every 60 seconds while visible; online-order status is read every 5 seconds while visible from the same readPublicStoreStatus/getStoreSettings source as Cardápio; failed refreshes label stale previews and never claim current status. On fresh failure/empty, the Cardápio/contact links remain available. Public views are read only, with abortable 12-second requests and latest-response ownership.

## Do's and Don'ts
- Do make the Cardápio action immediately visible.
- Do preserve native navigation, local theme choice and the existing PWA behavior.
- Don't invent ratings, hours, availability or food photography.
- Don't spread the hero's expressive composition into commerce controls.

Code ownership and retired legacy entrypoints are documented in docs/code-ownership.md. Landing base CSS retains geometry/components; brand values and motion must not be duplicated there.

### Ambient motion and landing footer
Root landing only. js/scroll-fire.js owns one visibility-gated Canvas loop, pooled ember particles, a cached glow sprite and 60ms passive scroll sampling. Soft amber trails, depth variation and smooth upward drift replace localized flames. Drawing caps: desktop 30 FPS / mobile 24 FPS; DPR 1.5 / 1; particle count 65 / 28. Decorative negative layers never intercept input. Hidden tabs, manual pause, reduced motion and forced colors cancel RAF and clear the canvas. Hero dish uses circular geometry and a 65-second transform rotation paused offscreen. Existing logo artwork has no tinted backing. Static radial gradients use the primary #146447 in both themes, with a green gradient contact section and full-width dark green footer. Footer uses semantic navigation, distinct canonical unit WhatsApp and phone links, 44px targets, responsive columns and no unverified email or mislabeled destinations. Visible icon attribution was removed at the owner's explicit request.

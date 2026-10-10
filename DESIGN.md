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
The landing page should feel like the welcoming sign outside a Brazilian neighborhood restaurant pub. Its signature is the existing flame-and-chope mark on an arched green panel with a small yellow hospitality seal. Audience: people choosing lunch, dinner or delivery in Manaus and Itajaí, as described by index.html and Cardapio/README.md. Portuguese (Brazil), mobile first. The landing page uses a brand register; /Cardapio/ remains a functional commerce surface with its existing design and behavior.

Runtime CSS remains canonical (Model B). This document mirrors the landing identity. No new product policy, checkout behavior or database changes are part of this redesign.

## Colors
Green owns navigation and primary actions. Burnt orange accents only the word “acende.” Pale green surfaces keep the daylight view calm. The logo panel retains the asset's green background; yellow marks hospitality rather than success or availability. Dark mode changes surfaces and text, retaining the same hierarchy; its orange accent is #ee8b5d for contrast. No static claim that the restaurant is currently open.

## Typography
Syne carries titles and the wordmark; DM Sans supports paragraphs and controls, with sans-serif fallback for Portuguese accents. Titles use short lines and tight tracking; body uses 1.65–1.8 line height. Avoid extended uppercase body copy.

## Layout
1200px maximum content width; desktop side margins 40px, phone 20px. Split hero becomes a single column at 768px, text before illustration. Natural document scrolling; sticky navigation is 88px on desktop and 76px on mobile. Mobile navigation is a non-modal disclosure. Its closed links must not receive focus. Reserve image dimensions; never hide essential content while waiting for animation.

## Elevation & Depth
Borders and tonal surfaces carry hierarchy. Avoid glowing buttons and decorative gradients. The logo may move at most 24px in response to document scroll on fine-pointer devices. A small solid shadow anchors the hospitality seal only.

## Shapes
Pill actions, 24px card radius, and one arched hero panel. The arch belongs to the brand hero, not every card.

## Components
Mapping: colors.primary → styles/brand.css --green → .button and navigation; accent → --ember → hero accent and focus; background → --bg → body/header; surface → --surface → cards; text → --title → headings; body → --body → copy. Typography maps to --font-display and --font-body. Rounded.card → --radius; rounded.button → .button; spacing.page-max → --max-w. The existing styles/styles.css supplies base components and brand.css supplies landing variants.

Buttons retain labels and valid destinations. Theme and menu actions use native buttons with accessible names and states. Focus uses a visible orange outline. Disabled controls use opacity and a not-allowed cursor. Scrollbars use shared thumb, track, hover and active tokens, with system colors in forced-color mode. Motion uses progressive Web Animations: 650ms section entrances, 80ms service-card stagger, a reading-progress bar and a maximum 24px hero scroll displacement. All entrances/parallax stop with reduced motion; content is always visible if scripts fail. Header, navigation and progress share one requestAnimationFrame scroll scheduler. Inline local SVG symbols replace external icon-font dependencies; all use a 24px viewBox, 1.7px rounded strokes and currentColor. Core actions retain text. Theme choice initializes before paint, storage failure is nonfatal, and feedback uses one localized status live region. Installation is a non-modal aside, only shown when the browser supplies an install prompt. No new loading, form, dialog or checkout primitives are introduced.

## Do's and Don'ts
- Do make the Cardápio action immediately visible.
- Do preserve native navigation, local theme choice and the existing PWA behavior.
- Don't invent ratings, hours, availability or food photography.
- Don't spread the hero's expressive composition into commerce controls.

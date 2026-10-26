---
name: QabylDesk
description: An addressed synthetic-packet cabinet in the language of business correspondence.
colors:
  navy: "#183e60"
  ink: "#172e45"
  page: "#edf3f8"
  surface: "#fff"
  line: "#b9cbd9"
  nav: "#dce9f3"
  muted: "#46627a"
  input: "#7894aa"
  link: "#174e7e"
  primary: "#126653"
  hover: "#0b5343"
  focus: "#bd671a"
  error: "#942721"
  error-bg: "#fff0ee"
  selection: "#b7ded2"
  selection-ink: "#132f29"
typography:
  display:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-.025em"
  headline:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.4rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.1rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 650
    lineHeight: 1.55
  button:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 650
    lineHeight: 1.35
  caption:
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: ".9rem"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  control: "7px"
  letter: "12px"
spacing:
  control: ".7rem"
  control-x: "1rem"
  action-gap: ".65rem"
  inset: "1rem"
  gutter: "1.25rem"
  letter-inset: "1.7rem"
  stack: "1.5rem"
  section: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: ".65rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.navy}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: ".65rem 1rem"
  button-secondary-hover:
    backgroundColor: "{colors.nav}"
  input-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "{spacing.control}"
    width: "100%"
  navigation-current:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.navy}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: ".65rem 1rem"
  packet-link-current:
    backgroundColor: "{colors.nav}"
    textColor: "{colors.navy}"
    typography: "{typography.button}"
    rounded: "0"
    padding: ".55rem .7rem"
    width: "100%"
  letter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.letter}"
    padding: "{spacing.letter-inset}"
  notice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "{spacing.inset}"
  error:
    backgroundColor: "{colors.error-bg}"
    textColor: "{colors.error}"
    rounded: "{rounded.control}"
    padding: "{spacing.inset}"
---

# Design System: QabylDesk

## Overview

**Creative North Star: "Кабинет как деловая переписка"**

QabylDesk presents addressed authored packets as readable business correspondence. The owner-confirmed form uses the inherited owned cabinet identity: a navy account frame, pale ground, ink text, white native fields and a green explicit action. This is a working cabinet with quiet separators and direct labels.

Its signature is the relationship between an index and a letter-like article. The recipient reads the authored sections before reaching the manual account note. Administrative forms and native disclosures use the same material. The typography, status language and restrained surfaces keep the packet, its version and the account action distinguishable.

**Key Characteristics:**

- Native controls and system typography, inherited by explicit direction.
- A navy identity frame above pale ground and white working surfaces.
- A readable index/article relationship with ruled metadata.
- Green explicit actions, orange keyboard focus and textual status.
- RU/KK text that wraps without ornamental mail imagery.

## Colors

The palette combines cool administrative surfaces with a restrained green action color; the frontmatter preserves the actual CSS custom-property values.

### Primary

- **Cabinet Navy** (`navy`): header, brand context, secondary control text and control borders.
- **Action Green** (`primary`): the primary button and status text; **Action Green Hover** (`hover`) is its hover fill.
- **Link Blue** (`link`): underlined text links.

### Neutral

- **Pale Ground** (`page`): the page and scrollbar track.
- **White Working Surface** (`surface`): letters, controls, notices and active navigation; also inverse header and primary-action text.
- **Body Ink** (`ink`): reading and form text.
- **Quiet Blue Ink** (`muted`): helper text, list metadata, empty/busy states and footer.
- **Blue Rule** (`line`): separators, article outlines and active-navigation borders.
- **Navigation Wash** (`nav`): navigation ground, selected packet, secondary-button hover and JSON disclosure surface.
- **Field Stroke** (`input`): native field borders and scrollbar thumb.

The remaining colors carry functional feedback: **Keyboard Orange** (`focus`) is the focus outline; **Error Ink** and **Error Wash** (`error`, `error-bg`) mark errors; **Selected Text Green** and **Selected Text Ink** (`selection`, `selection-ink`) style browser text selection. These are state colors, rather than additional decorative accents.

**The State Has Words Rule.** Color accompanies an explicit status, field label or action label. A green status remains text, without an invented badge or icon vocabulary.

## Typography

**Display and Body Font:** the frontmatter's native system stack. There is no external font asset. Display, headline and title map to native h1, h2 and h3; their bold weight is the browser's ordinary heading default. Labels and buttons use the authored semibold weight. The brand has its own small wordmark treatment (1.4rem, weight 740), rather than a large display face.

### Hierarchy

- **Display:** page identity; at the mobile breakpoint its size becomes 1.75rem.
- **Headline:** article, form and major working-section headings.
- **Title:** authored packet sections and compact administrative subsections.
- **Body:** readable instructions, authored RU/KK text and field contents.
- **Label:** visible field names and definition-list labels.
- **Button:** explicit control labels with a tighter line height.
- **Caption:** helper copy and letter metadata. Packet-index small text retains the native `small` size and has an authored line height of 1.5; JSON uses the native monospace face at .85rem.

Reading paragraphs have a maximum measure of 75ch; authored letter text uses 72ch and preserves authored line breaks. Headings and text wrap long content. Heading balance is authored CSS, not a guarantee of an identical line break across browsers.

**The Native Voice Rule.** Extend the confirmed native cabinet typography; the system face is an inherited product decision, rather than a proposed display identity.

## Layout

The main area and footer have a centered maximum width of 1280px, with the frontmatter gutter on each side. The header aligns its contents through `max(1.25rem, calc((100vw - 1240px)/2))`. Header and navigation use wrapping flex rows; action groups also wrap.

The correspondence grid is `minmax(15rem, .8fr) minmax(0, 2fr)` with a section-sized gap and top alignment. Lists are plain ruled rows, not a grid of cards. Forms have a maximum width of 50rem; the login region is narrower at 38rem. Paired administrative fields use two equal columns.

At `max-width: 760px`, correspondence and paired fields become one column, the index precedes the article, metadata becomes a single column, page side gutters become 1rem, and letter padding becomes 1.2rem. The mobile main margin and correspondence gap become 1.5rem. These are source breakpoints, not a claim that this documentation pass exercised a viewport.

The rhythm combines control insets, a wrapping action gap, ruled list rows and larger separation between working sections. Interactive buttons and fields have a minimum height of 44px. Summary rows also have a 44px minimum height. Long labels wrap.

## Elevation & Depth

No custom box-shadow is declared. Depth comes from the navy frame, pale ground, white surfaces, selected navigation wash and thin outlines. Error surfaces receive a semantic wash and border; a focused control receives an outline rather than elevation. Native browser affordances remain part of the chosen material.

**The Flat Working Surface Rule.** Preserve the built tonal and ruled separation when adding cabinet surfaces; the white article does not require a simulated sheet, stamp or lifted shadow.

## Shapes

Controls, notices, fieldsets and JSON blocks share the control radius. The larger letter radius distinguishes the reading surface. Packet selectors remain square, borderless rows; their selected state is a wash with a small horizontal inset. One-pixel rules define lists and disclosures. Fields remain native input, select and textarea elements; textareas resize vertically and start at a minimum height of 8rem.

## Components

### Buttons

Compact native actions use the frontmatter's primary and secondary variants. The primary fill changes to the darker green on hover; the secondary fill changes to the navigation wash. Both retain the authored one-pixel border and 44px minimum height. Disabled buttons use opacity .6 and the default cursor. No custom pressed animation is authored.

### Inputs / Fields

White full-width controls use the field-stroke border, body typography and control radius. Labels are visible above the field; helper copy follows it. Textareas support authored multi-line text. The retained-note copy area reuses a read-only textarea rather than a new visual component.

### Navigation

The account header names the current identity and role. A pale horizontal navigation band contains wrapping native buttons. The current administrative destination uses `aria-current="page"`, a white fill and rule-colored border; ordinary navigation buttons have transparent fill and border. Refresh and logout remain explicit labeled actions. The working/history switch uses ordinary buttons with `aria-pressed`; no separate selected-pressed style is authored.

### Packet Index

Ruled list rows contain left-aligned full-width button labels followed by muted metadata. The selected packet uses `aria-current="true"` and the navigation wash. The same pattern supports the administrative working/history views. Status remains readable text, not a colored chip.

### Letter / Metadata

The white outlined article carries the packet heading, textual status, a ruled definition-list metadata area, a native language selector and authored sections. Content version and issue version have separate labels. A ruled manual-note section follows the authored body. A static example may illustrate this structure, but does not simulate a live account or a saved action.

### Notices / Errors

A neutral notice is a white outlined block. An error uses the semantic error ink, wash and border. In the application, these regions carry status/alert semantics; newly reported messages may receive focus. The shared focus treatment is a 3px orange outline with a 3px offset, including links, buttons, fields, summaries and focusable message containers.

### Disclosures

Native details/summary rows reveal administrative snapshots and history. Summary is semibold with a minimum interactive height; opened JSON is wrapped, scrollable and capped at 32rem in height. Preserve native disclosure behavior and its browser marker.

Motion is limited to background/color transitions on buttons and links (.15s ease-out), enabled only under `prefers-reduced-motion: no-preference`.

## Do's and Don'ts

### Do:

- **Do** preserve the navy account frame, pale ground and white working surfaces.
- **Do** keep the index/article relationship, collapsing to index first at the authored breakpoint.
- **Do** use visible native labels, wrapping actions and the shared orange focus outline.
- **Do** distinguish metadata from authored text and place the manual-note section after the text.
- **Do** reuse plain textual statuses and explicit working/history navigation.

### Don't:

- **Don't** introduce email-client chrome, envelopes, stamps or chat bubbles into the confirmed correspondence form.
- **Don't** replace the confirmed native typography and controls with a marketing hero or decorative display system.
- **Don't** introduce fictional inbox counts, delivery/read receipts or legal-signature imagery.
- **Don't** turn a static component example into evidence of a live account, persisted action or tested interaction.

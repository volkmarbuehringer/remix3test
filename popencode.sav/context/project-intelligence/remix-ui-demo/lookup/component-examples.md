---
title: Component Examples
description: All 28 discovered examples with slug, title, description, and directory
category: project-intelligence
type: lookup
source: app/examples/components/, app/examples/foundations/, app/examples/theme/, app/examples/ui-tokens/, app/examples/index.tsx
---

# Component Examples

## Core Concept

28 examples are auto-discovered from 4 directories under `app/examples/`. Each has metadata in `EXAMPLE_COPY_BY_SLUG` and is accessible at `/examples/:slug`.

## Components (13 examples)

Directory: `app/examples/components/`

| Slug | Title | Description |
|------|-------|-------------|
| `accordion-overview` | Accordion overview | Default Accordion behavior and shared visual tokens |
| `accordion-card` | Accordion in a card | Accordion inside another shared surface |
| `accordion-multiple` | Accordion multiple mode | Multiple mode with per-item disabled state |
| `anchor` | Anchor utility | Anchor utility |
| `breadcrumbs-basic` | Breadcrumbs basic | Thin convenience component for common markup |
| `breadcrumbs-separator` | Breadcrumbs custom separator | Custom visual language without losing convenience |
| `combobox-overview` | Combobox overview | Input-first popup-backed value picker |
| `listbox-overview` | Listbox overview | Headless value-picker surface |
| `menu-button-overview` | Menu button overview | Action-oriented popup with menu semantics |
| `menu-button-bubbling` | Item and parent events | `onMenuSelect(...)` action handling at multiple levels |
| `popover-overview` | Popover overview | Low-level popover primitive for anchored panels |
| `select-overview` | Select overview | Single-select popup with trigger and hidden input |
| `select-deconstructed` | Select deconstructed | Composing select from individual Context/Style exports |

## Foundations (4 examples)

Directory: `app/examples/foundations/`

| Slug | Title | Description |
|------|-------|-------------|
| `start-here-theme` | Theme values | Shared value contract for spacing, color, typography |
| `start-here-ui` | Component building blocks | Context, mixins, *Style exports, and convenience wrappers |
| `install-theme` | Installing a theme | Render theme and glyph sheet once in the document |
| `create-theme-local` | Local theme preview | Create scoped theme from local values object |

## Theme (5 examples)

Directory: `app/examples/theme/`

| Slug | Title | Description |
|------|-------|-------------|
| `theme-surface-stack` (was `surface-stack`) | Surface stack | Surface scale for visible hierarchy without hand-picked fills |
| `theme-space-rhythm` (was `space-rhythm`) | Space rhythm | Shared rhythm behind padding, gaps, and dense layout |
| `theme-typography-scale` (was `typography-scale`) | Typography scale | Type tokens for hierarchy and density |
| `theme-color-roles` (was `color-roles`) | Color roles | Semantic colors so text and actions feel related |
| `theme-control-sizes` (was `control-sizes`) | Control sizes | Align buttons, fields, menus, and compact interactions |

## UI Tokens (6 examples)

Directory: `app/examples/ui-tokens/`

| Slug | Title | Description |
|------|-------|-------------|
| `button-aliases` | Button wrapper | Fast path to ordinary actions |
| `button-base-tone` | Base and tone | Composable button model with visible base and tone |
| `button-slots-states` | Button slots and states | Button slots and states |
| `listbox-contract` | Listbox tokens | Popup value-control contract without shared card/text layer |
| `menu-contract` | Menu tokens | Own styling contract decoupled from listbox/popover |
| `popover-contract` | Popover surface | Popup surface token separate from higher-level behavior |

## References

- `app/examples/index.tsx` — `EXAMPLE_COPY_BY_SLUG` with all metadata
- `app/examples/discovery.ts` — Filesystem discovery logic and slug generation

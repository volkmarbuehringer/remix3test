---
name: remix3-theme-conformance
description: "Use when styling a remix3 app with theme tokens — raw `var(--rmx-...)` strings, bare variable names, a `*.background` token used as text, or a token missing from the contract tree (resolves to `undefined`) silently break light/dark contrast."
origin: consolidated
---

# Remix 3 Theme Conformance

**Consolidated from:** `remix3-theme-object-conformance`, `remix3-theme-css-variable-prefix`

This skill is the **index** for theme-token conformance — styling must go through the typed `theme` object, and the CSS variables it resolves to use the `--rmx-` prefix. Read only the reference you need.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Understanding the six ways styling drifts, or the app's theme files | `references/failure-modes.md` |
| Choosing/importing a token, or a token that does not exist yet | `references/token-rules.md` |
| A low-contrast or invisible label, badge, glyph, or destructive-outline button | `references/contrast-verification.md` |
| Building style strings by hand in `clientEntry` / browser DOM code (incl. `var(${theme.…})` re-wrapping) | `references/cliententry-dom-styling.md` |
| What `npm run lint` enforces, a past incident with measured light/dark ratios, or the `theme.<group>.<key>` to `--rmx-*` variable-name mapping | `references/metadata.md` |

## Core Rules

- **Always** reference tokens through the typed `theme` object (`app/ui/theme/theme.ts`); **never** write `var(--rmx-...)` literals or bare token names. `theme.*` leaves are already `var(--rmx-...)` strings.
- **Never** hardcode colors, borders, shadows, or spacing that a token covers.
- **Never re-wrap a token**: `var(${theme.…})` becomes `var(var(--rmx-…))`, which drops the whole declaration (and `element.style.x` rejects it outright).
- **Fill vs. ink:** use `theme.colors.<group>.background` only as a surface fill paired with `.foreground`; use `.foreground` for accent text, glyphs, or a border. `*.background` passes `tsc` and lint even in the wrong role.
- **Verify contrast by measurement, not lint**: toggle `data-theme="dark"` on `<html>` and read `getComputedStyle`; both gates are blind to contrast.
- **Missing token:** add the key to the contract tree (`app/ui/theme/contract.ts`), add matching values to both `Theme` and `DarkTheme` (`app/theme.tsx`), then reference it — never hardcode a fallback.
- **The contract is the source of truth**: a value defined in `app/theme.tsx` but absent from the contract resolves to `undefined` and its declarations are silently dropped — check `contract.ts`, not just `app/theme.tsx`.
- **Enforcement:** `scripts/check-theme-conformance.ts` (wired into `npm run lint`) fails on `var(--rmx-` in `app/` outside `app/ui/theme/` and `app/theme.tsx`.

## When to Use

- Writing inline styles in `clientEntry` (client-side JavaScript, no React)
- Rendering DOM elements with CSS variable references in a Remix 3 app
- Debugging invisible text or low-contrast UI in light or dark mode
- Adding/reviewing a status badge, accent glyph, or colored text (check `.background` vs `.foreground`)
- Adding new UI components that need to be theme-aware
- Adding a token that a component needs but the theme doesn't define yet
- A `theme.<group>.<key>` value is `undefined`, or a style silently does nothing (check `contract.ts`, not just `app/theme.tsx`)
- Reviewing a coloured label or destructive-outline button for dark-mode contrast

## Related Skills

- `remix3-theme-glyph-add` — adding a glyph to the theme contract and preset in sync

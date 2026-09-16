---
name: remix3-theme-conformance
description: "Use when styling a remix3 app with theme tokens — raw `var(--rmx-...)` strings, bare variable names, a `*.background` token used as text, or a token missing from the contract tree (resolves to `undefined`) silently break light/dark contrast."
origin: consolidated
---

# Remix 3 Theme Conformance

**Consolidated from:** `remix3-theme-object-conformance`, `remix3-theme-css-variable-prefix`

Covers one discipline with two failure modes: styling must go through the typed theme object, and the CSS variables it resolves to use the `--rmx-` prefix. Both skills described the same underlying rule from different angles; this is the merged reference.

The app's theme system: `app/ui/theme/contract.ts` (typed token tree), `app/ui/theme/theme.ts` (the `theme` object), `app/theme.tsx` (light `Theme` + dark `DarkTheme` values). The contract maps token keys to `--rmx-*` CSS variable names.

## Problem

Styling drifts out of the theme in six ways, all of which skip the contract and break dark mode:

1. **Raw `var(--rmx-...)` strings** in `css()` mixins or inline style strings. The variable name is typed as a plain string, so misspelled or removed tokens are never caught at build time.
2. **Hardcoded hex/rgba values** (e.g. `#3b82f6`, `#dc3545`) instead of theme tokens. These ignore both light and dark presets and rot when the theme changes.
3. **Bare variable names with fallbacks** — `var(--surface-lvl1, #f5f5f5)` never resolves because the theme defines `--rmx-surface-lvl1`, not `--surface-lvl1`. The light-mode fallback kicks in **in all themes**, producing invisible/low-contrast text in dark mode (`data-theme="dark"` on `<html>`).
4. **Raw variables that don't exist in the theme at all** (e.g. `var(--rmx-color-success, #28a745)`). The theme never defines `--rmx-color-success`, so the fallback hex is always used — the "theme-aware" code is actually hardcoded.
5. **A `*.background` fill token used as a text `color`.** `success.background` / `warning.background` are pale tints in light mode and near-black in dark mode, so as ink they are invisible in **both** themes; `danger.background` reads acceptably as a border or icon fill but fails AA as normal-size text in dark mode (see below), so the bug is easy to inherit from danger styling. Both `tsc` and `check-theme-conformance` pass it.
6. **A token defined in the theme values but missing from the contract tree resolves to `undefined`.** `app/theme.tsx`'s `lightSurface` / `darkSurface` define `dangerBg` / `dangerText` / `dangerBorder` (and the `success*` trio), but `themeVariableNames.surface` in `app/ui/theme/contract.ts` declares only `lvl0`–`lvl4`. `createTheme` emits only contract keys, so `--rmx-surface-danger-bg` is never written, `theme.surface.dangerText` is `undefined`, and every declaration that uses it is dropped — including the flash banners in `app/ui/layout.tsx`, `app/ui/verwaltung-layout.tsx`, `app/ui/sidebar-layout.tsx` and `app/ui/toast.ts`.

## Rules

- **Always** import the typed object and reference tokens by key:
  ```ts
  import { theme } from 'app/ui/theme/theme.ts'
  // theme.surface.lvl1 === 'var(--rmx-surface-lvl1)'  (the leaf is already a var(...) reference)
  // theme.colors.text.muted === 'var(--rmx-color-text-muted)'
  // theme.colors.action.primary.background === 'var(--rmx-color-action-primary-background)'
  ```
- **Never** write `var(--rmx-...)` literals or bare token names. `theme.*` leaves are typed as **`var(--rmx-...)` strings** (`createThemeContract` wraps each variable name), so interpolating `${theme.colors.border.default}` is exactly equivalent to the old literal minus any fallback.
- **Never** hardcode colors, borders, shadows, or spacing values that a token covers.
- **Fill vs. ink:** use `theme.colors.<group>.background` only as a surface fill, paired with `.foreground` text. For accent text, glyphs, or a border, use `.foreground`.

### `*.background` is a fill, not a text color

The `success` / `warning` / `danger` groups pair a fill with the readable on-fill color — the actual light/dark hex values live in `app/theme.tsx` (`Theme`/`DarkTheme`). The pattern to remember: `success.background` is a pale tint in light mode and near-black in dark mode, so as ink it is invisible in **both** themes; `danger.background` reads acceptably as a **border or icon fill** (≈4.6:1 light, ≈3.1:1 dark — the 3:1 non-text threshold), but as **normal-size text** it fails WCAG AA in dark mode (measured ≈3.05:1 on `#363a3e`), so it is not a safe shortcut for a danger label.

```ts
// BAD — pale fill used as ink: measured rgb(240 253 244) on rgb(247 251 255) ≈ 1.02:1
css({ color: theme.colors.success.background })

// GOOD — accent text / glyph
css({ color: theme.colors.success.foreground })
// GOOD — fill plus matching ink
css({ background: theme.colors.success.background, color: theme.colors.success.foreground })
```

`tsc` accepts any real token key and `check-theme-conformance` only scans for raw `var(--rmx-` literals, so role confusion passes every automated gate. After adding a status badge or accent glyph, grep for `color: theme.colors.[a-z]+.background` or measure `getComputedStyle(el).color` against its background — do not trust lint for this.

### Verify contrast by measurement, not by lint

Both gates are blind to contrast. Toggle dark mode the way the app does — `data-theme="dark"` on `<html>`, **not** `prefers-color-scheme` — and read computed styles:

```js
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
getComputedStyle(el).color            // rendered ink
getComputedStyle(document.documentElement).getPropertyValue('--rmx-surface-danger-bg')
// '' ⇒ the variable was never emitted ⇒ theme.surface.dangerBg is undefined (failure mode 6)
```

A contract variable that reads back empty is the fastest confirmation of failure mode 6; a hardcoded hex shows up as the *same* `color` before and after the toggle.

### In clientEntry / browser DOM code

Stream files and other non-component DOM code build style strings by hand. Import `theme` and interpolate the token names — it is a plain frozen object of strings, safe to import client-side:

```ts
// GOOD
icon.style.color = theme.colors.action.primary.background
card.style.cssText = `border:1px solid ${theme.colors.border.default};background:${theme.surface.lvl1}`
```

This keeps type-checking (the key must exist on the contract) while still resolving per-theme.

#### Do not re-wrap the token (`var(${theme.…})`)

Because `theme.*` leaves already include `var(...)`, wrapping them again produces
`var(var(--rmx-…))`. The parser drops the **whole** declaration — assigning to
`element.style.x` rejects it outright — and the element silently falls back to
the cascade: no background, no border, inherited text colour. Two reasons it
survives review: the source contains no `var(--rmx-` literal, so
`check-theme-conformance` stays green, and the code *looks* like correct token
usage.

Recorded 2026-09-10: the uploads pending-file chips shipped like this —
`chipStyle` (`background`, `border`), `chipSizeStyle.color` and the chip remove
button's `color` in `app/actions/admin/public/admin-uploads-dropzone.tsx` were
all dead declarations, so the chips rendered as bare text with no pill chrome.
Now asserted against the resolved tokens in
`app/actions/admin/uploads/uploads-dropzone.test.e2e.ts`.

### When a token does not exist

If the required semantic color has no token, **add it to the theme** — do not hardcode a fallback:

1. Add the group/key to the contract tree in `app/ui/theme/contract.ts`.
2. Add matching values to both `Theme` and `DarkTheme` in `app/theme.tsx`.
3. Then reference `theme.colors.<group>.<key>`.

## Enforcement

`scripts/check-theme-conformance.ts` (wired into the `lint` npm script) fails when `var(--rmx-` appears in `app/` outside `app/ui/theme/` and `app/theme.tsx`. Run `npm run lint` after styling changes.

## Status / history

- 2026-09-16: `theme.surface.dangerBg` / `dangerText` / `dangerBorder` verified `undefined` at runtime (contract lists only `lvl0`–`lvl4`), so the flash-banner/toast status styling is currently a no-op; `danger.background` as a 12px label measured 4.64:1 light / 3.05:1 dark (AA fail), and a `dangerOutline` button tone hardcoded to `#dc2626` measured 2.37:1 dark before switching to the mode-aware action token.
- `app/assets/streams/*.browser.tsx` (7 files incl. `streams.test.browser.tsx`) and `app/ui/workflow-agent-page.tsx` + `app/ui/agent-events-page.tsx` previously used raw `var(--rmx-...)` strings (some orphans: `--rmx-color-success`, `--rmx-color-warning`, `--rmx-color-action-danger` without suffix) — converted to `theme.*` interpolation.
- `success` / `warning` token groups were added to `app/ui/theme/contract.ts` and to `Theme`/`DarkTheme` in `app/theme.tsx` (each with `background` / `backgroundHover` / `backgroundActive` / `foreground` / `border`), so status colors now track light/dark.
- An invisible-button-text bug in dark mode was caused by slot buttons using `var(--surface-lvl1, #f5f5f5)` — the bare name never resolved because the theme defines `--rmx-surface-lvl1`.
- `success.background` as a text color, twice: the admin-dashboard KPI value (`app/ui/admin-page.tsx`, ~1.05:1 in light mode — its inline comment is the canonical note) and the `/admin/lists` "Erledigt ✓" marker (`app/ui/admin-lists-page.tsx`, measured `rgb(240 253 244)` on `rgb(247 251 255)` ≈ 1.02:1). Both now use `success.foreground` (~7:1).

## Reference: key tokens

Every token key and its `--rmx-*` CSS variable name is defined in `app/ui/theme/contract.ts` (the typed tree) with the light/dark values in `app/theme.tsx`. Don't memorize the table — read `theme.*` from the contract. The naming rule is mechanical: `theme.colors.<group>.<key>` → `var(--rmx-color-<group>-<key>)`, `theme.surface.<n>` → `var(--rmx-surface-<n>)`, and the space/radius/fontSize/shadow groups → `var(--rmx-space-<k>)`, `var(--rmx-radius-<k>)`, `var(--rmx-font-size-<k>)`, `var(--rmx-shadow-<k>)`.

## When to Use

- Writing inline styles in `clientEntry` (client-side JavaScript, no React)
- Rendering DOM elements with CSS variable references in a Remix 3 app
- Debugging invisible text or low-contrast UI in light or dark mode
- Adding/reviewing a status badge, accent glyph, or colored text (check `.background` vs `.foreground`)
- Adding new UI components that need to be theme-aware
- Adding a token that a component needs but the theme doesn't define yet
- A `theme.<group>.<key>` value is `undefined`, or a style silently does nothing (check `contract.ts`, not just `app/theme.tsx`)
- Reviewing a coloured label or destructive-outline button for dark-mode contrast

---
name: remix3-theme-object-conformance
description: 'Always style through the typed theme object (theme.<group>.<token>); raw var(--rmx-...) strings and hardcoded hex silently skip the theme contract and break dark mode'
---

# Remix 3 Theme Object Conformance

**Context:** The app's theme system in `app/ui/theme/contract.ts` (typed token tree), `app/ui/theme/theme.ts` (the `theme` object), `app/theme.tsx` (light `Theme` + dark `DarkTheme` values). The contract maps token keys to `--rmx-*` CSS variable names.

## Problem

Styling drifts out of the theme in three ways, all of which skip the contract:

1. **Raw `var(--rmx-...)` strings** in `css()` mixins or inline style strings. The variable name is typed as a plain string, so misspelled or removed tokens are never caught at build time.
2. **Hardcoded hex/rgba values** (e.g. `#3b82f6`, `#dc3545`) instead of theme tokens. These ignore both light and dark presets and rot when the theme changes.
3. **Raw variables that don't exist in the theme at all** (e.g. `var(--rmx-color-success, #28a745)`). The theme never defines `--rmx-color-success`, so the fallback hex is always used — the "theme-aware" code is actually hardcoded.

## Rules

- **Always** import the typed object and reference tokens by key:
  ```ts
  import { theme } from 'app/ui/theme/theme.ts'
  // theme.surface.lvl1 === 'var(--rmx-surface-lvl1)'  (the leaf is already a var(...) reference)
  // theme.colors.text.muted === 'var(--rmx-color-text-muted)'
  // theme.colors.action.primary.background === 'var(--rmx-color-action-primary-background)'
  ```
- **Never** write `var(--rmx-...)` literals or bare token names. Note `theme.*` leaves are typed as **`var(--rmx-...)` strings** (`createThemeContract` wraps each variable name), so interpolating `${theme.colors.border.default}` is exactly equivalent to the old literal minus any fallback.
- **Never** hardcode colors, borders, shadows, or spacing values that a token covers.

### In clientEntry / browser DOM code

Stream files and other non-component DOM code build style strings by hand. Import `theme` and interpolate the token names — it is a plain frozen object of strings, safe to import client-side:

```ts
// GOOD
icon.style.color = theme.colors.action.primary.background
card.style.cssText = `border:1px solid ${theme.colors.border.default};background:${theme.surface.lvl1}`
```

This keeps type-checking (the key must exist on the contract) while still resolving per-theme.

### When a token does not exist

If the required semantic color has no token, **add it to the theme** — do not hardcode a fallback:

1. Add the group/key to the contract tree in `app/ui/theme/contract.ts`.
2. Add matching values to both `Theme` and `DarkTheme` in `app/theme.tsx`.
3. Then reference `theme.colors.<group>.<key>`.

## Enforcement

`scripts/check-theme-conformance.ts` (wired into the `lint` npm script) fails when `var(--rmx-` appears in `app/` outside `app/ui/theme/` and `app/theme.tsx`. Run `npm run lint` after styling changes.

## Status / history

- `app/assets/streams/*.browser.tsx` (7 files incl. `streams.test.browser.tsx`) and `app/ui/workflow-agent-page.tsx` + `app/ui/agent-events-page.tsx` previously used raw `var(--rmx-...)` strings (some orphans: `--rmx-color-success`, `--rmx-color-warning`, `--rmx-color-action-danger` without suffix) — converted to `theme.*` interpolation.
- `success` / `warning` token groups were added to `app/ui/theme/contract.ts` and to `Theme`/`DarkTheme` in `app/theme.tsx` (each with `background` / `backgroundHover` / `backgroundActive` / `foreground` / `border`), so status colors now track light/dark.

## Reference: key tokens

| `theme.*` key                          | Resolves to                     |
| -------------------------------------- | ------------------------------- |
| `theme.surface.lvl0` / `.lvl1`         | `var(--rmx-surface-lvl0)` / `-lvl1` |
| `theme.colors.text.primary`            | `var(--rmx-color-text-primary)`      |
| `theme.colors.text.secondary`          | `var(--rmx-color-text-secondary)`    |
| `theme.colors.text.muted`              | `var(--rmx-color-text-muted)`        |
| `theme.colors.border.subtle` / default | `var(--rmx-color-border-subtle/-default)` |
| `theme.colors.action.primary.*`        | `var(--rmx-color-action-primary-*)`  |
| `theme.colors.action.danger.*`         | `var(--rmx-color-action-danger-*)`   |
| `theme.colors.success.*`               | `var(--rmx-color-success-*)`         |
| `theme.colors.warning.*`               | `var(--rmx-color-warning-*)`         |
| `theme.colors.focus.ring`              | `var(--rmx-color-focus-ring)`        |
| `theme.space.md`, `theme.radius.md`, `theme.fontSize.sm`, `theme.shadow.md`, ... | `var(--rmx-space-md)`, `var(--rmx-radius-md)`, `var(--rmx-font-size-sm)`, `var(--rmx-shadow-md)`, ... |

## Related skills

- `remix3-theme-css-variable-prefix` — the token names use the `--rmx-` prefix; this skill supersedes raw-variable usage with the typed object.

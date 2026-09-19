# Theme Rules

**Source:** `remix3-theme-object-conformance`, `remix3-theme-css-variable-prefix`

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

## `*.background` is a fill, not a text color

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

## When a token does not exist

If the required semantic color has no token, **add it to the theme** — do not hardcode a fallback:

1. Add the group/key to the contract tree in `app/ui/theme/contract.ts`.
2. Add matching values to both `Theme` and `DarkTheme` in `app/theme.tsx`.
3. Then reference `theme.colors.<group>.<key>`.

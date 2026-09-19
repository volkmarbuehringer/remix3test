# Enforcement, Status, and Key Tokens

**Source:** `remix3-theme-object-conformance`, `remix3-theme-css-variable-prefix`

## Enforcement

`scripts/check-theme-conformance.ts` (wired into the `lint` npm script) fails when `var(--rmx-` appears in `app/` outside `app/ui/theme/` and `app/theme.tsx`. Run `npm run lint` after styling changes.

## Status / History

- 2026-09-16: `theme.surface.dangerBg` / `dangerText` / `dangerBorder` verified `undefined` at runtime (contract lists only `lvl0`–`lvl4`), so the flash-banner/toast status styling is currently a no-op; `danger.background` as a 12px label measured 4.64:1 light / 3.05:1 dark (AA fail), and a `dangerOutline` button tone hardcoded to `#dc2626` measured 2.37:1 dark before switching to the mode-aware action token.
- `app/assets/streams/*.browser.tsx` (7 files incl. `streams.test.browser.tsx`) and `app/ui/workflow-agent-page.tsx` + `app/ui/agent-events-page.tsx` previously used raw `var(--rmx-...)` strings (some orphans: `--rmx-color-success`, `--rmx-color-warning`, `--rmx-color-action-danger` without suffix) — converted to `theme.*` interpolation.
- `success` / `warning` token groups were added to `app/ui/theme/contract.ts` and to `Theme`/`DarkTheme` in `app/theme.tsx` (each with `background` / `backgroundHover` / `backgroundActive` / `foreground` / `border`), so status colors now track light/dark.
- An invisible-button-text bug in dark mode was caused by slot buttons using `var(--surface-lvl1, #f5f5f5)` — the bare name never resolved because the theme defines `--rmx-surface-lvl1`.
- `success.background` as a text color, twice: the admin-dashboard KPI value (`app/ui/admin-page.tsx`, ~1.05:1 in light mode — its inline comment is the canonical note) and the `/admin/lists` "Erledigt ✓" marker (`app/ui/admin-lists-page.tsx`, measured `rgb(240 253 244)` on `rgb(247 251 255)` ≈ 1.02:1). Both now use `success.foreground` (~7:1).

## Reference: Key Tokens

Every token key and its `--rmx-*` CSS variable name is defined in `app/ui/theme/contract.ts` (the typed tree) with the light/dark values in `app/theme.tsx`. Don't memorize the table — read `theme.*` from the contract. The naming rule is mechanical: `theme.colors.<group>.<key>` → `var(--rmx-color-<group>-<key>)`, `theme.surface.<n>` → `var(--rmx-surface-<n>)`, and the space/radius/fontSize/shadow groups → `var(--rmx-space-<k>)`, `var(--rmx-radius-<k>)`, `var(--rmx-font-size-<k>)`, `var(--rmx-shadow-<k>)`.

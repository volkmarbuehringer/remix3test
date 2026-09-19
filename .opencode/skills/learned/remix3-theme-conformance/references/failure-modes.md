# Theme System and Failure Modes

**Source:** `remix3-theme-object-conformance`, `remix3-theme-css-variable-prefix`

Covers one discipline with two failure modes: styling must go through the typed theme object, and the CSS variables it resolves to use the `--rmx-` prefix. Both skills described the same underlying rule from different angles; this is the merged reference.

The app's theme system: `app/ui/theme/contract.ts` (typed token tree), `app/ui/theme/theme.ts` (the `theme` object), `app/theme.tsx` (light `Theme` + dark `DarkTheme` values). The contract maps token keys to `--rmx-*` CSS variable names.

Styling drifts out of the theme in six ways, all of which skip the contract and break dark mode:

1. **Raw `var(--rmx-...)` strings** in `css()` mixins or inline style strings. The variable name is typed as a plain string, so misspelled or removed tokens are never caught at build time.
2. **Hardcoded hex/rgba values** (e.g. `#3b82f6`, `#dc3545`) instead of theme tokens. These ignore both light and dark presets and rot when the theme changes.
3. **Bare variable names with fallbacks** — `var(--surface-lvl1, #f5f5f5)` never resolves because the theme defines `--rmx-surface-lvl1`, not `--surface-lvl1`. The light-mode fallback kicks in **in all themes**, producing invisible/low-contrast text in dark mode (`data-theme="dark"` on `<html>`).
4. **Raw variables that don't exist in the theme at all** (e.g. `var(--rmx-color-success, #28a745)`). The theme never defines `--rmx-color-success`, so the fallback hex is always used — the "theme-aware" code is actually hardcoded.
5. **A `*.background` fill token used as a text `color`.** `success.background` / `warning.background` are pale tints in light mode and near-black in dark mode, so as ink they are invisible in **both** themes; `danger.background` reads acceptably as a border or icon fill but fails AA as normal-size text in dark mode (see below), so the bug is easy to inherit from danger styling. Both `tsc` and `check-theme-conformance` pass it.
6. **A token defined in the theme values but missing from the contract tree resolves to `undefined`.** `app/theme.tsx`'s `lightSurface` / `darkSurface` define `dangerBg` / `dangerText` / `dangerBorder` (and the `success*` trio), but `themeVariableNames.surface` in `app/ui/theme/contract.ts` declares only `lvl0`–`lvl4`. `createTheme` emits only contract keys, so `--rmx-surface-danger-bg` is never written, `theme.surface.dangerText` is `undefined`, and every declaration that uses it is dropped — including the flash banners in `app/ui/layout.tsx`, `app/ui/verwaltung-layout.tsx`, `app/ui/sidebar-layout.tsx` and `app/ui/toast.ts`.

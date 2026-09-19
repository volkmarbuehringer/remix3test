# Verify Contrast by Measurement, Not by Lint

**Source:** `remix3-theme-object-conformance`, `remix3-theme-css-variable-prefix`

Both gates are blind to contrast. Toggle dark mode the way the app does — `data-theme="dark"` on `<html>`, **not** `prefers-color-scheme` — and read computed styles:

```js
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
getComputedStyle(el).color            // rendered ink
getComputedStyle(document.documentElement).getPropertyValue('--rmx-surface-danger-bg')
// '' ⇒ the variable was never emitted ⇒ theme.surface.dangerBg is undefined (failure mode 6)
```

A contract variable that reads back empty is the fastest confirmation of failure mode 6; a hardcoded hex shows up as the *same* `color` before and after the toggle.

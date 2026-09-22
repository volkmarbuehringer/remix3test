# Verify Contrast by Measurement, Not by Lint

**Source:** `remix3-theme-object-conformance`, `remix3-theme-css-variable-prefix`

Both gates are blind to contrast. The app toggles dark mode by setting `data-theme="dark"` on `<html>`, so set the attribute directly to *force* a theme. Since the head bootstrap in `app/ui/document.tsx` also derives the attribute from `prefers-color-scheme` when no explicit choice is stored, emulating OS dark (`newContext({ colorScheme: 'dark' })`) **does** render dark on a clean profile; an explicit `localStorage.theme` / `theme` cookie wins over it. To force light on an OS-dark machine in a probe, seed `localStorage.theme = 'light'` before load. Then read computed styles:

```js
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
getComputedStyle(el).color            // rendered ink
getComputedStyle(document.documentElement).getPropertyValue('--rmx-surface-danger-bg')
// '' ⇒ the variable was never emitted ⇒ theme.surface.dangerBg is undefined (failure mode 6)
```

A contract variable that reads back empty is the fastest confirmation of failure mode 6; a hardcoded hex shows up as the *same* `color` before and after the toggle.

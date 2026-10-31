# Verify Contrast by Measurement, Not by Lint

**Source:** `remix3-theme-object-conformance`, `remix3-theme-css-variable-prefix`

Both gates are blind to contrast. The app toggles dark mode by setting `data-theme="dark"` on `<html>`, so set the attribute directly to *force* a theme. Since the head bootstrap in `app/ui/theme-bootstrap.ts` also derives the attribute from `prefers-color-scheme` when no explicit choice is stored, emulating OS dark (`newContext({ colorScheme: 'dark' })`) **does** render dark on a clean profile; an explicit `localStorage.theme` / `theme` cookie wins over it. To force light on an OS-dark machine in a probe, seed `localStorage.theme = 'light'` before load; explicit light now writes `data-theme="light"` (it no longer removes the attribute). Then read computed styles:

```js
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
getComputedStyle(el).color            // rendered ink
getComputedStyle(document.documentElement).getPropertyValue('--rmx-surface-danger-bg')
// '' ⇒ the variable was never emitted ⇒ theme.surface.dangerBg is undefined (failure mode 6)
```

A contract variable that reads back empty is the fastest confirmation of failure mode 6; a hardcoded hex shows up as the *same* `color` before and after the toggle.

### Composite ink alpha and `opacity` before trusting the ratio

`getComputedStyle(el).color` is not the colour the user sees: it can carry alpha
(`rgba(255,255,255,0.92)`) and the element or an ancestor can set `opacity` (the
active kind-count badge uses `opacity: 0.85`). On `/admin/uploads` (2026-10-24)
comparing the raw colour to the background reported **4.76:1** for a badge whose
rendered pixels were **3.95:1** — below the 4.5:1 small-text minimum. Blend the ink
(its own alpha × every ancestor's `opacity`) over the first opaque background, then
compute the WCAG ratio from the composited colour:

```js
const parseColor = (c) => {
  let [r, g, b, a = 1] = (c.match(/[\d.]+/g) ?? []).map(Number)
  return { r, g, b, a }
}
let opacity = 1
for (let n = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity || 1)

let bgEl = el
while (bgEl && parseColor(getComputedStyle(bgEl).backgroundColor).a === 0) bgEl = bgEl.parentElement
const bg = parseColor(getComputedStyle(bgEl ?? document.body).backgroundColor)
const ink = parseColor(getComputedStyle(el).color)
ink.a *= opacity
const fg = {
  r: ink.r * ink.a + bg.r * (1 - ink.a),
  g: ink.g * ink.a + bg.g * (1 - ink.a),
  b: ink.b * ink.a + bg.b * (1 - ink.a),
}
// ratio(fg, bg) with the usual WCAG relative-luminance formula
```

Reference values from that run: inactive count badge **5.51 light / 5.76 dark**,
current page **6.73 / 4.76**, active count badge **5.40 / 3.95**. Disabled controls
(the upload button at `opacity: 0.6`) are exempt from the 4.5:1 minimum — exclude
them rather than "fixing" their ratio.

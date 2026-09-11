---
name: remix3-css-override-cascade-layer
description: "Use when a remix/remix-ui `css()` override silently loses (double borders, wrong divider colour, `& > *` rules ignored) while siblings apply — rules live in per-class `@layer rmx.*` sub-layers."
metadata:
  origin: auto-extracted
---

# remix3 CSS: overrides that lose inside the `rmx` cascade layer

**Extracted:** 2026-09-10
**Context:** Joined segmented button groups (period/status switchers on `/verwaltung/appointments`, `/verwaltung/offerings`, `/appointments/new`) rendered with a doubled divider and the vendor button's border colour instead of the theme token. Every segment was wrapped in `css({ '& button': { borderRight: … } })`; the radii and padding from that same block applied, the `border-*` declarations did not.

## Mechanism

`remix/ui` puts **every** `css(...)` rule into a cascade layer, one sub-layer per generated class:

```css
@layer rmx.rmxc-13464qnk3l09y {
  .rmxc-13464qnk3l09y { … }
  & button { border-right: 1px solid var(--rmx-color-border-default); }
}
```

The vendor README documents the top-level contract (`node_modules/remix/src/ui/README.md`, "Cascade Layers": *"Remix UI emits generated css(...) rules under the rmx cascade layer. Unlayered CSS outranks layered CSS, so use explicit layer order when mixing Remix UI with global styles."*) and this app pins the order in `app/ui/theme/runtime.ts` + `app/ui/theme/layers.ts`:

```css
@layer rmx-reset, rmx;
```

Inside a layer, **sub-layer order decides, and specificity is irrelevant** — and which sub-layer is declared last depends on the order classes happen to be registered while rendering, so the same override can win on one element and lose on its sibling (the *active* primary-tone segment is the usual casualty). Consequences:

- A rule nested under a wrapper (`& button`, `& > *`) lives in the *wrapper's* sub-layer. Whether that beats the button mixin's own sub-layer is a coin flip per render.
- Properties the competing mixin never sets (padding, `border-radius`, `opacity`) apply normally — which is what makes this so confusing: part of the block visibly works.
- Unlayered stylesheet rules beat every `rmx.*` sub-layer, so a global stylesheet is the nuclear option.

## Fix patterns

1. **Override on the target element, after the mixin, with `!important` for contested properties** (used for the segmented groups — `app/ui/mixins/segmented.ts`):

```tsx
<button mix={[button({ tone }), segmentedButton({ isFirst, isLast })]}>
```
```ts
// segmented.ts — the class is on the button, after the mixin, and the
// declarations the mixin also sets carry !important.
borderLeft: isFirst ? undefined : '0 !important',
borderRight: isLast ? undefined : `1px solid ${theme.colors.border.default} !important`,
```
`!important` beats the mixin's non-important `border` shorthand deterministically; the layer order does not matter. The app already uses this escape hatch for vendor styles it cannot out-specify (`app/ui/main-nav.tsx`, `app/ui/appointment-grid-styles.ts`).

2. **Re-render the markup with app classes** instead of restyling the vendor component — the pattern the app chose for breadcrumbs (`app/ui/breadcrumbs.tsx` explains why: the vendor component hardcodes `light-dark(...)` values that ignore `data-theme`, and its layers make overrides unreliable).

3. **Use a later/global layer** only for genuinely global needs: declare a layer after `rmx` (e.g. `@layer rmx-reset, rmx, app;`) and put raw CSS there. Keep `var(--rmx-…)` out of source (theme-conformance lint) — interpolate `theme.*` tokens instead.

## Verifying (styles are not in `document.styleSheets`)

The generated rules live in an adopted stylesheet plus a sheet whose `cssRules` access throws, so `document.styleSheets` iteration shows nothing and is misleading (see the sibling delta `remix3-css-hover-reveal`). Use CDP:

```js
const cdp = await context.newCDPSession(page)
await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.wrapper button' })
const matched = await cdp.send('CSS.getMatchedStylesForNode', { nodeId })
// rule.selectorList.text is the *nested* text ('& button'); rule.layerName is null
```
Then confirm with `getComputedStyle` — a declaration that lost the layer contest is simply absent from the computed value, and longhands expanded from a `var()` shorthand report `<empty>` in `cssProperties` even when the declaration is valid.

## Related

- `remix3-css-hover-reveal` — the same runtime silently dropping nested selectors wholesale.
- `remix3-theme-conformance` — token usage rules that apply to whichever fix you pick.

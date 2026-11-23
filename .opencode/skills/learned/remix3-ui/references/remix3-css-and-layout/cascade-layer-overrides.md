# remix3 CSS: overrides that lose inside the `rmx` cascade layer

**Source:** `remix3-css-override-cascade-layer`

**Extracted:** 2026-09-10
**Revalidated:** 2026-11-19 against source `9e4da4d3` (`@remix-run/component` 1.3.0). The mechanism is unchanged: `src/style/stylesheet.ts:188` inserts `@layer ${REMIX_UI_STYLE_LAYER}.${className} { … }` per style, and SSR `src/server/stream.ts:1634` wraps each collected rule the same way, in `styleCache` insertion (= render) order. Guide 04 §"Styling with css and dynamic style values" now states the same rule (source `9e4da4d3`, #12352) and adds the parent→child consequence below.
**Context:** Joined segmented button groups (period/status switchers on `/verwaltung/appointments`, `/verwaltung/offerings`, `/appointments/new`) rendered with a doubled divider and the vendor button's border colour instead of the theme token. Every segment was wrapped in `css({ '& button': { borderRight: … } })`; the radii and padding from that same block applied, the `border-*` declarations did not.

## Mechanism

`remix/component` puts **every** `css(...)` rule into a cascade layer, one sub-layer per generated class:

```css
@layer rmx.rmxc-13464qnk3l09y {
  .rmxc-13464qnk3l09y { … }
  & button { border-right: 1px solid var(--rmx-color-border-default); }
}
```

The vendor README documents the top-level contract (`node_modules/remix/src/component/README.md`, "Cascade Layers": *"Remix UI emits generated css(...) rules under the rmx cascade layer. Unlayered CSS outranks layered CSS, so use explicit layer order when mixing Remix UI with global styles."*) and this app pins the order in `app/ui/theme/runtime.ts` + `app/ui/theme/layers.ts`:

```css
@layer rmx-reset, rmx;
```

Guide 04 (§"Styling with css and dynamic style values", source `d1061933` / #12352) now states the same rule for app authors: each `css(...)` style gets its own layer, a parent's style is usually inserted before its children's, and a nested selector in the parent (`"&:hover .title"`) cannot override a property the child's own style sets — put the state selector in the child's style. This is the guide-level confirmation of the mechanism below; the app's `lists-view.tsx` row hover predates it and uses `!important` (so does `admin-table.ts` `floatingRowReveal`).

Inside a layer, **sub-layer order decides, and specificity is irrelevant** — and which sub-layer is declared last depends on the order classes happen to be registered while rendering, so the same override can win on one element and lose on its sibling (the *active* primary-tone segment is the usual casualty). Consequences:

- A rule nested under a wrapper (`& button`, `& > *`) lives in the *wrapper's* sub-layer. Whether that beats the button mixin's own sub-layer is a coin flip per render.
- Properties the competing mixin never sets (padding, `border-radius`, `opacity`) apply normally — which is what makes this so confusing: part of the block visibly works.
- Unlayered stylesheet rules beat every `rmx.*` sub-layer, so a global stylesheet is the nuclear option.

### Parent → child rules are the same contest, not a stronger selector

A nested selector in a parent's style (`&:hover .title`, `& tbody td`, `& > button`) is declared inside the **parent's** sub-layer. The parent usually renders first, so its layer is inserted before the child's own style, and the child's later sub-layer wins any property both set. A parent can therefore only style a child for properties the child's own style leaves unset — a descendant selector gives no specificity advantage across sub-layers. (Within one sub-layer, specificity still applies normally.)

Concrete case found in the 2026-11-19 §04 re-audit: the shared stacked-card layouts (`app/ui/mixins/admin-table.ts` `mobileCards`, copied as `listsCardsStyle` in `app/ui/admin-lists-page.tsx`) are applied to the wrapper and restyle `& tbody td`. Every cell also composes `table.td`, whose later sub-layer kept `padding: 8px 12px`, `border-bottom: 1px solid`, `overflow: hidden`, `text-overflow: ellipsis`, and `white-space: nowrap`; the card layout's `4px 0` padding / no divider / wrapping never applied. `table.row`'s zebra background likewise beat the card background on even rows. The layout still *looked* half-right because `display: flex`/`justify-content` are properties `table.td` never sets — the usual trap.

A probe (Playwright, 390px, `/admin/clients`) measured it and the fix; the regression guard is `test/responsive.ts` `assertMobileCards()` plus the card assertions in `app/actions/admin/lists/lists-ux.test.e2e.ts`.

Two follow-on details:

- `!important` in the **parent** rule works even though the parent's layer is earlier: for important declarations the layer order is reversed, so the earlier layer wins. Same-sub-layer variants (e.g. card base `background` + `& tbody tr:hover`) keep normal specificity among the important declarations.
- Removing the cell's `overflow: hidden` changes its automatic minimum size: the grid item now contributes its min-content width, so one long unbreakable value widened the card track past the viewport (38px overflow at 390px). Add `min-width: 0` to the cell rule when the card layout switches it to `overflow: visible`.

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
`!important` beats the mixin's non-important `border` shorthand deterministically; the layer order does not matter. The same escape hatch is mandatory for contested properties in a **parent's** nested rule (`app/actions/lists/public/lists-view.tsx`, `app/ui/mixins/admin-table.ts` `floatingRowReveal`/`mobileCards`, `app/ui/admin-lists-page.tsx` `listsCardsStyle`, `app/ui/mixins/verwaltung-grid.ts` `verwaltungGridDensity`). Do not use it for properties the child leaves unset — it is noise and hides which rule is load-bearing.

2. **Re-render the markup with app classes** instead of restyling the vendor component — the pattern the app chose for breadcrumbs (`app/ui/breadcrumbs.tsx` explains why: the vendor component hardcodes `light-dark(...)` values that ignore `data-theme`, and its layers make overrides unreliable).

3. **Use a later/global layer** only for genuinely global needs: declare a layer after `rmx` (e.g. `@layer rmx-reset, rmx, app;`) and put raw CSS there. Keep `var(--rmx-…)` out of source (theme-conformance lint) — interpolate `theme.*` tokens instead.

## Verifying (styles are not in `document.styleSheets`)

The generated rules live in an adopted stylesheet plus a sheet whose `cssRules` access throws, so `document.styleSheets` iteration shows nothing and is misleading (see `remix3-css-and-layout` → `references/hover-reveal.md`). Use CDP:

```js
const cdp = await context.newCDPSession(page)
await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.wrapper button' })
const matched = await cdp.send('CSS.getMatchedStylesForNode', { nodeId })
// rule.selectorList.text is the *nested* text ('& button'); rule.layerName is null
```
Then confirm with `getComputedStyle` — a declaration that lost the layer contest is simply absent from the computed value, and longhands expanded from a `var()` shorthand report `<empty>` in `cssProperties` even when the declaration is valid.

For a parent→child contest the CDP step is optional: the sub-layer indices alone predict the winner. SSR-style `<style data-rmx-style>` tags are removed after adoption, so read the adopted sheet and record each sub-layer's first-seen index (render order, so a wrapper's layer normally precedes its children's):

```js
// page.evaluate()
let layerIndex = new Map()
let i = 0
for (let sheet of document.adoptedStyleSheets) {
  for (let rule of sheet.cssRules) {
    let m = /^@layer (rmx\.[^\s{]+)/.exec(rule.cssText)
    if (m && !layerIndex.has(m[1])) layerIndex.set(m[1], i++)
  }
}
let layersOf = (el) =>
  el.className
    .split(/\s+/)
    .map((c) => [c, layerIndex.get(`rmx.${c}`) ?? -1])
// wrapper's mobileCards class vs the cell's table.td class: later index wins
// normal declarations, earlier index wins `!important` ones
```

Pair the indices with `getComputedStyle(target)` to see which declarations actually lost (the 2026-11-19 card probe read `padding: 8px 12px` where the card rule asked for `4px 0`). Check the contested properties individually — a rule whose uncontested properties all apply can still be losing the ones that matter.

## Related

- `remix3-css-and-layout` → `references/hover-reveal.md` — the same runtime silently dropping nested selectors wholesale.
- `remix3-theme-conformance` — token usage rules that apply to whichever fix you pick.

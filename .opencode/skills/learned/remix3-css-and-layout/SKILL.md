---
name: remix3-css-and-layout
description: "Use when styling Remix 3 / remix-ui pages and something is visually wrong — hover-reveal selectors not emitted, `css()` overrides losing to `@layer rmx.*`, inline SVG/glyph wrapping, native `<select>` overflowing a flex row, content-sized panels collapsing, bounded flex chains not scrolling, full-height sidebar shells, or the `hidden` attribute not hiding."
user-invocable: false
origin: consolidated
---

# Remix 3 CSS And Layout

**Consolidated from:** `remix3-css-hover-reveal`, `remix3-css-override-cascade-layer`, `remix3-svg-reset-inline-wrap`, `native-select-flex-contain`, `remix3-content-sized-flex-panel`, `remix3-bounded-scroll-flexchain`, `remix3-full-height-page-in-sidebar-shell`, `remix3-hidden-attribute-display-override`

This skill is the **index** for Remix 3 / `remix-ui` styling and layout deltas. For the framework CSS API and canonical styling patterns, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`); for theme tokens, see `remix3-theme-conformance`.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| A hover/focus reveal (row actions, delete, tooltip) never appears; `&:hover > *` / `&:hover [attr]` in `css()` emits nothing | `references/hover-reveal.md` |
| A `css()` override silently loses to vendor rules (double borders, wrong divider colour, `& > *` ignored) while sibling rules apply | `references/cascade-layer-overrides.md` |
| An inline icon/glyph sits on its own line above its label; a link/span containing an SVG wraps vertically | `references/svg-reset-inline-wrap.md` |
| A native `<select>` overflows its flex row because of long option text | `references/native-select-flex-contain.md` |
| A content-sized flex-column panel/card collapses to its header; a bounded full-height shell under-sizes | `references/content-sized-flex-panel.md` |
| A viewport-bounded page's inner list/sidebar won't scroll; a `flex: 1` child is clipped by an `overflow: hidden` `display: block` wrapper | `references/bounded-scroll-flexchain.md` |
| Filling the available height in an admin sidebar shell; `height: 100vh` overflows the stacked chrome | `references/full-height-sidebar-shell.md` |
| `hidden` / `toggleAttribute('hidden', …)` has no visual effect; an author `display` in `css()` overrides the UA `[hidden]` rule | `references/hidden-attribute-display-override.md` |
| Inspecting generated rules in the browser — `document.styleSheets` iteration shows nothing | `references/hover-reveal.md`, `references/cascade-layer-overrides.md` |
| A scrollbar is missing in Firefox although `&::-webkit-scrollbar` is set | `references/bounded-scroll-flexchain.md` |

## Core Rules

**Hover reveal (`references/hover-reveal.md`)**

- The `css()` runtime **never emits parent→child reveal selectors**: `&:hover > *`, `&:hover > [attr]`, `&:hover [attr]` are all silent no-ops, while `:hover` on the element itself and non-hover child combinators do apply. The rules land in an adopted/shadow stylesheet, so `document.styleSheets` shows nothing.
- Drive the reveal from a `clientEntry` that toggles **inline** `style.opacity` (and `pointer-events`) on a stable-attributed child cluster, wired to `mouseenter`/`mouseleave` **and** `focusin`/`focusout`; re-init on frame `reloadComplete` and abort prior listeners. Provide the delegated (`mouseover` + `closest(...)`) variant for rows that re-render on every state change.
- Resting state is `opacity: 0; pointer-events: none`, flipped to `auto` when revealed (the container's `pointer-events: none` is what lets clicks pass through to the row). Force-reveal an actively-editing row; add `@media (hover: none)` so touch devices always see and can click the actions; gate destructive actions separately (e.g. `data-confirm`), never by trapping clicks with `pointer-events`.

**Cascade-layer overrides (`references/cascade-layer-overrides.md`)**

- Every `css()` rule is emitted into a **per-class `@layer rmx.<class>` sub-layer** (this app pins `@layer rmx-reset, rmx;`). Inside a layer, **sub-layer order decides and specificity is irrelevant**, and which sub-layer is declared last depends on class registration order — so the same override can win on one element and lose on its sibling (the active/tone variant is the usual casualty). Nested `& button` / `& > *` rules live in the *wrapper's* sub-layer, and unlayered stylesheet rules beat every `rmx.*` sub-layer.
- Fix by overriding **on the target element, after the mixin, with `!important`** for the contested properties; or re-render the markup with app classes; or declare a genuinely global later layer (`@layer rmx-reset, rmx, app;`). Keep raw `var(--rmx-…)` out of source — interpolate `theme.*` tokens.
- Verify with CDP (`CSS.getMatchedStylesForNode`), not `document.styleSheets`; a declaration that lost the layer contest is simply absent from `getComputedStyle`, and longhands expanded from a `var()` shorthand report `<empty>`.

**Inline SVG wrap (`references/svg-reset-inline-wrap.md`)**

- The `rmx-reset` layer ships `:where(img, svg) { display: block }`, so an `<svg>` is block-level by default and takes its own line in any non-flex host (plain `<a>`, `<span>`, inline `<div>`); the markup is correct and render tests / HTML assertions still pass.
- Make the **host** `display: inline-flex; align-items: center; gap: 4px` (prefer `gap` over glyph margins), and fix the shared control rather than each call site. Mixins that already declare `inline-flex` (e.g. `button()`, `table.searchBtn`, `table.sortLink`, `table.filterTab`) do not hit it; a host that is already a flex item blockifies `inline-flex` to `flex`, which is still correct.
- The fast tell is `getComputedStyle(svg).display === 'block'`; the reset lives inside an `@layer`, so walk the rules recursively to find it.

**Native select contain (`references/native-select-flex-contain.md`)**

- A native `<select>` has an intrinsic minimum width set by its longest `<option>`, so in a flex row it refuses to shrink below that and overflows / pushes siblings even with `flex: 1`.
- Use **all four** together: `flex: 1; min-width: 0; width: 100%; overflow: hidden` (optionally `text-overflow: ellipsis`). `min-width: 0` is the key — it overrides the flex item's `auto` minimum size; `width: 100%` makes browsers respect it.
- The native dropdown popup still opens at full width (not controllable via CSS), and custom (non-native) selects are unaffected.

**Content-sized flex panel (`references/content-sized-flex-panel.md`)**

- `flex: 1` is `flex: 1 1 0%` (**basis 0**), so a container that becomes content-sized (dropped `flex: 1`, or capped with `max-height` for centering) collapses to its non-flex children (typically the header) and `overflow: hidden` hides the body/list.
- Fix: change **every** `flex: 1` level in the chain to `flex: 1 1 auto` (`flexGrow: 1; flexShrink: 1; flexBasis: 'auto'`) while keeping `min-height: 0`. Center it with `justify-content: center` on a bounded flex column; keep a companion sidebar stable and full-height with a `margin-bottom` gap and pin pagination with `margin-top: auto`.
- Same trap for a leaf text `<span>`: `flex: 1` + `-webkit-box` + line clamp + `overflow: hidden` in a **column** wrapper is reinterpreted as height/basis 0 and collapses to ~0px — drop `flex: 1` (or use `flex: 1 1 auto`) and rely on `align-self: stretch`. Detect it by asserting `getBoundingClientRect().height > 10`, not Playwright `isVisible()` / count.

**Bounded scroll flexchain (`references/bounded-scroll-flexchain.md`)**

- Once the shell is bounded (`height: 100%` + `grid-template-rows: minmax(0, 1fr)`), every nested flex level needs `min-height: 0`; the silent failure is a **`display: block` wrapper with `overflow: hidden` clipping a `flex: 1` child** instead of letting it scroll. The wrapping level must be `display: flex; flex-direction: column; min-height: 0`, and the real scroll region gets `flex: 1; min-height: 0; overflow-y: auto`.
- For a bounded sidebar: `aside { display: flex; flex-direction: column; min-height: 0; overflow: hidden }` and `nav { flex: 1; min-height: 0; overflow-y: auto }`, keeping the header outside `nav` so it stays fixed.
- Scrollbar styling uses the standard `scrollbarWidth: 'thin'` / `scrollbarColor: '<thumb> <track>'` (theme tokens): nested `&::-webkit-scrollbar` rules are ignored by Firefox, and `@supports not selector(::-webkit-scrollbar)` does **not** work because Firefox reports `CSS.supports('selector(::-webkit-scrollbar)')` as `true`.

**Full-height sidebar shell (`references/full-height-sidebar-shell.md`)**

- `height: 100vh` inside the admin sidebar shell overflows because the visible box is `viewport − MainNav − footer − breadcrumbs − shell padding`, producing a permanent scrollbar. A `Frame` splices content with **no wrapper**, so the page is a direct child of the shared `pageStyle` scroll container — the **shell** must be height-constrained, not just the page.
- Add a **config-gated** full-height mode to `createSidebarLayout` (`fullHeightTargets?: string[]`): matching pathnames get `shellStyle { height: 100%; grid-template-rows: minmax(0, 1fr) }` and `contentStyle { height: 100% }`, and the page uses `display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden`. Never change the shared shell globally — a blanket `height: 100%` breaks the sticky sidebar on tall pages.
- A standalone page rendered directly in the plain `Layout` (e.g. `/chat`) has a definite-height parent, so `height: 100%` works there and it must **not** be in `fullHeightTargets`. Verify by grepping the files for the old `height: '100vh'` — an OpenSpec checkbox does not prove the code landed.

**Hidden attribute (`references/hidden-attribute-display-override.md`)**

- The UA rule `[hidden] { display: none }` is beaten by any **author** `display` — including a `css()` class rule — so `el.hidden = true` / `toggleAttribute('hidden', …)` has no visual effect and the element stays visible.
- Fix: add `&[hidden] { display: none }` to the **same** `css()` descriptor (it compiles to `.class[hidden]`, out-specifying `.class`). Alternatives: a `data-*` attribute with `&[data-x='true'] { display: none }`, or conditional server-side rendering. If a `clientEntry` must hide it, keep toggling the attribute plus the CSS guard — not `style.display`.
- If the `display` comes from a different composed mixin/layer rather than this descriptor, read `references/cascade-layer-overrides.md` before reaching for `!important`.

## When to Use

- You are styling a Remix 3 / `remix-ui` page and a style or layout silently does nothing, loses a specificity/layer contest, or collapses a region.
- A control toggled through `hidden`, or a hover/focus reveal, does not appear or disappear as intended.
- Flex/scroll geometry is wrong: panels collapse, lists clip instead of scroll, or a page in the sidebar shell overflows.
- You are adding a new hand-rolled link/span with an inline SVG, a `<select>` in a flex row, or a content-sized panel inside a bounded shell.
- Before trusting a `css()` override or a computed style, use these references' CDP / recursive-rule-walk recipes rather than `document.styleSheets`.

## Related Skills

- `remix3-theme-conformance` — theme-token rules that apply to whichever fix you pick (raw `var(--rmx-…)`, missing tokens, contrast)
- `remix3-theme-glyph-add` — adding a missing theme glyph in the contract and preset
- `remix3-client-entries` (`references/aria-tabs.md`) — ARIA tabs over `hidden` panels, including the no-JS stacked fallback
- `remix3-frame-cliententry` — `Frame` navigation, `clientEntry` hydration, and `clientEntry` DOM/styling interactions
- `remix3-jsx-attribute-conventions` — kebab-case SVG attributes and runtime `rmx-*` renames in `remix/ui` JSX
- `remix3-testing` (`references/cliententry-browser-test-stubs.md`) — driving measurement/geometry-driven `clientEntry` side effects in browser tests
- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical `remix/ui` CSS API and styling patterns

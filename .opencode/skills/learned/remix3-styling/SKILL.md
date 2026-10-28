---
name: remix3-styling
description: "Use when styling a Remix 3 / remix-ui app and something is visually wrong — css() overrides losing to @layer rmx.*, hover-reveal selectors (nested parent→child rules now emit; legacy JS fallback), theme-token conformance (raw var(--rmx-...) strings, *.background tokens used as text/accent-color, tokens missing from the contract tree), flex/panel/sidebar layout traps, native <select> overflow, the hidden attribute not hiding, glyph/SVG wrapping, and motion: entrance/exit presence, layout animation, spring()/tween()/easing values, CSS-first reduced-motion gating, interruptible imperative animations with @remix-run/ui/animation, `element.animate()`/WAAPI motion that bypasses the CSS reduced-motion guard, and `transitionend` teardowns that never fire when a stylesheet overrides the transition."
user-invocable: false
origin: consolidated
---

# Remix 3 Styling: CSS, Theme Tokens & Motion

Consolidated from 4 former learned skills (`remix3-css-and-layout`, `remix3-theme-conformance`, `remix3-animation`, `imperative-motion-gotchas`) between 2026-10-17 and 2026-10-24. Reference files are namespaced under `references/<former-skill>/`; the imperative-motion deltas live in `references/remix3-animation/reduced-motion.md`. Everything vendor-supplied (guides, package READMEs, the vendor `remix` / `mastra` skills) stays authoritative — sections below are deltas only.

## Load Only The Sections You Need

| You need... | Section | References |
| --- | --- | --- |
| Visually wrong styling — @layer rmx.* overrides, hover-reveal, flex/panel/sidebar traps, admin-grid columns, native <select> overflow, hidden not hiding | § CSS & Layout | `references/remix3-css-and-layout/` |
| Styling with theme tokens — raw var(--rmx-...) strings, *.background misuse, missing contract tokens breaking light/dark contrast | § Theme Tokens | `references/remix3-theme-conformance/` |
| Motion — entrance/exit presence, layout animation, spring()/tween(), reduced-motion gating, interruptible imperative animations, WAAPI (`element.animate()`) and `transitionend` teardown leaks | § Animation & Motion | `references/remix3-animation/` |

## CSS & Layout

_(formerly `remix3-css-and-layout` — references live under `references/remix3-css-and-layout/`)_

**Consolidated from:** `remix3-css-hover-reveal`, `remix3-css-override-cascade-layer`, `remix3-svg-reset-inline-wrap`, `native-select-flex-contain`, `remix3-content-sized-flex-panel`, `remix3-bounded-scroll-flexchain`, `remix3-full-height-page-in-sidebar-shell`, `remix3-hidden-attribute-display-override`, `remix3-nested-scroller-navigation-reset`

This skill is the **index** for Remix 3 / `remix-ui` styling and layout deltas. For the framework CSS API and canonical styling patterns, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`); for theme tokens, see `remix3-styling § Theme Tokens`. For component context, the document shell, and choosing among `remix/component` building blocks, see `remix3-ui § Rendering`.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| A hover/focus reveal (row actions, delete, tooltip) never appears; `&:hover > *` / `&:hover [attr]` in `css()` emits nothing (pre-fix builds only) | `references/remix3-css-and-layout/hover-reveal.md` |
| A `css()` override silently loses to vendor rules (double borders, wrong divider colour, `& > *` ignored) while sibling rules apply | `references/remix3-css-and-layout/cascade-layer-overrides.md` |
| An inline icon/glyph sits on its own line above its label; a link/span containing an SVG wraps vertically | `references/remix3-css-and-layout/svg-reset-inline-wrap.md` |
| A native `<select>` overflows its flex row because of long option text | `references/remix3-css-and-layout/native-select-flex-contain.md` |
| A content-sized flex-column panel/card collapses to its header; a bounded full-height shell under-sizes | `references/remix3-css-and-layout/content-sized-flex-panel.md` |
| A line clamp does not apply; generated CSS contains invalid `2px` for a vendor-prefixed property | `references/remix3-css-and-layout/unitless-numeric-css-properties.md` |
| A viewport-bounded page's inner list/sidebar won't scroll; a `flex: 1` child is clipped by an `overflow: hidden` `display: block` wrapper | `references/remix3-css-and-layout/bounded-scroll-flexchain.md` |
| Filling the available height in an admin sidebar shell; `height: 100vh` overflows the stacked chrome | `references/remix3-css-and-layout/full-height-sidebar-shell.md` |
| A plain-`Layout` (no sidebar) grid shows a page scrollbar; you want the header/filters pinned and only rows to scroll | `references/remix3-css-and-layout/plain-layout-bounded-grid.md` |
| A nested scroll container keeps/clamps its offset after a frame navigation; a grid jumps or lands mid-page when paging | `references/remix3-css-and-layout/nested-scroller-navigation-reset.md` |
| `hidden` / `toggleAttribute('hidden', …)` has no visual effect; an author `display` in `css()` overrides the UA `[hidden]` rule | `references/remix3-css-and-layout/hidden-attribute-display-override.md` |
| Inspecting generated rules in the browser — `document.styleSheets` iteration shows nothing | `references/remix3-css-and-layout/hover-reveal.md`, `references/remix3-css-and-layout/cascade-layer-overrides.md` |
| A scrollbar is missing in Firefox although `&::-webkit-scrollbar` is set | `references/remix3-css-and-layout/bounded-scroll-flexchain.md` |
| An admin grid overflows on mobile / hides its row actions, or opening the two-column edit panel clips the table columns | `references/remix3-css-and-layout/admin-grid-responsive-panels.md` |

### Core Rules

**Hover reveal (`references/remix3-css-and-layout/hover-reveal.md`)**

- Nested parent→child rules **do work on the current build**: `&:hover > *`, `&:hover > [attr]`, and `&:hover [attr]` are emitted into the per-class `@layer rmx.<class>` rule and applied by the browser (verified in Chromium + Firefox, 2026-10-26). Drive the reveal from the row's `&:hover` plus `&:focus-visible` and `&:has(:focus-visible)` CSS instead of a `clientEntry`; **not `:focus-within`** — a mouse click focuses the button but is not focus-visible, so `:focus-within` pins the cluster open after a pointer click (after a row reorder this shows two toolbars at once; see the reference). Drop the opacity transition: a hover swap between adjacent rows cross-fades both clusters for ~120 ms. Restore focus to the same ↑/↓ button after the reorder (row fallback when the button is disabled at a boundary). Add `@media (hover: none)` so touch devices always see and can click the actions (for dense rows whose cluster squeezes/overlays the label, switch to a kebab + inline menu — see `remix3-ui` § Client Entries → `references/remix3-client-entries/touch-row-action-menu.md`); gate destructive actions separately (e.g. `data-confirm`), never by trapping clicks with `pointer-events`.
- **Legacy caveat (pre-fix builds only):** these selectors once emitted nothing, so the app briefly carried a delegated inline-style reveal in `lists-view.tsx`. That JS block is gone; the current reveal is CSS-only (`:focus-visible` gated) in `lists-view.tsx`. Inspect generated rules with CDP (`CSS.getMatchedStylesForNode`), not `document.styleSheets`: the rules live in an adopted stylesheet.

**Cascade-layer overrides (`references/remix3-css-and-layout/cascade-layer-overrides.md`)**

- Every `css()` rule is emitted into a **per-class `@layer rmx.<class>` sub-layer** (this app pins `@layer rmx-reset, rmx;`). Inside a layer, **sub-layer order decides and specificity is irrelevant**, and which sub-layer is declared last depends on class registration order — so the same override can win on one element and lose on its sibling (the active/tone variant is the usual casualty). Nested `& button` / `& > *` rules live in the *wrapper's* sub-layer, and unlayered stylesheet rules beat every `rmx.*` sub-layer.
- Fix by overriding **on the target element, after the mixin, with `!important`** for the contested properties; or re-render the markup with app classes; or declare a genuinely global later layer (`@layer rmx-reset, rmx, app;`). Keep raw `var(--rmx-…)` out of source — interpolate `theme.*` tokens.
- Verify with CDP (`CSS.getMatchedStylesForNode`), not `document.styleSheets`; a declaration that lost the layer contest is simply absent from `getComputedStyle`, and longhands expanded from a `var()` shorthand report `<empty>`.

**Inline SVG wrap (`references/remix3-css-and-layout/svg-reset-inline-wrap.md`)**

- The `rmx-reset` layer ships `:where(img, svg) { display: block }`, so an `<svg>` is block-level by default and takes its own line in any non-flex host (plain `<a>`, `<span>`, inline `<div>`); the markup is correct and render tests / HTML assertions still pass.
- Make the **host** `display: inline-flex; align-items: center; gap: 4px` (prefer `gap` over glyph margins), and fix the shared control rather than each call site. Mixins that already declare `inline-flex` (e.g. `button()`, `table.searchBtn`, `table.sortLink`, `table.filterTab`) do not hit it; a host that is already a flex item blockifies `inline-flex` to `flex`, which is still correct.
- The fast tell is `getComputedStyle(svg).display === 'block'`; the reset lives inside an `@layer`, so walk the rules recursively to find it.

**Native select contain (`references/remix3-css-and-layout/native-select-flex-contain.md`)**

- A native `<select>` has an intrinsic minimum width set by its longest `<option>`, so in a flex row it refuses to shrink below that and overflows / pushes siblings even with `flex: 1`.
- Use **all four** together: `flex: 1; min-width: 0; width: 100%; overflow: hidden` (optionally `text-overflow: ellipsis`). `min-width: 0` is the key — it overrides the flex item's `auto` minimum size; `width: 100%` makes browsers respect it.
- The native dropdown popup still opens at full width (not controllable via CSS), and custom (non-native) selects are unaffected.

**Content-sized flex panel (`references/remix3-css-and-layout/content-sized-flex-panel.md`)**

- `flex: 1` is `flex: 1 1 0%` (**basis 0**), so a container that becomes content-sized (dropped `flex: 1`, or capped with `max-height` for centering) collapses to its non-flex children (typically the header) and `overflow: hidden` hides the body/list.
- Fix: change **every** `flex: 1` level in the chain to `flex: 1 1 auto` (`flexGrow: 1; flexShrink: 1; flexBasis: 'auto'`) while keeping `min-height: 0`. Center it with `justify-content: center` on a bounded flex column; keep a companion sidebar stable and full-height with a `margin-bottom` gap and pin pagination with `margin-top: auto`.
- Same trap for a leaf text `<span>`: `flex: 1` + `-webkit-box` + line clamp + `overflow: hidden` in a **column** wrapper is reinterpreted as height/basis 0 and collapses to ~0px — drop `flex: 1` (or use `flex: 1 1 auto`) and rely on `align-self: stretch`. Detect it by asserting `getBoundingClientRect().height > 10`, not Playwright `isVisible()` / count.

**Unitless numeric properties (`references/remix3-css-and-layout/unitless-numeric-css-properties.md`)**

- `css()` appends `px` to numeric values outside its `NUMERIC_CSS_PROPS` allowlist (`@remix-run/component/src/style/style.ts`, `normalizeCssValue`). Vendor-prefixed properties are not included, so `WebkitLineClamp: 2` emits invalid `-webkit-line-clamp: 2px` and is silently dropped; the text never clamps and can grow unbounded.
- Use the string form for unitless properties: `WebkitLineClamp: '2'`. Do not compensate with `2px`; for properties that genuinely need units, pass a CSS string such as `'0.5rem'`. Check `getComputedStyle(el).webkitLineClamp` or the generated rule if a clamp appears to do nothing.

**Bounded scroll flexchain (`references/remix3-css-and-layout/bounded-scroll-flexchain.md`)**

- Once the shell is bounded (`height: 100%` + `grid-template-rows: minmax(0, 1fr)`), every nested flex level needs `min-height: 0`; the silent failure is a **`display: block` wrapper with `overflow: hidden` clipping a `flex: 1` child** instead of letting it scroll. The wrapping level must be `display: flex; flex-direction: column; min-height: 0`, and the real scroll region gets `flex: 1; min-height: 0; overflow-y: auto`.
- For a bounded sidebar: `aside { display: flex; flex-direction: column; min-height: 0; overflow: hidden }` and `nav { flex: 1; min-height: 0; overflow-y: auto }`, keeping the header outside `nav` so it stays fixed.
- Scrollbar styling uses the standard `scrollbarWidth: 'thin'` / `scrollbarColor: '<thumb> <track>'` (theme tokens): nested `&::-webkit-scrollbar` rules are ignored by Firefox, and `@supports not selector(::-webkit-scrollbar)` does **not** work because Firefox reports `CSS.supports('selector(::-webkit-scrollbar)')` as `true`.

**Full-height sidebar shell (`references/remix3-css-and-layout/full-height-sidebar-shell.md`)**

- `height: 100vh` inside the admin sidebar shell overflows because the visible box is `viewport − MainNav − footer − breadcrumbs − shell padding`, producing a permanent scrollbar. A `Frame` splices content with **no wrapper**, so the page is a direct child of the shared `pageStyle` scroll container — the **shell** must be height-constrained, not just the page.
- Add a **config-gated** full-height mode to `createSidebarLayout` (`fullHeightTargets?: string[]`): matching pathnames get `shellStyle { height: 100%; grid-template-rows: minmax(0, 1fr) }` and `contentStyle { height: 100% }`, and the page uses `display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden`. Never change the shared shell globally — a blanket `height: 100%` breaks the sticky sidebar on tall pages.
- A standalone page rendered directly in the plain `Layout` (e.g. `/chat`) has a definite-height parent, so `height: 100%` works there and it must **not** be in `fullHeightTargets`. Verify by grepping the files for the old `height: '100vh'` — an OpenSpec checkbox does not prove the code landed.

**Plain-Layout bounded grid (`references/remix3-css-and-layout/plain-layout-bounded-grid.md`)**

- The top-level `Layout`'s scroll container is `main > div` (`pageStyle { flex: 1; overflow-y: auto }`), **not** the document. To keep a grid page from ever overflowing it, add a route-scoped `fullHeight` option that wraps the tab nav + `<section>` in `height: 100%; display: flex; flex-direction: column` with `& > section { flex: 1; min-height: 0 }` — `height: 100%` on the section alone overflows by the sibling nav's height.
- Fill the chain down to the row region with `flex: 1 1 auto` (never `flex: 1`): the same classes run unbounded in frame fragments/agent panels, where basis 0 + `min-height: 0` collapses the grid. Density overrides use `!important` (sibling `@layer rmx.*` sub-layers). Measured: 15 rows, row 47→39px, page never scrolls; below ~865px viewport only rows scroll.
- Verify with a temporary `t.serve` e2e asserting `pageEl.scrollHeight === pageEl.clientHeight`; the document itself will not reveal the overflow.

**Nested scroller navigation reset (`references/remix3-css-and-layout/nested-scroller-navigation-reset.md`)**

- The frame runtime's default scroll reset calls the Navigation API's `event.scroll()`, which resets the **document** scrolling element only. The app scrolls inside `main > div` (`pageStyle`), so a frame navigation keeps/clamps that nested offset — with variable row heights the clamp is unpredictable and reads as the page jumping.
- Fix with a persistent `clientEntry` in the top-level `Layout` that resets `[data-page-scroller]`/`[data-grid-scroll]` on `navigatesuccess` for `push`/`replace` navigations (skip `traverse`, honor `data-rmx-reset-scroll="manual"`). `frame.reload()` is not a navigation, so SSE reloads stay put.
- Pair it with `scrollbarGutter: 'stable'` on the scrollers; exclude a page-managed scroller (`[data-create-panel]`) or opt it out.

**Hidden attribute (`references/remix3-css-and-layout/hidden-attribute-display-override.md`)**

- The UA rule `[hidden] { display: none }` is beaten by any **author** `display` — including a `css()` class rule — so `el.hidden = true` / `toggleAttribute('hidden', …)` has no visual effect and the element stays visible.
- Fix: add `&[hidden] { display: none }` to the **same** `css()` descriptor (it compiles to `.class[hidden]`, out-specifying `.class`). Alternatives: a `data-*` attribute with `&[data-x='true'] { display: none }`, or conditional server-side rendering. If a `clientEntry` must hide it, keep toggling the attribute plus the CSS guard — not `style.display`.
- If the `display` comes from a different composed mixin/layer rather than this descriptor, read `references/remix3-css-and-layout/cascade-layer-overrides.md` before reaching for `!important`.

**Responsive admin grids and two-column panels (`references/remix3-css-and-layout/admin-grid-responsive-panels.md`)**

- A `table.wrap` grid without `table.mobileCards` keeps `min-width: 840px` and scrolls its right-hand columns off a phone; `mobileCards` also needs `data-label` on every `<td>` (including the actions cell) or cards render unlabelled values.
- The two-column edit/create panel (`minmax(0, 1fr) 340px`) clips the grid because `table.page` caps at 1000px while `table` floors at `min-width: 840px`. Use `pageWide` plus a `twoColumnGrid` override scoped to `@media (min-width: 1101px)` with `min-width: 640px !important`; the media query keeps it from fighting `mobileCards` `min-width: 0 !important`. In the narrower sidebar shell (`/admin/users`) 640px still clips: drop `twoColumnGrid` in panel mode, render a focused column set (identity/role/status/actions), and set a page-local `min-width: 480px !important`. Add `order: -1` to the stacked panel at ≤1100px so the frame scroll reset lands on the opened editor.
- `dataGridWrap` (`flex: 1 1 auto`) grows under a short result set and leaves a tall empty bordered panel; use a `flex: 0 1 auto` wrapper for content height with shrink-to-scroll.
- Verify by measurement: `wrap.scrollWidth === wrap.clientWidth` with the panel open, and `getComputedStyle(thead).display === "none"` plus `td[data-label]` on mobile.

### When to Use

- You are styling a Remix 3 / `remix-ui` page and a style or layout silently does nothing, loses a specificity/layer contest, or collapses a region.
- A control toggled through `hidden`, or a hover/focus reveal, does not appear or disappear as intended.
- Flex/scroll geometry is wrong: panels collapse, lists clip instead of scroll, or a page in the sidebar shell overflows.
- You are adding a new hand-rolled link/span with an inline SVG, a `<select>` in a flex row, or a content-sized panel inside a bounded shell.
- You are adding a data grid or a two-column edit panel and need it to survive a phone and a desktop without clipping.
- An admin grid's row actions disappear while the inline edit panel is open, or a short result set leaves a tall empty bordered grid panel.
- Before trusting a `css()` override or a computed style, use these references' CDP / recursive-rule-walk recipes rather than `document.styleSheets`.

### Related Skills

- `remix3-styling § Theme Tokens` — theme-token rules that apply to whichever fix you pick (raw `var(--rmx-…)`, missing tokens, contrast)
- `remix3-styling § Theme Tokens` (`references/remix3-theme-conformance/glyph-add.md`) — adding a missing theme glyph in the contract and preset
- `remix3-ui § Client Entries` (`references/remix3-client-entries/aria-tabs.md`) — ARIA tabs over `hidden` panels, including the no-JS stacked fallback
- `remix3-ui § Frames` — `Frame` navigation, `clientEntry` hydration, and `clientEntry` DOM/styling interactions
- `remix3-ui § JSX Attributes` — kebab-case SVG attributes and runtime `rmx-*` renames in `remix/component` JSX
- `remix3-tooling § Testing` (`references/remix3-testing/cliententry-browser-test-stubs.md`) — driving measurement/geometry-driven `clientEntry` side effects in browser tests
- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical `remix/component` CSS API and styling patterns

---

## Theme Tokens

_(formerly `remix3-theme-conformance` — references live under `references/remix3-theme-conformance/`)_

**Consolidated from:** `remix3-theme-object-conformance`, `remix3-theme-css-variable-prefix`, `remix3-theme-glyph-add`

This skill is the **index** for theme-token conformance — styling must go through the typed `theme` object, and the CSS variables it resolves to use the `--rmx-` prefix. Read only the reference you need.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Understanding the six ways styling drifts, or the app's theme files | `references/remix3-theme-conformance/failure-modes.md` |
| Choosing/importing a token, or a token that does not exist yet | `references/remix3-theme-conformance/token-rules.md` |
| A low-contrast or invisible label, badge, glyph, or destructive-outline button | `references/remix3-theme-conformance/contrast-verification.md` |
| Building style strings by hand in `clientEntry` / browser DOM code (incl. `var(${theme.…})` re-wrapping) | `references/remix3-theme-conformance/cliententry-dom-styling.md` |
| What `npm run lint` enforces, a past incident with measured light/dark ratios, or the `theme.<group>.<key>` to `--rmx-*` variable-name mapping | `references/remix3-theme-conformance/metadata.md` |
| Adding an icon/glyph missing from the theme set, or a `TS2339`/`TS2741`/`GlyphValues` error on `Glyph name=…` | `references/remix3-theme-conformance/glyph-add.md` |

### Core Rules

- **Always** reference tokens through the typed `theme` object (`app/ui/theme/theme.ts`); **never** write `var(--rmx-...)` literals or bare token names. `theme.*` leaves are already `var(--rmx-...)` strings.
- **Never** hardcode colors, borders, shadows, or spacing that a token covers.
- **Never re-wrap a token**: `var(${theme.…})` becomes `var(var(--rmx-…))`, which drops the whole declaration (and `element.style.x` rejects it outright).
- **Fill vs. ink:** use `theme.colors.<group>.background` only as a surface fill paired with `.foreground`; use `.foreground` for accent text, glyphs, a border, or a native control's `accent-color`. `*.background` passes `tsc` and lint even in the wrong role.
- **Verify contrast by measurement, not lint**: toggle `data-theme="dark"` on `<html>` and read `getComputedStyle`; both gates are blind to contrast.
- **Missing token:** add the key to the contract tree (`app/ui/theme/contract.ts`), add matching values to both `Theme` and `DarkTheme` (`app/theme.tsx`), then reference it — never hardcode a fallback.
- **The contract is the source of truth**: a value defined in `app/theme.tsx` but absent from the contract resolves to `undefined` and its declarations are silently dropped — check `contract.ts`, not just `app/theme.tsx`.
- **Enforcement:** `scripts/check-theme-conformance.ts` (wired into `npm run lint`) fails on `var(--rmx-` in `app/` outside `app/ui/theme/` and `app/theme.tsx`.

**Adding a glyph (`references/remix3-theme-conformance/glyph-add.md`)**

- The icon set is a closed, typed contract spanning two files that must change together: `app/ui/theme/glyph-contract.ts` (`glyphNames`) and `app/ui/theme/presets/rmx-01/glyphs.tsx` (`glyphValues`); `GlyphValues = Readonly<Record<GlyphName, GlyphSymbol>>` makes a name without a symbol (or vice-versa) fail typecheck. Symbol ids auto-derive as `rmx-glyph-<name>`; only `rmx-01` exists today, so add the symbol to every preset if that changes.

### When to Use

- Writing inline styles in `clientEntry` (client-side JavaScript, no React)
- Rendering DOM elements with CSS variable references in a Remix 3 app
- Debugging invisible text or low-contrast UI in light or dark mode
- Adding/reviewing a status badge, accent glyph, or colored text (check `.background` vs `.foreground`)
- Adding new UI components that need to be theme-aware
- Adding a token that a component needs but the theme doesn't define yet
- A `theme.<group>.<key>` value is `undefined`, or a style silently does nothing (check `contract.ts`, not just `app/theme.tsx`)
- Reviewing a coloured label or destructive-outline button for dark-mode contrast
- A native checkbox/radio/switch styled with `accent-color` looks invisible or washed out (check `.background` vs `.foreground`)
- A screen needs an icon missing from the theme set, or `Glyph name=…` trips a `GlyphValues` type error.

---

## Animation & Motion

_(formerly `remix3-animation` and `imperative-motion-gotchas` — references live under `references/remix3-animation/`)_

**Extracted:** 2026-09-26 (imperative-motion delta folded 2026-10-24)

This skill is the **pointer/delta index** for guide `node_modules/remix/guides/07-animation.md` (the canonical motion model). The component primitives it composes with (`clientEntry`, `on`, `ref`, `mix`) are covered by the vendor `remix` skill and `remix3-ui § Client Entries`.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| A node enters/exits, toggles presence, or a keyed list reorders/expands | `references/remix3-animation/presence-and-layout.md` |
| Choosing `spring()` vs `spring.transition()` vs `tween()`; imperatively animating a node; interruption | `references/remix3-animation/motion-values.md` |
| `prefers-reduced-motion`, gating animation before JS loads, or the app's motion helper — including WAAPI (`element.animate()`) and `transitionend` teardown leaks | `references/remix3-animation/reduced-motion.md` |

### Core Rules

**Presence and layout (`references/remix3-animation/presence-and-layout.md`)**

- `animateEntrance(...)` runs on insert; `animateExit(...)` keeps a removed node in the DOM until its exit finishes. Both are mixins, composed into a `mix` array with `css()`/`on()`/`ref()`.
- Pass `true`/`false` to enable/disable without reshaping the array; `animateEntrance({ initial: false })` skips the first insertion for a key; a keyed element that returns before its exit ends is reclaimed and animated back.
- Stable `key`s are required for enter/exit/replace and for `animateLayout(...)` in lists. `animateLayout` measures before/after and animates the delta; size projects by default, `size: false` animates position only.
- The app already gates presence motion: `app/utils/motion.ts` exports `entrance(config)` and `exit(config)` returning `false` under reduced motion; wrap as `animateEntrance(entrance({...}))` / `animateExit(exit({...}))`. Reduced motion is otherwise handled globally by the shell rule in `app/ui/document.tsx` — but WAAPI (`element.animate()`) is *not* covered and must check `prefersReducedMotion()`. Exit-animation teardowns are created asynchronously: in browser tests, poll for DOM removal rather than awaiting one `getAnimations()` snapshot.

**Motion values (`references/remix3-animation/motion-values.md`)**

- `spring()` returns an iterator decorated for CSS and Web Animations: stringify it in CSS, spread it into options (`{ ...spring('snappy') }`), or iterate it. `spring.transition(property, name)` builds a CSS transition value.
- `tween({from,to,duration,curve})` + `next(ts) -> { value, done }` and `easings` are for canvas, counters, and non-CSS values; prefer CSS/WAAPI for ordinary UI.
- Interruption is the default: handler signals abort, mixins cancel/replace in-flight work, and imperative code keeps the current `Animation` in setup scope and `cancel()`s it before restarting.

**Reduced motion (`references/remix3-animation/reduced-motion.md`)**

- Respect it at the CSS boundary first (`@media (prefers-reduced-motion: reduce)` inside `css()`), because it works before JS and for server-rendered frames; then check `matchMedia` for JS-driven motion.
- The shell's CSS guard does **not** reach `element.animate()`: gate every imperative animation on `prefersReducedMotion()` yourself. The same `transition: none !important` also beats inline `element.style.transition`, so `transitionend` never fires under reduced motion — pair every `transitionend` teardown with a timeout fallback (`app/ui/toast.ts`).
- Exit teardowns are created asynchronously, so browser tests must poll for DOM removal instead of awaiting one `getAnimations()` snapshot (`references/remix3-animation/presence-and-layout.md`).
- Reduced motion is not "no feedback" — prefer shorter fades, instant layout, or non-motion state changes.

### When to Use

- A node appears/disappears, a list reorders, or a card expands and should animate.
- You need a spring/tween value or an imperative WAAPI animation.
- You are adding motion and must respect reduced-motion and interruption.

### Related Skills

- `remix3-ui § Client Entries` — `clientEntry`/`on`/`ref`/runtime lifecycle
- `remix3-styling § CSS & Layout` — `css()`, `@layer rmx`, layout mechanics
- `remix3-ui § Rendering` — composing mixins and building blocks

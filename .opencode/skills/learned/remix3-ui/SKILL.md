---
name: remix3-ui
description: "Use when building or styling Remix 3 pages, components, <Frame> navigation, or clientEntry browser behavior — component context / handle.id / TypedEventTarget, document shell + asset-entry/ImportMap/head wiring, choosing app-owned css() vs @remix-run/ui primitives, unsafeHTML and remix/html-template, css() overrides losing to @layer rmx.*, hover-reveal selectors, floating admin-grid row actions, theme-token conformance (raw var(--rmx-...) strings, *.background misuse, missing contract tokens), vendor light-dark(...) palettes that ignore data-theme, flex/panel/sidebar layout traps, native <select> overflow, the hidden attribute not hiding, glyph/SVG wrapping, motion (entrance/exit presence, layout animation, spring()/tween()/easing, reduced-motion gating, interruptible imperative animations, WAAPI bypassing the CSS guard, transitionend teardowns), the createRoot/run() interactivity runtime, custom event mixins and browser-only behavior mixins (createMixin(type, { ssr: false })), touch row action menus (kebab + inline menu, focus restoration), on(...)/handle.update() cancellation, navigate/link/attrs, optimistic UI, enhanced form submission, queueTask vs requestAnimationFrame, ARIA tab wiring + no-JS fallback CSS, Firefox multi-import-map, frame targets/data-rmx-* escapes, cascade/mounted-guard traps, LazyFrame/IntersectionObserver, session.flash in fragments, frame failures/cancellation, renderToString/renderWith, and remix/component JSX attribute conventions (kebab-case SVG, runtime renames verified at runtime)."
user-invocable: false
origin: consolidated
---

# Remix 3 UI: Rendering, Styling, Frames & Client Entries

Consolidated from 5 former learned skills (`remix3-rendering-ui`, `remix3-client-entries`, `remix3-frame-cliententry`, `remix3-jsx-attribute-conventions`, `remix3-styling`) between 2026-10-17 and 2026-11-02. Reference files are namespaced under `references/<former-skill>/`. Everything vendor-supplied (guides, package READMEs, the vendor `remix` / `mastra` skills) stays authoritative — sections below are deltas only.

## Load Only The Sections You Need

| You need... | Section | References |
| --- | --- | --- |
| Building pages/components — component context, handle.id, TypedEventTarget, document shell, import maps/head, unsafeHTML, html-template, css() vs @remix-run/ui primitives | § Rendering & UI Composition | `references/remix3-rendering-ui/` |
| Styling/layout — `css()` overrides losing to `@layer rmx.*`, hover reveal, flex/panel/sidebar traps, admin-grid columns, native `<select>` overflow, `hidden` not hiding | § CSS & Layout | `references/remix3-css-and-layout/` |
| Theme tokens — raw `var(--rmx-…)` strings, `*.background` misuse, missing contract tokens, light/dark contrast, glyph contract | § Theme Tokens | `references/remix3-theme-conformance/` |
| Motion — entrance/exit presence, layout animation, `spring()`/`tween()`, reduced-motion gating, WAAPI and `transitionend` teardown leaks | § Animation & Motion | `references/remix3-animation/` |
| clientEntry browser behavior — createRoot/run(), event mixins, handle.update(), browser-only mixins, navigate/link/attrs, optimistic UI, queueTask, ARIA/no-JS fallback, large-entry decomposition | § Client Entries & Browser Runtime | `references/remix3-client-entries/` |
| <Frame> navigation, clientEntry hydration, LazyFrame, frame targets, data-rmx-* escapes, session.flash in fragments, frame failures/cancellation, renderToString/renderWith | § Frames & clientEntry Hydration | `references/remix3-frame-cliententry/` |
| Writing remix/component JSX — attributes pass through verbatim, kebab-case SVG, runtime renames verified at runtime | § JSX Attribute Conventions | `references/remix3-jsx-attribute-conventions/` |

## Rendering & UI Composition

_(formerly `remix3-rendering-ui` — references live under `references/remix3-rendering-ui/`)_

**Consolidated from:** `remix3-unsafe-html`, `remix-html-template`

**Extracted:** 2026-09-26

This skill is the **pointer/delta index** for the rendering-ui guide's uncovered surfaces. The canonical patterns live in the installed guide `node_modules/remix/guides/04-rendering-ui.md`; the component mental model is in the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`, "Components"). Do not restate the guide here — these references name the app seams and the disambiguations the guide cannot know.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Sharing a value with descendant components (`handle.context`), generating a stable DOM id (`handle.id`), or a browser-reactive context value (`TypedEventTarget`) | `references/remix3-rendering-ui/component-context-and-handle-id.md` |
| Adding to `<head>` (meta/og, modulepreload, styles, CSP nonce), wiring the browser entry script / import map, or `context.render(tree, ResponseInit)` | `references/remix3-rendering-ui/document-shell-and-asset-entry.md` |
| Choosing between app-owned `css()` styling and an `@remix-run/ui` headless primitive, or deciding whether to wrap/replace a vendor component | `references/remix3-rendering-ui/first-party-ui-blocks.md` |
| Rendering raw HTML through a prop (`innerHTML`, iframe `srcDoc`/`srcdoc`) and `Framework invariant: Invalid … prop` throws after a Remix bump | `references/remix3-rendering-ui/unsafe-html.md` |
| Returning an HTML string outside the component runtime (standalone 500/429/error pages, frame fragments, email/RSS), with XSS-safe interpolation | `references/remix3-rendering-ui/html-template.md` |

### Core Rules

**Component context, `handle.id`, `TypedEventTarget` (`references/remix3-rendering-ui/component-context-and-handle-id.md`)**

- `handle.context` is **component-tree** context (provider type is the key; `handle.context.set(v)` in setup, `handle.context.get(Provider)` in a consumer). It is not the server request context: this app's `remix/middleware/async-context` `getContext()` / middleware `context.set/get` is a separate, request-scoped mechanism used in `app/ui/document.tsx` and `app/middleware/*`. Do not mix them.
- `handle.context.set(...)` stores a value but schedules no render; for context that changes in the browser use a `TypedEventTarget` (guide).
- `handle.id` wires a label/input/ARIA relationship without an `id` prop.
- As of extraction this app uses **none** of the three (zero occurrences); follow the guide and treat it as new surface if you introduce one.

**Document shell and asset entry (`references/remix3-rendering-ui/document-shell-and-asset-entry.md`)**

- The shell is `app/ui/document.tsx`, not the guide's `app/actions/document.tsx`. Entry data is request-scoped middleware state via `getAssetEntry()` (`app/middleware/asset-entry.ts`), not a `scriptEntry` export from `app/assets.ts`.
- Head: `<ImportMap value={entry.importMap} nonce={getCspNonce()} />` plus modulepreload links; body script uses `entry.href` with a `routes.assets.href({ path: 'app/assets/entry.tsx' })` fallback.
- `loadAssetEntry` **skips frame requests** (`X-Remix-Frame`), so never assume the entry is present in a fragment — compute global head/asset work on document responses.
- `createHtmlResponse()` owns doctype/content-type (it always prepends `<!DOCTYPE html>`); `context.render(tree, { status, headers })` adds status/headers.

**First-party UI blocks (`references/remix3-rendering-ui/first-party-ui-blocks.md`)**

- Selection order: style the native control with `css()`; reach for an `@remix-run/ui` headless primitive (`accordion`/`anchor`/`animation`/`combobox`/`listbox`/`menu`/`popover`/`select`/`tabs`/`toggle`) when the product needs its behavior or markup. `@remix-run/ui` 0.13.0 no longer exports the styled `button`/`input`/`checkbox`/`radio` mixins or the `breadcrumbs` module (removed in the 0.11 → 0.12 cleanup, #11986), and there are no `/primitives` subpaths; the app vendors its own button (`app/ui/theme/upstream-button.ts`). Interactive controls still need a `clientEntry` boundary. Toggle note (since build `c93cec30`/source `e5ed055`, PR #11986): the upstream `@remix-run/ui/toggle` module exports the mixin as a flat `toggle` callable directly as `mix={toggle({...})}` — the old `toggle.control()` shape no longer exists; the app currently uses no toggle mixin, but do not re-adopt the group-under-`.control` pattern.
- This app wraps the vendored `app/ui/theme/upstream-button.ts` in `app/ui/theme/button.ts` (extra tones, host-type rebind, `buttonLink()` for anchor hosts); the vendored copy must also keep upstream's attribute default (`type="button"`), and a link that needs button styling uses `buttonLink()` — a nested `<a><button>` submits a surrounding form and is blocked by `remix-a11y/no-nested-interactive`.
- It deliberately renders its own breadcrumbs in `app/ui/breadcrumbs.tsx` (the pre-0.12 vendor component wrapped classes in `@layer remix-ui.*`, making overrides unreliable; it was removed in the 0.11 → 0.12 cleanup). The document shell now maps an explicit `data-theme` to `color-scheme`, so vendor `light-dark(...)` palettes (menus, buttons) follow the app theme.
- Menus use `@remix-run/ui/menu` primitives, wrapped by the app's `app/ui/theme/menu/index.tsx` styled `MenuList`/`MenuItem`; `onMenuSelect` comes from the vendor module.

**Raw HTML props (`references/remix3-rendering-ui/unsafe-html.md`)**

- As of upstream #11885, `innerHTML`/`srcDoc`/`srcdoc` only accept the opaque value from `unsafeHTML()` (and `outerHTML` is rejected outright); a plain string throws `Framework invariant: Invalid innerHTML prop: expected a value created with unsafeHTML()` at render time, not from `tsc` (`createElement`'s `ElementProps = Record<string, any>`); #11988 added that suffix, and the guide's §"Raw HTML with unsafeHTML" now authors the base pattern. `unsafeHTML()` authorizes, it does not sanitize — keep escaping at the call site. The app's only prop site is `app/ui/theme/runtime.ts` (DOM `el.innerHTML = …` assignments are unaffected).

**HTML-string responses (`references/remix3-rendering-ui/html-template.md`)**

- Outside the component system, use the `html` tagged template (auto-escaping; `html.raw` for trusted sources) and coerce with `String(html\`…\`)` for a `Response` body; top-level error pages emit a full `<!doctype html>` document, frame errors emit a bare fragment. Never refactor a tagged template to plain interpolation without a manual escape helper — that silently drops XSS escaping.

### When to Use

- You need to pass a value from a component to a descendant without prop-drilling, or to give a reusable control a stable id.
- You are editing the document shell, adding head tags/preloads, or wiring the browser entry/import map.
- You are choosing a `remix/component` building block or deciding whether to use, wrap, or replace a vendor component.
- A link styled as a button submits/reloads its form, or an untyped `button()` control starts submitting after a vendor bump.
- A raw-HTML prop throws `Invalid innerHTML`/`srcDoc`/`srcdoc prop`, or a mixin returning one is now stripped.
- You are writing an HTML-string response (standalone error page, frame fragment, email/RSS) outside the component runtime.

### Related Skills

- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — component model (setup/render, `handle.props`, `handle.update`)
- § CSS & Layout — `css()`, `@layer rmx`, and layout deltas
- § Theme Tokens — theme tokens and light/dark contrast
- `remix3-ui § Client Entries` — the `clientEntry`/hydration boundary and import-map constraints
- `remix3-server § Security` — CSP nonces for inline scripts

---

## CSS & Layout

_(formerly `remix3-css-and-layout` — references live under `references/remix3-css-and-layout/`)_

**Consolidated from:** `remix3-css-hover-reveal`, `remix3-css-override-cascade-layer`, `remix3-svg-reset-inline-wrap`, `native-select-flex-contain`, `remix3-content-sized-flex-panel`, `remix3-bounded-scroll-flexchain`, `remix3-full-height-page-in-sidebar-shell`, `remix3-hidden-attribute-display-override`, `remix3-nested-scroller-navigation-reset`

This skill is the **index** for Remix 3 / `remix-ui` styling and layout deltas. For the framework CSS API and canonical styling patterns, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`); for theme tokens, see § Theme Tokens. For component context, the document shell, and choosing among `remix/component` building blocks, see § Rendering.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| A hover/focus reveal (row actions, delete, tooltip) never appears; `&:hover > *` / `&:hover [attr]` in `css()` emits nothing (pre-fix builds only) | `references/remix3-css-and-layout/hover-reveal.md` |
| A `css()` override silently loses to vendor rules (double borders, wrong divider colour, `& > *` ignored) while sibling rules apply | `references/remix3-css-and-layout/cascade-layer-overrides.md` |
| An inline icon/glyph sits on its own line above its label; a link/span containing an SVG wraps vertically | `references/remix3-css-and-layout/svg-reset-inline-wrap.md` |
| A native `<select>` overflows its flex row because of long option text | `references/remix3-css-and-layout/native-select-flex-contain.md` |
| A content-sized flex-column panel/card collapses to its header; a bounded full-height shell under-sizes | `references/remix3-css-and-layout/content-sized-flex-panel.md` |
| On a pre-#12121 build, a line clamp does not apply; generated CSS contains invalid `2px` for a vendor-prefixed property | `references/remix3-css-and-layout/unitless-numeric-css-properties.md` |
| A viewport-bounded page/grid stops scrolling after a remix bump; `flex: 1` now serializes as basis `0%` | `references/remix3-css-and-layout/unitless-numeric-css-properties.md` |
| A viewport-bounded page's inner list/sidebar won't scroll; a `flex: 1` child is clipped by an `overflow: hidden` `display: block` wrapper | `references/remix3-css-and-layout/bounded-scroll-flexchain.md` |
| Filling the available height in an admin sidebar shell; `height: 100vh` overflows the stacked chrome | `references/remix3-css-and-layout/full-height-sidebar-shell.md` |
| A plain-`Layout` (no sidebar) grid shows a page scrollbar; you want the header/filters pinned and only rows to scroll | `references/remix3-css-and-layout/plain-layout-bounded-grid.md` |
| A nested scroll container keeps/clamps its offset after a frame navigation; a grid jumps or lands mid-page when paging | `references/remix3-css-and-layout/nested-scroller-navigation-reset.md` |
| `hidden` / `toggleAttribute('hidden', …)` has no visual effect; an author `display` in `css()` overrides the UA `[hidden]` rule | `references/remix3-css-and-layout/hidden-attribute-display-override.md` |
| Inspecting generated rules in the browser — `document.styleSheets` iteration shows nothing | `references/remix3-css-and-layout/hover-reveal.md`, `references/remix3-css-and-layout/cascade-layer-overrides.md` |
| A scrollbar is missing in Firefox although `&::-webkit-scrollbar` is set | `references/remix3-css-and-layout/bounded-scroll-flexchain.md` |
| An admin grid overflows on mobile / hides its row actions, or opening the two-column edit panel clips the table columns | `references/remix3-css-and-layout/admin-grid-responsive-panels.md` |
| An admin grid's actions column overflows, a hover-reveal cluster should reclaim its width, or a `css()` breakpoint override silently does nothing | `references/remix3-css-and-layout/floating-row-actions.md` |

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

- `flex: 1` is `flex: 1 1 0%` (**basis 0**), so a container that becomes content-sized (dropped `flex: 1`, or capped with `max-height` for centering) collapses to its non-flex children (typically the header) and `overflow: hidden` hides the body/list. Since remix #12121 `css({ flex: 1 })` really emits that shorthand; before it emitted `flex: 1px` (basis 1px), which masked the collapse. In an auto-height ancestor the `0%` basis resolves to content, so a viewport-fill chain becomes content-sized — use `flex: '1 1 0'` (definite zero) there.
- Fix: change **every** `flex: 1` level in the chain to `flex: 1 1 auto` (`flexGrow: 1; flexShrink: 1; flexBasis: 'auto'`) while keeping `min-height: 0`. Center it with `justify-content: center` on a bounded flex column; keep a companion sidebar stable and full-height with a `margin-bottom` gap and pin pagination with `margin-top: auto`.
- Same trap for a leaf text `<span>`: `flex: 1` + `-webkit-box` + line clamp + `overflow: hidden` in a **column** wrapper is reinterpreted as height/basis 0 and collapses to ~0px — drop `flex: 1` (or use `flex: 1 1 auto`) and rely on `align-self: stretch`. Detect it by asserting `getBoundingClientRect().height > 10`, not Playwright `isVisible()` / count.

**Unitless numeric properties (`references/remix3-css-and-layout/unitless-numeric-css-properties.md`)**

- `css()` appends `px` to numeric values outside its `NUMERIC_CSS_PROPS` allowlist on pre-#12121 builds (`@remix-run/component/src/style/style.ts`, `normalizeCssValue`); vendor-prefixed properties were not included, so `WebkitLineClamp: 2` emitted invalid `-webkit-line-clamp: 2px` and was silently dropped. Build `57ecca4cba` (#12121) made vendor-prefixed and shorthand numbers unitless (`WebkitLineClamp: 2` now works) and made `flex: <number>` emit the real shorthand — `flex: 1` is basis `0%`, which un-bounds a viewport-fill chain in an auto-height ancestor. Use `flex: '1 1 0'` for definite zero basis, and keep strings for time/angle values such as `'200ms'`/`'45deg'`. Check `getComputedStyle` or the generated rule if a clamp or scroller misbehaves.

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

**Floating row actions (`references/remix3-css-and-layout/floating-row-actions.md`)**

- Opt-in for wide admin grids only: zero-width actions column, absolute hover/focus-revealed cluster, trailing-cell fade. Not the default row treatment — one-action, bulk-selection, and blocked-action grids lose their affordance.
- Overlay only under `(min-width: 1200px) and (hover: hover)`; keep the card/visible fallback at every other width. Zero width/padding with `!important` when composing `table.th` / `table.actionCell` (sibling `@layer rmx.*`).
- **Media keys in `css()` must start with `@media `** — a constant holding only the condition silently produces a no-op rule (overlay stays visible; e2e opacity checks fail).
- Blocked actions stay focusable via `aria-disabled="true"` + `type="button"`; native `disabled` removes them from the tab order and leaves the reason unreachable in a hover-hidden cluster.

### When to Use

- You are styling a Remix 3 / `remix-ui` page and a style or layout silently does nothing, loses a specificity/layer contest, or collapses a region.
- A control toggled through `hidden`, or a hover/focus reveal, does not appear or disappear as intended.
- Flex/scroll geometry is wrong: panels collapse, lists clip instead of scroll, or a page in the sidebar shell overflows.
- You are adding a new hand-rolled link/span with an inline SVG, a `<select>` in a flex row, or a content-sized panel inside a bounded shell.
- You are adding a data grid or a two-column edit panel and need it to survive a phone and a desktop without clipping.
- An admin grid's row actions disappear while the inline edit panel is open, or a short result set leaves a tall empty bordered grid panel.
- You are reclaiming a wide admin grid's actions column, or a `css()` breakpoint override does nothing.
- Before trusting a `css()` override or a computed style, use these references' CDP / recursive-rule-walk recipes rather than `document.styleSheets`.

### Related Skills

- § Theme Tokens — theme-token rules that apply to whichever fix you pick (raw `var(--rmx-…)`, missing tokens, contrast)
- § Theme Tokens (`references/remix3-theme-conformance/glyph-add.md`) — adding a missing theme glyph in the contract and preset
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
| Vendor `light-dark(...)` palettes ignore the app `data-theme` toggle; the OS scheme wins | `references/remix3-theme-conformance/light-dark-color-scheme.md` |
| Building style strings by hand in `clientEntry` / browser DOM code (incl. `var(${theme.…})` re-wrapping) | `references/remix3-theme-conformance/cliententry-dom-styling.md` |
| What `npm run lint` enforces, a past incident with measured light/dark ratios, or the `theme.<group>.<key>` to `--rmx-*` variable-name mapping | `references/remix3-theme-conformance/metadata.md` |
| Adding an icon/glyph missing from the theme set, or a `TS2339`/`TS2741`/`GlyphValues` error on `Glyph name=…` | `references/remix3-theme-conformance/glyph-add.md` |

### Core Rules

- **Always** reference tokens through the typed `theme` object (`app/ui/theme/theme.ts`); **never** write `var(--rmx-...)` literals or bare token names. `theme.*` leaves are already `var(--rmx-...)` strings.
- **Never** hardcode colors, borders, shadows, or spacing that a token covers.
- **Never re-wrap a token**: `var(${theme.…})` becomes `var(var(--rmx-…))`, which drops the whole declaration (and `element.style.x` rejects it outright).
- **Fill vs. ink:** use `theme.colors.<group>.background` only as a surface fill paired with `.foreground`; use `.foreground` for accent text, glyphs, a border, or a native control's `accent-color`. `*.background` passes `tsc` and lint even in the wrong role.
- **Verify contrast by measurement, not lint**: toggle `data-theme="dark"` on `<html>` and read `getComputedStyle`; both gates are blind to contrast.
- **Explicit themes must set `color-scheme`**: `light-dark(...)` resolves from the used `color-scheme`, not from `data-theme`. Map explicit dark/light to `color-scheme` on `<html>`, and set `data-theme="light"` for explicit light; auto mode leaves the attribute off and uses the `light dark` meta. See `references/remix3-theme-conformance/light-dark-color-scheme.md`.
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

This skill is the **pointer/delta index** for guide `node_modules/remix/guides/07-animation.md` (the canonical motion model). The component primitives it composes with (`clientEntry`, `on`, `ref`, `mix`) are covered by the vendor `remix` skill and § Client Entries.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Motion values, entrance/exit/layout animation, reduced-motion gating, or WAAPI/`transitionend` teardown | `references/remix3-animation/gotchas.md` |

### Core Rules

**Animation (`references/remix3-animation/gotchas.md`)**

- `animateEntrance(...)` runs on insert; `animateExit(...)` keeps a removed node in the DOM until its exit finishes. Both are mixins, composed with `css()`/`on()`/`ref()`.
- Pass `true`/`false` to enable/disable without reshaping the array; `animateEntrance({ initial: false })` skips the first insertion for a key; a keyed element that returns before its exit ends is reclaimed and animated back.
- Stable `key`s are required for enter/exit/replace and for `animateLayout(...)`. `animateLayout` measures before/after and animates the delta; `size: false` animates position only.
- `app/utils/motion.ts` exports `entrance(config)`/`exit(config)` returning `false` under reduced motion; wrap as `animateEntrance(entrance({...}))` / `animateExit(exit({...}))`. The shell rule in `app/ui/document.tsx` handles CSS globally, but WAAPI (`element.animate()`) is not covered and must check `prefersReducedMotion()`.
- `spring()` returns an iterator decorated for CSS and Web Animations: stringify it in CSS, spread it into options (`{ ...spring('snappy') }`), or iterate it. `spring.transition(property, name)` builds a CSS transition value.
- `tween({from,to,duration,curve})` + `next(ts) -> { value, done }` and `easings` are for canvas, counters, and non-CSS values; prefer CSS/WAAPI for ordinary UI.
- Interruption is the default: handler signals abort, mixins cancel/replace in-flight work, and imperative code keeps the current `Animation` in setup scope and `cancel()`s it before restarting.
- The shell's `transition: none !important` beats inline `element.style.transition`, so `transitionend` never fires under reduced motion — pair every `transitionend` teardown with a timeout fallback (`app/ui/toast.ts`).
- Exit teardowns are created asynchronously; browser tests must poll for DOM removal instead of awaiting one `getAnimations()` snapshot.
- Reduced motion is not "no feedback" — prefer shorter fades, instant layout, or non-motion state changes.

### When to Use

- A node appears/disappears, a list reorders, or a card expands and should animate.
- You need a spring/tween value or an imperative WAAPI animation.
- You are adding motion and must respect reduced-motion and interruption.

### Related Skills

- `remix3-ui § Client Entries` — `clientEntry`/`on`/`ref`/runtime lifecycle
- § CSS & Layout — `css()`, `@layer rmx`, layout mechanics
- `remix3-ui § Rendering` — composing mixins and building blocks

---

## Client Entries & Browser Runtime

_(formerly `remix3-client-entries` — references live under `references/remix3-client-entries/`)_

**Consolidated from:** `remix3-queuetask-over-raf`, `remix3-firefox-single-import-map`, `remix3-aria-tabs`, `roving-tabindex-keyboard-lists`, `maxlength-programmatic-value-bypass`, `streamed-chat-markdown-finalize`, `remix3-textarea-bulk-clear-wipe`, `remix3-client-entry-decomposition`, `remix3-client-entry-factory-extraction`, `remix3-stream-controller-extraction`

This skill is the **index** for browser-side deltas that live in a Remix 3 `clientEntry`. For the Frame/entry runtime and `remix/component` component-model APIs themselves, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

### Load Only The References You Need

| Symptom / task involves... | Start with |
| --- | --- |
| A DOM op (focus, scroll, measure) must run after `handle.update()`; `requestAnimationFrame` steals focus or fires after a re-render; deciding whether a `ref` callback is enough | `references/remix3-client-entries/queuetask-over-raf.md` |
| A page works in Chromium but client entries fail in Firefox with `Multiple import maps are not allowed.` or `[createFrame] Failed to load module`; a server-hydrated textarea renders empty only in Firefox | `references/remix3-client-entries/firefox-single-import-map.md` |
| Several same-page sections should show one at a time; a section nav must deep-link via the URL hash and support Arrow/Home/End; `hidden` panels do not hide; the whole page flashes before the client entry hides inactive panels | `references/remix3-client-entries/aria-tabs.md` |
| A server-hidden element must reappear when scripting is disabled; a `<noscript>` or `<html data-*>` fallback goes live / gets wiped after a client patch | `references/remix3-client-entries/nojs-fallback-scripting-media.md` |
| A `clientEntry` needs a client-only mount, a custom event mixin, code-driven navigation (or a link-like non-anchor host), cancellation granularity / optimistic state, stable list keys / input ownership, or enhanced form submission | `references/remix3-client-entries/interactivity-runtime.md` |
| Building keyboard-navigable rich lists (roving tabindex, nested controls, focus-by-id reorder, safe re-init) | `references/remix3-client-entries/roving-tabindex-keyboard-lists.md` |
| Dense touch row lists: hover actions squeeze the label, a row menu is clipped by the scroll container, filtered move actions reorder hidden rows, or focus drops after an action | `references/remix3-client-entries/touch-row-action-menu.md` |
| View-only list views: status tabs/counts, hide-done, text-filter composition, selections hidden by filters, or sort/reverse/shuffle that must not rewrite the persisted order | `references/remix3-client-entries/view-only-list-controls.md` |
| Bulk actions over hidden selections, a target picker that must search beyond the rendered sidebar page, an atomic multi-item move, or a `window.confirm` merge that needs the styled dialog | `references/remix3-client-entries/bulk-actions-and-target-picker.md` |
| Undo that must survive a pause, a visible shortcut sheet, a mobile toolbar fold, double-click editing, or sidebar sort/page-size/result-count state that must survive navigation | `references/remix3-client-entries/lists-undo-help-and-sidebar-controls.md` |
| Setting an input/textarea value programmatically (chip, autofill, URL prefill) and the `maxLength` cap must still hold | `references/remix3-client-entries/maxlength-programmatic-value-bypass.md` |
| Streaming agent/LLM text into a chat bubble and rendering markdown only once the stream settles, without `innerHTML` | `references/remix3-client-entries/streamed-chat-markdown-finalize.md` |
| A `clientEntry` / `.browser.tsx` has grown past ~1,000 lines and mixes state, DOM, network, styles, and JSX and must be split without behavior change | `references/remix3-client-entries/client-entry-decomposition.md` |
| The clientEntry's fetch/SSE turn state machine (retry, reconnect, thread adoption, suspend gates) must become independently testable / stop touching DOM | `references/remix3-client-entries/stream-controller-extraction.md` |
| Several `clientEntry`s repeat the same entry body (delegated listener + menu/popover shell + dispatch) and must be deduplicated without breaking hydration | `references/remix3-client-entries/client-entry-factory-extraction.md` |
| An enhancer clientEntry renders `null`/a hidden div, scans server DOM, and registers module-scoped document listeners; converting it to component-owned DOM (or its `on(...)` can't hear a sibling input's events) | `references/remix3-client-entries/component-owned-dom-conversion.md` |
| Per-element `ref()` event wiring for a DOM behavior that contributes no server HTML should become one delegated browser-only `createMixin(type, { ssr: false })` on a container (or its handlers must stop reading `e.currentTarget` as the row) | `references/remix3-client-entries/browser-only-behavior-mixin.md` |
| Adding `data-rmx-prefetch` / `prefetch()` link warming, or a prefetch cost a second SSR because `run({ resolveFrame })` replaces the default resolver | `references/remix3-client-entries/frame-prefetch-cache.md` |

### Core Rules

**Post-update DOM ops: `queueTask` over `rAF` (`references/remix3-client-entries/queuetask-over-raf.md`)**

- When a DOM operation must run **after the DOM reflects a `handle.update()`** — focusing a freshly revealed input, `scrollIntoView`, scrolling an ancestor, or `getBoundingClientRect` measurement — use `handle.queueTask(() => { ... })`, **not** `requestAnimationFrame`: the vendor documents `queueTask` as running "a task during the commit after the next update", for when "DOM measurement or another update must happen as part of that flush", it is **abortable on re-render** (a rapid `draft → cancel` once let `rAF` fire and steal focus onto a removed input), whereas `rAF` is only a paint-timing primitive that says nothing about whether the Frame's DOM mutation has flushed. A `ref` callback that focuses the element itself on mount (`ref((el) => { if (el) { el.focus(); el.select() } })`) is the correct idiom for self-focus and must **not** be "fixed" into `queueTask`.
- `queueTask` attaches to a Frame **render**, so where there is no `handle.update()` keep synchronous focus: imperative DOM insertion (`document.createElement('input')` + `cell.appendChild(input)` then `input.focus()` — e.g. `client-grid-inline-edit`, `list-name-edit`) and imperative class toggles (`drawer.classList.toggle(...)` then `closeBtn.focus()` — `nav-toggle`) have no render to attach to. Authority: vendor guide `node_modules/remix/guides/05-interactivity.md` (`handle.update()` / `handle.queueTask()`: §"State, updates, and post-render tasks") and the installed `Handle` type docs (`@remix-run/component/src/runtime/component.ts:33-51`); since #11795 `handle.update()`'s own docs direct calls from an event handler or `handle.queueTask()` — the vendor-blessed remedy for the phase-guard throws (see `remix3-ui § Frames`). First application retired `app/ui/appointment-grid.browser.tsx:583` `startDraft` and `:641` `startEdit`; the `renameInputs.get(appt.id)` lookup inside `startEdit` stays valid because ref callbacks run during commit, before `queueTask`.

**Firefox honors only one import map (`references/remix3-client-entries/firefox-single-import-map.md`)**

- Firefox allows **one** `<script type="importmap">` per document and ignores extras (console: "Multiple import maps are not allowed."), while Chromium merges them. The client runtime (recorded against `@remix-run/ui@0.10.0`/rc.3; since the #11948 split the import-map manager lives in `@remix-run/component` — `appendImportMapScript` re-confirmed at `@remix-run/component@1.0.0` `dist/runtime/import-map-manager.js:87,214` on build `c1787ef`, 2026-10-12) renders the initial combined map via `<ImportMap>`, but for **deferred client entries** in a frame response it appends a **second** `data-rmx-import-map` script (import-map-manager's `appendImportMapScript`) holding the deltas for those entries' dependencies (`lists-keyboard`, `button`, `drop-zone`, `sidebar-sync`). Firefox ignores the second map, so those entries cannot resolve their bare specifiers and fail at execution — `[createFrame] Failed to load module for <hash>` (the fetch succeeds, so `requestfailed` stays empty) — client interactions stop, and a textarea hydrated from server state renders empty (the client re-render wipes children when the entry never hydrated). This is deterministic, **not** a stale browser: fresh-browser Chromium tests pass. (#11980 makes HMR-updated module imports use timestamped URLs directly instead of import maps — dev-HMR only; the deferred-entry second-map delta above is unaffected.)
- Fix by wiring `run()` to `remix/multiple-import-maps-polyfill`: `loadModule` uses `importModule(moduleUrl)` (polyfill-aware `import()`), and `processClientEntryPreloads` returns the preloads when `await detectMultipleImportMapSupport()` is true, else calls `preloadShim(preloads)` and returns `[]`; Chromium keeps native `import()` while Firefox loads late entries through the polyfill using every import map. CSP `script-src` needs only `blob:` (polyfilled module graphs evaluate from blob URLs) since #12059: the polyfill imports `es-module-lexer/minimal/js`, a pure asm.js build, so `'unsafe-eval'`/`'wasm-unsafe-eval'` are no longer required (they were before #12059; re-check the polyfill's lexer import before re-adding them). Verify in **Firefox**, not Chromium: load a page with deferred entries (e.g. `/lists?load=<id>`), check for the warning and `[createFrame] Failed to load module`, confirm two `data-rmx-import-map` scripts with the entry deltas in the second, then confirm the entry imports the polyfill and interactions work; `app/middleware/security-headers.test.e2e.ts` guards against any CSP violation during hydration.

**ARIA tabs with hash deep-linking (`references/remix3-client-entries/aria-tabs.md`)**

- Turning a stacked Remix 3 page into tabs in a `clientEntry` hits five traps: (1) `hidden` does not hide because a `display:flex` panel descriptor (author origin) beats the UA `[hidden]{display:none}` rule — see § CSS & Layout → `references/remix3-css-and-layout/hidden-attribute-display-override.md`; (2) fragments never reach the server, so SSR cannot know the hash-selected tab and the client entry must reconcile the hash with the server's default; (3) focus-banner logic (`alert.focus()`) can focus a `display:none` node unless tab visibility is applied first; (4) a swallowing `preventDefault()` click handler destroys the no-JS/history fallback that `href="#<id>"` anchors keep for free. Fix (1) with `'&[hidden]': { display: 'none' }` on the **same** panel `css()` descriptor/layer. Trap (5): server-render the inactive panels with `hidden={tab.id !== activeTab || undefined}` so only the active panel paints on first load, and restore the stacked no-JS view with a CSS rule scoped to `@media (scripting: none)`. Do **not** use a `<noscript><style>` reveal rule — the Remix UI runtime re-parses the noscript body into a live `<style>` after the first client patch, un-hiding every panel — and do **not** gate the reveal on a JS-set `<html data-js>` flag, because the runtime reconciles the document element against the server HTML and drops the flag. Do **not** "fix" the flash by leaving every panel un-hidden server-side.
- Render a `role="tablist"` of anchors (`role="tab"`, `href="#<id>"`, `id="<id>-tab"`, `aria-controls`, `aria-selected`, roving `tabindex`, `data-settings-tab`) plus `role="tabpanel"` panels (`aria-labelledby`, `tabindex={0}`, `data-settings-tabpanel`), take `activeTab` from a prop (default first), and carry it across POSTs: error re-renders pass `activeTab` (plus `data-settings-active-tab` on the container for JS-less server tests) and PRG redirects append `#<id>`. The client `activate(id, { focus, setHash })` sets each tab's `aria-selected`/`tabIndex`, toggles `panel.hidden`, then focuses and `history.replaceState(null, '', '#<id>')`; `init()` prefers a hash that matches a panel, else the `[aria-selected="true"]` tab, else the first panel. `click` calls `activate` **without** `preventDefault()`; `hashchange` re-activates for back/forward and deep links; ArrowLeft/ArrowRight/Home/End call `activate(next, { focus: true, setHash: true })` with `event.preventDefault()`. Run `init()` before any focus-banner logic (in `queueTask`) so focus never lands on a hidden panel; style the active tab via `&[aria-selected="true"]` declared **after** `&:hover` in the same descriptor (roving-tabindex/keyboard details for nested lists: `references/remix3-client-entries/roving-tabindex-keyboard-lists.md`). Server tests only see HTML — assert one `role="tab"`/`role="tabpanel"` per section plus `href="#<id>"`/`aria-controls`, `data-settings-active-tab` after an error POST, and `Location.endsWith('#<id>')` after a PRG redirect; switching, keyboard, and deep-link behavior need a browser check.

**No-JS fallbacks survive client patching (`references/remix3-client-entries/nojs-fallback-scripting-media.md`)**

- A `<noscript><style>` no-JS reveal rule becomes **live** once the client runtime re-parses the noscript body, and a JS-set `<html data-*>` flag is **wiped** when the runtime reconciles the document element. Scope such rules to `@media (scripting: none)`; server-hide with `hidden` to avoid the first-paint flash. The app currently has no no-JS reveal; the reference keeps the generic recipe and the re-parse caveat.

**Interactivity runtime: roots, mixins, navigation, forms (`references/remix3-client-entries/interactivity-runtime.md`)**

- `createRoot(container)` owns a client-only container (`render`/`flush`/`dispose`, dispose on `pagehide`); the app's only use is the fatal-error takeover in `app/assets/error-card.browser.tsx:113-135`, which runs after `app.dispose()` and replaces `document.body` — normal UI still starts on the server via `clientEntry`. `run()` exposes `app.ready()`/`app.flush()`/`app.dispose()` (guide §"Booting the browser runtime with run"); the entry's `app` never calls `ready()`/`flush()`, though tests can drive a local `run()` result that way (`app/ui/lazy-frame.test.browser.tsx`).
- Cancellation granularity: `handle.update()` resolves to an `AbortSignal` but cannot abort between the `await` and the next synchronous statement; the `on(type, (event, signal))` second argument aborts on re-run/element removal. The already-covered `handle.signal`/`queueTask` aborts live in `references/remix3-client-entries/queuetask-over-raf.md`, not here.
- `navigate(href, options)` is code-driven navigation and `link(...)` gives a non-anchor host `role="link"`/Enter/modifier activation/`aria-disabled`; `attrs(...)` supplies non-overriding defaults. The app's only `navigate` call is `app/actions/scroll-restoration/public/scroll-restoration.tsx:81`; frame navigation elsewhere uses a local `navigateFrame` helper in `app/actions/lists/public/lists-client.tsx:291` plus `handle.frame.reload` in `app/actions/lists/public/lists-sidebar-keyboard.tsx:63`, so grep hits for `navigate(` are not all client navigation. `app/ui/appointment-sidebar.tsx` is server-rendered and imports no `navigate`; `link()`/`attrs()` remain unused.
- Optimistic UI belongs in the data model with its reconcile/rollback policy (setup-scope pending state only drives disabled/label state); use stable list ids, not index keys, and keep controlled vs uncontrolled input ownership straight. Enhanced submit intercepts `submit`, posts `new FormData(form)` with the handler signal, and follows a redirect with `navigate(response.url, { history: "replace" })` — the app's existing agent/chat SSE+JSON interception is a separate boundary.

**Keyboard-navigable lists (`references/remix3-client-entries/roving-tabindex-keyboard-lists.md`)**

- Guard bubbled keydown at the top of the row handler (`if (e.target !== e.currentTarget) return`) so nested checkbox/textarea/buttons keep their semantics; track the roving `tabindex`/focus by stable item id (fall back to the first item when the focused id was deleted, or every row becomes `tabindex="-1"`); abort the previous wiring pass before re-initializing (per-row `AbortController`s or one delegated listener); exclude modifier keys from typeahead.

**Touch row action menus (`references/remix3-client-entries/touch-row-action-menu.md`)**

- On `(hover: none)`, do not merely force a 4-button hover cluster visible: it overlays/squeezes the label and a full-width bar doubles row height. Hide the view cluster with `display: none`, show one 44px kebab, and render the menu as an inline `flex-basis: 100%` second line; keep the edit-mode cluster inline and full-width.
- When a filter hides rows, hide position-based move actions **and** guard the mutation (`if (filterActive()) return`). A move against a hidden neighbour can leave the visible order unchanged while persisting a new order.
- Restore focus after Escape/action with `handle.queueTask`: prefer the kebab, fall back to `[data-item-id]` when the trigger is `display: none`, then the add field; use `CSS.escape` for selector ids. `queueTask` only drains on a component update — a client entry that mutates DOM attributes imperatively must call `void handle.update()` after queueing, or the task never runs.
- View-only list controls stay out of the persisted model: keep `statusFilter`/`hideDone`/`sortMode`/`reverseView`/`shuffleOrder` in the client closure, build the rendered rows through one pure `buildVisibleItems` pipeline, and gate drag/grab/array-adjacent moves with `reorderLocked()`. ↑/↓ buttons and the touch move menu use the narrower `visibleReorderLocked()`; hide-done keeps them available by swapping with the nearest **visible** neighbour (hidden done rows keep their slots, boundaries follow the visible index), while text/status filters and view-only orders still hide them. None of these controls call `setDirty()` or `showUndo()`. Status counts follow the text filter, hidden selections are labeled, and the filtered empty state offers a reset. Details: `references/remix3-client-entries/view-only-list-controls.md`.
- Server-rendered sidebars reuse the same inline menu: one always-visible 44px trigger after the link, a `display: none` `[data-list-menu]` toggled by a client entry with `aria-expanded`, and a row `flex-wrap` second line so the scrolling `<nav>` cannot clip it. In a phone drawer, scope the "destination chosen" collapse to `a[href]` so opening a row menu does not hide the drawer.
- The undo chip should stay until the next mutation, not expire on a timer: have `showUndo` set a one-shot guard consumed by the following `setDirty`, and bind Ctrl/Cmd+Z on `document` while leaving inputs/textareas/selects/contenteditable alone. A visible help sheet keeps the live-region announcement and restores focus with `queueTask` then `update`. Key a mobile toolbar fold on `max-width: 768px` (not `hover: none`) so the 390px e2e tests the real branch; `on('dblclick')` is not in the event map, so use the row click's `detail === 2`. Sidebar sort/page-size belong in the same GET form as search so one submit serializes filter/sort/size/load, and every generated link must append all of them. Details: `references/remix3-client-entries/lists-undo-help-and-sidebar-controls.md`.
- Bulk actions must include hidden selected rows (snapshot/undo over the full `items`, not `visibleItems()`), and multi-item moves want one atomic server route instead of a client loop racing If-Match. Do not point a session UI at `/api/*` just for JSON: those routes are token-only and skip CSRF; add a session-authenticated action on the page route. A `position: fixed` confirm dialog mounted inside a `position: sticky` sidebar is trapped in that stacking context — mount it as a direct child of the page grid. Details: `references/remix3-client-entries/bulk-actions-and-target-picker.md`.

**Programmatic `maxLength` (`references/remix3-client-entries/maxlength-programmatic-value-bypass.md`)**

- `element.value = x` bypasses `maxLength` (it only guards typing/pasting); clamp with `.slice(0, MAX)` using the same shared constant the server validates against, then re-run the counter and `setSelectionRange(value.length, value.length)`.

**Finalize streamed markdown once (`references/remix3-client-entries/streamed-chat-markdown-finalize.md`)**

- Stream the reply as plain `textContent` and render markdown **once** in the terminal `complete` handler, targeting a `data-kind="text"` bubble (a tool-result card/approval gate can be the last element); build the DOM with `createTextNode`/property assignment, never `innerHTML`, and restrict links to `http(s)`.

**Decomposing a large `clientEntry` (`references/remix3-client-entries/client-entry-decomposition.md`)**

- Extract in order — styles → pure state → network → cohesive DOM subsystem → view — keeping the tree green after each step. The view split's trap: you **cannot** keep reads via destructuring and writes via assignment (`let { title } = view` copies a primitive and writes the local, not the closure) — convert every inline mutation to a setter callback (`view.setTitle(v)`) and every ref that writes closure state to a `view.onXRef(el)` hook. Never slice a block by line offset (numbers shift after any edit) — anchor on unique content and re-read after each write; match the static-import source extension (`.tsx`).

**Deduplicating similar `clientEntry`s with a shared factory (`references/remix3-client-entries/client-entry-factory-extraction.md`)**

- `clientEntry(entryId, component)` only tags the function (`$entry`/`$entryId`); hydration resolves from the id's `#ExportName`, not function identity. Extract the body into a factory but keep `clientEntry(import.meta.url + '#Name', factory({...}))` at each call site — a factory calling `clientEntry` itself points `href` at the wrong module and the export name is absent there. The shared module must be under an allowFiles path. Preserve the select guard, and only `handle.update()` on capture when rendered items depend on the captured row. Direct-render browser tests bypass hydration — verify with an e2e that waits for a hydration marker (`state: 'attached'`; the trigger is invisible).

**Browser-only behavior mixin over delegated listeners (`references/remix3-client-entries/browser-only-behavior-mixin.md`)**

- A DOM behavior that contributes no server HTML (drag-and-drop, pointer menus) belongs in `createMixin(setup, { ssr: false })` applied to its container, not in per-element `ref()` listeners re-created every render. Follow the vendor `on()` mixin's lifecycle: capture `handle.signal` in setup, bind on `insert` (`event.node`), rebind when a different node is inserted, let the scope signal own teardown. First application: `app/actions/lists/public/lists-drag-mixin.ts` (`drag(ctx)`) replacing the per-row drag `ref()`s in `lists-view.tsx`; commit `868aa6c`.
- The delegation trap: `e.currentTarget` becomes the container, so row-scoped handlers must take the row explicitly (`handleDragStart(e, index, row)`); keep capture-phase listeners (edge auto-scroll) capture-phase, branch the single bubble-phase delegated handler on `target.closest('[role="listitem"]')`, and export the wiring function (`wireListsDragHost`) so the browser test drives the exact production path against a fixture.

**Frame prefetching (`references/remix3-client-entries/frame-prefetch-cache.md`)**

- `data-rmx-prefetch="intent"` / `prefetch()` only pay off with a custom `run({ prefetch })`: the runtime default fetches its own HTML and bypasses the app's `resolveFrame` (agent prefill, 4xx/5xx policy, redirect reconciliation, `no-store`), so the prefetched document is discarded and the navigation fetches again. `app/assets/frame-prefetch.browser.ts` keeps a single-use, target-keyed, 10 s cache warmed through `prefetchFrameResponse` and claimed by `resolveFrame`; prefetch mode must never call `window.location.assign` and must not consume `agentPrefillMap`; only plain GETs (no `formData`) are warmable, and a click that races an in-flight warm must await it (`claimPrefetchedFrame`) rather than clear + refetch.

### When to Use

- You are adding `data-rmx-prefetch` to navigation links, deciding whether link prefetching is worth it, or wondering why the runtime's prefetcher does not reuse this app's frame HTML.
- You are building browser behavior in a Remix 3 `clientEntry` and the DOM does not do what the server render implies: an op must wait for `handle.update()`, client entries silently do nothing in Firefox, or same-page panels need to become hash-deep-linked ARIA tabs.
- A page works in Chromium but client interactions, hover reveals, drag-and-drop, or textarea hydration fail in Firefox (especially after a remix/import-map upgrade); or a `requestAnimationFrame` focus/measure callback fires too early, too late, or after the element was removed.
- Before adopting `requestAnimationFrame` for post-render DOM work, wiring the multiple-import-maps polyfill, or hand-rolling tabs over `hidden` panels.
- You are adding a client-only `createRoot`, a custom event mixin (`createMixin`/`handle.element`), code-driven `navigate` or a link-like non-anchor host (`link`/`attrs`), optimistic UI, stable list keys, or an enhanced form submit that follows a controller redirect — see `references/remix3-client-entries/interactivity-runtime.md` for the guide sections and the app's actual seams.
- You are adding keyboard navigation/reorder to a list of rich rows containing nested controls.
- You are adding per-row actions to a dense touch list, or a filtered list with position-based reorder controls.
- You set a `maxLength`-bounded field programmatically (chip click, autofill, URL prefill, draft restore) and the counter can exceed the cap.
- You stream agent/LLM text into a chat bubble and want markdown rendering in the settled reply without an `innerHTML` XSS risk.
- A single `clientEntry`/`.browser.tsx` has grown past ~1,000 lines and mixes state, DOM, network, styles, and JSX — see `references/remix3-client-entries/client-entry-decomposition.md` for the extraction order and the view-model setter rule.
- Several `clientEntry`s repeat the same entry body (delegated listener + menu/popover shell + dispatch) and must be deduplicated without breaking hydration — see `references/remix3-client-entries/client-entry-factory-extraction.md` (keep `clientEntry(...)` at each call site).

### Related Skills

- `remix3-ui § Frames` — `<Frame>` navigation, `clientEntry` hydration/lifecycle, and the phase-guard throws that `queueTask` remedies
- § CSS & Layout — the `hidden`-attribute/`display` override and other `remix-ui` styling traps the tab panels depend on
- `remix3-tooling § Testing` — driving `clientEntry` DOM side effects and browser-test stubs that these behaviors need
- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical `remix/component` component-model, `queueTask`, and runtime import-map APIs

---

## Frames & clientEntry Hydration

_(formerly `remix3-frame-cliententry` — references live under `references/remix3-frame-cliententry/`)_

Remix 3's `<Frame>` component and `clientEntry` hydration model form a tightly coupled lifecycle. Frames intercept GET navigations via the browser Navigation API, replacing DOM content server-side without full-page reloads; `clientEntry` components hydrate inside those frames. The interaction produces hard-to-debug failure modes: `handle.update()` cascades fire on large frames, `mounted` guards silently break after Frame DOM replacement, and binary responses crash the frame router.

This skill is the **index** for the version-pinned deltas. For the framework API itself, use the vendor reference `node_modules/remix/guides/06-streaming-ui-with-frames.md`; for component-local state and mixins, `node_modules/remix/src/component/README.md`.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Form interception in frames (post-#11668), `resolveFrame`, frame direct render, `data-rmx-document`/`data-rmx-history`, nested-frame PRG redirects | `references/remix3-frame-cliententry/frame-navigation.md` |
| `clientEntry` cascade limits, `mounted` guards after reload, the hydration-marker wait rule (including `state: 'attached'` for a marker an entry hides), reload-driven data loading, the `reloadStart`/`reloadComplete` pre/post-reload hooks (loading state + pre-swap flush), keeping focus in a live-search field across a frame reload (`data-rmx-reset-focus="manual"` + re-focus), global document listeners, SSR-safety/authoring constraints, server-rendering a `clientEntry` from props (DOM-script data → serializable props, props refresh on frame navigation, hydration-only values, SSR tests) | `references/remix3-frame-cliententry/cliententry-lifecycle.md` |
| Styling clientEntry children, joined button groups, inline-edit table cells, `on` mixin hydration, drag-and-drop, fragment scrolling | `references/remix3-frame-cliententry/cliententry-dom-and-styling.md` |
| Frame target registration/content-only panels, nested-frame registration inside a fragment-hydrated frame, `<input>` `defaultValue` preservation, asserting on frame-rendered HTML in tests, timing an e2e click after named-frame registration | `references/remix3-frame-cliententry/frame-layout-and-testing.md` |
| Deferring frames until visible (LazyFrame/IntersectionObserver), collapsed or offscreen frame content, measuring frame fan-out | `references/remix3-frame-cliententry/lazy-frames.md` |
| A frame-targeted form POSTs to a method-only route (frame GETs it → 404), or a racing SSE invalidate-reload crashes with `Node.insertBefore` | `references/remix3-frame-cliententry/frame-form-action-get-route.md` |
| Converting a clientEntry tab/panel switcher to server-rendered frame navigation, a POST validation/success message vanishes because the frame content came from a separate GET, or deciding whether a frame conversion is actually a code reduction | `references/remix3-frame-cliententry/frame-server-view-switching.md` |
| A frame-shell page shows the breadcrumb/page name twice on a full GET (top-level Layout also renders one) | `references/remix3-frame-cliententry/frame-shell-duplicate-breadcrumb.md` |
| A frame editor's "create new" mode has no server id and navigation would lose typed content | `references/remix3-frame-cliententry/frame-unsaved-draft.md` |
| A `session.flash` PRG message never appears in a frame fragment, or a test reads an empty session | `references/remix3-frame-cliententry/session-flash-frames.md` |
| A client-owned attribute on a reconciled element (root `data-theme`, `open`, custom) reverts after a frame/document reload | `references/remix3-frame-cliententry/preserve-client-owned-attrs.md` |
| A frame fails/cancels or its resolver must choose a fallback vs a login redirect; whether returned frame HTML is safe; `renderToString`/`renderWith`; a `data-rmx-src` link is not intercepted; native validation/`submit` ordering; stale server props after a frame reload | `references/remix3-frame-cliententry/frame-failures-and-rendering.md` |

- `references/remix3-frame-cliententry/frame-navigation.md` — the frame navigation/forms contract and escape hatches.
- `references/remix3-frame-cliententry/cliententry-lifecycle.md` — the entry's mount/hydration/re-render lifecycle traps, plus the `reloadStart`/`reloadComplete` pre/post-reload hooks.
- `references/remix3-frame-cliententry/cliententry-dom-and-styling.md` — DOM mutation and CSS patterns inside entries.
- `references/remix3-frame-cliententry/frame-layout-and-testing.md` — layout wiring and verification.
- `references/remix3-frame-cliententry/lazy-frames.md` — the eager/lazy decision rule, the `name`/auth trap, and how to measure and verify frame fan-out.
- `references/remix3-frame-cliententry/frame-form-action-get-route.md` — the action-path-must-resolve-as-GET contract (404 vs `Node.insertBefore` crash).
- `references/remix3-frame-cliententry/frame-server-view-switching.md` — server-rendered view switching (tabs/steps), the POST-state-must-render-inline trap, and the profitability check.
- `references/remix3-frame-cliententry/frame-shell-duplicate-breadcrumb.md` — suppressing the top-level Layout's breadcrumb for shell pages.
- `references/remix3-frame-cliententry/frame-unsaved-draft.md` — `sessionStorage` draft persistence for id-less "create new" editors.
- `references/remix3-frame-cliententry/session-flash-frames.md` — flash banner in fragment render paths + parsing the signed session cookie in tests.
- `references/remix3-frame-cliententry/preserve-client-owned-attrs.md` — keeping client-owned attributes (root theme) across reloads via `data-rmx-preserve-attrs`.
- `references/remix3-frame-cliententry/frame-failures-and-rendering.md` — failure/cancellation contract, frame HTML security, complete-HTML rendering, and interception limits.

### Core Rules

**Frame failures, complete-HTML rendering, and interception limits (`references/remix3-frame-cliententry/frame-failures-and-rendering.md`)**

- The app's `resolveFrame`, not the runtime, decides a non-2xx frame outcome: a 4xx body renders in the slot, a 5xx becomes a bounded `ErrorCard` fragment, and a 401 becomes the full-page login redirect — so the global `error` event only sees genuine runtime faults, and frame render errors stay silent by design (the `fallback` is the visibility mechanism).
- A supplied `data-rmx-src` must be a valid same-origin URL regardless of `data-rmx-target`; invalid or cross-origin values disable interception. Native constraint validation and the native `submit` event always run before Remix intercepts, and several admin forms here set `novalidate`.
- `renderToString()` (frame-free complete HTML) and `renderWith()` (a different renderer) are vendor APIs with no production app call site; the only `renderToString()` use is the Bun SSR-regression test in `app/actions/lists/public/lists-search.test.tsx`. Frame fragments stream through `context.render(..., fragmentResponseInit())`.
- After a frame reload a clientEntry keeps its factory-closure setup state but receives fresh `handle.props` — read changing server values in the render function, never snapshot them in the closure.

### Core Invariants

- `app/assets/entry.tsx` (`run({ resolveFrame })`) is the always-loaded client runtime, not per-page user code. Removing it does not make a page "more SSR" — it removes enhancement and falls back to full-document navigation.
- A frame that has not mounted cannot be addressed — defer only frames that nothing points at, or navigation to them silently becomes a full frame reload.
- A `<Frame>` present in the server HTML is registered synchronously during hydration *before* any `clientEntry` module hydrates (`hydrateContainer` runs `createSubFrames` before `scheduleHydrationMarker`), so a `data-rmx-target` link to it is already addressable once any shell clientEntry has run — see `references/remix3-frame-cliententry/frame-layout-and-testing.md`.
- Make the server route correct before layering `clientEntry`/frame interactivity on top.
- `handle.update()` only from an event handler or `handle.queueTask()` — never from setup, render, or a `dragover`/resize/scroll handler.
- The factory closure of a `clientEntry` persists across frame DOM replacement; only the render function re-runs. State a "did I mount?" fact in the closure only if the render function cannot observe the new DOM.
- For cross-boundary transitions the frame runtime must not intercept (binary downloads, cross-section links, login), use `data-rmx-document` — do not disable the runtime.
- Programmatic frame navigation is `frame.reload({ src: href })` (build `044d8372`, remix #11938); `frame.src = href; frame.reload()` is the pre-#11938 equivalent. `reload({ method, body })` submits form data without changing history (GET encodes into the query; POST defaults to URL encoding).
- Under HMR, a frame response can carry a client-entry href newer than the live one (`getScriptEntry`/`getHref` now retain the HMR timestamp, remix #11980, build `c1787ef`); the runtime compares client-entry identity with exactly one 13-digit `t=` query segment ignored (`@remix-run/component` `dist/runtime/client-entry-boundary.js` `HMR_TIMESTAMP_QUERY_SEGMENT_PATTERN`), so the existing entry keeps its state instead of remounting. Two `t` segments → not ignored → treated as different entries. Dev-only; production hrefs are fingerprinted, not timestamped.

> Version-pinned facts here reference the pinned `remix` preview build (see `package.json`). Re-check against the installed vendor source before relying on them.

### When to Use

- A frame fails or is canceled and you need to know which hook reports it, or the resolver must choose between bounded fallback HTML, an auth redirect, and rejecting to the runtime handler.
- You are checking whether returned frame HTML is safe, or a `data-rmx-src` link or frame form is not intercepted.
- You need a complete HTML string (`renderToString`) or a different renderer (`renderWith`).
- A clientEntry shows stale server-derived values after a frame reload because props were cached in the factory closure.

---

## JSX Attribute Conventions

_(formerly `remix3-jsx-attribute-conventions` — references live under `references/remix3-jsx-attribute-conventions/`)_

**Consolidated from:** `remix3-svg-attributes`, `remix3-jsx-attribute-rename-blind-spot`

This skill is the **index** for the consolidated JSX attribute conventions. Read only the reference you need.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Writing inline SVG (camelCase attributes do not render), or an `rmx-*` runtime attribute appears dead after a rename | `references/remix3-jsx-attribute-conventions/jsx-attributes.md` |

### Core Rules

Remix 3 uses its own JSX runtime (`remix/component`, `jsxImportSource: "remix/component"`), not React. It passes attributes through **verbatim** — there is no React-style attribute-name translation. Two consequences follow, both silent breakages:

1. SVG presentation attributes must be written in **kebab-case** (the SVG spec's lowercase form), not React camelCase.
2. Because JSX props are typed as `Record<string, any>`, attribute renames/typos **compile without error** — verify runtime attribute contracts at the runtime layer, not via `tsc` or render assertions.

- **Kebab-case SVG**: `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stop-color`, `fill-rule`, etc. — see the full mapping in `references/remix3-jsx-attribute-conventions/jsx-attributes.md`.
- **`ElementProps = Record<string, any>`**: strict `IntrinsicElements` prop types (e.g. `FormHTMLProps` with `data-rmx-target`) are never enforced on JSX, so renames and typos pass typecheck; server-render tests pass too because they assert what a component *emits*, not what the runtime *reads*. See `references/remix3-jsx-attribute-conventions/jsx-attributes.md`.
- **Verify at the runtime layer**: grep the installed package for the actual attribute, sweep the app with a negative-lookbehind regex, add a render test for the new name, and exercise the real flow in a browser.

### When to Use

- Rendering inline SVG elements in Remix 3 components (migrating SVG from React, or icons not rendering)
- Upstream `remix`/`@remix-run/component` renames, removes, or adds a runtime attribute
- A `data-rmx-*` / `rmx-*` / `ln-*` attribute appears dead (frame targeting, document escape, or history semantics not working)
- Diagnosing "tests pass but feature silently broken" in a Remix 3 frame app
- Before trusting `npm run typecheck` after bumping the pinned `remix` build (`github:remix-run/remix#preview/main`)
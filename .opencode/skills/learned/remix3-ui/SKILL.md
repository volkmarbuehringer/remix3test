---
name: remix3-ui
description: "Use when building or styling Remix 3 pages, components, <Frame> navigation, or clientEntry browser behavior — the index of learned UI deltas: app document shell/asset entry, css() vs @remix-run/ui primitives, unsafeHTML and remix/html-template, overrides losing inside @layer rmx.*, hover/focus reveal, theme-token conformance (raw var(--rmx-…) strings, *.background vs .foreground misuse, missing contract tokens, light-dark vs color-scheme), flex/bounded-scroll/sidebar and admin-grid layout traps (native <select> overflow, the hidden attribute not hiding, glyph/SVG wrapping), motion + reduced-motion boundaries, the createRoot/run() runtime, queueTask vs requestAnimationFrame, browser-only mixins, ARIA tabs and no-JS fallbacks, Firefox import maps, the /lists editor patterns, frame targets and data-rmx-* escapes, frame failures/reloads, session.flash in fragments, renderToString/renderWith, and remix/component JSX attribute conventions. Each section's table names the reference that owns the detail."
user-invocable: false
origin: consolidated
---

# Remix 3 UI: Rendering, Styling, Frames & Client Entries

This skill is the **index** for the learned UI deltas: each section is a routing table plus the cross-cutting invariants that decide which reference to load. Detail, app seams, and version-pinned line refs live in the references; everything vendor-supplied (guides, package READMEs, the vendor `remix` skill) stays authoritative and is linked, never restated. Consolidated from 5 former learned skills (`remix3-rendering-ui`, `remix3-client-entries`, `remix3-frame-cliententry`, `remix3-jsx-attribute-conventions`, `remix3-styling`); references are namespaced under `references/<former-skill>/`.

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

Delta index for the app's document shell, component context, first-party block choices, and HTML escape hatches. Canonical patterns: `node_modules/remix/guides/04-rendering-ui.md`; component mental model: vendor `remix` skill.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Sharing a value with descendant components (`handle.context`), generating a stable DOM id (`handle.id`), or a browser-reactive context value (`TypedEventTarget`) | `references/remix3-rendering-ui/component-context-and-handle-id.md` |
| Adding to `<head>` (meta/og, modulepreload, styles, CSP nonce), wiring the browser entry script / import map, or `context.render(tree, ResponseInit)` | `references/remix3-rendering-ui/document-shell-and-asset-entry.md` |
| Choosing between app-owned `css()` styling and an `@remix-run/ui` headless primitive, or deciding whether to wrap/replace a vendor component | `references/remix3-rendering-ui/first-party-ui-blocks.md` |
| Rendering raw HTML through a prop (`innerHTML`, iframe `srcDoc`/`srcdoc`) and `Framework invariant: Invalid … prop` throws after a Remix bump | `references/remix3-rendering-ui/unsafe-html.md` |
| Returning an HTML string outside the component runtime (standalone 500/429/error pages, frame fragments, email/RSS), with XSS-safe interpolation | `references/remix3-rendering-ui/html-template.md` |

### Core Rules

- The shell is app-owned: `app/ui/document.tsx` plus request-scoped `getAssetEntry()` middleware state (the guide's `app/actions/document.tsx` + `scriptEntry` shape does not exist here). Global head/import-map/preload work belongs on document responses only — `loadAssetEntry` skips frame requests, so a fragment never has an entry.
- `handle.context` is **component-tree** context; this app's request context is the separate `remix/middleware/async-context` `getContext()`/middleware `context`. Never mix them, and remember `handle.context.set` schedules no render.
- Style the native control with `css()` before reaching for an `@remix-run/ui` primitive, and interactive controls need a `clientEntry` boundary. The app wrappers own the attribute contract: `button()` must keep upstream's `type="button"` default, and an anchor styled as a button uses `buttonLink()` — never nest `<button>` in `<a>`.
- Raw-HTML props accept only the opaque `unsafeHTML()` value, which authorizes but does not sanitize. Outside the component runtime, use the `html` tagged template; dropping the tag without a manual escape helper silently drops XSS escaping.

### When to Use

- Editing the document shell, adding head tags/preloads, or wiring the browser entry/import map; a fragment is missing its entry or import map.
- Passing a value to a descendant without prop-drilling, needing a stable id for a label/ARIA relationship, or sharing browser-reactive state.
- Choosing among `css()`, an `@remix-run/ui` primitive, and this app's wrappers; a link styled as a button submits its form, or an untyped `button()` starts submitting after a vendor bump.
- A raw-HTML prop throws `Invalid innerHTML`/`srcDoc`/`srcdoc`, a mixin returning one is now stripped, or you are writing an HTML-string response (standalone error page, frame fragment, email/RSS).

---

## CSS & Layout

_(formerly `remix3-css-and-layout` — references live under `references/remix3-css-and-layout/`)_

Delta index for styling/layout failures that look like "the CSS did nothing": cascade-layer losses, the flex/basis and bounded-scroll chain, reveal selectors, and grid/shell geometry. Framework CSS API: vendor `remix` skill; tokens: § Theme Tokens.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| A hover/focus reveal stays pinned open after a pointer click, or two toolbars show after a reorder (`:focus-within` trap) | `references/remix3-css-and-layout/hover-reveal.md` |
| A `css()` override silently loses to vendor rules (double borders, wrong divider colour, `& > *` ignored) while sibling rules apply | `references/remix3-css-and-layout/cascade-layer-overrides.md` |
| An inline icon/glyph sits on its own line above its label; a link/span containing an SVG wraps vertically | `references/remix3-css-and-layout/svg-reset-inline-wrap.md` |
| A native `<select>` overflows its flex row because of long option text | `references/remix3-css-and-layout/native-select-flex-contain.md` |
| A content-sized flex-column panel/card collapses to its header; a bounded full-height shell under-sizes | `references/remix3-css-and-layout/content-sized-flex-panel.md` |
| A viewport-bounded page/grid stops scrolling after a remix bump; `css({ flex: 1 })` now serializes as basis `0%` | `references/remix3-css-and-layout/bounded-scroll-flexchain.md` |
| A viewport-bounded page's inner list/sidebar won't scroll; a `flex: 1` child is clipped by an `overflow: hidden` `display: block` wrapper | `references/remix3-css-and-layout/bounded-scroll-flexchain.md` |
| Filling the available height in an admin sidebar shell; `height: 100vh` overflows the stacked chrome | `references/remix3-css-and-layout/full-height-sidebar-shell.md` |
| A plain-`Layout` (no sidebar) grid shows a page scrollbar; you want the header/filters pinned and only rows to scroll | `references/remix3-css-and-layout/plain-layout-bounded-grid.md` |
| A nested scroll container keeps/clamps its offset after a frame navigation; a grid jumps or lands mid-page when paging | `references/remix3-css-and-layout/nested-scroller-navigation-reset.md` |
| `hidden` / `toggleAttribute('hidden', …)` has no visual effect; an author `display` in `css()` overrides the UA `[hidden]` rule | `references/remix3-css-and-layout/hidden-attribute-display-override.md` |
| Inspecting generated rules in the browser — `document.styleSheets` iteration shows nothing | `references/remix3-css-and-layout/hover-reveal.md`, `references/remix3-css-and-layout/cascade-layer-overrides.md` |
| A scrollbar is missing in Firefox although `&::-webkit-scrollbar` is set | `references/remix3-css-and-layout/bounded-scroll-flexchain.md` |
| An admin grid overflows on mobile / hides its row actions, or opening the two-column edit panel clips the table columns | `references/remix3-css-and-layout/admin-grid-responsive-panels.md` |
| An admin grid's actions column overflows, a hover-reveal cluster should reclaim its width, or a `css()` breakpoint override silently does nothing | `references/remix3-css-and-layout/floating-row-actions.md` |
| A desktop-only hide keeps an element visible, a narrow mouse window keeps the touch layout, or a new breakpoint flips browser-test focus/visibility | `references/remix3-css-and-layout/responsive-show-hide.md` |

### Core Rules

- `css()` emits one `@layer rmx.<class>` sub-layer per class: inside a layer **sub-layer order decides and specificity is irrelevant**, unlayered CSS beats every `rmx.*` layer, and which sub-layer is last depends on class registration order — so the same override can win on one element and lose on its sibling. Fix on the target element, after the mixin, with `!important` for contested properties (or a genuinely later app layer), and verify with CDP, not `document.styleSheets`.
- `css({ flex: 1 })` is `flex: 1 1 0%` since #12121: use `flex: '1 1 0'` in a viewport-fill chain and `flex: '1 1 auto'` in a content-sized column, and give **every** nested level `min-height: 0`. A `display: block` + `overflow: hidden` wrapper clips its `flex: 1` child instead of letting it scroll.
- An author `display` — including any `css()` descriptor — beats the UA `[hidden] { display: none }` rule, so a `hidden`/`toggleAttribute('hidden', …)` toggle needs `&[hidden] { display: none }` in the same descriptor.
- Drive hover/focus reveals from the row's `&:hover` plus `:focus-visible`/`:has(:focus-visible)`, never `:focus-within` (a pointer click focuses without matching `:focus-visible`, so the cluster pins open); drop the opacity transition so a reorder swap shows one cluster; gate destructive actions separately instead of trapping clicks with `pointer-events`.
- A media key in `css()` must be the full query (`'@media (min-width: 1200px) and (hover: hover)'`) — a bare condition held in a constant produces a silent no-op rule.

### When to Use

- A style or layout silently does nothing, loses a layer/specificity contest, or collapses a region.
- A `hidden` toggle or a hover/focus reveal does not appear/disappear as intended, or two toolbars show after a reorder.
- Flex/scroll geometry is wrong: panels collapse, lists clip instead of scrolling, or a page in the sidebar shell overflows.
- Adding a hand-rolled icon link, a `<select>` in a flex row, a content-sized panel in a bounded shell, a data grid / two-column edit panel, or floating row actions on a wide admin grid.
- Before trusting a computed style or a `css()` override: use these references' CDP / recursive-rule-walk recipes, and drive the assertions with `remix3-tooling § Testing` (`references/remix3-testing/cliententry-browser-tests.md`).

---

## Theme Tokens

_(formerly `remix3-theme-conformance` — references live under `references/remix3-theme-conformance/`)_

Delta index for theme-token conformance: styling goes through the typed `theme` object, whose leaves resolve to `--rmx-*` variables — role, contract completeness, contrast, and `color-scheme`.

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

- Reference tokens only through the typed `theme` object (`app/ui/theme/theme.ts`); never write `var(--rmx-…)` literals or hardcode a value a token covers. `theme.*` leaves **already are** `var(--rmx-…)` strings, so never re-wrap them: `var(${theme.…})` yields `var(var(--rmx-…))` and the parser drops the whole declaration.
- `.background` is a surface fill (pair it with `.foreground`); text, glyphs, borders, and a native control's `accent-color` take `.foreground`. Role confusion passes `tsc` and lint.
- The contract (`app/ui/theme/contract.ts`) is the source of truth: a value defined only in `app/theme.tsx` resolves to `undefined` and its declarations are silently dropped — add a missing token to the contract **and** both `Theme`/`DarkTheme` before referencing it.
- Contrast is verified by measurement (force `data-theme`, composite ink alpha × ancestor `opacity`), not by lint — both gates are blind to it.
- `light-dark()` follows the used `color-scheme`, not `data-theme`: map explicit dark/light to `color-scheme` on `<html>`, and represent explicit light as `data-theme="light"` (attribute set, not removed); auto mode leaves it off and uses the `light dark` meta.

### When to Use

- Writing styles in a component, a `clientEntry`, or stream/browser DOM code.
- Adding or reviewing a status badge, accent glyph, coloured label, destructive-outline button, or an `accent-color`-styled native control (check `.background` vs `.foreground`).
- A token is `undefined` or a declaration silently does nothing (check `contract.ts`, not just `app/theme.tsx`).
- A theme toggle flips the app but vendor `light-dark(...)` palettes stay on the OS scheme.
- A screen needs an icon missing from the theme set, or `Glyph name=…` trips a `GlyphValues` type error.

---

## Animation & Motion

_(formerly `remix3-animation` and `imperative-motion-gotchas` — references live under `references/remix3-animation/`)_

Delta index for motion above guide `node_modules/remix/guides/07-animation.md`: presence/layout mixins, springs/tweens, interruption, and where the reduced-motion boundary stops.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Motion values, entrance/exit/layout animation, reduced-motion gating, or WAAPI/`transitionend` teardown | `references/remix3-animation/gotchas.md` |

### Core Rules

- `animateEntrance`/`animateExit`/`animateLayout` are mixins composed with `css()`/`on()`/`ref()` and need stable `key`s. Wrap their configs in `app/utils/motion.ts` `entrance()`/`exit()`, which return `false` under reduced motion.
- The shell's reduced-motion guard (`transition: none !important` on `body` and `*`) beats inline `element.style.transition`, so every `transitionend` teardown needs a timeout fallback — and it does **not** cover WAAPI, so `element.animate()` must check `prefersReducedMotion()` itself.
- Interruption is the default: handlers and mixins abort their own in-flight work, while imperative code keeps the current `Animation` in setup scope and `cancel()`s it before restarting.
- Since #12220 `animateExit()` starts its animations synchronously in `beforeRemove`, so a `getAnimations()` snapshot right after close observes them; the persisted teardown/removal still settles asynchronously, so browser tests poll for DOM removal.
- Reduced motion is not "no feedback" — prefer shorter fades, instant layout, or a non-motion state change.

### When to Use

- A node appears/disappears, a keyed list reorders, or a card expands and should animate.
- You need a spring/tween value or an imperative WAAPI animation.
- Adding or auditing reduced-motion handling, a `transitionend` cleanup leaks a node, or an exit-animation browser test flakes.

---

## Client Entries & Browser Runtime

_(formerly `remix3-client-entries` — references live under `references/remix3-client-entries/`)_

Delta index for browser behavior that lives in a `clientEntry`; the entry/`Frame` runtime itself is § Frames, and the `remix/component` API is the vendor `remix` skill plus package READMEs.

### Load Only The References You Need

| Symptom / task involves... | Start with |
| --- | --- |
| A DOM op (focus, scroll, measure) must run after `handle.update()`; `requestAnimationFrame` steals focus or fires after a re-render; deciding whether a `ref` callback is enough | `references/remix3-client-entries/queuetask-over-raf.md` |
| A page works in Chromium but client entries fail in Firefox with `Multiple import maps are not allowed.` or `[createFrame] Failed to load module`; a server-hydrated textarea renders empty only in Firefox | `references/remix3-client-entries/firefox-single-import-map.md` |
| Several same-page sections should show one at a time; a section nav must deep-link via the URL hash and support Arrow/Home/End; `hidden` panels do not hide; the whole page flashes before the client entry hides inactive panels | `references/remix3-client-entries/aria-tabs.md` |
| A server-hidden element must reappear when scripting is disabled; a `<noscript>` or `<html data-*>` fallback goes live / gets wiped after a client patch | `references/remix3-client-entries/nojs-fallback-scripting-media.md` |
| A `clientEntry` needs a client-only mount, a custom event mixin, code-driven navigation (or a link-like non-anchor host), cancellation granularity / optimistic state, stable list keys / input ownership, or enhanced form submission | `references/remix3-client-entries/interactivity-runtime.md` |
| Building keyboard-navigable rich lists (roving tabindex, nested controls, focus-by-id reorder, safe re-init) | `references/remix3-client-entries/roving-tabindex-keyboard-lists.md` |
| A `/lists`-style editable list: view-only filters/sort vs the persisted order, last-action undo across an in-flight PUT or list switch, a touch kebab/inline row menu, bulk actions over hidden selections, a searchable target picker, a fixed dialog inside a sticky sidebar, help sheet/mobile fold/double-click editing, or sidebar sort/page-size/result-count state | `references/remix3-client-entries/lists-editor.md` |
| Setting an input/textarea value programmatically (chip, autofill, URL prefill) and the `maxLength` cap must still hold | `references/remix3-client-entries/maxlength-programmatic-value-bypass.md` |
| Streaming agent/LLM text into a chat bubble and rendering markdown only once the stream settles, without `innerHTML` | `references/remix3-client-entries/streamed-chat-markdown-finalize.md` |
| Raw JSON / `[object Object]` in an agent chat, a tool result overwriting the final text, repeated empty cards, or a turn that ends with tool cards and no answer | `references/remix3-client-entries/streaming-chat-tool-results.md` |
| A `clientEntry` / `.browser.tsx` has grown past ~1,000 lines and mixes state, DOM, network, styles, and JSX and must be split without behavior change | `references/remix3-client-entries/client-entry-decomposition.md` |
| The clientEntry's fetch/SSE turn state machine (retry, reconnect, thread adoption, suspend gates) must become independently testable / stop touching DOM | `references/remix3-client-entries/stream-controller-extraction.md` |
| Several `clientEntry`s repeat the same entry body (delegated listener + menu/popover shell + dispatch) and must be deduplicated without breaking hydration | `references/remix3-client-entries/client-entry-factory-extraction.md` |
| An enhancer clientEntry renders `null`/a hidden div, scans server DOM, and registers module-scoped document listeners; converting it to component-owned DOM (or its `on(...)` can't hear a sibling input's events) | `references/remix3-client-entries/component-owned-dom-conversion.md` |
| Per-element `ref()` event wiring for a DOM behavior that contributes no server HTML should become one delegated browser-only `createMixin(type, { ssr: false })` on a container (or its handlers must stop reading `e.currentTarget` as the row) | `references/remix3-client-entries/browser-only-behavior-mixin.md` |
| Adding `data-rmx-prefetch` / `prefetch()` link warming, or a prefetch cost a second SSR because `run({ resolveFrame })` replaces the default resolver | `references/remix3-client-entries/frame-prefetch-cache.md` |

### Core Rules

- `handle.update()` only from an event handler or `handle.queueTask()` — never from setup, render, or a `dragover`/resize/scroll handler (the runtime phase-guards it and throws on a cascading loop).
- Post-update DOM work (focus, scroll, measure) is a `queueTask`, not `requestAnimationFrame`: it is abortable on re-render. A task only drains on a render, so an entry that patches DOM imperatively must `void handle.update()` after queueing, and a focus restore queues **before** the update that renders the target.
- `clientEntry(entryId, component)` only tags; hydration resolves the entry id's module `#ExportName`, not function identity. Keep `clientEntry(import.meta.url + '#Name', …)` at each call site, and remember direct-render browser tests bypass hydration.
- A behavior that contributes no server HTML belongs in one delegated `createMixin(type, { ssr: false })` on a container, not per-element `ref()` wiring: under delegation `e.currentTarget` is the container, so row-scoped handlers take the row explicitly.
- Firefox honors one import map: keep the `remix/multiple-import-maps-polyfill` wiring in `run()` and the nonced entry/preload scripts — dropping a nonce reintroduces the `blob:` requirement.

### When to Use

- A DOM op must wait for `handle.update()`, a `rAF` focus/measure fires early, late, or after the element was removed, or a queued task never runs in an entry with no render.
- A page works in Chromium but client entries fail in Firefox (`Multiple import maps are not allowed.`, `[createFrame] Failed to load module`, a server-hydrated textarea rendering empty).
- Same-page sections must become hash-deep-linked ARIA tabs with a no-JS fallback, or a server-hidden element must reappear when scripting is off.
- A dense list needs keyboard navigation, or the `/lists` editor patterns: view-only filters/sort, last-action undo across an in-flight PUT or list switch, a touch kebab/inline row menu, bulk actions over hidden selections, a searchable target picker, the help sheet/mobile fold, or sidebar sort/page-size/result-count state.
- A `maxLength`-bounded field is filled programmatically, agent text streams into a chat bubble, tool results need a display policy, or frame links are prefetched.
- A `clientEntry` has grown past ~1,000 lines, or several entries repeat one body and should share a factory (verify hydration, not just direct render). Browser-test recipes: `remix3-tooling § Testing`.

---

## Frames & clientEntry Hydration

_(formerly `remix3-frame-cliententry` — references live under `references/remix3-frame-cliententry/`)_

Version-pinned delta index for `<Frame>` navigation and `clientEntry` hydration. Framework API: `node_modules/remix/guides/06-streaming-ui-with-frames.md` and `node_modules/remix/src/component/README.md`.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Form interception in frames (post-#11668), `resolveFrame`, frame direct render, `data-rmx-document`/`data-rmx-history`, nested-frame PRG redirects | `references/remix3-frame-cliententry/frame-navigation.md` |
| `clientEntry` cascade limits, `mounted` guards after reload, the hydration-marker wait rule (including `state: 'attached'` for a marker an entry hides), reload-driven data loading, the `reloadStart`/`reloadComplete` pre/post-reload hooks (loading state + pre-swap flush), keeping focus in a live-search field across a frame reload (`data-rmx-reset-focus="manual"` + re-focus), global document listeners, SSR-safety/authoring constraints, server-rendering a `clientEntry` from props (DOM-script data → serializable props, props refresh on frame navigation, hydration-only values, SSR tests) | `references/remix3-frame-cliententry/cliententry-lifecycle.md` |
| Styling clientEntry children, joined button groups, inline-edit table cells, `on` mixin hydration, drag-and-drop, fragment scrolling | `references/remix3-frame-cliententry/cliententry-dom-and-styling.md` |
| Frame target registration/content-only panels, nested-frame registration inside a fragment-hydrated frame, `<input>` `defaultValue` preservation, asserting on frame-rendered HTML in tests, timing an e2e click after named-frame registration (the URL commits before the frame DOM swap — wait on a destination-content marker) | `references/remix3-frame-cliententry/frame-layout-and-testing.md` |
| Deferring frames until visible (LazyFrame/IntersectionObserver), collapsed or offscreen frame content, measuring frame fan-out | `references/remix3-frame-cliententry/lazy-frames.md` |
| A frame-targeted form POSTs to a method-only route (frame GETs it → 404), or a racing SSE invalidate-reload crashes with `Node.insertBefore` | `references/remix3-frame-cliententry/frame-form-action-get-route.md` |
| Converting a clientEntry tab/panel switcher to server-rendered frame navigation, a POST validation/success message vanishes because the frame content came from a separate GET, or deciding whether a frame conversion is actually a code reduction | `references/remix3-frame-cliententry/frame-server-view-switching.md` |
| A frame-shell page shows the breadcrumb/page name twice on a full GET (top-level Layout also renders one) | `references/remix3-frame-cliententry/frame-shell-duplicate-breadcrumb.md` |
| A frame editor's "create new" mode has no server id and navigation would lose typed content | `references/remix3-frame-cliententry/frame-unsaved-draft.md` |
| A `session.flash` PRG message never appears in a frame fragment, or a test reads an empty session | `references/remix3-frame-cliententry/session-flash-frames.md` |
| A client-owned attribute on a reconciled element (root `data-theme`, `open`, custom) reverts after a frame/document reload | `references/remix3-frame-cliententry/preserve-client-owned-attrs.md` |
| A frame fails/cancels or its resolver must choose a fallback vs a login redirect; whether returned frame HTML is safe; `renderToString`/`renderWith`; a `data-rmx-src` link is not intercepted; native validation/`submit` ordering; stale server props after a frame reload | `references/remix3-frame-cliententry/frame-failures-and-rendering.md` |

### Core Rules

- Make the server route correct before layering frame/`clientEntry` interactivity on top. `app/assets/entry.tsx` (`run({ resolveFrame })`) is the always-loaded client runtime, not per-page user code: removing it does not make a page "more SSR", it drops enhancement back to full-document navigation.
- The app's `resolveFrame`, not the runtime, decides a non-2xx frame outcome: a 4xx body renders in the slot, a 5xx becomes a bounded `ErrorCard`, and a 401 becomes the full-page login redirect. The global `error` event therefore sees only genuine runtime faults, and the `fallback` stays the in-slot visibility mechanism.
- Returned frame HTML is reconciled without sanitization, and only a valid same-origin `src`/`data-rmx-src` is intercepted — anything echoed into a frame must already be escaped. For cross-boundary transitions use `data-rmx-document`; do not disable the runtime.
- A `clientEntry` keeps its factory-closure setup state across a frame reload but receives fresh `handle.props` — read changing server values in the render function, never snapshot them into the closure.
- A frame must be mounted to be addressable (`handle.frames.get(name)` is `undefined` before mount), while a `<Frame>` in server HTML registers synchronously before any `clientEntry` hydrates. Programmatic navigation is `frame.reload({ src })`; `reload({ method, body })` submits form data without a history change.

> Version-pinned facts here reference the pinned `remix` preview build (see `package.json`). Re-check against the installed vendor source before relying on them.

### When to Use

- A frame fails or is canceled and you need to know which hook reports it, or the resolver must choose between bounded fallback HTML, an auth redirect, and rejecting to the runtime handler.
- You are checking whether returned frame HTML is safe, or a `data-rmx-src` link or frame form is not intercepted.
- You need a complete HTML string (`renderToString`) or a different renderer (`renderWith`).
- A `clientEntry` shows stale server-derived values after a frame reload, or a frame target cannot be addressed yet.

---

## JSX Attribute Conventions

_(formerly `remix3-jsx-attribute-conventions` — references live under `references/remix3-jsx-attribute-conventions/`)_

Delta index for `remix/component` JSX: verbatim attributes, the untyped-props blind spot, and boolean `aria-*`/`data-*` serialization.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Writing inline SVG (camelCase attributes do not render), or an `rmx-*` runtime attribute appears dead after a rename | `references/remix3-jsx-attribute-conventions/jsx-attributes.md` |

### Core Rules

- `remix/component` passes attributes through **verbatim** — there is no React-style name translation, so SVG presentation attributes are kebab-case (`stroke-width`, `stop-color`), never camelCase.
- `ElementProps = Record<string, any>` means renames and typos compile, and render tests pass because they assert what a component *emits* rather than what the runtime *reads*. Verify runtime attribute contracts at the runtime layer: grep the installed package, sweep with a negative-lookbehind regex, add a render test, then exercise the real browser flow.
- Since #12152 boolean `aria-*`/`data-*` serialize to `"true"`/`"false"` on server and client, so prefer boolean ARIA over a string ternary. Presence-based markers (`data-rmx-document`, `data-rmx-preserve-dom`, `popover`, `value`, plain boolean props) are unchanged — assert those with `hasAttribute`.

### When to Use

- Rendering inline SVG elements in Remix 3 components (migrating SVG from React, or icons not rendering).
- Upstream `remix`/`@remix-run/component` renames, removes, or adds a runtime attribute.
- A `data-rmx-*` / `rmx-*` / `ln-*` attribute appears dead (frame targeting, document escape, or history semantics not working).
- Before trusting `npm run typecheck` after bumping the pinned `remix` build (preview release asset `https://github.com/remix-run/previews/releases/download/<tag>/remix.tgz`; see `docs/remix-pin-history.md`).

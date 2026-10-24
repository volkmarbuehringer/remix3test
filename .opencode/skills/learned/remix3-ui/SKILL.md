---
name: remix3-ui
description: "Use when building Remix 3 pages, components, <Frame> navigation, or clientEntry browser behavior — component context / handle.id / TypedEventTarget, document shell + asset-entry/ImportMap/head wiring, choosing app-owned css() vs @remix-run/ui primitives, unsafeHTML and remix/html-template, the createRoot/run() interactivity runtime, custom event mixins and browser-only behavior mixins (createMixin(type, { ssr: false })), touch row action menus (kebab + inline menu, focus restoration), on(...)/handle.update() cancellation, navigate/link/attrs, optimistic UI, enhanced form submission, queueTask vs requestAnimationFrame, ARIA tab wiring + no-JS fallback CSS, Firefox multi-import-map, frame targets/data-rmx-* escapes, cascade/mounted-guard traps, LazyFrame/IntersectionObserver, session.flash in fragments, frame failures/cancellation, renderToString/renderWith, and remix/component JSX attribute conventions (kebab-case SVG, runtime renames verified at runtime)."
user-invocable: false
origin: consolidated
---

# Remix 3 UI: Rendering, Frames & Client Entries

Consolidated from 4 former learned skills (`remix3-rendering-ui`, `remix3-client-entries`, `remix3-frame-cliententry`, `remix3-jsx-attribute-conventions`) on 2026-10-17. Reference files are namespaced under `references/<former-skill>/`. Everything vendor-supplied (guides, package READMEs, the vendor `remix` / `mastra` skills) stays authoritative — sections below are deltas only.

## Load Only The Sections You Need

| You need... | Section | References |
| --- | --- | --- |
| Building pages/components — component context, handle.id, TypedEventTarget, document shell, import maps/head, unsafeHTML, html-template, css() vs @remix-run/ui primitives | § Rendering & UI Composition | `references/remix3-rendering-ui/` |
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

- Selection order: style the native control with `css()`; reach for an `@remix-run/ui` headless primitive (`accordion`/`anchor`/`animation`/`combobox`/`listbox`/`menu`/`popover`/`select`/`tabs`/`toggle`) when the product needs its behavior or markup. `@remix-run/ui` 0.12.1 no longer exports the styled `button`/`input`/`checkbox`/`radio` mixins or the `breadcrumbs` module (removed in the 0.11 → 0.12 cleanup, #11986), and there are no `/primitives` subpaths; the app vendors its own button (`app/ui/theme/upstream-button.ts`). Interactive controls still need a `clientEntry` boundary. Toggle note (since build `c93cec30`/source `e5ed055`, PR #11986): the upstream `@remix-run/ui/toggle` module exports the mixin as a flat `toggle` callable directly as `mix={toggle({...})}` — the old `toggle.control()` shape no longer exists; the app currently uses no toggle mixin, but do not re-adopt the group-under-`.control` pattern.
- This app wraps the vendored `app/ui/theme/upstream-button.ts` in `app/ui/theme/button.ts` (extra tones, host-type rebind, `buttonLink()` for anchor hosts); the vendored copy must also keep upstream's attribute default (`type="button"`), and a link that needs button styling uses `buttonLink()` — a nested `<a><button>` submits a surrounding form and is blocked by `remix-a11y/no-nested-interactive`.
- It deliberately renders its own breadcrumbs in `app/ui/breadcrumbs.tsx` (the pre-0.12 vendor component hardcoded `light-dark(...)` + `@layer remix-ui.*`, breaking `data-theme` and overrides; it was removed in the 0.11 → 0.12 cleanup).
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
- `remix3-styling § CSS & Layout` — `css()`, `@layer rmx`, and layout deltas
- `remix3-styling § Theme Tokens` — theme tokens and light/dark contrast
- `remix3-ui § Client Entries` — the `clientEntry`/hydration boundary and import-map constraints
- `remix3-server § Security` — CSP nonces for inline scripts

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
- Fix by wiring `run()` to `remix/multiple-import-maps-polyfill`: `loadModule` uses `importModule(moduleUrl)` (polyfill-aware `import()`), and `processClientEntryPreloads` returns the preloads when `await detectMultipleImportMapSupport()` is true, else calls `preloadShim(preloads)` and returns `[]`; Chromium keeps native `import()` while Firefox loads late entries through the polyfill using every import map. CSP `script-src` must add `blob:` (polyfilled module graphs evaluate from blob URLs), `'wasm-unsafe-eval'` (`es-module-lexer` Wasm), and — **not** listed in the polyfill README — `'unsafe-eval'`, required by Firefox's `es-module-lexer` path (Firefox reports `blocked a JavaScript eval (script-src) ... (Missing 'unsafe-eval')` from `lexer.@*.js` even with `'wasm-unsafe-eval'`; confirmed 2026-09-09). Verify in **Firefox**, not Chromium: load a page with deferred entries (e.g. `/lists?load=<id>`), check for the warning and `[createFrame] Failed to load module`, confirm two `data-rmx-import-map` scripts with the entry deltas in the second, then confirm the entry imports the polyfill, the eval CSP error is gone, and interactions work.

**ARIA tabs with hash deep-linking (`references/remix3-client-entries/aria-tabs.md`)**

- Turning a stacked Remix 3 page into tabs in a `clientEntry` hits five traps: (1) `hidden` does not hide because a `display:flex` panel descriptor (author origin) beats the UA `[hidden]{display:none}` rule — see `remix3-styling § CSS & Layout` → `references/remix3-css-and-layout/hidden-attribute-display-override.md`; (2) fragments never reach the server, so SSR cannot know the hash-selected tab and the client entry must reconcile the hash with the server's default; (3) focus-banner logic (`alert.focus()`) can focus a `display:none` node unless tab visibility is applied first; (4) a swallowing `preventDefault()` click handler destroys the no-JS/history fallback that `href="#<id>"` anchors keep for free. Fix (1) with `'&[hidden]': { display: 'none' }` on the **same** panel `css()` descriptor/layer. Trap (5): server-render the inactive panels with `hidden={tab.id !== activeTab || undefined}` so only the active panel paints on first load, and restore the stacked no-JS view with a CSS rule scoped to `@media (scripting: none)`. Do **not** use a `<noscript><style>` reveal rule — the Remix UI runtime re-parses the noscript body into a live `<style>` after the first client patch, un-hiding every panel — and do **not** gate the reveal on a JS-set `<html data-js>` flag, because the runtime reconciles the document element against the server HTML and drops the flag. Do **not** "fix" the flash by leaving every panel un-hidden server-side.
- Render a `role="tablist"` of anchors (`role="tab"`, `href="#<id>"`, `id="<id>-tab"`, `aria-controls`, `aria-selected`, roving `tabindex`, `data-settings-tab`) plus `role="tabpanel"` panels (`aria-labelledby`, `tabindex={0}`, `data-settings-tabpanel`), take `activeTab` from a prop (default first), and carry it across POSTs: error re-renders pass `activeTab` (plus `data-settings-active-tab` on the container for JS-less server tests) and PRG redirects append `#<id>`. The client `activate(id, { focus, setHash })` sets each tab's `aria-selected`/`tabIndex`, toggles `panel.hidden`, then focuses and `history.replaceState(null, '', '#<id>')`; `init()` prefers a hash that matches a panel, else the `[aria-selected="true"]` tab, else the first panel. `click` calls `activate` **without** `preventDefault()`; `hashchange` re-activates for back/forward and deep links; ArrowLeft/ArrowRight/Home/End call `activate(next, { focus: true, setHash: true })` with `event.preventDefault()`. Run `init()` before any focus-banner logic (in `queueTask`) so focus never lands on a hidden panel; style the active tab via `&[aria-selected="true"]` declared **after** `&:hover` in the same descriptor (roving-tabindex/keyboard details for nested lists: `references/remix3-client-entries/roving-tabindex-keyboard-lists.md`). Server tests only see HTML — assert one `role="tab"`/`role="tabpanel"` per section plus `href="#<id>"`/`aria-controls`, `data-settings-active-tab` after an error POST, and `Location.endsWith('#<id>')` after a PRG redirect; switching, keyboard, and deep-link behavior need a browser check.

**No-JS fallbacks survive client patching (`references/remix3-client-entries/nojs-fallback-scripting-media.md`)**

- A `<noscript><style>` no-JS reveal rule becomes **live** once the client runtime re-parses the noscript body, and a JS-set `<html data-*>` flag is **wiped** when the runtime reconciles the document element. Scope such rules to `@media (scripting: none)`; server-hide with `hidden` to avoid the first-paint flash. First applied in `app/actions/settings/controller.tsx` (`PANEL_REVEAL_CSS`) (obsolete: neither `PANEL_REVEAL_CSS` nor any `<noscript>`/`@media (scripting: none)` reveal rule remains in `app/` — the settings tabs are now server-rendered in that controller; app re-checked 2026-10-14).

**Interactivity runtime: roots, mixins, navigation, forms (`references/remix3-client-entries/interactivity-runtime.md`)**

- `createRoot(container)` owns a client-only container (`render`/`flush`/`dispose`, dispose on `pagehide`); the app's only use is the fatal-error takeover in `app/assets/error-card.browser.tsx:113-135`, which runs after `app.dispose()` and replaces `document.body` — normal UI still starts on the server via `clientEntry`. `run()` exposes `app.ready()`/`app.flush()`/`app.dispose()` (guide §"Booting the browser runtime with run"), but this app never calls `ready()`/`flush()`.
- Cancellation granularity: `handle.update()` resolves to an `AbortSignal` but cannot abort between the `await` and the next synchronous statement; the `on(type, (event, signal))` second argument aborts on re-run/element removal. The already-covered `handle.signal`/`queueTask` aborts live in `references/remix3-client-entries/queuetask-over-raf.md`, not here.
- `navigate(href, options)` is code-driven navigation and `link(...)` gives a non-anchor host `role="link"`/Enter/modifier activation/`aria-disabled`; `attrs(...)` supplies non-overriding defaults. In the app, no code imports `navigate` from `remix/component`: `app/ui/appointment-sidebar.tsx` is now server-rendered (no clientEntry/`navigate`), and frame navigation is a local `navigateFrame` helper in `app/actions/lists/public/lists-client.tsx:291` plus `handle.frame.reload` in `app/actions/lists/public/lists-sidebar-keyboard.tsx:63`, so grep hits for `navigate(` are not client navigation; `link()`/`attrs()` are unused (app re-checked 2026-10-14).
- Optimistic UI belongs in the data model with its reconcile/rollback policy (setup-scope pending state only drives disabled/label state); use stable list ids, not index keys, and keep controlled vs uncontrolled input ownership straight. Enhanced submit intercepts `submit`, posts `new FormData(form)` with the handler signal, and follows a redirect with `navigate(response.url, { history: "replace" })` — the app's existing agent/chat SSE+JSON interception is a separate boundary.

**Keyboard-navigable lists (`references/remix3-client-entries/roving-tabindex-keyboard-lists.md`)**

- Guard bubbled keydown at the top of the row handler (`if (e.target !== e.currentTarget) return`) so nested checkbox/textarea/buttons keep their semantics; track the roving `tabindex`/focus by stable item id (fall back to the first item when the focused id was deleted, or every row becomes `tabindex="-1"`); abort the previous wiring pass before re-initializing (per-row `AbortController`s or one delegated listener); exclude modifier keys from typeahead.

**Touch row action menus (`references/remix3-client-entries/touch-row-action-menu.md`)**

- On `(hover: none)`, do not merely force a 4-button hover cluster visible: it overlays/squeezes the label and a full-width bar doubles row height. Hide the view cluster with `display: none`, show one 44px kebab, and render the menu as an inline `flex-basis: 100%` second line; keep the edit-mode cluster inline and full-width.
- When a filter hides rows, hide position-based move actions **and** guard the mutation (`if (filterActive()) return`). A move against a hidden neighbour can leave the visible order unchanged while persisting a new order.
- Restore focus after Escape/action with `handle.queueTask`: prefer the kebab, fall back to `[data-item-id]` when the trigger is `display: none`, then the add field; use `CSS.escape` for selector ids. `queueTask` only drains on a component update — a client entry that mutates DOM attributes imperatively must call `void handle.update()` after queueing, or the task never runs.
- View-only list controls stay out of the persisted model: keep `statusFilter`/`hideDone`/`sortMode`/`reverseView`/`shuffleOrder` in the client closure, build the rendered rows through one pure `buildVisibleItems` pipeline, and gate drag/grab/move with `reorderLocked()`; none of these call `setDirty()` or `showUndo()`. Status counts follow the text filter, hidden selections are labeled, and the filtered empty state offers a reset. Details: `references/remix3-client-entries/view-only-list-controls.md`.
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
- `remix3-styling § CSS & Layout` — the `hidden`-attribute/`display` override and other `remix-ui` styling traps the tab panels depend on
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
| `clientEntry` cascade limits, `mounted` guards after reload, the hydration-marker wait rule (including `state: 'attached'` for a marker an entry hides), reload-driven data loading, the `reloadStart`/`reloadComplete` pre/post-reload hooks (loading state + pre-swap flush), keeping focus in a live-search field across a frame reload (`data-rmx-reset-focus="manual"` + re-focus), global document listeners, SSR-safety/authoring constraints | `references/remix3-frame-cliententry/cliententry-lifecycle.md` |
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
| Writing inline SVG in Remix 3 — React camelCase attributes not rendering | `references/remix3-jsx-attribute-conventions/svg-attributes-kebab-case.md` |
| An `rmx-*` runtime attribute appears dead, or an upstream runtime renames/removes an attribute | `references/remix3-jsx-attribute-conventions/attribute-renames-runtime-verification.md` |

### Core Rules

Remix 3 uses its own JSX runtime (`remix/component`, `jsxImportSource: "remix/component"`), not React. It passes attributes through **verbatim** — there is no React-style attribute-name translation. Two consequences follow, both silent breakages:

1. SVG presentation attributes must be written in **kebab-case** (the SVG spec's lowercase form), not React camelCase.
2. Because JSX props are typed as `Record<string, any>`, attribute renames/typos **compile without error** — verify runtime attribute contracts at the runtime layer, not via `tsc` or render assertions.

- **Kebab-case SVG**: `stroke-width`, `stroke-linecap`, `stroke-linejoin`, `stop-color`, `fill-rule`, etc. — see the full mapping in `references/remix3-jsx-attribute-conventions/svg-attributes-kebab-case.md`.
- **`ElementProps = Record<string, any>`**: strict `IntrinsicElements` prop types (e.g. `FormHTMLProps` with `data-rmx-target`) are never enforced on JSX, so renames and typos pass typecheck; server-render tests pass too because they assert what a component *emits*, not what the runtime *reads*. See `references/remix3-jsx-attribute-conventions/attribute-renames-runtime-verification.md`.
- **Verify at the runtime layer**: grep the installed package for the actual attribute, sweep the app with a negative-lookbehind regex, add a render test for the new name, and exercise the real flow in a browser.

### When to Use

- Rendering inline SVG elements in Remix 3 components (migrating SVG from React, or icons not rendering)
- Upstream `remix`/`@remix-run/component` renames, removes, or adds a runtime attribute
- A `data-rmx-*` / `rmx-*` / `ln-*` attribute appears dead (frame targeting, document escape, or history semantics not working)
- Diagnosing "tests pass but feature silently broken" in a Remix 3 frame app
- Before trusting `npm run typecheck` after bumping the pinned `remix` build (`github:remix-run/remix#preview/main`)
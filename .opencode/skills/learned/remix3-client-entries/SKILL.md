---
name: remix3-client-entries
description: "Use when building Remix 3 browser behavior in a `clientEntry` — DOM operations that must run after a re-render (`queueTask` vs `requestAnimationFrame`), Firefox rejecting multiple import maps, ARIA tab wiring over `hidden` panels with hash deep-linking, no-JS fallback CSS that survives client DOM patching (`<noscript>` re-parsing, `@media (scripting: none)`), and the interactivity runtime: `createRoot`/`run()` lifecycle, custom event mixins, `on(...)`/`handle.update()` cancellation, `navigate`/`link`/`attrs`, optimistic UI, enhanced form submission, keyboard-navigable rich lists, programmatic `maxLength` clamping, finalize-on-complete markdown for streamed chat, and decomposing an over-1,000-line `clientEntry`/`.browser.tsx` into styles/state/API/drag/view modules without behavior change, and deduplicating several similar `clientEntry`s behind one shared factory while keeping `clientEntry(...)` at each call site."
user-invocable: false
origin: consolidated
---

# Remix 3 Client Entry Browser Behaviors

**Consolidated from:** `remix3-queuetask-over-raf`, `remix3-firefox-single-import-map`, `remix3-aria-tabs`, `roving-tabindex-keyboard-lists`, `maxlength-programmatic-value-bypass`, `streamed-chat-markdown-finalize`, `remix3-textarea-bulk-clear-wipe`, `remix3-client-entry-decomposition`, `remix3-client-entry-factory-extraction`

This skill is the **index** for browser-side deltas that live in a Remix 3 `clientEntry`. For the Frame/entry runtime and `remix/component` component-model APIs themselves, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

## Load Only The References You Need

| Symptom / task involves... | Start with |
| --- | --- |
| A DOM op (focus, scroll, measure) must run after `handle.update()`; `requestAnimationFrame` steals focus or fires after a re-render; deciding whether a `ref` callback is enough | `references/queuetask-over-raf.md` |
| A page works in Chromium but client entries fail in Firefox with `Multiple import maps are not allowed.` or `[createFrame] Failed to load module`; a server-hydrated textarea renders empty only in Firefox | `references/firefox-single-import-map.md` |
| Several same-page sections should show one at a time; a section nav must deep-link via the URL hash and support Arrow/Home/End; `hidden` panels do not hide; the whole page flashes before the client entry hides inactive panels | `references/aria-tabs.md` |
| A server-hidden element must reappear when scripting is disabled; a `<noscript>` or `<html data-*>` fallback goes live / gets wiped after a client patch | `references/nojs-fallback-scripting-media.md` |
| A `clientEntry` needs a client-only mount, a custom event mixin, code-driven navigation (or a link-like non-anchor host), cancellation granularity / optimistic state, stable list keys / input ownership, or enhanced form submission | `references/interactivity-runtime.md` |
| Building keyboard-navigable rich lists (roving tabindex, nested controls, focus-by-id reorder, safe re-init) | `references/roving-tabindex-keyboard-lists.md` |
| Setting an input/textarea value programmatically (chip, autofill, URL prefill) and the `maxLength` cap must still hold | `references/maxlength-programmatic-value-bypass.md` |
| Streaming agent/LLM text into a chat bubble and rendering markdown only once the stream settles, without `innerHTML` | `references/streamed-chat-markdown-finalize.md` |
| A `clientEntry` / `.browser.tsx` has grown past ~1,000 lines and mixes state, DOM, network, styles, and JSX and must be split without behavior change | `references/client-entry-decomposition.md` |
| Several `clientEntry`s repeat the same entry body (delegated listener + menu/popover shell + dispatch) and must be deduplicated without breaking hydration | `references/client-entry-factory-extraction.md` |
| Historical: the `diffChildren` bulk-clear wipe of an unchanged textarea `value`/`defaultValue` (fixed upstream #11880) | `references/textarea-bulk-clear-wipe-history.md` |

## Core Rules

**Post-update DOM ops: `queueTask` over `rAF` (`references/queuetask-over-raf.md`)**

- When a DOM operation must run **after the DOM reflects a `handle.update()`** — focusing a freshly revealed input, `scrollIntoView`, scrolling an ancestor, or `getBoundingClientRect` measurement — use `handle.queueTask(() => { ... })`, **not** `requestAnimationFrame`: the vendor documents `queueTask` as running "a task during the commit after the next update", for when "DOM measurement or another update must happen as part of that flush", it is **abortable on re-render** (a rapid `draft → cancel` once let `rAF` fire and steal focus onto a removed input), whereas `rAF` is only a paint-timing primitive that says nothing about whether the Frame's DOM mutation has flushed. A `ref` callback that focuses the element itself on mount (`ref((el) => { if (el) { el.focus(); el.select() } })`) is the correct idiom for self-focus and must **not** be "fixed" into `queueTask`.
- `queueTask` attaches to a Frame **render**, so where there is no `handle.update()` keep synchronous focus: imperative DOM insertion (`document.createElement('input')` + `cell.appendChild(input)` then `input.focus()` — e.g. `client-grid-inline-edit`, `list-name-edit`) and imperative class toggles (`drawer.classList.toggle(...)` then `closeBtn.focus()` — `nav-toggle`) have no render to attach to. Authority: vendor guide `node_modules/remix/guides/05-interactivity.md` (`handle.update()` / `handle.queueTask()`: §"State, updates, and post-render tasks") and the installed `Handle` type docs (`@remix-run/component/src/runtime/component.ts:33-51`); since #11795 `handle.update()`'s own docs direct calls from an event handler or `handle.queueTask()` — the vendor-blessed remedy for the phase-guard throws (see `remix3-frame-cliententry`). First application retired `app/ui/appointment-grid.browser.tsx:583` `startDraft` and `:641` `startEdit`; the `renameInputs.get(appt.id)` lookup inside `startEdit` stays valid because ref callbacks run during commit, before `queueTask`.

**Firefox honors only one import map (`references/firefox-single-import-map.md`)**

- Firefox allows **one** `<script type="importmap">` per document and ignores extras (console: "Multiple import maps are not allowed."), while Chromium merges them. The `@remix-run/ui@0.10.0` runtime (rc.3) renders the initial combined map via `<ImportMap>`, but for **deferred client entries** in a frame response it appends a **second** `data-rmx-import-map` script (import-map-manager's `appendImportMapScript`) holding the deltas for those entries' dependencies (`lists-keyboard`, `button`, `drop-zone`, `sidebar-sync`). Firefox ignores the second map, so those entries cannot resolve their bare specifiers and fail at execution — `[createFrame] Failed to load module for <hash>` (the fetch succeeds, so `requestfailed` stays empty) — client interactions stop, and a textarea hydrated from server state renders empty (the client re-render wipes children when the entry never hydrated). This is deterministic, **not** a stale browser: fresh-browser Chromium tests pass.
- Fix by wiring `run()` to `remix/multiple-import-maps-polyfill`: `loadModule` uses `importModule(moduleUrl)` (polyfill-aware `import()`), and `processClientEntryPreloads` returns the preloads when `await detectMultipleImportMapSupport()` is true, else calls `preloadShim(preloads)` and returns `[]`; Chromium keeps native `import()` while Firefox loads late entries through the polyfill using every import map. CSP `script-src` must add `blob:` (polyfilled module graphs evaluate from blob URLs), `'wasm-unsafe-eval'` (`es-module-lexer` Wasm), and — **not** listed in the polyfill README — `'unsafe-eval'`, required by Firefox's `es-module-lexer` path (Firefox reports `blocked a JavaScript eval (script-src) ... (Missing 'unsafe-eval')` from `lexer.@*.js` even with `'wasm-unsafe-eval'`; confirmed 2026-09-09). Verify in **Firefox**, not Chromium: load a page with deferred entries (e.g. `/lists?load=<id>`), check for the warning and `[createFrame] Failed to load module`, confirm two `data-rmx-import-map` scripts with the entry deltas in the second, then confirm the entry imports the polyfill, the eval CSP error is gone, and interactions work.

**ARIA tabs with hash deep-linking (`references/aria-tabs.md`)**

- Turning a stacked Remix 3 page into tabs in a `clientEntry` hits five traps: (1) `hidden` does not hide because a `display:flex` panel descriptor (author origin) beats the UA `[hidden]{display:none}` rule — see `remix3-css-and-layout` → `references/hidden-attribute-display-override.md`; (2) fragments never reach the server, so SSR cannot know the hash-selected tab and the client entry must reconcile the hash with the server's default; (3) focus-banner logic (`alert.focus()`) can focus a `display:none` node unless tab visibility is applied first; (4) a swallowing `preventDefault()` click handler destroys the no-JS/history fallback that `href="#<id>"` anchors keep for free. Fix (1) with `'&[hidden]': { display: 'none' }` on the **same** panel `css()` descriptor/layer. Trap (5): server-render the inactive panels with `hidden={tab.id !== activeTab || undefined}` so only the active panel paints on first load, and restore the stacked no-JS view with a CSS rule scoped to `@media (scripting: none)`. Do **not** use a `<noscript><style>` reveal rule — the Remix UI runtime re-parses the noscript body into a live `<style>` after the first client patch, un-hiding every panel — and do **not** gate the reveal on a JS-set `<html data-js>` flag, because the runtime reconciles the document element against the server HTML and drops the flag. Do **not** "fix" the flash by leaving every panel un-hidden server-side.
- Render a `role="tablist"` of anchors (`role="tab"`, `href="#<id>"`, `id="<id>-tab"`, `aria-controls`, `aria-selected`, roving `tabindex`, `data-settings-tab`) plus `role="tabpanel"` panels (`aria-labelledby`, `tabindex={0}`, `data-settings-tabpanel`), take `activeTab` from a prop (default first), and carry it across POSTs: error re-renders pass `activeTab` (plus `data-settings-active-tab` on the container for JS-less server tests) and PRG redirects append `#<id>`. The client `activate(id, { focus, setHash })` sets each tab's `aria-selected`/`tabIndex`, toggles `panel.hidden`, then focuses and `history.replaceState(null, '', '#<id>')`; `init()` prefers a hash that matches a panel, else the `[aria-selected="true"]` tab, else the first panel. `click` calls `activate` **without** `preventDefault()`; `hashchange` re-activates for back/forward and deep links; ArrowLeft/ArrowRight/Home/End call `activate(next, { focus: true, setHash: true })` with `event.preventDefault()`. Run `init()` before any focus-banner logic (in `queueTask`) so focus never lands on a hidden panel; style the active tab via `&[aria-selected="true"]` declared **after** `&:hover` in the same descriptor (roving-tabindex/keyboard details for nested lists: `references/roving-tabindex-keyboard-lists.md`). Server tests only see HTML — assert one `role="tab"`/`role="tabpanel"` per section plus `href="#<id>"`/`aria-controls`, `data-settings-active-tab` after an error POST, and `Location.endsWith('#<id>')` after a PRG redirect; switching, keyboard, and deep-link behavior need a browser check.

**No-JS fallbacks survive client patching (`references/nojs-fallback-scripting-media.md`)**

- A `<noscript><style>` no-JS reveal rule becomes **live** once the client runtime re-parses the noscript body, and a JS-set `<html data-*>` flag is **wiped** when the runtime reconciles the document element. Scope such rules to `@media (scripting: none)`; server-hide with `hidden` to avoid the first-paint flash. First applied in `app/actions/settings/controller.tsx` (`PANEL_REVEAL_CSS`).

**Interactivity runtime: roots, mixins, navigation, forms (`references/interactivity-runtime.md`)**

- `createRoot(container)` owns a client-only container (`render`/`flush`/`dispose`, dispose on `pagehide`); the app's only use is the fatal-error takeover in `app/assets/error-card.browser.tsx:113-135`, which runs after `app.dispose()` and replaces `document.body` — normal UI still starts on the server via `clientEntry`. `run()` exposes `app.ready()`/`app.flush()`/`app.dispose()` (guide §"Booting the browser runtime with run"), but this app never calls `ready()`/`flush()`.
- Cancellation granularity: `handle.update()` resolves to an `AbortSignal` but cannot abort between the `await` and the next synchronous statement; the `on(type, (event, signal))` second argument aborts on re-run/element removal. The already-covered `handle.signal`/`queueTask` aborts live in `references/queuetask-over-raf.md`, not here.
- `navigate(href, options)` is code-driven navigation and `link(...)` gives a non-anchor host `role="link"`/Enter/modifier activation/`aria-disabled`; `attrs(...)` supplies non-overriding defaults. In the app, `navigate` (imported from `remix/component` in `app/ui/appointment-sidebar.browser.tsx`) is shadowed by a local frame-navigation `navigate` helper in `app/actions/lists/public/lists-sidebar-keyboard.tsx:34-38`; `link()`/`attrs()` are unused.
- Optimistic UI belongs in the data model with its reconcile/rollback policy (setup-scope pending state only drives disabled/label state); use stable list ids, not index keys, and keep controlled vs uncontrolled input ownership straight. Enhanced submit intercepts `submit`, posts `new FormData(form)` with the handler signal, and follows a redirect with `navigate(response.url, { history: "replace" })` — the app's existing agent/chat SSE+JSON interception is a separate boundary.

**Keyboard-navigable lists (`references/roving-tabindex-keyboard-lists.md`)**

- Guard bubbled keydown at the top of the row handler (`if (e.target !== e.currentTarget) return`) so nested checkbox/textarea/buttons keep their semantics; track the roving `tabindex`/focus by stable item id (fall back to the first item when the focused id was deleted, or every row becomes `tabindex="-1"`); abort the previous wiring pass before re-initializing (per-row `AbortController`s or one delegated listener); exclude modifier keys from typeahead.

**Programmatic `maxLength` (`references/maxlength-programmatic-value-bypass.md`)**

- `element.value = x` bypasses `maxLength` (it only guards typing/pasting); clamp with `.slice(0, MAX)` using the same shared constant the server validates against, then re-run the counter and `setSelectionRange(value.length, value.length)`.

**Finalize streamed markdown once (`references/streamed-chat-markdown-finalize.md`)**

- Stream the reply as plain `textContent` and render markdown **once** in the terminal `complete` handler, targeting a `data-kind="text"` bubble (a tool-result card/approval gate can be the last element); build the DOM with `createTextNode`/property assignment, never `innerHTML`, and restrict links to `http(s)`.

**Textarea bulk-clear (historical, `references/textarea-bulk-clear-wipe-history.md`)**

- The `diffChildren` bulk-clear fast path that wiped an unchanged textarea `value`/`defaultValue` is **fixed** (upstream `f5b5c5340`, #11880; the guard now requires `curr.length > 0`). Do not re-apply the old children-based workaround — use plain `defaultValue`.

**Decomposing a large `clientEntry` (`references/client-entry-decomposition.md`)**

- Extract in order — styles → pure state → network → cohesive DOM subsystem → view — keeping the tree green after each step. The view split's trap: you **cannot** keep reads via destructuring and writes via assignment (`let { title } = view` copies a primitive and writes the local, not the closure) — convert every inline mutation to a setter callback (`view.setTitle(v)`) and every ref that writes closure state to a `view.onXRef(el)` hook. Never slice a block by line offset (numbers shift after any edit) — anchor on unique content and re-read after each write; match the static-import source extension (`.tsx`).

**Deduplicating similar `clientEntry`s with a shared factory (`references/client-entry-factory-extraction.md`)**

- `clientEntry(entryId, component)` only tags the function (`$entry`/`$entryId`); hydration resolves from the id's `#ExportName`, not function identity. Extract the body into a factory but keep `clientEntry(import.meta.url + '#Name', factory({...}))` at each call site — a factory calling `clientEntry` itself points `href` at the wrong module and the export name is absent there. The shared module must be under an allowFiles path. Preserve the select guard, and only `handle.update()` on capture when rendered items depend on the captured row. Direct-render browser tests bypass hydration — verify with an e2e that waits for a hydration marker (`state: 'attached'`; the trigger is invisible).

## When to Use

- You are building browser behavior in a Remix 3 `clientEntry` and the DOM does not do what the server render implies: an op must wait for `handle.update()`, client entries silently do nothing in Firefox, or same-page panels need to become hash-deep-linked ARIA tabs.
- A page works in Chromium but client interactions, hover reveals, drag-and-drop, or textarea hydration fail in Firefox (especially after a remix/import-map upgrade); or a `requestAnimationFrame` focus/measure callback fires too early, too late, or after the element was removed.
- Before adopting `requestAnimationFrame` for post-render DOM work, wiring the multiple-import-maps polyfill, or hand-rolling tabs over `hidden` panels.
- You are adding a client-only `createRoot`, a custom event mixin (`createMixin`/`handle.element`), code-driven `navigate` or a link-like non-anchor host (`link`/`attrs`), optimistic UI, stable list keys, or an enhanced form submit that follows a controller redirect — see `references/interactivity-runtime.md` for the guide sections and the app's actual seams.
- You are adding keyboard navigation/reorder to a list of rich rows containing nested controls.
- You set a `maxLength`-bounded field programmatically (chip click, autofill, URL prefill, draft restore) and the counter can exceed the cap.
- You stream agent/LLM text into a chat bubble and want markdown rendering in the settled reply without an `innerHTML` XSS risk.
- A single `clientEntry`/`.browser.tsx` has grown past ~1,000 lines and mixes state, DOM, network, styles, and JSX — see `references/client-entry-decomposition.md` for the extraction order and the view-model setter rule.
- Several `clientEntry`s repeat the same entry body (delegated listener + menu/popover shell + dispatch) and must be deduplicated without breaking hydration — see `references/client-entry-factory-extraction.md` (keep `clientEntry(...)` at each call site).

## Related Skills

- `remix3-frame-cliententry` — `<Frame>` navigation, `clientEntry` hydration/lifecycle, and the phase-guard throws that `queueTask` remedies
- `remix3-css-and-layout` — the `hidden`-attribute/`display` override and other `remix-ui` styling traps the tab panels depend on
- `remix3-testing` — driving `clientEntry` DOM side effects and browser-test stubs that these behaviors need
- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical `remix/component` component-model, `queueTask`, and runtime import-map APIs

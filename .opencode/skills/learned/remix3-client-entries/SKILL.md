---
name: remix3-client-entries
description: "Use when building Remix 3 browser behavior in a `clientEntry` — DOM operations that must run after a re-render (`queueTask` vs `requestAnimationFrame`), Firefox rejecting multiple import maps, and ARIA tab wiring over `hidden` panels with hash deep-linking."
user-invocable: false
origin: consolidated
---

# Remix 3 Client Entry Browser Behaviors

**Consolidated from:** `remix3-queuetask-over-raf`, `remix3-firefox-single-import-map`, `remix3-aria-tabs`

This skill is the **index** for browser-side deltas that live in a Remix 3 `clientEntry`. For the Frame/entry runtime and `remix/ui` component-model APIs themselves, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

## Load Only The References You Need

| Symptom / task involves... | Start with |
| --- | --- |
| A DOM op (focus, scroll, measure) must run after `handle.update()`; `requestAnimationFrame` steals focus or fires after a re-render; deciding whether a `ref` callback is enough | `references/queuetask-over-raf.md` |
| A page works in Chromium but client entries fail in Firefox with `Multiple import maps are not allowed.` or `[createFrame] Failed to load module`; a server-hydrated textarea renders empty only in Firefox | `references/firefox-single-import-map.md` |
| Several same-page sections should show one at a time; a section nav must deep-link via the URL hash and support Arrow/Home/End; `hidden` panels do not hide | `references/aria-tabs.md` |

## Core Rules

**Post-update DOM ops: `queueTask` over `rAF` (`references/queuetask-over-raf.md`)**

- When a DOM operation must run **after the DOM reflects a `handle.update()`** — focusing a freshly revealed input, `scrollIntoView`, scrolling an ancestor, or `getBoundingClientRect` measurement — use `handle.queueTask(() => { ... })`, **not** `requestAnimationFrame`: the vendor documents `queueTask` for "focusing elements, scrolling, or measuring dimensions after conditional rendering", it is **abortable on re-render** (a rapid `draft → cancel` once let `rAF` fire and steal focus onto a removed input), whereas `rAF` is only a paint-timing primitive that says nothing about whether the Frame's DOM mutation has flushed. A `ref` callback that focuses the element itself on mount (`ref((el) => { if (el) { el.focus(); el.select() } })`) is the correct idiom for self-focus and must **not** be "fixed" into `queueTask`.
- `queueTask` attaches to a Frame **render**, so where there is no `handle.update()` keep synchronous focus: imperative DOM insertion (`document.createElement('input')` + `cell.appendChild(input)` then `input.focus()` — e.g. `client-grid-inline-edit`, `list-name-edit`) and imperative class toggles (`drawer.classList.toggle(...)` then `closeBtn.focus()` — `nav-toggle`) have no render to attach to. Authority: vendor doc `node_modules/remix/src/ui/README.md` and its rule *"do DOM-sensitive work in event handlers or `queueTask(...)`, not in render"*; since #11795 `handle.update()`'s own docs direct calls from an event handler or `handle.queueTask()` — the vendor-blessed remedy for the phase-guard throws (see `remix3-frame-cliententry`). First application retired `app/ui/appointment-grid.browser.tsx:583` `startDraft` and `:641` `startEdit`; the `renameInputs.get(appt.id)` lookup inside `startEdit` stays valid because ref callbacks run during commit, before `queueTask`.

**Firefox honors only one import map (`references/firefox-single-import-map.md`)**

- Firefox allows **one** `<script type="importmap">` per document and ignores extras (console: "Multiple import maps are not allowed."), while Chromium merges them. The `@remix-run/ui@0.9.0` runtime (rc.2) renders the initial combined map via `<ImportMap>`, but for **deferred client entries** in a frame response it appends a **second** `data-rmx-import-map` script (import-map-manager's `appendImportMapScript`) holding the deltas for those entries' dependencies (`lists-keyboard`, `button`, `drop-zone`, `sidebar-sync`). Firefox ignores the second map, so those entries cannot resolve their bare specifiers and fail at execution — `[createFrame] Failed to load module for <hash>` (the fetch succeeds, so `requestfailed` stays empty) — client interactions stop, and a textarea hydrated from server state renders empty (the client re-render wipes children when the entry never hydrated). This is deterministic, **not** a stale browser: fresh-browser Chromium tests pass.
- Fix by wiring `run()` to `remix/multiple-import-maps-polyfill`: `loadModule` uses `importModule(moduleUrl)` (polyfill-aware `import()`), and `processClientEntryPreloads` returns the preloads when `await detectMultipleImportMapSupport()` is true, else calls `preloadShim(preloads)` and returns `[]`; Chromium keeps native `import()` while Firefox loads late entries through the polyfill using every import map. CSP `script-src` must add `blob:` (polyfilled module graphs evaluate from blob URLs), `'wasm-unsafe-eval'` (`es-module-lexer` Wasm), and — **not** listed in the polyfill README — `'unsafe-eval'`, required by Firefox's `es-module-lexer` path (Firefox reports `blocked a JavaScript eval (script-src) ... (Missing 'unsafe-eval')` from `lexer.@*.js` even with `'wasm-unsafe-eval'`; confirmed 2026-09-09). Verify in **Firefox**, not Chromium: load a page with deferred entries (e.g. `/lists?load=<id>`), check for the warning and `[createFrame] Failed to load module`, confirm two `data-rmx-import-map` scripts with the entry deltas in the second, then confirm the entry imports the polyfill, the eval CSP error is gone, and interactions work.

**ARIA tabs with hash deep-linking (`references/aria-tabs.md`)**

- Turning a stacked Remix 3 page into tabs in a `clientEntry` hits four traps: (1) `hidden` does not hide because a `display:flex` panel descriptor (author origin) beats the UA `[hidden]{display:none}` rule — see `remix3-css-and-layout` → `references/hidden-attribute-display-override.md`; (2) fragments never reach the server, so SSR cannot know the hash-selected tab and the client entry must reconcile the hash with the server's default; (3) focus-banner logic (`alert.focus()`) can focus a `display:none` node unless tab visibility is applied first; (4) a swallowing `preventDefault()` click handler destroys the no-JS/history fallback that `href="#<id>"` anchors keep for free. Fix the first with `'&[hidden]': { display: 'none' }` on the **same** panel `css()` descriptor/layer, and give inactive panels a stacked no-JS fallback by leaving every panel un-hidden server-side.
- Render a `role="tablist"` of anchors (`role="tab"`, `href="#<id>"`, `id="<id>-tab"`, `aria-controls`, `aria-selected`, roving `tabindex`, `data-settings-tab`) plus `role="tabpanel"` panels (`aria-labelledby`, `tabindex={0}`, `data-settings-tabpanel`), take `activeTab` from a prop (default first), and carry it across POSTs: error re-renders pass `activeTab` (plus `data-settings-active-tab` on the container for JS-less server tests) and PRG redirects append `#<id>`. The client `activate(id, { focus, setHash })` sets each tab's `aria-selected`/`tabIndex`, toggles `panel.hidden`, then focuses and `history.replaceState(null, '', '#<id>')`; `init()` prefers a hash that matches a panel, else the `[aria-selected="true"]` tab, else the first panel. `click` calls `activate` **without** `preventDefault()`; `hashchange` re-activates for back/forward and deep links; ArrowLeft/ArrowRight/Home/End call `activate(next, { focus: true, setHash: true })` with `event.preventDefault()`. Run `init()` before any focus-banner logic (in `queueTask`) so focus never lands on a hidden panel; style the active tab via `&[aria-selected="true"]` declared **after** `&:hover` in the same descriptor (roving-tabindex/keyboard details for nested lists: `roving-tabindex-keyboard-lists`). Server tests only see HTML — assert one `role="tab"`/`role="tabpanel"` per section plus `href="#<id>"`/`aria-controls`, `data-settings-active-tab` after an error POST, and `Location.endsWith('#<id>')` after a PRG redirect; switching, keyboard, and deep-link behavior need a browser check.

## When to Use

- You are building browser behavior in a Remix 3 `clientEntry` and the DOM does not do what the server render implies: an op must wait for `handle.update()`, client entries silently do nothing in Firefox, or same-page panels need to become hash-deep-linked ARIA tabs.
- A page works in Chromium but client interactions, hover reveals, drag-and-drop, or textarea hydration fail in Firefox (especially after a remix/import-map upgrade); or a `requestAnimationFrame` focus/measure callback fires too early, too late, or after the element was removed.
- Before adopting `requestAnimationFrame` for post-render DOM work, wiring the multiple-import-maps polyfill, or hand-rolling tabs over `hidden` panels.

## Related Skills

- `remix3-frame-cliententry` — `<Frame>` navigation, `clientEntry` hydration/lifecycle, and the phase-guard throws that `queueTask` remedies
- `remix3-css-and-layout` — the `hidden`-attribute/`display` override and other `remix-ui` styling traps the tab panels depend on
- `roving-tabindex-keyboard-lists` — roving tabindex and bubbled-event guards for keyboard-navigable lists with nested controls
- `remix3-testing` — driving `clientEntry` DOM side effects and browser-test stubs that these behaviors need
- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical `remix/ui` component-model, `queueTask`, and runtime import-map APIs

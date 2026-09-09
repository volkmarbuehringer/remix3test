---
name: remix3-firefox-single-import-map
description: 'Use when client entries (add item, hover reveal, drag, textarea hydration) break in Firefox but work in Chromium, or when Firefox logs "Multiple import maps are not allowed" — Firefox honors only the first import map, so the remix/ui runtime must load late client entries through remix/multiple-import-maps-polyfill'
user-invocable: false
origin: auto-extracted
---

# Firefox: only one import map is honored

**Extracted:** 2026-09-09
**Context:** After the remix rc.2 / import-map upgrade (#11706), the /lists page broke in Firefox only: adding items did nothing, the row-action hover overlay stayed hidden, drag to the sidebar failed, and a hydrated textarea (Beschreibung) rendered empty. Chromium was fine.

## Problem

Firefox allows **one** `<script type="importmap">` per document; any additional import maps are ignored (console warning: "Multiple import maps are not allowed."). Chromium merges multiple import maps.

The remix/ui runtime (`@remix-run/ui@0.9.0`, from rc.2) renders the initial document's combined map via the `<ImportMap>` component, but for **deferred client entries** discovered in a frame response it appends a **second** `data-rmx-import-map` script (import-map-manager's `appendImportMapScript`). The second map holds the deltas for those client entries' dependencies (e.g. `lists-keyboard`, `button`, `drop-zone`, `sidebar-sync`).

In Firefox the second map is ignored, so the affected client entries cannot resolve their bare-specifier imports. Symptoms:

- `[createFrame] Failed to load module for <hash>` (client entry module fails at execution — the fetch succeeds, so `requestfailed` stays empty)
- Client interactions driven by those entries stop working
- A textarea hydrated from server state renders empty (the client re-render wipes children content when the entry's state never hydrated)

Fresh-browser Chromium tests pass, so a "stale browser" diagnosis is wrong for Firefox — this is deterministic.

## Solution

Wire `run()` to the multiple-import-maps polyfill (the integration documented in the ui 0.9.0 changelog and `~/remix/packages/multiple-import-maps-polyfill/README.md`):

```tsx
// app/assets/entry.tsx
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'

app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await importModule(moduleUrl) // polyfill-aware import()
    // ...return mod[exportName]
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads
    preloadShim(preloads)
    return []
  },
})
```

Browsers with native multiple-map support (Chromium) keep native `import()`; Firefox loads late client entries through the polyfill using every import map in the document.

### CSP requirements

`importShim` evaluates modules from `blob:` URLs and `es-module-lexer` compiles via Wasm. The app's CSP `script-src` must add:

```ts
`script-src 'self' 'nonce-${nonce}' blob: 'wasm-unsafe-eval' 'unsafe-eval'`,
```

- `blob:` — polyfilled module graphs are evaluated from blob URLs
- `'wasm-unsafe-eval'` — `es-module-lexer` Wasm compilation (documented in the polyfill README)
- `'unsafe-eval'` — **required by Firefox's `es-module-lexer` path** (confirmed 2026-09-09): Firefox reports `blocked a JavaScript eval (script-src) ... (Missing 'unsafe-eval')` from `lexer.@*.js` even with `'wasm-unsafe-eval'` present. The polyfill README only lists `'wasm-unsafe-eval'`; Firefox additionally needs `'unsafe-eval'`.

## How to verify

Reproduce in **Firefox**, not Chromium (Chromium merges the maps and masks the bug):

1. Load a page with deferred client entries (e.g. `/lists?load=<id>`)
2. Check the console for `Multiple import maps are not allowed.` and `[createFrame] Failed to load module`
3. Confirm two `data-rmx-import-map` scripts exist; the second holds the client-entry deltas
4. After the fix, the entry script imports `remix/multiple-import-maps-polyfill`, the eval CSP error is gone, and client interactions work

## When to Use

- A page works in Chromium but client entries fail in Firefox with `Multiple import maps are not allowed.`
- `[createFrame] Failed to load module` errors with no `requestfailed` network failure
- After the import-map upgrade, Firefox-only regressions in client-entry-driven UI
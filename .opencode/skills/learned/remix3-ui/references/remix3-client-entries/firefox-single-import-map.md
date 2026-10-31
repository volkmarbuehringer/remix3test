# Firefox: only one import map is honored

**Source:** `remix3-firefox-single-import-map`

**Extracted:** 2026-09-09
**Context:** After the remix rc.2 / import-map upgrade (#11706), the /lists page broke in Firefox only: adding items did nothing, the row-action hover overlay stayed hidden, drag to the sidebar failed, and a hydrated textarea (Beschreibung) rendered empty. Chromium was fine.

## Problem

Firefox allows **one** `<script type="importmap">` per document; any additional import maps are ignored (console warning: "Multiple import maps are not allowed."). Chromium merges multiple import maps.

The component runtime (observed on the pre-split `@remix-run/ui@0.10.0`, remix 3.0.0-rc.3) renders the initial document's combined map via the `<ImportMap>` component, but for **deferred client entries** discovered in a frame response it appends a **second** `data-rmx-import-map` script (import-map-manager's `appendImportMapScript`). The second map holds the deltas for those client entries' dependencies (e.g. `lists-keyboard`, `button`, `drop-zone`, `sidebar-sync`).

In Firefox the second map is ignored, so the affected client entries cannot resolve their bare-specifier imports. Symptoms:

- `[createFrame] Failed to load module for <hash>` (client entry module fails at execution — the fetch succeeds, so `requestfailed` stays empty)
- Client interactions driven by those entries stop working
- A textarea hydrated from server state renders empty (the client re-render wipes children content when the entry's state never hydrated)

Fresh-browser Chromium tests pass, so a "stale browser" diagnosis is wrong for Firefox — this is deterministic.

## Solution

Wire `run()` to the multiple-import-maps polyfill (the integration documented in `node_modules/remix/src/component/README.md` under "Trusted Content and Module Loading" — retitled/moved by #12142, formerly "Client Entry Loading" — and `node_modules/remix/src/multiple-import-maps-polyfill/README.md`):

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

`importShim` evaluates modules from `blob:` URLs. Since remix #12059 (build `57ecca4cba`) the polyfill imports `es-module-lexer/minimal/js`, a pure asm.js build with no `eval`/Wasm, so the app's `script-src` needs only:

```ts
`script-src 'self' 'nonce-${nonce}' blob:`,
```

- `blob:` — polyfilled module graphs are evaluated from blob URLs
- `'unsafe-eval'` / `'wasm-unsafe-eval'` were required before #12059 (the default `es-module-lexer` path used Wasm and an eval fallback); do not re-add them without checking that the installed polyfill still imports `es-module-lexer/minimal/js`
- Guards: `app/middleware/security-headers.test.ts` asserts both tokens are absent, and `app/middleware/security-headers.test.e2e.ts` fails on any `securitypolicyviolation` while `/admin/messages` hydrates in Chromium and Firefox (Firefox exercises the polyfill)

## How to verify

Reproduce in **Firefox**, not Chromium (Chromium merges the maps and masks the bug):

1. Load a page with deferred client entries (e.g. `/lists?load=<id>`)
2. Check the console for `Multiple import maps are not allowed.` and `[createFrame] Failed to load module`
3. Confirm two `data-rmx-import-map` scripts exist; the second holds the client-entry deltas
4. After the fix, the entry script imports `remix/multiple-import-maps-polyfill`, no `securitypolicyviolation` is reported, and client interactions work

## When to Use

- A page works in Chromium but client entries fail in Firefox with `Multiple import maps are not allowed.`
- `[createFrame] Failed to load module` errors with no `requestfailed` network failure
- After the import-map upgrade, Firefox-only regressions in client-entry-driven UI

---
name: remix3-tooling
description: "Use when configuring how a Remix 3 app is served, built, or tested — asset-server config in remix.json (loadConfig + config.assets, mounts/denyFiles, colocated public/ and the allowFiles graph), the remix CLI / node-tsx loader, the node-hmr dev server, self-hosting webfonts, analyzing branch-pinned upstream dependency changes, running or testing under Bun (TypeError: Type error from handle.frame listeners, Dateityp-nicht-erlaubt upload MIME, @types/bun breaking typecheck, pnpm bin shims, SSR signal EventTarget), and the test suite (clientEntry DOM side effects, parallel-test interference despite ephemeral DBs, waitFor on statically present elements, mocking external services on dynamic ports, html-validate assertions, this app's state-isolation + t.serve e2e wiring, and Playwright/networkidle hangs)."
user-invocable: false
origin: consolidated
---

# Remix 3 Tooling: Build, Bun & Testing

Consolidated from 3 former learned skills (`remix3-build-and-tooling`, `remix3-bun-runtime`, `remix3-testing`) on 2026-10-17. Reference files are namespaced under `references/<former-skill>/`. Everything vendor-supplied (guides, package READMEs, the vendor `remix` / `mastra` skills) stays authoritative — sections below are deltas only.

## Load Only The Sections You Need

| You need... | Section | References |
| --- | --- | --- |
| Serving/building — remix.json asset server, mounts/denyFiles/allowFiles, remix CLI, node-tsx, node-hmr, webfonts, upstream dependency analysis | § Build, Assets & Tooling | `references/remix3-build-and-tooling/` |
| App or tests fail under Bun but pass under Node — TypeError: Type error, upload MIME rejection, @types/bun typecheck, pnpm bin shims | § Bun Runtime | `references/remix3-bun-runtime/` |
| Writing/debugging the test suite — state isolation, t.serve e2e, clientEntry DOM tests, parallel-test interference, html-validate, Playwright hangs | § Testing | `references/remix3-testing/` |

## Build, Assets & Tooling

_(formerly `remix3-build-and-tooling` — references live under `references/remix3-build-and-tooling/`)_

**Consolidated from:** `remix3-browser-source-public-colocation`, `remix3-assets-config-inspection`, `remix-cli-devops`, `remix3-hmr-dev-server`, `remix3-self-hosted-fonts`, `remix-upstream-dependency-analysis`

This skill is the **index** for how a Remix 3 app's asset server is configured, how browser source is laid out for it, and how the `remix` CLI / `node-tsx` loader are driven. For the asset-server, CLI, and loader APIs themselves, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

### Load Only The References You Need

| Symptom / task involves... | Start with |
| --- | --- |
| Making `remix.json` the asset-server source of truth (`loadConfig` + spread `config.assets`), `mounts` vs the removed `fileMap`, `denyFiles` precedence, or debugging with `remix assets` / `remix assets inspect` and `AssetStatus` | `references/remix3-build-and-tooling/assets-config-inspection.md` |
| Relocating `.browser.*` source into `<route>/public/`; `git mv` breaking sibling `./`/`../` imports (`TS2307`, silently un-bundled graph); a `ui/` module importing a non-public `app/actions/**` module that resolves `not-allowed`; tuning `allowFiles` | `references/remix3-build-and-tooling/browser-source-public-colocation.md` |
| Running `remix new` / `test` / `doctor` / `routes` / `version` / `completion`, programmatic `runRemix`, wiring `node --import remix/node-tsx` or `loadModule`, the `node-tsx` tsconfig, `remix test` filters, `NODE_ENV=test`, or mocking frozen ES-module exports | `references/remix3-build-and-tooling/cli-devops.md` |
| Wiring or debugging the `node-hmr` dev server (`npm run hmr`): fingerprint/watch conflict, IPv6 loopback, ready-gate hang, orphaned child, `trustProxy`, or hoisted declarations dropped after a component `return` | `references/remix3-build-and-tooling/hmr-dev-server.md` |
| Adding/replacing/auditing a webfont, or a page still loads `fonts.googleapis.com` / `fonts.gstatic.com`; serving `public/` and tightening the CSP | `references/remix3-build-and-tooling/self-hosted-fonts.md` |
| A branch-pinned (`github:…#branch`) dependency may have upstream changes, you must judge whether to update, or you are pinning release-day versions across the post-#11948 split lines (currently `remix` 3.1.0 / `@remix-run/ui` 0.13.0 / `@remix-run/component` 1.1.0) | `references/remix3-build-and-tooling/upstream-dependency-analysis.md` |
| `pnpm update`/`install` on the branch-pinned remix deps fails or crawls (`EROFS` store, `ERR_PNPM_UNEXPECTED_STORE`, `ERR_PNPM_PREPARE_PACKAGE`, codeload 429/retry storms), or you need to bump an unrelated package without re-preparing the monorepo tarball | `references/remix3-build-and-tooling/pnpm-git-hosted-installs.md` |

### Core Rules

**Browser source colocated under a route's `public/` (`references/remix3-build-and-tooling/browser-source-public-colocation.md`)**

- `git mv`-ing `.browser.*` source into `app/actions/<group>/public/` preserves history but breaks every sibling relative import (`./`/`../`) — `TS2307` and a silently un-bundled asset graph. Count depth back to `app/` when fixing them (`…/<group>/public/` → `../../../`, one level deeper → `../../../../`), and keep `app/ui/**` broad in `allowFiles`: the **whole** dependency graph (`public/`, `.browser.*`, and shared `app/ui/` helpers) must match the glob, not just `public/`.
- `allowFiles` admits `app/ui/**` and `app/utils/**` but **not** non-public `app/actions/**`, so a `ui/` page importing an actions module leaves a dormant `reachable → not-allowed` edge that surfaces only once the page enters a client graph. Move the shared value to `app/utils/` and re-export it from the actions module to keep importers working; confirm edges with `remix assets inspect <file>` (`reachable` vs `not-allowed`). Revert a move when the component is really a shared subsystem (e.g. the appointment-grid cluster) rather than route-owned.

**Shared asset config + inspector (`references/remix3-build-and-tooling/assets-config-inspection.md`)**

- Make `remix.json → assets` the single source of truth and spread `config.assets` into `createAssetServer` via `loadConfig` (it accepts a file or directory and searches upward for `remix.json`; needs top-level `await`), keeping only runtime options (`watch`, `hmr`, `fingerprint`, `target`, `sourceMaps`, `scripts`, `minify`) in code. Debug with `remix assets` (`url -> file`) and `remix assets inspect <url-or-file>` (`Status`, `URL`, `File`, `Denied by:`); `AssetStatus` is `reachable | missing | denied | not-allowed | unmapped | unsupported`, and `denyFiles` outranks `allowFiles`/`allowPackages`, setting `access.deniedBy`.
- The strict `parseAssetsConfig` rejects unknown properties — `fileMap` now throws, so use directory-based `mounts` (keys are URL segments relative to `basePath`, values are directories relative to `rootDir`, recursing; default `{ app: 'app', npm: 'node_modules' }` serves node_modules at `/assets/npm/...`). `denyFiles` is path-scoped (`app/**/*.server.*`, `app/**/*.test.*`): vendor `node_modules` test files stay reachable, and app test files are hidden from `/assets` **without** breaking browser tests (the test runner uses its own server). The `node_modules` mount makes the whole allowed dep tree reachable (~2500 lines — filter `^/assets/app/`, never pipe through `head`), and #11814 auto-mounts `/__@remix/virtual-store` only when the store is outside `rootDir` (not this app, whose `.pnpm` is inside the mount).

**`remix` CLI + `node-tsx` (`references/remix3-build-and-tooling/cli-devops.md`)**

- `remix new <dir>`, `remix test`, `remix doctor [--fix]`, `remix routes [--table]`, `remix version`, `remix completion bash|zsh`, plus programmatic `runRemix` from `remix/cli`. `remix routes` reads only the export **named `routes`** from `routes.ts` (the loader worker requires `'routes' in routeModule`, otherwise it throws `must export a named "routes" value`) — independently mounted named trees run but stay invisible — and `remix test` takes a positional glob with `--type=server|browser|e2e` (no `--run`), **defaults `NODE_ENV` to `test` when it is unset** (`process.env.NODE_ENV ??= 'test'`), and supports `--coverage`.
- Register the TypeScript/JSX loader with `remix/node-tsx` (`node --import remix/node-tsx ./server.ts`, side-effect `import 'remix/node-tsx'`, scoped `loadModule` from `remix/node-tsx/load-module`) under `module`/`moduleResolution: NodeNext`, `allowImportingTsExtensions`, `isolatedModules`, `verbatimModuleSyntax`, and `rewriteRelativeImportExtensions`. `mock.method(obj, name)` cannot spy frozen ES-module named exports, so prefer side-effect/DOM testing or wrap the export in a mutable object (`export let scrollLock = { … }`).

**HMR dev server (`references/remix3-build-and-tooling/hmr-dev-server.md`)**

- `npm run hmr` runs `hmr.ts`, which spawns `server.ts` behind a readiness-gated loopback proxy. Gate `fingerprint`/`minify` to non-dev, use the object `hmr` form (`channel` + `moduleImporter: 'remix/multiple-import-maps-polyfill'`) with `componentHmr()` in `scripts.loaders`, pin the child `HOST: '127.0.0.1'`, wrap `runner.ready()` in a timeout so a boot crash returns 503 instead of hanging, and exit the child on IPC `disconnect`. Set `trustProxy: isHmr` so the proxy's forwarded headers restore the browser origin (upstream #11897). Pre-`27393da759` builds dropped function declarations after a component `return` (`ReferenceError` in the browser); bump the pin or move them above the `return`.

**Self-hosted webfonts (`references/remix3-build-and-tooling/self-hosted-fonts.md`)**

- Dedupe Google's variable families to one woff2 per family (every weight resolves to the same URL) and declare `font-weight: 100 900`; serve `public/` with `staticFiles('./public', …)` after `securityHeaders()` and before `session`/`loadDatabase`; link `/fonts/fonts.css` from `Document`'s `<head>`; set CSP `style-src 'self' 'unsafe-inline'` and `font-src 'self'`. Commit the fetch script and guard with a test that home HTML contains no `fonts.googleapis.com`/`fonts.gstatic.com`.

**Upstream dependency analysis (`references/remix3-build-and-tooling/upstream-dependency-analysis.md`)**

- For a `github:owner/repo#branch&path:subdir` pin, read the resolved commit from `pnpm-lock.yaml`, `git log <pinned>..origin/<branch>` and `git diff --stat` the package, grep the codebase for each changed API, then run `typecheck` + tests. Focus on new opaque types, changed defaults, and new runtime validation that can turn an unchecked `as` cast into a 500 (`dev-gotchas § TypeScript` → `references/typescript-gotchas/vendor-validator-cast-audit.md`).

### When to Use

- You are wiring or diagnosing the asset server: moving static mapping/access config into `remix.json → assets`, adopting `loadConfig` + `config.assets`, migrating `fileMap` to `mounts`, reasoning about `denyFiles` precedence, or asking what is actually reachable with `remix assets` / `remix assets inspect`.
- You are relocating or adding browser (`.browser.*`) source and need to know where it belongs (`<route>/public/` vs shared `app/ui/`), how `git mv` changes relative-import depth, or whether an import is servable under `allowFiles`.
- You are running the `remix` CLI (scaffold, tests, doctor, routes), setting up `node-tsx` to execute TypeScript/JSX directly, filtering `remix test` by type, `NODE_ENV` handling in `remix test`, or working around frozen ES-module exports in tests.
- You are wiring or debugging `npm run hmr` (asset-server/HMR config, proxy hangs, `EADDRINUSE`, the pre-#11913 hoisted-declaration `ReferenceError`).
- You are self-hosting a webfont, auditing for a third-party font CDN, or serving `public/` through the static middleware.
- A branch-pinned dependency may have moved and you need to judge whether updating breaks the app.

### Related Skills

- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical asset-server, CLI, `node-tsx`, and convention APIs these deltas build on
- `remix3-server § Route Wiring` (`references/remix3-route-wiring/route-relocation.md`) — moving routes between trees; its relative-import-depth checklist points here for `public/` client entries
- `remix3-server § Route Wiring` (`references/remix3-route-wiring/standalone-route-admin-sidebar.md`) — registering standalone routes outside the route tree; the CLI route-tree discovery note now lives here
- `remix3-ui § Client Entries` — the browser behavior that runs inside the colocated `clientEntry` modules
- `remix3-tooling § Testing` — Remix 3 test-suite patterns, including `remix test` filters and the frozen-export mock seam
- `remix3-tooling § Bun Runtime` — running the app or `remix test` under Bun, where the `node-tsx` loader and `@types/bun` interact

---

## Bun Runtime

_(formerly `remix3-bun-runtime` — references live under `references/remix3-bun-runtime/`)_

**Consolidated from:** `bun-run-pnpm-shim`

**Extracted:** 2026-09-19
**Context:** Adding Bun as a second runtime to this Remix 3 + pnpm app (remix `3.0.0-rc.3`; `@remix-run/ui` 0.10.0; Bun 1.4.2). Node stays runtime #1; Bun is opt-in via `pnpm dev:bun` / `start:bun` / `test:bun`. Re-validate version-pinned claims against `node_modules/.pnpm/@remix-run+*` and the installed Bun — the current line refs and pass/fail result live in `references/remix3-bun-runtime/validation-and-result.md`.

This skill is the **index** for running this Remix 3 + pnpm app under Bun. For the runtime APIs themselves, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| `server.bun.ts`, sharing the router/DB pipeline, or `X-Client-Ip` from `requestIP()` | `references/remix3-bun-runtime/entrypoint-and-shared-handler.md` |
| `test:bun`, `IS_BUN`, `--coverage` under Bun, or which parts of the suite change | `references/remix3-bun-runtime/test-runner-and-bun-awareness.md` |
| `TypeError: Type error` from `addEventListener(..., { signal: handle.signal })` during SSR | `references/remix3-bun-runtime/ssr-signal-eventtarget.md` |
| Uploads rejected under Bun only (`Dateityp nicht erlaubt.`); `File.type` gains `;charset=utf-8` | `references/remix3-bun-runtime/file-mime-charset.md` |
| `@types/bun` breaking the main typecheck (`Property 'preconnect' is missing`) | `references/remix3-bun-runtime/typescript-types-scoping.md` |
| `bun run <bin>` silently executing Node in a pnpm project | `references/remix3-bun-runtime/pnpm-bin-shim.md` |
| Re-validating the version-pinned claims, or the suite's Bun pass/fail result | `references/remix3-bun-runtime/validation-and-result.md` |

### Core Rules

**Entrypoint (`references/remix3-bun-runtime/entrypoint-and-shared-handler.md`)**

- `server.bun.ts` must reuse `server.ts`'s router/DB bootstrap through one shared `createServerHandler(router)`; the only Bun-specific part is reading the trusted socket address from `runtime.requestIP(request)?.address` in `fetch(request, runtime)`. Bun auto-loads `.env` (no `--env-file`).

**Test runner (`references/remix3-bun-runtime/test-runner-and-bun-awareness.md`)**

- `"test:bun": "NODE_ENV=test bun node_modules/remix/dist/cli-entry.js test"` — plain `bun run remix test` runs Node through the pnpm shim. `@remix-run/test` is Bun-aware (`IS_BUN`): native `Glob` discovery, skips `@remix-run/node-tsx`, and skips the Node V8 coverage loader, so `--coverage` is not meaningful under Bun.

**SSR signal (`references/remix3-bun-runtime/ssr-signal-eventtarget.md`)**

- `handle.signal` is a frozen plain object during SSR, not an `AbortSignal`; Bun's `EventTarget` throws `TypeError: Type error` on `{ signal: handle.signal }`. Guard any registration that can run during SSR with `typeof document !== 'undefined'`.

**File MIME (`references/remix3-bun-runtime/file-mime-charset.md`)**

- Bun's `File.type` appends `;charset=utf-8`, so exact-match allowlists reject valid uploads. Normalize through `ContentType.from(mime).mediaType?.toLowerCase()`.

**TypeScript types (`references/remix3-bun-runtime/typescript-types-scoping.md`)**

- Never add `"bun"` to the main `tsconfig` `types` (Bun's `fetch` requires `preconnect`, breaking `fetch` mocks). Use `tsconfig.bun.json` with `files: ["server.bun.ts"]` and exclude `server.bun.ts` from the base.

**pnpm bin shim (`references/remix3-bun-runtime/pnpm-bin-shim.md`)**

- `bun run <bin>` resolves through `node_modules/.bin/<bin>`, a `/bin/sh` shim ending in `exec node …`, so it silently runs Node. Force Bun with `bun --bun run <bin>`, or invoke the package's real dist entry.

### When to Use

- Adding or debugging `server.bun.ts`, `pnpm dev:bun` / `start:bun` / `test:bun`.
- A Remix 3 page renders under Node but throws `TypeError: Type error` under Bun.
- Uploads are rejected under Bun even though the file type is allowed.
- `tsc` breaks with `Property 'preconnect' is missing` after adding Bun types.
- A CLI launched with `bun run <bin>` behaves like Node at runtime.

### Related Skills

- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical runtime/entrypoint APIs
- `remix3-server § Security` (`references/security-gotchas/two-tier-ip-trust-model.md`) — why the `requestIP()` socket tier keeps `X-Client-Ip` unspoofable
- `remix3-tooling § Build & Tooling` — the `node-tsx` loader and `@types/bun` interaction; asset-server/dev-server wiring
- `remix3-tooling § Testing` — the Remix 3 test-suite patterns this runner executes

---

## Testing

_(formerly `remix3-testing` — references live under `references/remix3-testing/`)_

**Consolidated from:** `remix3-cliententry-browser-test-stubs`, `remix-test-parallel-interference`, `static-element-waitfor-content-not-existence`, `mock-http-external-service-dynamic-port`, `remix3-html-amp-escaped-assertions`, `remix3-playwright-browser-testing`

This skill is the **index** for Remix 3 test-suite deltas. For the vendor test runner API (`remix test`, `describe`/`it`, `render`/`act`), use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`). For the canonical test boundaries and patterns (`router.fetch`, state isolation, browser component and e2e flows), use the installed testing guide `node_modules/remix/guides/13-testing.md`.

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| A `*.test.browser.tsx` must assert a `clientEntry` side effect driven by `getBoundingClientRect`, `matchMedia`, or `scrollTo` that `render`/`act` alone cannot drive | `references/remix3-testing/cliententry-browser-test-stubs.md` |
| A `*.test.browser.tsx` for a **full-page** `clientEntry` that queries `document`/`window` and registers delegated listeners, or that writes the URL hash; browser tests pass alone but fail together | `references/remix3-testing/document-scoped-cliententry-browser-tests.md` |
| A `*.test.browser.tsx` must drive a `clientEntry`'s `reloadStart`/`reloadComplete` behavior (loading/pending state, pre-swap flush), and the mounted runtime frame cannot be dispatched on | `references/remix3-testing/frame-event-cliententry-tests.md` |
| Parallel tests interfere despite ephemeral per-run DBs; a test passes in isolation but fails in the full suite; a shared-DB test fails even alone (`LIMIT 1` without `ORDER BY`, seed rows relative to today); another suite's unscoped `afterEach` `DELETE` removed your live fixture; a background retention/cleanup timer swept the old row your test just inserted | `references/remix3-testing/parallel-test-interference.md` |
| `waitFor(() => !!getElementById(x))` passes instantly and the next assertion fails on empty content | `references/remix3-testing/waitfor-static-element.md` |
| Mocking an external HTTP service in a test; the real service is running locally on the same port (`EADDRINUSE`) | `references/remix3-testing/mock-external-http-service.md` |
| A `remix test` string assertion on an `href`/`action`/query string fails because the HTML escapes `&` to `&amp;` | `references/remix3-testing/html-amp-escaped-assertions.md` |
| A rendered page passes the JSX AST rule but you need to catch invalid content models (`<a><button>`, `<h2>` in `<span>`, `<style>` in `<div>`) in dynamically composed HTML or raw `remix/html-template` output | `references/remix3-testing/rendered-html-conformance-html-validate.md` |
| You are ad-hoc verifying a UI change against the running dev server and the path includes a destructive control (delete/clear, or arm-then-confirm) | `references/remix3-testing/ad-hoc-verification-safety.md` |
| A router test shares session/DB state, or an `*.test.e2e.ts` needs `t.serve`/`createTestServer` wiring (the guide's generic `createAppRouter`/memory-storage examples don't match this app) | `references/remix3-testing/state-isolation-and-e2e-serve.md` |
| A Playwright navigation/submit hangs on a page that mounts an SSE/EventSource channel (`networkidle` never settles) | `references/remix3-testing/sse-networkidle-never-settles.md` |
| A remix `on('change')` handler on a native `<select>` does not fire for `selectOption` in Firefox, or for a dispatched `change` in Chromium | `references/remix3-testing/select-change-events.md` |
| A hover/focus-revealed control behaves differently with a real pointer vs programmatic `.click()`/`.focus()`; you need to test `:hover`/`:focus-visible`, transient opacity, or focus retention across a reorder | `references/remix3-testing/input-modality-and-hover-testing.md` |
| An e2e types into an input right after `goto` and the field settles missing leading keystrokes (passes idle/alone, fails under suite load); you need baseline attribution for a flaky e2e | `references/remix3-testing/keystroke-loss-hydration-race.md` |
| A `*.test.browser.tsx` hangs after code calls `window.location.reload()`/`assign`/`replace`/`href` | `references/remix3-testing/location-reload-unforgeable.md` |
| A generic crash card hides the real exception stack from `pageerror`/console | `references/remix3-testing/crash-card-swallowed-stack.md` |
| Choosing which browser engine to reproduce a DOMException report in | `references/remix3-testing/reproduction-browser-from-message.md` |

### Core Rules

**clientEntry browser-test stubs (`references/remix3-testing/cliententry-browser-test-stubs.md`)**

- `render(...)` + `result.act(...)` flushes `handle.queueTask` and is enough for event-driven entries, but **not** when the side effect depends on geometry or media state (`getBoundingClientRect().top < 0`, `window.matchMedia(...)`, `scrollTo`/`scrollIntoView` in a container with no real layout).
- Build a controlled DOM fixture the entry queries, then stub the platform APIs with `Object.defineProperty(el, 'scrollTo'|'scrollHeight'|'clientHeight', { configurable: true })` (preferred over assignment: the properties are inherited/read-only and `scrollTo` is overloaded, so a plain assignment needs an `as unknown as` cast); stub `matchMedia` per test and restore it in `afterEach`.
- Pair every "not called" case with a positive case that proves the entry ran — a stub that is never called makes an "assert zero calls" test pass vacuously. Module-scoped delegated listeners outlive a test, so scope queries to `result.container` and remove fixtures in `afterEach` even when an assertion throws.
- Run explicitly with `NODE_ENV=test npx remix test app/ui/<name>.test.browser.tsx` to execute every configured project (here `chromium` + `firefox`); for the production counterpart (once per frame navigation, keyed on a server-rendered `data-*` attribute + `handle.queueTask`) see `remix3-ui § Frames`.

**Document-scoped `clientEntry` browser tests (`references/remix3-testing/document-scoped-cliententry-browser-tests.md`)**

- The guide's example mounts a self-contained component, but most full-page entries here render only a hidden marker and work through `document`/`window` in a `ref` callback. Append the fixture to `document.body` (not `result.container`) and assert against the fixture; `result.container` holds none of the UI.
- Remove the fixture in `afterEach` even when an assertion throws — module-scoped delegated listeners (`let listenersRegistered = false`) persist across tests and `cleanup()` does not remove them. If the entry writes `location.hash`/`history.replaceState` (ARIA tabs, deep links), reset the hash in `beforeEach` or one test deep-links the next.
- `render()` supplies a root frame, so entries that only listen for `handle.frame` events mount without setup; stub `frameInit.resolveFrame` only when the test triggers `handle.frame.reload()`. Mirror the server-rendered markup exactly (`Glyph` emits only `xlink:href` — see `remix3-styling § Theme Tokens → references/remix3-theme-conformance/glyph-add.md`).

**Frame-event `clientEntry` tests (`references/remix3-testing/frame-event-cliententry-tests.md`)**

- `RenderResult` exposes `container`/`root`/`$`/`$$`/`act`/`cleanup` — **not** the entry's `frame`, so `render(<Entry/>)` gives you no way to dispatch `reloadStart`/`reloadComplete`. Call the entry factory directly with a synthetic `Handle` whose `frame` is a plain `EventTarget` and whose `update` re-renders into the test root (the `pending-submit.test.browser.tsx` pattern).
- The synthetic handle needs `frame`, `props`, a real `signal` (native `addEventListener`; Bun rejects the SSR stub), and `update`; abort the signal + `cleanup()` in `afterEach` so the factory's document/window listeners do not leak. Add `queueTask` (drain it) when the exercised path opens a picker/dialog, and hold a manually resolved `fetch` promise to test a response resolving after a frame switch.
- This bypasses hydration — assert the entry's own render output, and keep an e2e for the real navigation wiring.

**Parallel test interference (`references/remix3-testing/parallel-test-interference.md`)**

- Ephemeral per-run databases do **not** fix within-run interference: parallel workers' `setupTestEnvironment()` data accumulates in the shared ephemeral DB, so when seed + helper + own + parallel data exceeds a paginated page size the test's own rows fall off the first page. Diagnose by isolation, then keep `after()` cleanup for colliding sources, raise the page size in the test environment, or scope assertions to unique filters/identifiers.
- A shared-DB test can also fail **in isolation** when the fixture is not self-owned: `LIMIT 1` without `ORDER BY` picks an arbitrary row, and seed rows relative to today (seeded weekday offerings) are excluded by a `day >= today` window on weekends. Create the rows the assertion needs, require the needed properties in the query (`JOIN … WHERE … ORDER BY`, throwing when empty), and scope to identifiers the test owns.
- A `forks` pool isolates **processes, not the database**: a teardown that deletes a whole shared table (`DELETE FROM chat_runs` with no `WHERE`) can land inside a parallel suite's insert→assert window and null its fixture. Resolve the ids your suite authenticates as once, and scope every delete to them (`WHERE user_id = ANY($1::int[])`).
- A **background timer started from shared init** (`initializeAppDatabase()` → `startDatabaseMaintenance()` → `setInterval` that runs immediately) executes in every worker and can delete the old row a test just inserted before the test's own call. Guard the start with `process.env.NODE_ENV !== 'test'`; keep the sweep functions unit-tested against explicit windows.

**Static container and `waitFor` (`references/remix3-testing/waitfor-static-element.md`)**

- An existence-check wait (`!!getElementById(x)`) passes instantly once the element is **statically present** (a node refactored from dynamically-created into a fixed fixture/placeholder); the following `textContent` assertion then fails with a confusing "not found" on the empty shell.
- Make the `waitFor` predicate overlap the assertion: if you assert on `textContent`, wait on `textContent` (e.g. `!!gate && gate.textContent?.includes('Cancel Jane Doe?')`).

**Mock external HTTP service (`references/remix3-testing/mock-external-http-service.md`)**

- Bind the mock with `node:http` `createServer` on **port 0** (OS-assigned) to avoid `EADDRINUSE` with a real local service, and read the target URL through a **function** evaluated at request time (`function externalUrl() { return process.env.EXTERNAL_URL ?? ... }`) — a module-level `const` is evaluated at import, before `before()` can override it, and the test then silently skips the external-forwarding path.
- In `before()` set `process.env.EXTERNAL_URL` from `mockServer.address()` once listening; in `after()` call `mockServer?.close()` and `delete process.env.EXTERNAL_URL` so other tests are unaffected. Verify the forward actually happened via a side effect (e.g. the stored response status in the DB), not just a 2xx.

**HTML-escaped assertions (`references/remix3-testing/html-amp-escaped-assertions.md`)**

- Rendered HTML serializes `&` in attribute values as `&amp;` (and `"` as `&quot;`), and `response.text()` returns that serialized HTML with entities intact — so a string assertion written with the raw `&` never matches and fails with no hint of the cause. Match the escaped form in `response.text()`, including in absence assertions.
- Prefer asserting on a redirect `Location` header when possible: headers are not HTML-escaped and keep the raw `&`.

**Rendered-HTML content-model conformance (`references/remix3-testing/rendered-html-conformance-html-validate.md`)**

- Validate the real `router.fetch` response with `html-validate`; `.htmlvalidate.json` sets `"extends": []` so only `element-permitted-content` runs (the loader default is `Config.defaultConfig()` = `html-validate:recommended`). `new HtmlValidate()` never reads the file — use `new HtmlValidate(new FileSystemConfigLoader())` and the **async** `validateString`; `validateStringSync` throws on that loader.
- Frame content streams scoped styles as an inline `<head>` block after the `<!-- rmx:f:HASH -->` marker; strip `/<head>[\s\S]*?<\/head>/g` before validating or html-validate flags `<head>` under a body element. Assert the response contains `<html` (frame fragments are not documents), and keep the check additive to `remix-a11y/no-nested-interactive` (see `remix3-ui § Rendering`).

**State isolation and `t.serve` e2e (`references/remix3-testing/state-isolation-and-e2e-serve.md`)**

- The guide's generic seams are app-specific here: the factory is `createNewappRouter(options)` in `app/router.ts` (not `createAppRouter`), shared tests import `router` from `app/test-router.ts`, DB state is an ephemeral Postgres database created by `test/setup.ts` via `remix.json` `test.setup` (not SQLite `:memory:`), and session/cookie helpers already exist in `app/test-utils.ts` (`extractCookie`, `createCsrfSession`, `createAuthCookieWithCsrf*`) instead of a hand-rolled `getResponseCookie`.
- E2E uses `t.serve(await createTestServer((request) => router.fetch(request)))` (arrow adapter, not `createTestServer(router.fetch)`); `t.serve` closes the server/page, but DB/file fixtures created outside it need their own cleanup, and Firefox-broken assertions are scoped with `isFirefox(page)` rather than skipped.
- The ephemeral DB is per-run, not per-test: parallel workers accumulate rows, so a test that paginates still owns its cleanup (see `parallel-test-interference.md`).

**Ad-hoc verification safety (`references/remix3-testing/ad-hoc-verification-safety.md`)**

- **Never verify a destructive control against the running dev server.** It shares the persistent `DATABASE_URL`, and a two-step arm/confirm button (e.g. `/lists` → `✕ Alle löschen`, label flips to "Wirklich alle löschen?") executes on the second click. Prove the behavior non-destructively (outside click / `Escape` / assert `details[open]`), or move the path into a seeded `*.test.e2e.ts` that deletes only its own rows.

**Playwright / browser-run debugging (`references/remix3-testing/sse-networkidle-never-settles.md`, `references/remix3-testing/location-reload-unforgeable.md`, `references/remix3-testing/crash-card-swallowed-stack.md`, `references/remix3-testing/reproduction-browser-from-message.md`, `references/remix3-testing/select-change-events.md`)**

- **Native `<select>` change events are unreliable**: `selectOption` fires the remix `on('change')` handler in Chromium only; a synthetic `dispatchEvent(new Event('change'))` does not reach it on selects even in Chromium (it does on checkboxes — host element type matters). Retry the interaction until the DOM reflects the change (hydration-gap no-ops) and scope Firefox out with `isFirefox(page)` + a smoke check (`references/remix3-testing/select-change-events.md`).
- **Hydration swallows early keystrokes** in e2e typing: the first client flush lands before `on('input')` binds, so app state loses leading characters and no `waitFor` widening can converge. Settle-check `inputValue()` after typing and re-type with **real keystrokes** (bounded ~3 rounds) — never `fill()`, which fixes the DOM without dirtying the editor. Attribute flakiness to baseline first (`git worktree add … HEAD~n` + symlinked `node_modules` + copied `.env`, run the file 3× there). See `references/remix3-testing/keystroke-loss-hydration-race.md`.
- **Never use `networkidle`** on a page/action that mounts an SSE/streaming connection — the open `EventSource` keeps `waitForLoadState('networkidle')` pending forever. Wait on a state-specific DOM anchor; use `waitForURL` for a signed-in submit→redirect; add a short `waitForTimeout` only if a `clientEntry` effect must settle.
- `window.location.reload`/`location` are unforgeable in real Chromium (assigning or `Object.defineProperty`-ing throws `TypeError: Cannot assign to read only property 'reload' of object '[object Location]'`), and **any** `Location` navigation (`reload`/`assign`/`replace`/`href`) triggered while an `await` is pending navigates the test page away — the runner reports no progress (`0/N files completed`) and hangs. Window-mode navigation is **not assertable** in a real browser: skip it, add an injectable reload seam, assert a pre-reload side effect, or extract a pure predicate. `frame.reload()` is fine. If a dormant suite starts hanging after widening the glob to `.tsx`, run the file alone under an OS-level `timeout`.
- **Crash cards swallow the stack**: the app's `try/catch` consumes the exception before Playwright sees it. Wrap the throwing DOM method in `page.addInitScript` (runs before app code, re-arms per document) and stash the stack on `window` (or `sessionStorage` when the failure navigates); wrap **one** named method (`Node.insertBefore`) or the usual `insertBefore`/`appendChild`/`removeChild`, and capture `this.nodeName`/`node.nodeName`.
- **DOMException messages are browser-specific** (Firefox `Node.insertBefore: Cannot insert a Text as a child of a Document` vs Chromium `Failed to execute 'insertBefore' on 'Node': …`): reproduce in the engine whose wording matches the report.

**Input modality and reorder focus (`references/remix3-testing/input-modality-and-hover-testing.md`)**

- A `*.test.browser.tsx` cannot reproduce pointer modality: `.click()` never sets `:hover`, and `.focus()` keeps the last input modality, so a `:focus-within`-pinned control can pass there and fail with a real mouse. Drive the pointer path in `*.test.e2e.ts` with `row.hover()` → `action.hover()` → `click()`; switch to keyboard modality with a real key before `.focus()`/`Enter` and assert `document.activeElement.matches(':focus-visible')`.
- Count revealed instances with `getComputedStyle(cluster).opacity > 0.5` (not `isVisible()`: the cluster is laid out at opacity 0), identify the hovered row with `document.elementFromPoint(x, y)?.closest('[data-item-id]')`, and retry the interaction through the hydration gap until the expected DOM change.
- A keyed reorder may reinsert the focused row (focus falls to `<body>`) or move a sibling and leave the clicked row in place (focus survives). Don't infer focus from node identity; assert the active row/label, and restore the action by id after the update when it must continue.

### When to Use

- You are writing or debugging a Remix 3 `remix test` suite (server-render or `*.test.browser.tsx`) and an assertion fails for a reason the test code does not explain.
- A browser test must drive a measurement/geometry/media-driven `clientEntry` side effect that `render`/`act` cannot reach.
- A `*.test.browser.tsx` must drive a `clientEntry`'s frame `reloadStart`/`reloadComplete` behavior (loading/pending state, pre-swap flush) that `render(<Entry/>)` cannot reach.
- A `*.test.browser.tsx` targets a full-page `clientEntry` that queries `document`, and tests interfere (leftover fixtures, an unexpected active tab) or one test's hash deep-links another.
- Tests interfere when run in parallel, or a shared-DB test fails intermittently or even in isolation.
- A `waitFor` existence check passes but the content assertion that follows fails.
- You need to mock an external HTTP service or match escaped markup in rendered output.
- You need a regression guard for the HTML content model of server-rendered pages (nested interactive content or invalid element nesting the JSX AST rule cannot see).
- A router test needs an authenticated session or multi-request flow, or you are adding an `*.test.e2e.ts`, and the guide's generic example does not match this repo's harness.
- A Playwright/e2e navigation or submit hangs on a page with an SSE/EventSource channel, or a browser test hangs after a `window.location` navigation.
- You are manually verifying a UI change in the running app and the flow contains a delete/reset/confirm action.
- A crash card hides the real exception stack from `pageerror`/console capture.
- A hover/focus-revealed control behaves differently with a real pointer than with programmatic `.click()`/`.focus()`, or a reorder pins/loses focus in a way a component test cannot reproduce.

### Related Skills

- `remix3-ui § Frames` — production `Frame` navigation and `clientEntry` side effects (`handle.queueTask`, `data-*` identity)
- `remix3-tooling § Bun Runtime` — running the app and its `remix test` suite under Bun
- `remix3-styling § CSS & Layout` — styling/layout deltas that browser tests assert on (geometry, computed style)
- `remix3-ui § Rendering` — owns the `<a><button>` bug class, `buttonLink()`, and raw-HTML props this validation is additive to
- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical `remix test` runner and `render`/`act` API

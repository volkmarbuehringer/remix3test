# Remix 3 HMR Dev Server — Adoption & Debugging

**Source:** `remix3-hmr-dev-server`

**Extracted:** 2026-08-10
**Revalidated:** 2026-11-10 against preview release `v0.20261109.230941-main-af7b225e` / source `af7b225e` (`@remix-run/node-hmr` 1.0.0, `@remix-run/assets` and `@remix-run/component-hmr` from the same release).
**Context:** This app adopted the opt-in HMR dev server from `@remix-run/node-hmr` + `@remix-run/component-hmr`. `npm run hmr` runs `hmr.ts`, which spawns `server.ts` as a child behind a readiness-gated loopback proxy (proxy :44100, SSE :44101, child :44102). These are the app-specific pitfalls hit while wiring and smoke-testing it; re-grep the installed `@remix-run/node-hmr` / `@remix-run/assets` before trusting a line number after a bump.

## Current API anchors (release `v0.20261109.230941-main-af7b225e`)

- `run(entry, options)` at `@remix-run/node-hmr/dist/index.d.ts:126`; `RunOptions` at `:4` with `browserHmrChannel` at `:9`, plus `cwd`/`entryArgs`/`env`/`nodeArgs`/`watch`.
- `createHmrReadyFetch(runner, fetch, options)` at `dist/index.d.ts:114`; `dist/index.js:17` uses `shouldRetrySafeUnavailableRequest` (`:81`) for GET/HEAD on `502/503/504` **or** a thrown error.
- `createBrowserHmrChannel`/`emitServerReady` at `dist/runtime.d.ts:17`/`:25`.
- `REMIX_NODE_HMR` is injected by the runner itself (`dist/lib/runner.js:16`, `buildChildProcessEnv` at `:864`) — never set it yourself.
- The `fingerprint cannot be used with watch mode` guard is at `@remix-run/assets/dist/lib/asset-server.js:802`.
- The browser HMR channel is an **EventSource** at `http://127.0.0.1:<HMR_PORT>/hmr` (`@remix-run/assets/dist/lib/hmr.js:90`; channel default host `127.0.0.1`, port `proxy + 1`), not a WebSocket on the proxy port.
- `componentHmr` setup-state rewriting lives in `@remix-run/component-hmr/dist/lib/transform.js` (`createSetupSource` at `:517`, `rewriteReferences` at `:584`).

## Problem

Hooking the upstream HMR template into this app produced four non-obvious failures:

1. **`fingerprint` × `watch` conflict** — `@remix-run/assets` throws `TypeError: fingerprint cannot be used with watch mode` at `createAssetServer` when both are set. The app enables content fingerprinting outside development, so enabling `watch: isDevelopment` (required for HMR) crashes the dev server at boot unless fingerprinting is gated to non-dev.
2. **IPv6/IPv4 loopback mismatch** — the child inherits the app's `HOST = 'localhost'` default and binds `[::1]:<appPort>`, while `createFetchProxy('http://127.0.0.1:<appPort>')` dials IPv4. Result: `ECONNREFUSED 127.0.0.1:<appPort>`, proxy answers 500, and curl to the child returns `000`.
3. **Ready-gate wedge** — `runner.ready()` blocks until the child calls `emitServerReady()`. If the child crashes at boot (DB init at `server.ts` top-level, or a `REQUIRED_ENV` throw, both happen *before* `listen()` → before `emitServerReady()`), `ready()` never resolves and **every** proxy request hangs indefinitely — the browser just spins.
4. **SIGKILL-orphaned child** — `kill -9` of the hmr proxy leaves the child holding the app port; the next `npm run hmr` child then `EADDRINUSE`s and drops into the wait-for-file-change state (the port is effectively bricked until manually cleaned).

## Solution

### 1. Gate fingerprint (and minify) to non-dev, `app/assets.ts`

```ts
import { componentHmr } from 'remix/component-hmr/assets'

const isDevelopment = process.env.NODE_ENV === 'development'
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)

export const assetServer = createAssetServer({
  ...config.assets,
  watch: isDevelopment,
  ...(isHmr
    ? {
        hmr: {
          channel: async () =>
            (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
          moduleImporter: 'remix/multiple-import-maps-polyfill',
        },
      }
    : {}),
  ...(isDevelopment ? {} : { fingerprint: true }),
  ...(isDevelopment ? { sourceMaps: 'external' } : {}),
  minify: !isDevelopment,
  scripts: {
    define: { /* existing */ },
    ...(isHmr ? { loaders: [componentHmr()] } : {}),
  },
})
```

The object `hmr` form (`{ channel, moduleImporter }`) is what the authored §11 chapter documents; `app/assets.ts` uses it with `remix/multiple-import-maps-polyfill`, matching the app entry's `processClientEntryPreloads` polyfill. The loader import is `componentHmr` (the pre-split `uiHmr` name is gone), and fingerprinting is the boolean `fingerprint: true` outside development.

### 2. Pin the child to IPv4 loopback, `hmr.ts`

Put `HOST: '127.0.0.1'` **after** `...process.env` in the runner's child env so any production `HOST=0.0.0.0` in `.env` can't leak into the dev child:

```ts
const hmrRunner = run('server.ts', {
  env: { ...process.env, PORT: String(appPort), HMR_PROXY_PORT: String(hmrProxyPort), HOST: '127.0.0.1' },
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/component-hmr/node'],
  browserHmrChannel: { port: hmrEventPort },
})
```

### 3. Readiness timeout → 503 instead of hanging, `hmr.ts`

`runner.ready()` has no not-ready response path, so `hmr.ts`'s `createReadyFetch` races it against a 30s timer (covers the app's slow first boot with DB seed) and returns `503 "HMR server is starting or failed to start…"` on timeout. It then keeps the retry-on-new-generation behavior for GET/HEAD `502/503/504` and thrown errors (see `shouldRetrySafeUnavailableRequest`).

### 4. Orphan guard in the child, `server.ts`

Under `REMIX_NODE_HMR`, exit when the IPC channel closes so a killed parent can't strand the child:

```ts
if (process.env.REMIX_NODE_HMR) {
  process.on('disconnect', () => process.exit(0))
}
```

Also emit readiness in the `listen` callback and guard its import:

```ts
server.listen(port, host, () => {
  if (process.env.REMIX_NODE_HMR) {
    import('remix/node-hmr/runtime')
      .then((nodeHmr) => nodeHmr.emitServerReady())
      .catch((error) => console.error('Failed to emit server-ready signal', error))
  }
})
```

### Port validation idiom

`Number.parseInt(process.env.PORT, 10)` yields `NaN` for garbage input, and `NaN + 1` cascades through all three ports; `server.listen(NaN)` fails with a confusing `RangeError`. Validate before using:

```ts
function configuredPort(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  let port = Number.parseInt(value, 10)
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new TypeError(`Invalid ${name} port: ${value}`)
  return port
}
```

### 5. Trust the dev proxy under HMR (`trustProxy: isHmr`), `server.ts` — upstream #11897

The HMR proxy forwards `X-Forwarded-Proto`/`Host`/`Port` (`xForwardedHeaders: true` in `hmr.ts`). The app server hardcoded `trustProxy: false`, so under HMR the request URL kept the loopback origin (`http://127.0.0.1:<appPort>`) instead of the browser-facing origin — breaking cookie/redirect auth flows. Upstream #11897 moved the template to `{ trustProxy: isHmr }`, and the app now mirrors it:

```ts
const isHmr = process.env.REMIX_NODE_HMR === '1'
const handler = createRequestListener(
  (request, client) => handleRequest(request, client?.address ?? ''),
  { trustProxy: isHmr },
)
```

`REMIX_NODE_HMR` is injected by the node-hmr runner itself. Production (`npm run start`) never sets it, so `trustProxy` stays `false` there — the app's no-trusted-reverse-proxy stance (`X-Client-Ip` from the TCP socket, `app/utils/server-handler.ts`) is preserved. Also reuse `isHmr` for the `emitServerReady`/`disconnect` guards.

The Bun entry (`server.bun.ts`) does not use `createRequestListener` or the HMR proxy, so it needs no equivalent. #11902 also changed `fetch-proxy` to strip hop-by-hop/`Connection`-listed headers and `Content-Length`, and `request-listener` to reject conflicting HTTP/2 `Host`/`:authority` with a 400 — no app change required.

## `componentHmr` setup-state rewrite order

**Symptom:** under `npm run hmr`, a page fails with the app error card (`Unexpected Error` / `Something went wrong`). Firefox console reports `ReferenceError: assignment to undeclared variable loadingList` (Chromium: `loadingList is not defined`). The page works under plain `npm run dev`.

**Cause:** the component HMR transform replaces setup-scope `let`/`const` declarations with `__s__.name` and removes the local binding, but `createSetupSource` only rewrites references in statements **after** the declaration (`initializedStateNames` gates `rewriteReferences`). A closure declared before the `let` keeps a bare `name` reference — assignment (`name = …`, `name++`) or **call** (`name(...)`) — which becomes an undeclared identifier in the transformed module. This app hit it twice in `app/actions/lists/public/lists-client.tsx`: `hydrateFromInitialState` (before `let loadingList = false`) assigns `loadingList = false`, and the early autosave/picker helpers call `scheduleAutosave`/`setDirty`/`syncEditorSidebar`/`clearSelection`/`announce`/`copyItemsToTarget`/`moveItem(s)ToTarget` before those arrow functions are assigned. A forward call fails *later* than hydration: adds still paint, but the uncaught `scheduleAutosave is not defined` aborts the handler before it saves, so the element never persists. Check the browser console after adding an item or applying a filter/undo.

**Fix:** declare setup state before any statement or closure that references it — move `let loadingList = false` above `hydrateFromInitialState`, and give helpers referenced by earlier closures a typed forward declaration (`let setDirty: () => void`, `let announce: (message: string) => void`, …) at the top of setup, assigning the implementation later. Do not move them back down for readability. To audit a suspect module, fetch its transformed asset (`/assets/<path>`) and look for bare references where `__s__.name` is the state key — assignments (`name =`, `name++`), calls (`name(...)`), and reads (`if (name)`); every setup-state reference must be `__s__.name` (object keys such as `loadingList: __s__.loadingList` are fine). A bare call is easy to miss because the handler still renders; assert it via the browser console or a save round-trip, not just page load.

## Browser HMR CSP must allow the EventSource port

**Symptom:** the page loads but browser HMR never applies updates; Firefox console shows `Content-Security-Policy: … blocked … (connect-src) at http://127.0.0.1:44101/hmr` and `Firefox can't establish a connection to the server at http://127.0.0.1:44101/hmr`. Server restarts still work, so the failure looks like “HMR does nothing”.

**Cause:** `node-hmr` coordinates browser updates with an EventSource hosted by the parent on `HMR_PORT` (default proxy port + 1, host `127.0.0.1`). The app's CSP was written for an earlier WebSocket design and only allowed `ws://localhost:44100`, which matches neither the scheme nor the port.

**Fix:** `hmr.ts` passes `HMR_EVENT_PORT` into the child env; `security-headers.ts` adds `http://127.0.0.1:<port>` and `http://localhost:<port>` to `connect-src` only when `REMIX_NODE_HMR === '1'`. Do not allow it in plain dev, and do not restore the retired websocket source. `security-headers.test.ts` covers both the default and a custom event port.

## `component-hmr/node` boot cost — app hook without server source maps

**Symptom:** `npm run hmr` takes ~15–16s before `Server listening` (seed logs appear only at the end), while `npm run dev` is ready in ~1.5–2s. The supervisor itself is not the cause: plain `node server.ts` is ~1.8s, `--conditions=node-hmr` is ~1.9s, and the full proxy/child path adds only ~0.2s.

**Cause:** `remix/component-hmr/node` calls `transformComponentsForServer(..., { sourceMap: true })` for every app module. `generateSourceMap` requests `hires: true` and, for each setup hint, adds a mapping per matching character; `getLineAndColumnAtIndex` re-slices/splits the whole source for every mapping, so a 77KB module costs ~5s. One large client entry is enough to dominate boot.

**Fix:** `component-hmr-server.ts` at the repo root mirrors the vendor hook (`load` → `shouldTransformModule` → `detectImportSource` → `transformComponentsForServer`) but passes `sourceMap: false`; `hmr.ts` loads it via `new URL('./component-hmr-server.ts', import.meta.url).href` instead of `remix/component-hmr/node`. Server stack traces lose inline maps; **browser** assets still get maps from the asset server's `componentHmr()` loader. Measured 16.1s → 2.1s (dev baseline 1.9s).

Re-audit this on every remix bump: if upstream adds a `sourceMap` option to the node hook or fixes the per-character mapper, delete the local hook and go back to `remix/component-hmr/node`. Keep the local copy in sync with `@remix-run/component-hmr/dist/lib/loaders.js` (module filter, import-source detection, canonical URL).

## Smoke-Testing the HMR Loop

- **Restart vs update markers** — a server-module content edit logs `restart <file>` (child re-emits ready); a `.browser.*` edit logs `hmr update <file>` (no restart, event goes to the browser channel). Assert on these to prove which path fired.
- **Chokidar ignores mtime-only `touch` on Linux** (`IN_ATTRIB`, no `IN_MODIFY`) — a real content change is required to trigger a restart. If your smoke test "doesn't restart", that's why.
- **Dev-only IP collapse** — `X-Client-Ip` is the socket address (`client?.address`); under the loopback proxy every dev client is `127.0.0.1`, so `connectionIp()`/`isLocalhost()`-gated logic (rate limiting, the `/callback` localhost guard) cannot distinguish client IPs in HMR mode. Dev-only, expected, no production leak: prod runs `npm run start`, not `hmr.ts`, and the proxy binds loopback only.
- **grep/ss cleanup gotcha** — when killing hmr processes from an agent shell, `pkill -f '<pattern>'` can match and kill your own shell if the literal pattern text is in your command line; use the bracket trick (`pkill -f 'hm[r].ts'`) or kill by PID from `ss -ltnp | grep -oP 'pid=\K\d+'`.

## When to Use

- Adding or changing the HMR / asset-server / dev-server config in this app
- Debugging `npm run hmr` symptoms: requests hang (ready-gate), proxy returns 500 (`ECONNREFUSED` path), `EADDRINUSE` on the app port (orphan/`HOST` leak), or "Failed running server.ts. Waiting for file changes before restarting..." stalls
- A page renders the error card with `assignment to undeclared variable <name>` (component HMR setup-state rewrite order), or the browser console reports a CSP `connect-src` block for `http://127.0.0.1:<HMR_PORT>/hmr` (browser HMR EventSource not allowed)
- Writing dev-server smoke tests and wondering why a `touch`-only change doesn't restart the server

---
name: remix3-hmr-dev-server
description: "Wire and debug the Remix 3 node-hmr dev server — fingerprint/watch conflict, IPv6 loopback, ready-gate wedge, orphan guard"
user-invocable: false
origin: auto-extracted
---

# Remix 3 HMR Dev Server — Adoption & Debugging

**Extracted:** 2026-08-10
**Context:** This app adopted the opt-in HMR dev server from `@remix-run/node-hmr` + `@remix-run/ui-hmr` (remix `preview/main` build `e52c10054`, includes "Add HMR support" #11515). `npm run hmr` runs `hmr.ts`, which spawns `server.ts` as a child behind a readiness-gated loopback proxy (proxy :44100, SSE :44101, child :44102). These are the version-pinned pitfalls hit while wiring and smoke-testing it. Validate any claim here against `~/remix/` before relying on it — this feature is pre-release churn (follow-up fixes around Windows timeouts and Bun e2e skips, #11676–#11678).

**Validated:** 2026-08-18 against installed build `5e6e9862` (remix 0.7.0 / beta.10). API claims below confirmed in `@remix-run/node-hmr/dist`: `run(entry, { env, nodeArgs, browserHmrChannel })` (`index.d.ts`), `createHmrReadyFetch(runner, fetch, { shouldRetry })` with default retry of GET/HEAD on `502/503/504` (`index.js:17,81`), `createBrowserHmrChannel`/`emitServerReady` from `remix/node-hmr/runtime` (`runtime.d.ts`), `REMIX_NODE_HMR` injected by the runner itself (`lib/runner.js:16,878`), and the `fingerprint cannot be used with watch mode` guard in `@remix-run/assets/dist/lib/asset-server.js:695`.

**Re-validated:** 2026-08-29 against installed build `f597ce701` (installable dist of `fc87ca9`, includes #11607/#11751/#11665; version string still `3.0.0-beta.10`). All five claims hold: `run(entry, { env, nodeArgs, browserHmrChannel })` still at `index.d.ts:126` (`RunOptions` gained `cwd`/`entryArgs`/`watch` — superset, no break); `createHmrReadyFetch(runner, fetch, { shouldRetry })` at `index.js:16` with default `shouldRetrySafeUnavailableRequest` at `index.js:81-87` retrying GET/HEAD on `502/503/504` **and now also on thrown errors** (`response === undefined`); `createBrowserHmrChannel`/`emitServerReady` unchanged in `runtime.d.ts`; `REMIX_NODE_HMR` injection unchanged (`lib/runner.js:16,878`); the `fingerprint cannot be used with watch mode` guard moved to `@remix-run/assets/dist/lib/asset-server.js:715` (was 695).

## Problem

Hooking the upstream HMR template into this app produced four non-obvious failures:

1. **`fingerprint` × `watch` conflict** — `@remix-run/assets` throws `TypeError: fingerprint cannot be used with watch mode` at `createAssetServer` when both are set. The app always had a `fingerprint: { buildId }` block, so enabling `watch: isDevelopment` (required for HMR) crashes the dev server at boot.
2. **IPv6/IPv4 loopback mismatch** — the child inherits the app's `HOST = 'localhost'` default and binds `[::1]:<appPort>`, while `createFetchProxy('http://127.0.0.1:<appPort>')` dials IPv4. Result: `ECONNREFUSED 127.0.0.1:<appPort>`, proxy answers 500, and curl to the child returns `000`.
3. **Ready-gate wedge** — `createHmrReadyFetch` blocks on `await runner.ready()`. If the child crashes at boot (DB init at `server.ts` top-level, or a `REQUIRED_ENV` throw, both happen *before* `listen()` → before `emitServerReady()`), `ready()` never resolves and **every** proxy request hangs indefinitely — the browser just spins.
4. **SIGKILL-orphaned child** — `kill -9` of the hmr proxy leaves the child holding the app port; the next `npm run hmr` child then `EADDRINUSE`s and drops into the wait-for-file-change state (the port is effectively bricked until manually cleaned).

## Solution

### 1. Gate fingerprint (and minify) to non-dev, `app/assets.ts`

```ts
import { uiHmr } from 'remix/ui-hmr/assets'

const isDevelopment = process.env.NODE_ENV === 'development'
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)

export const assetServer = createAssetServer({
  watch: isDevelopment,
  hmr: isHmr
    ? async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel()
    : undefined,
  fingerprint: !isDevelopment ? { buildId: process.env.BUILD_ID ?? `dev-${process.pid}-${Date.now()}` } : undefined,
  minify: !isDevelopment,
  scripts: { define: { /* existing */ }, loaders: isHmr ? [uiHmr()] : undefined },
})
```

`REMIX_NODE_HMR` is injected by the node-hmr runner itself (you never set it). `isHmr` must be AND-ed with `isDevelopment` so a leaked env var can't affect prod/test.

### 2. Pin the child to IPv4 loopback, `hmr.ts`

Put `HOST: '127.0.0.1'` **after** `...process.env` in the runner's child env so any production `HOST=0.0.0.0` in `.env` can't leak into the dev child:

```ts
const hmrRunner = run('server.ts', {
  env: { ...process.env, PORT: String(appPort), HMR_PROXY_PORT: String(hmrProxyPort), HOST: '127.0.0.1' },
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/ui-hmr/node'],
  browserHmrChannel: { port: hmrEventPort },
})
```

### 3. Readiness timeout → 503 instead of hanging, `hmr.ts`

`createHmrReadyFetch` has no not-ready response path, so wrap it with a race against a timer (30s covers the app's slow first boot with DB seed):

```ts
function waitForReady(runner: NodeHmrRunner): Promise<boolean> {
  return Promise.race([
    runner.ready().then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 30_000)),
  ])
}
```

On `false`, return `503 "HMR server is starting or failed to start. Check the \`npm run hmr\` terminal output"`. Keep the retry-on-new-generation behavior for GET/HEAD `502/503/504` (the library's `shouldRetrySafeUnavailableRequest`).

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

## Smoke-Testing the HMR Loop

- **Restart vs update markers** — a server-module content edit logs `restart <file>` (child re-emits ready); a `.browser.*` edit logs `hmr update <file>` (no restart, event goes to the browser channel). Assert on these to prove which path fired. Verdicts in the upstream CSS/SVG skills must be re-checked line-by-line against current `~/remix/` since pre-release churn is ongoing.
- **Chokidar ignores mtime-only `touch` on Linux** (`IN_ATTRIB`, no `IN_MODIFY`) — a real content change is required to trigger a restart. If your smoke test "doesn't restart", that's why.
- **Dev-only IP collapse** — `X-Client-Ip` is the socket address (`client?.address`); under the loopback proxy every dev client is `127.0.0.1`, so `connectionIp()`/`isLocalhost()`-gated logic (rate limiting, the `/callback` localhost guard) cannot distinguish client IPs in HMR mode. Dev-only, expected, no production leak: prod runs `npm run start`, not `hmr.ts`, and the proxy binds loopback only.
- **grep/ss cleanup gotcha** — when killing hmr processes from an agent shell, `pkill -f '<pattern>'` can match and kill your own shell if the literal pattern text is in your command line; use the bracket trick (`pkill -f 'hm[r].ts'`) or kill by PID from `ss -ltnp | grep -oP 'pid=\K\d+'`.
- **Redirect-following false 500 on auth smoke tests** — `createFetchProxy` forwards `redirect: request.redirect` (default `follow`) to its internal fetch; when the app returns a 302 (e.g. login POST → `/`), undici's `httpRedirectFetch` fails with `TypeError: fetch failed`, the proxy answers 500, and the Set-Cookie session header is swallowed — so a curl/node-fetch smoke test through `:44100` looks like a login regression even though auth works. The app server itself (`:44102`) handles the same POST fine (`302` + `Set-Cookie`). A browser never sees this: it follows the 302 client-side. Debug by hitting the app server directly, or by POSTing with `redirect: 'manual'` and following `Location` yourself while carrying the cookie.

## When to Use

- Adding or changing the HMR / asset-server / dev-server config in this app
- Debugging `npm run hmr` symptoms: requests hang (ready-gate), proxy returns 500 (`ECONNREFUSED` path), `EADDRINUSE` on the app port (orphan/`HOST` leak), or "Failed running server.ts. Waiting for file changes before restarting..." stalls
- Writing dev-server smoke tests and wondering why a `touch`-only change doesn't restart the server
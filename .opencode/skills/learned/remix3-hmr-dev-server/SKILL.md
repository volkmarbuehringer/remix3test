---
name: remix3-hmr-dev-server
description: "Use when wiring or debugging the Remix 3 `node-hmr` dev server — fingerprint/watch conflict, IPv6 loopback, ready-gate wedge, orphan guard."
user-invocable: false
origin: auto-extracted
---

# Remix 3 HMR Dev Server — Adoption & Debugging

**Extracted:** 2026-08-10
**Context:** This app adopted the opt-in HMR dev server from `@remix-run/node-hmr` + `@remix-run/ui-hmr` (remix `preview/main` build `e52c10054`, includes "Add HMR support" #11515). `npm run hmr` runs `hmr.ts`, which spawns `server.ts` as a child behind a readiness-gated loopback proxy (proxy :44100, SSE :44101, child :44102). These are the version-pinned pitfalls hit while wiring and smoke-testing it. Validate any claim here against the installed `@remix-run/*` packages (`node_modules/.pnpm/@remix-run+node-hmr*`, `@remix-run+assets*`) before relying on it — this feature is pre-release churn (follow-up fixes around Windows timeouts and Bun e2e skips, #11676–#11678).

**Validated:** 2026-08-18 against installed build `5e6e9862` (remix 0.7.0 / beta.10). API claims below confirmed in `@remix-run/node-hmr/dist`: `run(entry, { env, nodeArgs, browserHmrChannel })` (`index.d.ts`), `createHmrReadyFetch(runner, fetch, { shouldRetry })` with default retry of GET/HEAD on `502/503/504` (`index.js:17,81`), `createBrowserHmrChannel`/`emitServerReady` from `remix/node-hmr/runtime` (`runtime.d.ts`), `REMIX_NODE_HMR` injected by the runner itself (`lib/runner.js:16,878`), and the `fingerprint cannot be used with watch mode` guard in `@remix-run/assets/dist/lib/asset-server.js:695`.

**Re-validated:** 2026-08-29 against installed build `f597ce701` (installable dist of `fc87ca9`, includes #11607/#11751/#11665; version string still `3.0.0-beta.10`). All five claims hold: `run(entry, { env, nodeArgs, browserHmrChannel })` still at `index.d.ts:126` (`RunOptions` gained `cwd`/`entryArgs`/`watch` — superset, no break); `createHmrReadyFetch(runner, fetch, { shouldRetry })` at `index.js:16` with default `shouldRetrySafeUnavailableRequest` at `index.js:81-87` retrying GET/HEAD on `502/503/504` **and now also on thrown errors** (`response === undefined`); `createBrowserHmrChannel`/`emitServerReady` unchanged in `runtime.d.ts`; `REMIX_NODE_HMR` injection unchanged (`lib/runner.js:16,878`); the `fingerprint cannot be used with watch mode` guard moved to `@remix-run/assets/dist/lib/asset-server.js:715` (was 695).

**Post-bump (2026-09-08):** After upgrading the pinned `remix` to the build installed as `63aa4cc02af8c4194c` (asset server now imports `./virtual-store.js`), the `fingerprint cannot be used with watch mode` guard shifted again to `@remix-run/assets/dist/lib/asset-server.js:717` (was 715). Dist line refs in this skill are build-specific — re-grep the installed `node_modules/.pnpm/@remix-run+node-hmr*` / `@remix-run+assets*` after any bump rather than trusting these line numbers.

**Re-validated (2026-09-18):** against the now-installed build `3e94ca8a6` (source `03cd3404`; the `remix` version string is now `3.0.0-rc.2`, no longer `3.0.0-beta.10`). All five claims hold: `run(entry, { env, nodeArgs, browserHmrChannel })` still at `index.d.ts:126` (`RunOptions` at `:4`, `browserHmrChannel` at `:9`, with `cwd`/`entryArgs`/`watch` present); `createHmrReadyFetch(runner, fetch, { shouldRetry })` at `index.js:16`, with `shouldRetrySafeUnavailableRequest` at `index.js:81` retrying GET/HEAD on `502/503/504` **and on thrown errors** (`response === undefined`); `createBrowserHmrChannel`/`emitServerReady` unchanged (`runtime.d.ts:17,25`); `REMIX_NODE_HMR` still injected by the runner itself (`lib/runner.js:16` names it, `buildChildProcessEnv` injects it at `:877`); the `fingerprint cannot be used with watch mode` guard shifted again to `@remix-run/assets/dist/lib/asset-server.js:775` (was 717).

**Re-validated (2026-09-22):** build installed as `525ce2f6f` (installable dist of source `a1057f6`). Upstream landed **#11897 "Preserve auth flows through the HMR development proxy"** and **#11902 "Normalize HTTP/2 request authority and proxy headers"**; the app adopted both — see the "Auth flows through the proxy" section below and the `trustProxy: isHmr` change in `server.ts`. The old "Redirect-following false 500" workaround (bottom section) is now **obsolete** — kept only as history.

**Re-validated (2026-09-23):** build installed as `27393da759` (installable dist of source `6aad078`; `remix` version string now `3.0.0-rc.3`), bumped from `a4d62e19` (dist of `9f27468`). The range held exactly three upstream commits: **#11913 "Preserve hoisted client entry functions during HMR"** — the only app-affecting one, see section 6 — plus two `.github/workflows`-only bot commits (#11864 context delivery, GPT-6 Astra review model) that this app does not consume (its only workflow is `ci.yml.disabled`). All five node-hmr claims hold unchanged (`index.d.ts:4,9,126`; `index.js:16,81`; `runtime.d.ts:17,25`; `lib/runner.js:16,877`); the `fingerprint cannot be used with watch mode` guard moved once more to `@remix-run/assets/dist/lib/asset-server.js:779` (was 775).

**Re-validated (2026-09-24):** lock refreshed from build `1128ab5c` (dist of source `ae51cfa`) to the now-installed build `3e516fcc2` (installable dist of source `9ed3a5c`; `remix` version string `3.0.0-rc.3`). That range carries four real upstream commits — **#11920** (~47 `packages/remix/src/*/README.md` rewrites + guide renumbering; docs only), **#11931** (`remix test` partial-filename expansion in `packages/cli/src/lib/commands/test.ts`), a `.github/workflows`-only commit, and a new `demos/i18n` app — and `packages/*/src/**` runtime source is byte-identical apart from the CLI test command. All five node-hmr claims therefore hold unchanged: `run(entry, { env, nodeArgs, browserHmrChannel })` at `index.d.ts:126` (`RunOptions` `:4`, `browserHmrChannel` `:9`); `createHmrReadyFetch` at `index.js:16` with `shouldRetrySafeUnavailableRequest` at `index.js:81` (GET/HEAD on `502/503/504` **or** `response === undefined`); `createBrowserHmrChannel`/`emitServerReady` at `runtime.d.ts:17,25`; `REMIX_NODE_HMR` named at `lib/runner.js:16` and injected at `:877`; and the `fingerprint cannot be used with watch mode` guard is **unchanged** at `@remix-run/assets/dist/lib/asset-server.js:779`. (The line above pinned `27393da759`/`6aad078`, which this lock refresh skips over; section 6's #11913 fix is still present in the installed `@remix-run/ui-hmr` `src/lib/transform.ts` `getSetupStatements()`.)

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

The Bun entry (`server.bun.ts`) does not use `createRequestListener` or the HMR proxy, so it needs no equivalent. `#11902` also changed `fetch-proxy` to strip hop-by-hop/`Connection`-listed headers and `Content-Length`, and `request-listener` to reject conflicting HTTP/2 `Host`/`:authority` with a 400 — no app change required.

### 6. Hoisted function declarations after a component's `return` — upstream #11913, fixed in build `27393da759`

Before that build, `getSetupStatements()` sliced the component body at the first `return` (`statements.slice(0, returnIndex)`), so **every `function` declared after `return <renderFn>` was dropped from the transformed module** while its call sites in the render body survived unrewritten — `ReferenceError: <name> is not defined` the moment the handler ran. This bites from the *first page load* under `npm run hmr` (the browser loader transforms every served module, not only edited ones); `npm run dev`, `npm start`, `npm test` and the Bun entries never run the transform, because `app/assets.ts` installs `uiHmr()` only when `isDevelopment && REMIX_NODE_HMR`.

Measured on this app pre-fix: **32 handlers in 9 modules** — `app/ui/appointtype-panel.browser.tsx` (8), `app/ui/appointment-grid.browser.tsx` (7), `admin-{appointments,offering-configs,offerings,resources,uploads,users}-context-menu.tsx` and `clients-context-menu.tsx` (2–3 each, all `clientEntry` menus that declare `handleXAction()` after the `return`). To check any build, run the transform the loader runs and look for a binding per render-referenced handler:

```js
let { code } = transformComponentsForBrowser(source, { importSource: 'remix', moduleUrl: '/app/…' })
// per handler name: bound in the emitted module?
new RegExp(`function\\s+${name}\\b`).test(code) || new RegExp(`__s__\\.${name}\\s*=`).test(code)
```

Post-fix the declaration is kept, `__s__.handleX = handleX;` is hoisted ahead of the render registration, and every render reference is rewritten to `__s__.handleX` (verified: 32/32 handlers bound, 0 dangling). #11913 also folds the post-`return` declaration bodies into `getSetupHash`, so editing such a helper now invalidates the component's setup state instead of silently reusing it. On a pre-fix build the options are to bump the pin or move the declarations above the `return` (declarations *before* the `return` were always instrumented correctly). Related `var` traps covered by the same fix + tests: a `var` initializer before the `return` must still run after the hoisted assignment, and an uninitialized `var x` must not reset `__s__.x` to `undefined`.

## Smoke-Testing the HMR Loop

- **Restart vs update markers** — a server-module content edit logs `restart <file>` (child re-emits ready); a `.browser.*` edit logs `hmr update <file>` (no restart, event goes to the browser channel). Assert on these to prove which path fired. Verdicts in the upstream CSS/SVG skills must be re-checked line-by-line against the installed `@remix-run/*` packages since pre-release churn is ongoing.
- **Chokidar ignores mtime-only `touch` on Linux** (`IN_ATTRIB`, no `IN_MODIFY`) — a real content change is required to trigger a restart. If your smoke test "doesn't restart", that's why.
- **Dev-only IP collapse** — `X-Client-Ip` is the socket address (`client?.address`); under the loopback proxy every dev client is `127.0.0.1`, so `connectionIp()`/`isLocalhost()`-gated logic (rate limiting, the `/callback` localhost guard) cannot distinguish client IPs in HMR mode. Dev-only, expected, no production leak: prod runs `npm run start`, not `hmr.ts`, and the proxy binds loopback only.
- **grep/ss cleanup gotcha** — when killing hmr processes from an agent shell, `pkill -f '<pattern>'` can match and kill your own shell if the literal pattern text is in your command line; use the bracket trick (`pkill -f 'hm[r].ts'`) or kill by PID from `ss -ltnp | grep -oP 'pid=\K\d+'`.
- **Redirect-following false 500 on auth smoke tests** — **OBSOLETE since #11897**: `createFetchProxy` now defaults `redirect: 'manual'`, so the proxy passes 302s (e.g. login POST → `/`) through to the client instead of following them server-side; the undici `httpRedirectFetch` `TypeError: fetch failed` → proxy-500 + swallowed `Set-Cookie` failure mode no longer occurs. (History: pre-#11897 the proxy forwarded `redirect: request.redirect` — default `follow` — and the app server returned `302` + `Set-Cookie` fine while the proxy answered 500; the workaround was POSTing with `redirect: 'manual'` and following `Location` yourself, or debugging against the app server directly.)

## When to Use

- Adding or changing the HMR / asset-server / dev-server config in this app
- Debugging `npm run hmr` symptoms: requests hang (ready-gate), proxy returns 500 (`ECONNREFUSED` path), `EADDRINUSE` on the app port (orphan/`HOST` leak), or "Failed running server.ts. Waiting for file changes before restarting..." stalls
- A handler/button in a `npm run hmr` session throwing `ReferenceError: <name> is not defined` — hoisted declarations after the component `return` were dropped on pre-`27393da759` builds (section 6)
- Writing dev-server smoke tests and wondering why a `touch`-only change doesn't restart the server
---
name: remix3-bun-runtime
description: "Use when running a Remix 3 app or its `remix test` suite under Bun, or when a page/test passes under Node but fails under Bun — `TypeError: Type error` from a `handle.frame` listener, uploads rejected as `Dateityp nicht erlaubt.`, or `@types/bun` breaking the app typecheck."
user-invocable: false
origin: auto-extracted
---

# Remix 3 on Bun — Entrypoint, Tests, and Node↔Bun Divergences

**Extracted:** 2026-09-19
**Context:** Adding Bun as a second runtime to this Remix 3 + pnpm app (remix `3.0.0-rc.3`, build `95e5689cbdf1ef3caaad463093f7d8`; `@remix-run/ui` 0.10.0; Bun 1.4.2). Node stays runtime #1; Bun is opt-in via `pnpm dev:bun` / `start:bun` / `test:bun`. Re-validate version-pinned claims against `node_modules/.pnpm/@remix-run+*` and the installed Bun.

## Problem
Bun accepts Fetch handlers directly (no Node adapter) and `@remix-run/test` already has `IS_BUN` branches, so the migration looks trivial. It isn't: Bun's runtime is stricter than Node's, and pnpm's bin shims silently reintroduce Node. Each divergence below caused a real failure.

## Solution

### 1. Entrypoint: reuse the router, don't duplicate it
`server.bun.ts` calls `Bun.serve(...)` with the same router/DB bootstrap as `server.ts`. Extract the try/catch + `X-Client-Ip` stamping into a shared `createServerHandler(router)` so both entries share one pipeline. Take the trusted IP from the `fetch(request, server)` second argument:

```ts
const server = Bun.serve({
  port,
  hostname,
  development: !isProduction,
  ...(isProduction
    ? { tls: { key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem') } }
    : {}),
  fetch(request, runtime) {
    return handleRequest(request, runtime.requestIP(request)?.address ?? '')
  },
})
```

`server.requestIP()` is the TCP socket address, so `X-Client-Ip` stays unspoofable (see `remix3-two-tier-ip-trust-model`). Bun auto-loads `.env` — no `--env-file` flag.

### 2. `test:bun` must call the remix dist CLI directly
```jsonc
"test:bun": "NODE_ENV=test bun node_modules/remix/dist/cli-entry.js test"
```
**Do not use plain `bun run remix test`.** pnpm's `node_modules/.bin/remix` shim ends in `exec node …`, so `bun run remix` silently runs the whole suite under Node. The tell: Node's `module.register()` DEP0205 warning appears and `IS_BUN` stays false. Two invocations that do get Bun: the explicit dist entry above, or `bun --bun run remix test` (verified — `--bun` forces the runtime through the same shim). See the `bun-run-pnpm-shim` skill for the general trap.

`@remix-run/test` is Bun-aware (`src/lib/runtime.ts`: `IS_BUN = typeof process.versions.bun === 'string'`): native Bun `Glob` for discovery (pnpm symlink cycles), `importModule()` skips `@remix-run/node-tsx` ("node-tsx uses Node APIs that fail in Bun if statically imported"), and the Node V8 coverage loader is skipped — so `--coverage` is not meaningful under Bun. Browser + e2e work under Bun unchanged; Playwright needs no adjustment.

### 3. SSR passes a fake `handle.signal`; Bun's `EventTarget` rejects it
`@remix-run/ui`'s server runtime gives every component `signal: ssrSignal`, a frozen plain object (`@remix-run/ui/dist/server/stream.js`), not an `AbortSignal`. So `handle.frame.addEventListener(type, fn, { signal: handle.signal })` in component setup throws `TypeError: Type error` under Bun; Node tolerates the non-AbortSignal (it only rejects `null`).

Fix — frame/DOM reload events only fire in the browser, so guard registration:
```ts
if (typeof document !== 'undefined') {
  handle.frame.addEventListener('reloadComplete', reloadFromFrame, { signal: handle.signal })
}
```
Repro: `bun -e 'new EventTarget().addEventListener("x", () => {}, { signal: Object.freeze({}) })'` → `TypeError: Type error`; Node accepts it. Sweep every `addEventListener(..., { signal: handle.signal })` that can run during SSR.

### 4. Bun's `File` appends `;charset=utf-8`, breaking exact MIME allowlists
```js
new File(['x'], 'a.txt', { type: 'text/plain' }).type
// node: "text/plain"    bun: "text/plain;charset=utf-8"
```
An exact-match allowlist (`ALLOWED_MIME_TYPES.has(file.type)`) then rejects valid uploads as `Dateityp nicht erlaubt.`. Compare the media type only, and store the normalized value:
```ts
export function normalizeMimeType(mime: string): string {
  return (mime.split(';')[0] ?? '').trim().toLowerCase()
}
```
Keep the client-safe validator and the server handler in sync (`app/utils/upload-validation.ts` ↔ `app/middleware/uploads.ts`).

### 5. Scope `@types/bun` — never add `"bun"` to the main `tsconfig` `types`
Bun's global `fetch` type requires a `preconnect` property, so bundling `"bun"` into the app program breaks every test that mocks `fetch`: `TS2322 … Property 'preconnect' is missing in type … but required in type 'typeof fetch'`. Use a dedicated program instead:
- `tsconfig.json`: keep `types: ["node", "remix/assets/types/hmr"]`; add `"exclude": ["server.bun.ts"]`.
- `tsconfig.bun.json`: `extends` the base, `types: ["node", "bun", …]`, `files: ["server.bun.ts"]`.
- `typecheck`: `tsc --noEmit && tsc -p tsconfig.bun.json --noEmit`.

### Result (this repo, Bun 1.4.2)
Server 1491 pass / 0 fail; browser 248 pass / 0 fail; e2e 48 pass / 0 fail — identical pass/fail to Node and ~8% faster overall. Keep pnpm for installs: `bun install` cannot parse this repo's git-subdirectory lockfile entry (`remix@github:…#path:packages/remix`) and 404s.

## When to Use
- Adding or debugging `server.bun.ts`, `pnpm dev:bun` / `start:bun` / `test:bun`.
- A Remix 3 page renders under Node but throws `TypeError: Type error` under Bun.
- Uploads are rejected under Bun even though the file type is allowed.
- `tsc` breaks with `Property 'preconnect' is missing` after adding Bun types.

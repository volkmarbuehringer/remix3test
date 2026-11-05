# Bun Runtime Gotchas

**Source:** consolidated from `remix3-bun-runtime` notes (entrypoint, MIME, pnpm shim, runner, SSR signal, TS scoping, validation)

**Extracted:** 2026-09-19; last vendor re-check 2026-11-05 against preview release `v0.20261105.191550-main-500bb65e` / source `500bb65e` (Bun 1.4.4)
**Context:** Running this app under Bun (`server.bun.ts`, `test:bun`) and the Node/Bun divergences that don't show up in the Node suite.

## Entrypoint shares the router and handler

`server.bun.ts` and `server.ts` must share one request pipeline. Bun accepts Fetch handlers directly (no Node adapter), so the only difference is how the trusted socket address is read. Extract the try/catch + `X-Client-Ip` stamping into `createServerHandler(router)`; take the IP from Bun's second `fetch` argument:

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

`server.requestIP()` is the TCP socket address, so `X-Client-Ip` stays unspoofable (see `security-gotchas` → `references/two-tier-ip-trust-model.md`). Bun auto-loads `.env` — no `--env-file` flag.

## `File` appends `;charset=utf-8`

```js
new File(['x'], 'a.txt', { type: 'text/plain' }).type
// node: "text/plain"    bun: "text/plain;charset=utf-8"
```

An exact-match allowlist (`ALLOWED_MIME_TYPES.has(file.type)`) then rejects valid uploads with `Dateityp nicht erlaubt.`

Compare the media type only and store the normalized value:

```ts
import { ContentType } from 'remix/headers/content-type'

export function normalizeMimeType(mime: string): string {
  return ContentType.from(mime).mediaType?.toLowerCase() ?? ''
}
```

`ContentType.from()` is browser-safe (usable from `app/utils/upload-validation.ts`), handles quoted/parameterized values (#11901), and preserves the media type's case — lower-case it here. Keep the client-safe validator and `app/middleware/uploads.ts` in sync.

## `bun run <bin>` silently runs Node in pnpm projects

pnpm generates `node_modules/.bin/<bin>` as a `/bin/sh` shim ending in `exec node <entry> "$@"`. Bun runs the shim as a shell script, which hands off to Node, so `process.versions.bun` is undefined and every `IS_BUN` branch stays off — silently, with no error.

Force the runtime or bypass the shim:

```sh
bun --bun run <bin> <args>              # force Bun through the shim
bun node_modules/<pkg>/dist/<cli>.js    # invoke the real entry
```

Find the real entry in the package's `package.json` `bin` field. `bunx <bin>` resolves the same shims and is affected. A `bun run <script>` whose own command is `bun …` is fine; the trap is the resolved-bin shim.

Detection: the target prints a Node version, `process.versions.bun` is undefined, or a Bun-specific branch doesn't fire (e.g. `@remix-run/test`'s `IS_BUN` skips the Node coverage loader).

## `test:bun` must call the remix dist CLI directly

```jsonc
"test:bun": "NODE_ENV=test bun node_modules/remix/dist/cli-entry.js test"
```

Plain `bun run remix test` goes through the pnpm shim and runs the whole suite under Node; the tell is Node's `module.register()` DEP0205 warning and `IS_BUN === false`. `bun --bun run remix test` also works.

`@remix-run/test` is Bun-aware (`src/lib/runtime.ts`: `IS_BUN = typeof process.versions.bun === 'string'`): native Bun `Glob` for discovery (pnpm symlink cycles), `importModule()` skips `@remix-run/node-tsx` (Node APIs that fail in Bun if statically imported), and the Node V8 coverage loader is skipped — `--coverage` is not meaningful under Bun. Browser + e2e work unchanged; Playwright needs no adjustment.

## SSR `handle.signal` is not an `AbortSignal`

`@remix-run/component`'s server runtime gives every component `signal: ssrSignal`, a frozen plain object (`dist/server/stream.js`), not an `AbortSignal`. Registering `handle.frame.addEventListener(type, fn, { signal: handle.signal })` during SSR throws `TypeError: Type error` under Bun. Node duck-types the shape (it exposes `aborted` plus no-op `addEventListener`), so the Node suite stays green on unguarded code.

Frame/DOM reload events only fire in the browser, so guard registration:

```ts
if (typeof document !== 'undefined') {
  handle.frame.addEventListener('reloadComplete', reloadFromFrame, { signal: handle.signal })
}
```

Sweep every `addEventListener(..., { signal: handle.signal })` that can run during SSR. Typecheck and Node tests cannot catch it: `Handle.signal` is declared `AbortSignal`, and Node accepts the real `ssrSignal`. Run the guard under Bun — `renderToString()` executes a `clientEntry`'s setup body during SSR, so a server test rendering the entry goes red under `test:bun` when unguarded:

```tsx
// app/actions/lists/public/lists-search.test.tsx
import { renderToString } from 'remix/component/server'

it('server-renders without registering frame listeners', async () => {
  let html = await renderToString(<ListsSearch />)
  assert.ok(html.length > 0)
})
```

Confirmed at Bun 1.4.3 / Node 26.12.0: `handle.frame` is a real `TypedEventTarget`, and Node accepts that exact frozen object while rejecting `Object.freeze({})`.

## Scope `@types/bun` in a dedicated TypeScript program

Bun's global `fetch` type requires `preconnect`, so putting `"bun"` in the main program breaks every test that mocks `fetch` (`TS2322 … Property 'preconnect' is missing`).

- `tsconfig.json`: keep `types: ["node", "remix/assets/types/hmr"]`; add `"exclude": ["server.bun.ts"]`.
- `tsconfig.bun.json`: `extends` the base, `types: ["node", "bun", …]`, `files: ["server.bun.ts"]`.
- `typecheck`: `tsc --noEmit && tsc -p tsconfig.bun.json --noEmit`.
- `typecheck:bun` (opt-in): `bun check && bun check -p tsconfig.bun.json`.

`bun check` (Bun ≥ 1.4.3) uses the TypeScript 7 checker on all cores and reads the same programs; it matches `tsc --noEmit` (including `noUncheckedIndexedAccess`), runs ~1.4s vs ~16s for two `tsc` runs, only checks, exits `1` on errors (tsc exits `2`), and exits non-zero on an empty program. Keep Node-first `typecheck` as the default.

**Bun's global `File` rejects vendor structural file types.** Bun merges its own `File` (which adds `image()`) onto the DOM `File`, so `FileLike = File` in `remix/file-storage` rejects the streaming `FileUpload` even though the runtime only reads `name`/`type`/`size`/`stream()`:

```text
app/middleware/upload-files.ts(113,32): error TS2741:
Property 'image' is missing in type 'FileUpload' but required in type 'File'.
```

The main program accepts the same call; only the Bun program fails. Diagnose the two programs separately (`npm run typecheck` runs the Bun program only after the first passes, with no program label) by running `./node_modules/.bin/tsc -p tsconfig.bun.json --noEmit` directly. Fix with a narrow, commented cast at the storage boundary:

```ts
// Bun's global `File` adds `image()`; the backend only reads metadata and
// `stream()`, so the structural mismatch is type-level only.
await storage.set(key, upload as unknown as File)
```

Do not widen `FileUpload`, edit vendor types, or add `"bun"` to the main program.

## Validation result

Under Bun the suites match Node (server/browser/e2e all green; ~8% faster in the 2026-09-24 run). Keep pnpm for installs: it is what the scripts, Dockerfile, and CI use. The old blocker — `bun install` choking on the `remix@github:…#path:packages/remix` lockfile entry and 404ing — is historical. Since the 2026-11-04 preview-release migration the package specs are plain `https://github.com/remix-run/previews/releases/download/<tag>/*.tgz` URLs (the 2026-11-03 retained-tarball form resolved cleanly with `bun install --dry-run --lockfile-only`, Bun 1.4.4); re-verify the release-asset form before switching the install workflow. The supported path is still `pnpm install`.

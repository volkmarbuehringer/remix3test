# Bun Runtime Validation Log and Result

**Source:** `remix3-bun-runtime`

**Extracted:** 2026-09-19

**Re-validated (2026-09-24):** against the now-installed build `3e516fcc2` (installable dist of source `9ed3a5c`; `remix` `3.0.0-rc.3`, `@remix-run/ui` `0.10.0`, Bun `1.4.2`). All vendor claims hold: `IS_BUN = typeof process.versions.bun === 'string'` at `@remix-run/test` `src/lib/runtime.ts:2`; the Bun discovery branch uses Bun's native `Glob` because `fs.promises.glob` follows pnpm symlink cycles (`src/cli.ts:449-461`); `importModule()` returns through `import.meta.resolve` before the `@remix-run/node-tsx` import under Bun (`src/lib/import-module.ts:29-38`); the V8 coverage path is gated on `!IS_BUN` (`src/lib/worker-server.ts:25,138`); `ssrSignal` is still a frozen plain-object `AbortSignal` stand-in (`@remix-run/component` `dist/server/stream.js:52-69`; the earlier `@remix-run/ui` attribution was wrong — it lives in the component runtime); and `ContentType.from()` + `.mediaType` exist (`@remix-run/headers` `src/lib/content-type.ts:85,49`). The `test:bun` script still points at the dist CLI (`package.json`: `NODE_ENV=test bun node_modules/remix/dist/cli-entry.js test`).

**Re-validated (2026-10-14):** against the now-installed build `2c9e033` (installable dist of source `e6a63ea`; `remix` `3.0.0`, `@remix-run/ui` `0.12.1`, `@remix-run/component` `1.0.0`, Bun `1.4.3`). The vendor claims hold at the current lines: `IS_BUN = typeof process.versions.bun === 'string'` at `@remix-run/test` `src/lib/runtime.ts:2`; the Bun `Glob` discovery branch at `src/cli.ts:449-465`; `importModule()`'s `import.meta.resolve` path at `src/lib/import-module.ts:29-38`; the `!IS_BUN` coverage gate at `src/lib/worker-server.ts:25,138`; `ssrSignal` at `@remix-run/component` `dist/server/stream.js:52-69`; and `ContentType.from()` / `.mediaType` at `@remix-run/headers` `src/lib/content-type.ts:85,49`. The `test:bun` script is unchanged.

## Result (2026-09-24 run, Bun 1.4.2)

Server 1491 pass / 0 fail; browser 248 pass / 0 fail; e2e 48 pass / 0 fail — identical pass/fail to Node and ~8% faster overall. Keep pnpm for installs: `bun install` cannot parse this repo's git-subdirectory lockfile entry (`remix@github:…#path:packages/remix`) and 404s.

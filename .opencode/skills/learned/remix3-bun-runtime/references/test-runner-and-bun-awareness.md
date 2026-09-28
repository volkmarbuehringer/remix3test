# Bun-Aware `remix test` Runner

**Source:** `remix3-bun-runtime`

**Extracted:** 2026-09-19

**Context:** Running `remix test` under Bun from a pnpm project, and reasoning about which parts of the suite change under Bun.

## `test:bun` must call the remix dist CLI directly

```jsonc
"test:bun": "NODE_ENV=test bun node_modules/remix/dist/cli-entry.js test"
```

**Do not use plain `bun run remix test`.** pnpm's `node_modules/.bin/remix` shim ends in `exec node …`, so `bun run remix` silently runs the whole suite under Node. The tell: Node's `module.register()` DEP0205 warning appears and `IS_BUN` stays false. Two invocations that do get Bun: the explicit dist entry above, or `bun --bun run remix test` (verified — `--bun` forces the runtime through the same shim). See `references/pnpm-bin-shim.md` for the general trap.

`@remix-run/test` is Bun-aware (`src/lib/runtime.ts`: `IS_BUN = typeof process.versions.bun === 'string'`): native Bun `Glob` for discovery (pnpm symlink cycles), `importModule()` skips `@remix-run/node-tsx` ("node-tsx uses Node APIs that fail in Bun if statically imported"), and the Node V8 coverage loader is skipped — so `--coverage` is not meaningful under Bun. Browser + e2e work under Bun unchanged; Playwright needs no adjustment.

# Remix CLI and node-tsx (app deltas)

**Source:** `remix-cli-devops`

Canonical API: `node_modules/remix/src/cli/README.md`, `node_modules/remix/src/node-tsx/README.md`, and guide chapter 14. This file keeps only the app-specific seams.

## Route-tree discovery

`remix routes` reads only the export **named `routes`** from `routes.ts`. The loader worker requires `'routes' in routeModule` and otherwise throws `must export a named "routes" value`. Independently mounted named trees (`adminRoutes`, `aiRoutes`, …) work at runtime but are invisible in CLI output — do not treat missing routes in `remix routes` as a wiring error.

## App scripts

- Test scripts pass a positional glob plus `--type=server|browser|e2e`; there is no `--run <pattern>`.
- A positional argument with no glob metacharacters, path separator, or `.ts`/`.tsx` extension expands to `**/*<name>*.test*.{ts,tsx}` — `remix test frame` matches `frame.test.ts`, not `frame.ts`. Multiple arguments form a union; expanded arguments override `--glob.test`.
- `remix test` defaults `NODE_ENV` to `test` via `process.env.NODE_ENV ??= 'test'`; an explicit value wins. App scripts still prefix `NODE_ENV=test`.
- `runRemix` from `remix/cli` is available for programmatic use.

## node-tsx

App scripts run source through `node --import remix/node-tsx`; `loadModule` from `remix/node-tsx/load-module` scopes JSX loading. Required tsconfig flags: `module`/`moduleResolution: NodeNext`, `allowImportingTsExtensions`, `isolatedModules`, `verbatimModuleSyntax`, `rewriteRelativeImportExtensions`.

## Mocking frozen ES module exports

`mock.method(obj, methodName)` cannot spy on named ES module exports because ES module namespaces are frozen:

```ts
import * as scrollLock from 'app/utils/scroll-lock.ts'

// ❌ Throws: Cannot assign to property 'lockScroll' of [object Module]
mock.method(scrollLock, 'lockScroll', () => () => {})
```

Prefer side-effect testing: set up a realistic DOM mock and assert on DOM changes instead of mocking the function. If you must mock, wrap the export in a mutable object:

```ts
// app/utils/lock-scroll.ts
export let scrollLock = { lockScroll: () => actualLockScroll() }

// In tests
mock.method(scrollLock, 'lockScroll', () => () => {})
```

## References

- `node_modules/remix/src/cli/README.md` — full CLI docs
- `node_modules/remix/src/node-tsx/README.md` — loader docs and TS config

---
name: remix-cli-devops
description: Use the `remix` CLI for project scaffolding, testing, diagnostics, and TypeScript/JSX loading with `node-tsx`. Activate when running CLI commands, setting up Node.js module loaders, or debugging project health.
---

# Remix CLI and DevOps

Covers `remix/cli` and `remix/node-tsx`.

## CLI Commands

- `remix new <dir>` — scaffold a new Remix app
- `remix test` — run project tests
- `remix doctor` / `remix doctor --fix` — check project conventions and fix low-risk issues
- `remix routes` / `remix routes --table` — inspect the route tree
- `remix version` — print installed version
- `remix completion bash|zsh` — install shell completion

Programmatic: `import { runRemix } from 'remix/cli'`

## node-tsx

Register the TypeScript/JSX loader to run `.ts`, `.tsx`, `.jsx` files directly:

```sh
node --import remix/node-tsx ./server.ts
```

Or side-effect import in code: `import 'remix/node-tsx'`

Use `loadModule` for scoped JSX: `import { loadModule } from 'remix/node-tsx/load-module'`

## TypeScript Config for node-tsx

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "rewriteRelativeImportExtensions": true
  }
}
```

## Testing

### CLI Filter Syntax

`remix test` does NOT support `--run <pattern>` like Vitest or Jest. Pass the glob as a positional argument and use `--type` to filter:

```sh
# Run a single test file
remix test "**/appointments*" --type=server

# Run all tests including browser and e2e
remix test "**/*.test.*"

# Run with coverage
remix test --coverage
```

Available `--type` values: `server`, `browser`, `e2e`.

### `NODE_ENV=test` Not Auto-Set

`remix test` does **not** set `NODE_ENV=test` like Jest/Vitest. Add it to the test script yourself:

```json
"scripts": {
  "test": "NODE_ENV=test remix test"
}
```

Without this, guards like `if (process.env.NODE_ENV !== 'test')` won't fire — code will attempt real SMTP connections, DB seeds, etc.

### Mocking ES Module Named Exports

`mock.method(obj, methodName)` cannot spy on named ES module exports because ES module namespaces are frozen:

```ts
import * as scrollLock from 'remix/ui/scroll-lock'

// ❌ Throws: Cannot assign to property 'lockScroll' of [object Module]
mock.method(scrollLock, 'lockScroll', () => () => {})
```

Two workarounds:

**Prefer side-effect testing** — set up a realistic DOM mock and assert on DOM changes instead of mocking the function.

**Wrap the export in an object** if you must mock it:

```ts
// app/utils/lock-scroll.ts
export let scrollLock = { lockScroll: () => actualLockScroll() }

// In tests
mock.method(scrollLock, 'lockScroll', () => () => {})
```

## References

- `~/remix/packages/cli/README.md` — full CLI docs
- `~/remix/packages/node-tsx/README.md` — loader docs and TS config

# @remix-run/node-tsx load-module patch

## Error

```
Cannot find module '.../node_modules/@remix-run/node-tsx/dist/lib/register-hooks.ts'
imported from '.../node_modules/@remix-run/node-tsx/dist/lib/load-module.js'
```

Or equivalently, the asset server fails silently and returns `text/plain` for script requests because the test runner or module loader can't register the node-tsx hooks.

## Root Cause

`@remix-run/node-tsx` v0.1.0 dist artifact bug: `dist/lib/load-module.js` contains:

```js
register(new URL(`./register-hooks.ts?namespace=...`, import.meta.url), ...)
```

But only `register-hooks.js` exists in `dist/lib/` — the `.ts` file is never copied to the dist directory. Node.js's `module.register()` uses the URL specifier verbatim, so it looks for a `.ts` file that doesn't exist.

## Fix

A postinstall script patches the reference from `.ts` to `.js`:

```js
// scripts/patch-node-tsx.mjs
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.resolve(fileURLToPath(import.meta.url), '../../node_modules/.pnpm')
for (let entry of fs.readdirSync(dir)) {
  if (!entry.startsWith('@remix-run+node-tsx@')) continue
  let file = path.join(dir, entry, 'node_modules/@remix-run/node-tsx/dist/lib/load-module.js')
  if (!fs.existsSync(file)) continue
  let source = fs.readFileSync(file, 'utf-8')
  let patched = source.replace(
    './register-hooks.ts?namespace=',
    './register-hooks.js?namespace=',
  )
  if (source !== patched) {
    fs.writeFileSync(file, patched)
  }
}
```

## When It Applies

- Only when `remix` (or `@remix-run/node-tsx`) is installed via **git URL** (`github:remix-run/remix#preview/main&path:packages/node-tsx`) rather than from npm
- The patch must re-apply after every `pnpm install` / `pnpm update` (use a postinstall script)

## Affected Test Runners

The `remix test` runner imports `@remix-run/node-tsx/load-module` to register hooks for loading TypeScript test files. Without the patch, the registration fails and all tests crash with `Cannot find module`.

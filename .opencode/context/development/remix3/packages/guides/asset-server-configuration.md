<!-- Context: development/remix3/packages/guides | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Guide: Asset Server Configuration

**Purpose**: Complete reference for configuring `createAssetServer()`. All options, their types, constraints, and interactions.

## Core Options

| Option | Type | Description |
|--------|------|-------------|
| `basePath` | `string` | Public mount path, e.g. `'/assets'`. Normalized with trailing slash stripped. |
| `fileMap` | `Record<string, string>` | URL pattern → disk path. Uses route-pattern syntax, e.g. `'/app/*path': 'app/*path'`. |
| `rootDir` | `string` | Root for resolving relative paths. Defaults to `process.cwd()`. Resolved via `fs.realpathSync`. |

## Access Control

| Option | Type | Description |
|--------|------|-------------|
| `allow` | `string[]` | Glob/file patterns allowed for serving. **Required**. Injected package paths are always allowed. |
| `deny` | `string[]` | Glob/file patterns denied. Overrides `allow`. Injected package paths are never denied. |

Both use `createFileMatcher` glob matching resolved from `rootDir`. A file must match at least one `allow` pattern and no `deny` patterns.

## Compilation Target

`target` controls syntax lowering for scripts and styles:

```ts
{
  target: {
    chrome: '109',     // Browser version (X, X.Y, or X.Y.Z format)
    ios: '16',         // Same format
    safari: '16',
    firefox: '121',
    edge: '120',
    opera: '100',
    samsung: '23',
    es: '2022',        // ES version year (2015+)
  }
}
```
- Browser targets apply to both scripts (oxc) and styles (lightningcss).
- `es` applies only to scripts. Styles ignore it.
- Omitted targets → no syntax lowering.

## Script Configuration

| Option (in `scripts`) | Type | Description |
|-----------------------|------|-------------|
| `define` | `Record<string, string>` | Global replacements, e.g. `{ 'process.env.NODE_ENV': '"production"' }`. |
| `external` | `string[]` | Import specifiers to leave unrewritten (CDN URLs, import-map entries). |

## Source Maps

| Option | Values | Description |
|--------|--------|-------------|
| `sourceMaps` | `'inline'` \| `'external'` | Inline embeds as base64 data URL; external serves separate `.map` files. |
| `sourceMapSourcePaths` | `'url'` \| `'absolute'` | `'url'` (default) uses stable server path; `'absolute'` uses filesystem path. |
| `minify` | `boolean` | Minify emitted scripts and styles. |

## File Asset Configuration

Configured under `files`:

```ts
{
  files: {
    extensions: ['.png', '.jpg', '.svg', '.woff2'], // Required — must not include .css/.ts/.js
    transforms: { /* named request transforms via defineFileTransform() */ },
    globalTransforms: [ /* always-on transforms */ ],
    maxRequestTransforms: 5,       // Default 5
    cache: myFileStorage,           // Optional FileStorage backend
  }
}
```

## Fingerprinting & Watch

- **Fingerprinting**: `fingerprint: { buildId: string }` enables content-hash URLs with `immutable` cache.
- **Watch mode**: enabled by default (`watch: true`). `fingerprint` requires `watch: false`.
- **Watch options**: `{ ignore: ['**/node_modules/**'], poll: false, pollInterval: 100 }`.

## Error Handling

`onError(error): Response | void` — override 500 responses for compilation errors. Return a `Response` to customize, or return `void` for the default `500 Internal Server Error`.

## Full Example

```ts
import { createAssetServer, defineFileTransform } from 'remix/assets'

let server = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**', 'app/public/**'],
  rootDir: '/home/user/project',
  target: { chrome: '109', es: '2022' },
  scripts: { define: { 'process.env.NODE_ENV': '"production"' } },
  sourceMaps: 'external',
  sourceMapSourcePaths: 'url',
  minify: true,
  files: {
    extensions: ['.png', '.jpg', '.svg', '.webp'],
    maxRequestTransforms: 3,
  },
  watch: { ignore: ['**/generated/**'] },
  onError(error) { console.error(error) },
})
```

**Reference**: `/home/lucky/remix/packages/assets/src/lib/asset-server.ts`, `access.ts`, `target.ts`, `scripts/compiler.ts`, `styles/compiler.ts`

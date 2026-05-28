# Lookup: createAssetServer() Options

**Source**: `remix/assets`

## Core Options

| Option | Type | Description |
|--------|------|-------------|
| `fileMap` | `Record<string, string>` | URL pattern → file path pattern (route-pattern syntax). Required. |
| `allow` | `string[]` | Glob patterns for allowed files. Required. |
| `deny` | `string[]` | Glob patterns for denied files. Optional, takes precedence over allow. |
| `rootDir` | `string` | Root for resolving relative paths. Default: `process.cwd()`. |

## Behavior

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `watch` | `boolean \| { ignore: string[] }` | `true` | File watching. Disable for static builds. |
| `fingerprint` | `{ buildId: string }` | — | Source-based fingerprinting for immutable caching. Requires `watch: false`. |
| `target` | `Record<string, string>` | — | Browser target: `chrome`, `firefox`, `safari`, `ios`, `es`, etc. Lower emitted syntax. |
| `sourceMaps` | `'external' \| 'inline'` | — | Enable source maps. |
| `sourceMapSourcePaths` | `'absolute'` | — | Use filesystem paths (not URLs) in source map `sources`. |
| `minify` | `boolean` | — | Enable minification. |

## Script Options

| Option | Type | Description |
|--------|------|-------------|
| `scripts.define` | `Record<string, string>` | Replace globals with constant expressions. String values must self-quote. |
| `scripts.external` | `string[]` | Leave these import specifiers unchanged during compilation. |

## Error Handling

| Option | Type | Description |
|--------|------|-------------|
| `onError` | `(error) => Response \| void` | Report compilation failures. Return a custom Response, or omit for default 500. |

## Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `assetServer.fetch(request)` | `Promise<Response>` | Handle an asset request. |
| `assetServer.getHref(filePath)` | `Promise<string>` | Get public URL for a file path. |
| `assetServer.getPreloads(paths[])` | `Promise<string[]>` | Get preload URLs for assets and their deps. |
| `assetServer.close()` | `Promise<void>` | Stop file watcher and clean up. |

## Related

- `remix/fetch-router` — Fetch-based router for pairing with asset server
- `remix/route-pattern` — Pattern syntax used by `fileMap`

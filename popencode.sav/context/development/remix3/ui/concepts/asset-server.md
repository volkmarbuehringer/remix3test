# Concept: Asset Server

**Core Idea**: `createAssetServer()` from `remix/assets` is a Fetch-based on-demand JS/TS and CSS compiler. Map public URL patterns to filesystem paths; files compile on first request and cache for subsequent ones.

**Key Points**:
- `fileMap` maps URL patterns to root-relative file patterns using `route-pattern` syntax
- `allow` (required) and `deny` (optional) control access with glob patterns
- File watching enabled by default; disable with `watch: false` for static builds
- Returns a standard `fetch()`-compatible handler — works with `remix/fetch-router`
- Supports caching (ETag + revalidation), fingerprinting, source maps, minification
- Import from `remix/assets`; shutdown with `await assetServer.close()`

**Quick Example**:
```ts
import { createRouter } from 'remix/fetch-router'
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  fileMap: {
    '/assets/app/*path': 'app/*path',
    '/assets/npm/*path': 'node_modules/*path',
  },
  allow: ['app/assets/**', 'node_modules/**'],
})

let router = createRouter()
router.get('/assets/*', ({ request }) => assetServer.fetch(request))
```

**Reference**: `packages/assets/README.md`

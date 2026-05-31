# Example: Minimal Asset Server

**Goal**: Serve compiled browser assets from `app/assets/` and `node_modules/` via `/assets/*`.

## Basic Setup

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
```

## Wire to Router

```ts
let router = createRouter()
router.get('/assets/*', ({ request }) => {
  return assetServer.fetch(request)
})
```

## Get Public URLs

```ts
let src = await assetServer.getHref('app/assets/entry.tsx')
// '/assets/app/assets/entry.tsx'
```

## Generate Preload Links

```ts
let preloads = await assetServer.getPreloads(['app/assets/entry.tsx'])
// ['/assets/app/assets/entry.tsx', '/assets/app/assets/utils.ts', ...]
```

## Cleanup

```ts
await assetServer.close() // Stops file watcher
```

**Reference**: `packages/assets/README.md`

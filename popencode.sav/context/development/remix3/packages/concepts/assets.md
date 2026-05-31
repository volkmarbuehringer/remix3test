<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: Assets (Asset Server)

**Purpose**: Fetch-based on-demand compilation and file serving for browser assets. Compiles scripts/styles on demand, serves images/fonts with optional transforms, generates preload URLs, and fingerprints for long-lived caching.

**Key Points**:
- `createAssetServer(options)` — compiles browser scripts/styles, serves configured file assets
- `fileMap` maps public URL patterns to disk paths (uses route-pattern syntax)
- `allow`/`deny` for access control; optional `rootDir` for resolving relative paths
- **Preloads**: `assetServer.getPreloads([...])` returns modulepreload/stylesheet URLs for assets and their deps
- **Fingerprinting**: opt-in with `fingerprint.buildId` for immutable cache URLs
- **File transforms**: `files.transforms` for per-request transforms (e.g. resize, webp), `files.globalTransforms` for always-on transforms
- **Script options**: `define` for global replacements, `external` to leave specifiers unchanged
- **Target**: lower syntax via `target` (chrome, ios, es version)
- **Source maps**: `sourceMaps: 'external' | 'inline'`

**Minimal Example**:
```ts
import { createAssetServer } from 'remix/assets'

let assetServer = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/assets/**'],
  target: { chrome: '109', es: '2020' },
})

router.get('/assets/*', ({ request }) => assetServer.fetch(request))

// Get preload URLs for SSR
let preloads = await assetServer.getPreloads(['app/assets/entry.tsx'])
// Get public URL for a file
let src = await assetServer.getHref('app/assets/image.png')
```

**Reference**: `/home/lucky/remix/packages/assets/README.md`

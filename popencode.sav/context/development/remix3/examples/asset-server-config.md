<!-- Context: development/remix3/examples/asset-server-config | Priority: high | Version: 1.0 | Updated: 2026-05-05 -->

# Example: Asset Server with Workspace Support

**Core Idea**: `createAssetServer` compiles JS/TS/CSS on demand. The template adds monorepo workspace detection so `packages/` source is also served in development.

## Minimal Config (Standalone App)

```typescript
import { createAssetServer } from 'remix/assets'

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir: process.cwd(),
  fileMap: {
    'app/*path': 'app/*path',
    'node_modules/*path': 'node_modules/*path',
  },
  allow: ['app/assets/**', 'node_modules/**'],
  deny: ['app/**/*.server.*'],
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
})
```

## With Monorepo Workspace Support

```typescript
import * as fs from 'node:fs'
import * as path from 'node:path'

const workspacePackagesDir = path.resolve(rootDir, '..', 'packages')
const usesWorkspaceRemix = fs.existsSync(
  path.join(workspacePackagesDir, 'remix', 'src', 'ui.ts')
)

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir,
  fileMap: {
    'app/*path': 'app/*path',
    'node_modules/*path': 'node_modules/*path',
    ...(usesWorkspaceRemix ? { 'packages/*path': '../packages/*path' } : {}),
  },
  allow: [
    'app/assets/**',
    'node_modules/**',
    ...(usesWorkspaceRemix ? ['../packages/**'] : []),
  ],
  deny: ['app/**/*.server.*'],
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
})
```

## Key Patterns

| Concern | Pattern |
|---------|---------|
| **Detect workspace** | `fs.existsSync(path.join(workspacePackagesDir, 'remix', 'src', 'ui.ts'))` |
| **Add package paths** | Conditionally spread into `fileMap` and `allow` arrays |
| **Route wiring** | `router.map(routes, controller)` — asset handler in controller's `actions.assets` |
| **URL generation** | `assetServer.getHref('file://...')` in render.tsx's `resolveClientEntry` |

## Reference

- Template: `~/remix/template/app/actions/controller.tsx`
- Minimal standalone: `concepts/asset-server.md`
- Render integration: `examples/render-stream-frames.md`

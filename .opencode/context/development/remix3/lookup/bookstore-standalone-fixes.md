<!-- Context: development/remix3/lookup/bookstore-standalone-fixes | Priority: high | Version: 1.0 | Updated: 2026-04-23 -->

# Lookup: Bookstore Demo Standalone Fixes

**Purpose**: Document fixes required to run the bookstore demo app independently in the alpha4 workspace.

## Problem

The bookstore demo was originally configured for a different workspace. Running it standalone in `alpha4/bookstore/` requires path and permission fixes.

## Fixes Applied

### 1. Asset Server rootDir Path

**File**: `bookstore/app/utils/assets.ts`

```typescript
// Before (wrong - points to parent workspace)
// rootDir: '/home/lucky',

// After (correct - adjusted for alpha4)
rootDir: '/home/lucky/alpha4',
```

### 2. Allowed Paths in assetServer

**File**: `bookstore/server.ts` (or `bookstore/app/router.ts`)

```typescript
// Add allow rules for remix packages
const assetServer = new AssetServer({
  rootDir: '/home/lucky/alpha4',
  allow: [
    'bookstore/node_modules/remix/**',
    'bookstore/node_modules/@remix-run/**',
    'bookstore/public/**',
    'bookstore/app/assets/**',
  ],
})
```

### 3. FileMap Entries for node_modules

```typescript
const assetServer = new AssetServer({
  // ...
  fileMap: {
    'bookstore/node_modules/remix/*path': (path) => {
      const relPath = path.replace(/^bookstore\/node_modules\/remix\//, '')
      return `bookstore/node_modules/remix/${relPath}`
    },
    'bookstore/node_modules/@remix-run/*path': (path) => {
      const relPath = path.replace(/^bookstore\/node_modules\/@remix-run\//, '')
      return `bookstore/node_modules/@remix-run/${relPath}`
    },
  },
})
```

### 4. Static Files Absolute Path

**File**: `bookstore/server.ts`

```typescript
// Before (relative - breaks in standalone)
// publicDir: path.join(__dirname, '../public'),

// After (absolute)
publicDir: path.resolve(import.meta.dirname, '../public'),
```

### 5. Path Module Import

**File**: `bookstore/app/router.ts`

```typescript
import * as path from 'node:path'
```

## Summary

| Fix | File | Change |
|-----|-----|--------|
| rootDir | `app/utils/assets.ts` | `/home/lucky` → `/home/lucky/alpha4` |
| Allow remix | `server.ts` | Add `bookstore/node_modules/remix/**` |
| Allow @remix-run | `server.ts` | Add `bookstore/node_modules/@remix-run/**` |
| fileMap | `server.ts` | Add paths for node_modules |
| publicDir | `server.ts` | `path.resolve(import.meta.dirname, ...)` |
| path import | `app/router.ts` | Add `import * as path` |

## Related

- [static-server-setup.md](static-server-setup.md)
- [static-file-serving.md](static-file-serving.md)
- Bookstore demo: `bookstore/server.ts`
- Asset util: `bookstore/app/utils/assets.ts`
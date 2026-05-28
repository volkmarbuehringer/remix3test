<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: File Transforms (Leaf Asset Pipeline)

**Purpose**: Per-request and always-on content transforms for leaf file assets (images, fonts, etc.). Request transforms are activated via URL query params; global transforms run for every served file.

**Key Points**:
- **Request transforms** (`files.transforms`): named transforms invoked via `?transform=resize&transform=webp` in the asset URL. Up to `maxRequestTransforms` (default 5). Can have required (`true`), optional (`'optional'`), or no param.
- **Global transforms** (`files.globalTransforms`): ordered, always-on transforms that may return `null` to skip themselves for a given file. No URL-query activation.
- **Pipeline order**: source file → request transforms (in declaration order) → global transforms (in array order). Each step feeds its output to the next.
- **Extension changes**: transforms can change the output extension (e.g. `.png` → `.webp`) via `AssetFileTransformResult.extension`. Extension filtering uses the *current* extension at that pipeline position.
- **Caching**: transformed results can be stored in a `FileStorage` backend via `files.cache`. Cache keys incorporate `buildId` for global invalidation.
- **Typed via `defineFileTransform()`**: provides full TypeScript inference for param mode and transform name in URL construction (`assetServer.getHref(file, { transform: ['resize', '200x200'] })`).

**Quick Example**:
```ts
import { defineFileTransform, createAssetServer } from 'remix/assets'

let resize = defineFileTransform({
  param: true, // requires a param like "200x200"
  extensions: ['.png', '.jpg', '.webp'],
  async transform(bytes, { param }) {
    let resized = await sharp(bytes).resize(param).toBuffer()
    return { content: resized, extension: '.webp' }
  },
})

let avif = defineFileTransform({
  extensions: ['.png', '.jpg'],
  transform(bytes) {
    return { content: toAvif(bytes), extension: '.avif' }
  },
})

createAssetServer({
  basePath: '/assets',
  fileMap: { '/images/*path': 'public/images/*path' },
  allow: ['public/images/**'],
  files: {
    extensions: ['.png', '.jpg', '.svg'],
    transforms: { resize, avif },
    globalTransforms: [optimizeSvg], // always runs on .svg
  },
})
// URL: /assets/images/photo.png?transform=resize:200x200&transform=avif
```

**Reference**: `/home/lucky/remix/packages/assets/src/lib/files/config.ts`, `compiler.ts`, `store.ts`

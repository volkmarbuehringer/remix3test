<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: Fingerprinting & Caching

**Purpose**: Content-based URL fingerprinting for immutable long-lived caching, with ETag-based conditional requests for stale-revalidation. Fingerprint embeds a content hash in the URL path.

**Key Points**:
- **Fingerprint generation**: `generateFingerprint({ buildId, content })` = first 6 chars of base64url SHA-256(`JSON.stringify([content, buildId])`). The `buildId` token provides global invalidation across a deploy.
- **URL embedding**: fingerprint is inserted before the extension: `image.@abc123.png`. `formatFingerprintedPathname()` builds it; `parseFingerprintSuffix()` extracts it from incoming requests.
- **Cache-Control strategy**: fingerprinted URLs → `public, max-age=31536000, immutable`; non-fingerprinted → `no-cache`. Checked via `getFingerprintRequestCacheControl()`.
- **ETag**: weak validator (`W/"<hash>"`) computed from SHA-256 of the output body. Used with `If-None-Match` for 304 Not Modified responses.
- **Fingerprint mismatch**: if a requested fingerprint doesn't match the compiled asset, the server returns `null` (falls through to 404). This prevents serving stale content.
- **Mutually exclusive with watch**: fingerprinting requires `watch: false` — the server never invalidates a fingerprinted URL mid-deploy.

**Quick Example**:
```ts
import { createAssetServer } from 'remix/assets'

let server = createAssetServer({
  basePath: '/assets',
  fileMap: { '/app/*path': 'app/*path' },
  allow: ['app/**'],
  fingerprint: { buildId: 'deploy-42' },
  watch: false, // required when fingerprinting
})

// Generated URLs include fingerprint:
let href = await server.getHref('app/icons/logo.svg')
// → '/assets/app/icons/logo.@a1b2c3.svg'  (immutable, 1-year cache)

// Without fingerprint.buildId, URLs are stable but use no-cache
```

**Reference**: `/home/lucky/remix/packages/assets/src/lib/fingerprint.ts`, `asset-server.ts` (lines 346-425 for fetch/ETag logic)

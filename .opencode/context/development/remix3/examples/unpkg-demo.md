<!-- Context: development/remix3/examples/unpkg-demo | Priority: high | Version: 2.0 | Updated: 2026-05-05 -->

# Example: UNPKG Package Browser

**Core Idea**: From `~/remix/demos/unpkg/` — browse npm package contents. Shows `remix/tar-parser`, `remix/file-storage/fs` caching, catch-all routes, semver resolution, and typed errors.

## Catch-All Route + Controller
```typescript
export const routes = route({ home: get('/'), packageBrowser: get('/*path') })

// In controller:
async packageBrowser({ params }) {
  let { name, version, filePath } = parsePackagePath(params.path ?? '')
  let metadata = await fetchPackageMetadata(name)

  if (!isFullyResolvedVersion(metadata, version)) {
    return redirect(`/${name}@${resolveVersion(metadata, version)}${filePath ? '/' + filePath : ''}`)
  }
  let contents = await fetchPackageContents(name, version)
  if (filePath && contents.files.get(filePath)?.type === 'file') {
    return renderFileContent(name, version, filePath, await contents.getFileContent(filePath))
  }
  return renderDirectoryListing(name, version, filePath, getFilesAtPath(contents.files, filePath))
}
```

## Typed Error Handling
```typescript
try { /* resolve package */ }
catch (error) {
  if (error instanceof PackageNotFoundError) return renderError('Package not found', error.packageName)
  if (error instanceof VersionNotFoundError) return renderError('Version not found', error.version)
  if (error instanceof InvalidPathError) return renderError('Invalid path', error.path)
  throw error
}
```

## Tarball + File-Storage Caching
```typescript
import { parseTar } from 'remix/tar-parser'
import { createFsFileStorage } from 'remix/file-storage/fs'
// Pattern: fetch tarball → decompress (node:zlib) → parse entries (tar-parser) → cache (file-storage) → serve
```

## Render Without UI Runtime
```typescript
import { createHtmlResponse } from 'remix/response/html'
export function render(title, content) {
  return createHtmlResponse(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title></head><body>${content}</body></html>`)
}
```

## Reference
- Full demo: `~/remix/demos/unpkg/`
- Tarball parser: `remix/tar-parser`
- File storage: `remix/file-storage`, `remix/file-storage/fs`

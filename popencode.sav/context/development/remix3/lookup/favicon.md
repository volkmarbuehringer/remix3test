<!-- Context: development/remix3/lookup/favicon | Version: 1.0 | Updated: 2026-04-17 -->

# Lookup: Favicon Handling

Quick reference for adding favicons to Remix applications.

## Rule

**Always add a favicon to prevent 404 errors in browser console.**

## Implementation

### 1. Create Favicon

```svg
<!-- public/favicon.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#FF385C"/>
  <text x="50" y="70" font-size="50" text-anchor="middle" fill="white">C</text>
</svg>
```

### 2. Link in Document

```typescript
// app/ui/document.tsx
import type { Handle } from 'remix/ui'

export function Document(handle: Handle<{ children: any }>) {
  return () => {
    let { children } = handle.props
    return (
      <html>
        <head>
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        </head>
        <body>{children}</body>
      </html>
    )
  }
}
```

### 3. Serve Statically

Static file serving must handle SVG content-type:

```typescript
// server.ts
function getContentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.svg': return 'image/svg+xml'
    // ...
  }
}
```

## Reference

- Favicon: `checker/public/favicon.svg`
- Document: `checker/app/ui/document.tsx`
- Server: `checker/server.ts`

## Related

- `lookup/static-file-serving.md` - Static file rules
- `lookup/static-server-setup.md` - Server setup
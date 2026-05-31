<!-- Context: development/remix3/lookup/static-server-setup | Version: 1.0 | Updated: 2026-04-17 -->

# Lookup: Static File Serving Setup

Quick reference for setting up static file serving in custom Remix servers.

## Rule

**Static files go in `public/` directory.** URL maps directly: `public/app.css` → `/app.css`.

## Server Implementation

```typescript
// server.ts
import * as fs from 'node:fs'
import * as path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicPath = path.join(__dirname, 'public')

const server = http.createServer(
  createRequestListener(async (request) => {
    let url = new URL(request.url)
    
    // Try to serve static file first
    let filePath = path.join(publicPath, url.pathname)
    try {
      let stats = await fs.promises.stat(filePath)
      if (stats.isFile()) {
        let content = await fs.promises.readFile(filePath)
        return new Response(content, {
          headers: { 'Content-Type': getContentType(filePath) },
        })
      }
    } catch { /* not a file, continue to router */ }
    
    // Fall through to app router
    return await router.fetch(request)
  }),
)

function getContentType(filePath: string): string {
  let ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.css': return 'text/css'
    case '.js': return 'application/javascript'
    case '.json': return 'application/json'
    case '.png': return 'image/png'
    case '.svg': return 'image/svg+xml'
    default: return 'application/octet-stream'
  }
}
```

## Common File Types

| Extension | Content-Type |
| --------- | ------------- |
| `.css` | `text/css` |
| `.js` | `application/javascript` |
| `.json` | `application/json` |
| `.png` | `image/png` |
| `.svg` | `image/svg+xml` |
| `.ico` | `image/x-icon` |

## Reference

- Server: `checker/server.ts`
- CSS: `checker/public/app.css`
- Favicon: `checker/public/favicon.svg`

## Related

- `lookup/static-file-serving.md` - File path rules
- `guides/external-css.md` - CSS organization
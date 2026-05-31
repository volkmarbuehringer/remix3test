<!-- Context: development/remix3/packages/utilities | Priority: high | Version: 1.0 | Updated: 2026-04-25 -->

# utilities/packages

Key utility packages for Remix development.

| Package | Purpose |
|---------|---------|
| `headers` | Type-safe HTTP header manipulation |
| `html-template` | Safe HTML templating with XSS prevention |
| `multipart-parser` | Parse multipart/form-data requests |
| `mime` | MIME type utilities |
| `assert` | Type assertions and validation |
| `test` | Test utilities |
| `lazy-file` | Streaming File implementation |
| `fetch-proxy` | Fetch proxy utilities |
| `fs` | File system utilities |
| `data-schema` | Schema parsing for validation |
| `tar-parser` | TAR archive parsing |
| `assets` | Asset handling |

## Key Utilities

### html-template
```ts
import { html } from 'remix/html-template'
// Automatic XSS escaping
let response = createHtmlResponse(html`<h1>${userInput}</h1>`)
```

### headers
```ts
import { createHeaders, accept } from 'remix/headers'
let headers = createHeaders()
headers.set('Cache-Control', 'public, max-age=3600')
```

### lazy-file
```ts
import { openLazyFile } from 'remix/fs'
let lazyFile = openLazyFile('./large-video.mp4')
```

## Reference

Individual READMEs in `/home/lucky/remix/packages/*/README.md`
<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: Headers

**Purpose**: Typed utilities for parsing, manipulating, and serializing HTTP header values. Provides `SuperHeaders` (enhanced `Headers` subclass) plus per-header classes.

## Key Points

- **SuperHeaders** (default export) — extends native `Headers` with lazy typed property accessors (`headers.contentType`, `headers.cacheControl`, `headers.setCookie`). Still works with platform APIs since it's a real `Headers` subclass.
- **14 header classes**: Accept, Accept-Encoding, Accept-Language, Cache-Control, Content-Disposition, Content-Range, Content-Type, Cookie, If-Match, If-None-Match, If-Range, Range, Set-Cookie, Vary
- Parse with `HeaderClass.from(rawValue)`, serialize with `.toString()`
- **Raw headers**: `parse(rawString)` and `stringify(headers)` for raw HTTP header strings

## Quick Example

```ts
import Headers, { SuperHeaders, Accept, CacheControl, parse } from 'remix/headers'

// SuperHeaders with lazy typed accessors
let headers = new Headers(request.headers)
headers.contentType = { mediaType: 'text/html', charset: 'utf-8' }
headers.cacheControl = { public: true, maxAge: 3600 }

// Header classes
let accept = Accept.from(request.headers.get('Accept'))
accept.accepts('text/html') // true
accept.getPreferred(['text/html', 'application/json']) // 'text/html'

let cache = new CacheControl({ maxAge: 3600, public: true })
headers.set('Cache-Control', cache)

// Raw parsing
let parsed = parse('Content-Type: text/html\r\nCache-Control: no-cache')
```

## Header Class Patterns

- **Accept/Accept-Encoding/Accept-Language**: `Map<value, quality>` with `accepts()`, `getWeight()`, `getPreferred()`
- **Cache-Control**: Object with `public`, `maxAge`, `sMaxage`, `noCache`, `immutable`, etc.
- **Content-Type**: Object with `mediaType`, `charset`, `boundary`
- **Content-Disposition**: Object with `type`, `filename`, `preferredFilename`
- **Cookie**: Ordered list of name/value pairs with `get()`, `getAll()`, `set()`, `append()`
- **Set-Cookie**: Object with `name`, `value`, `path`, `httpOnly`, `secure`, `sameSite`, `maxAge`, `expires`
- **If-Match/If-None-Match**: `Set<etag>` with `matches()` (If-Match: strong only; If-None-Match: weak allowed)
- **Range**: Object with `unit`, `ranges[{start, end}]`, `canSatisfy()`, `normalize()`
- **Vary**: `Set<headerName>` (case-insensitive)

## Reference

Source: `~/remix/packages/headers/src/`
README: `~/remix/packages/headers/README.md`

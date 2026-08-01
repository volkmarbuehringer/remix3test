---
name: remix-headers
description: Use typed HTTP header manipulation with `remix/headers`. Activate when parsing, modifying, or constructing HTTP headers with type safety — Cache-Control, Content-Type, Set-Cookie, Accept, Range, and more.
---

# Remix HTTP Headers

Covers `remix/headers`.

For the SuperHeaders API (lazy typed property accessors on a `Headers` subclass), the individual header classes, and the raw `parse`/`stringify` helpers, see `~/remix/packages/headers/README.md`.

## Caveats: Typed Classes Handle Quoting Natively

When migrating from raw `headers.set('Name', value)` to typed classes, don't pre-escape values — the classes handle RFC quoting:

```ts
// ❌ Unnecessary — typed class handles quoting
headers.contentDisposition = {
  type: 'attachment',
  filename: filename.replace(/"/g, '\\"'), // don't pre-escape
}

// ✅ Correct — pass clean values, ContentDisposition quotes when needed
headers.contentDisposition = {
  type: 'attachment',
  filename: filename.replace(/[\r\n"]/g, ''), // strip only truly invalid chars
}
```

The `toString()` → `quote()` chain:

- Only escapes `"` → `\"` when the value contains `"`, `;`, or space
- Does not escape backslashes
- Only wraps in quotes when necessary

Similarly, `Content-Length` accepts `number` directly — no `String()` wrapping needed:

```ts
headers.contentLength = buffer.length // ✅ not String(buffer.length)
```

## References

- `~/remix/packages/headers/README.md` — full docs with per-header examples

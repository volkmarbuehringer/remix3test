<!-- Context: frames/errors/security-file-uri-s | Priority: high | Version: 1.0 | Updated: 2026-04-29 -->

# Security Errors - file:/// URIs

**Symptom**: `SecurityError: Blocked loading module from origin` — `file:///` URIs not allowed in browser.

**Root Cause**: Using `file://` URIs for client entry resolution in the browser context. File protocol is blocked by browser security policies.

```typescript
// ❌ BROKEN - file:/// URI in browser
let url = new URL(src, 'file://localhost')

// ✅ FIXED - Use http:// for browser resolution
let url = new URL(src, window.location.origin)
```

**Affected Files**: `bookstore/app/assets/entry.tsx`

## Key Rule

Never use `file://` URIs in browser-facing code. Use `window.location.origin` or the configured base URL for module resolution in the browser.

## See Also

- `development/remix3/errors/frame-rmx-data-parse.md` - Related parse errors

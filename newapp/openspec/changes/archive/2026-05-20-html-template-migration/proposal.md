## Why

Three places in the middleware layer construct raw HTML strings without going through the rendering pipeline. While the current interpolated values are safe (HTTP status codes, static text), this pattern is fragile — future edits could unwittingly introduce XSS vulnerabilities. The project already has `remix/html-template` available as a transitive dependency, which provides auto-escaping template literals designed exactly for this kind of outside-the-component-system HTML generation. Adopting it here establishes a consistent, safe pattern.

## What Changes

- `app/middleware/admin.ts` — Replace the hand-rolled 403 forbidden HTML document with `html` tagged template from `remix/html-template`.
- `app/middleware/auth.ts` — Replace the raw HTML string in the frame-level 401 response with `html` tagged template.
- `app/middleware/render.tsx` — Replace the frame error `<pre>` fallback string interpolation with `html` tagged template.

All three changes are internal refactors. HTTP status codes, headers, and response shapes remain identical. No behavioral changes.

## Capabilities

### New Capabilities

_(None — this is an internal refactor, not a new feature or user-facing capability.)_

### Modified Capabilities

_(None — no spec-level requirements change. The middleware continues to return the same HTTP responses with the same status codes and content types.)_

## Impact

- `app/middleware/admin.ts` — Import `html` from `remix/html-template`, wrap the 403 HTML template string.
- `app/middleware/auth.ts` — Import `html` from `remix/html-template`, wrap the 401 HTML string.
- `app/middleware/render.tsx` — Import `html` from `remix/html-template`, wrap the frame error string.
- No new dependencies — `remix` is already in `package.json` and `remix/html-template` is available as a subpath.
- No test changes needed — responses are identical in content and status. Existing tests continue to pass.

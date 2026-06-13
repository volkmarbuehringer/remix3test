## Why

The app has a partial migration to `remix/headers` typed header classes in core middleware (`render.tsx`, `sse.ts`), but the majority of header manipulation across the codebase still uses raw `headers.set('Name', value)` strings — error-prone, untyped, and inconsistent. Finishing the migration eliminates typos, enables autocomplete, gives compile-time safety for header names and values, and normalizes to one pattern.

## What Changes

- Migrate `security-headers.ts` to use `SuperHeaders` with typed property accessors (6 security headers)
- Migrate `auth.ts` and `admin.ts` middleware to use typed `ContentType`, `Location`, and `SuperHeaders`
- Migrate `assets/entry.tsx` to use typed `Accept`
- Migrate 4 file-download controllers (uploads, pdf, users-pdf, users-export) to use `ContentType`, `ContentDisposition`, `SuperHeaders`
- Migrate ~20+ redirect `Response` constructions to use `SuperHeaders` with typed `location` property or standardize on `redirect()` helper
- Migrate test header assertions to use typed parse helpers (`SetCookie.from()`, `CacheControl.from()`, etc.)
- Remove all remaining raw `headers.set('Header-Name', ...)` calls for headers that have typed equivalents

## Capabilities

### New Capabilities
<!-- No new capabilities — this is a pure refactoring/migration change with no spec-level behavioral changes -->

### Modified Capabilities
<!-- No spec-level requirement changes — all existing behavior is preserved -->

## Impact

- `app/middleware/security-headers.ts` — SuperHeaders with typed accessors
- `app/middleware/auth.ts` — typed Content-Type and Location
- `app/middleware/admin.ts` — typed Location
- `app/assets/entry.tsx` — typed Accept
- `app/actions/uploads/controller.tsx` — ContentType, ContentDisposition classes
- `app/actions/verwaltung/pdf/controller.tsx` — typed download headers
- `app/actions/verwaltung/users-pdf/controller.tsx` — typed download headers
- `app/actions/verwaltung/users-export/controller.tsx` — typed download headers
- ~20 action controller files — standardize redirect responses
- Test files — typed header assertions
- No dependency changes, no behavioral changes, no new routes

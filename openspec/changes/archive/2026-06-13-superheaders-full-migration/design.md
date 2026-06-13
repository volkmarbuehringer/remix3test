## Context

The app already uses `remix/headers` in core middleware (`render.tsx` with `SuperHeaders`, `Accept`, `AcceptEncoding`, `CacheControl`; `sse.ts` with `SuperHeaders`, `ContentType`, `CacheControl`; `test-utils.ts` with `SetCookie.from()`; `document.tsx` with `Cookie.from()`). The remaining ~85% of header operations use raw `headers.set('Name', value)` — untyped, no autocomplete, error-prone for header name typos.

## Goals / Non-Goals

**Goals:**
- All header writes use typed `remix/headers` classes instead of raw string manipulation
- Security headers middleware gets typed property accessors via `SuperHeaders`
- File download controllers use `ContentType`, `ContentDisposition` classes and `SuperHeaders.contentLength` typed property
- Redirect construction uses `SuperHeaders` with typed `location` or the `redirect()` helper
- Test utilities use typed parse helpers for header assertions
- Zero behavioral change — every existing response is byte-identical

**Non-Goals:**
- Introducing new headers or changing header values
- Refactoring the application logic or route structure
- Changing any non-header behavior
- Introducing `SuperHeaders` into every one-off redirect if a simpler pattern suffices

## Decisions

**Decision 1: SuperHeaders for multi-header middleware, value classes for single-header responses**

Middleware that sets multiple headers (security-headers, auth) gets `SuperHeaders`. Controllers setting 1-2 headers (redirects, file downloads) use individual value classes (`ContentType`, `ContentDisposition`, `CacheControl`) constructed inline.

Rationale: `SuperHeaders` runs `Object.defineProperty` for ~60 header accessors on construction. This overhead is fine in middleware (constructed once per request) but unnecessary for a simple redirect response where only `Location` is set.

**Decision 2: Redirects use `headers.location = url` via a small SuperHeaders wrapper, not the `redirect()` helper**

Several redirects return specific status codes (303, 301). The `redirect()` helper from `remix/response/redirect` always uses 302. Rather than changing semantics, use `SuperHeaders` to set `headers.location` with the existing status code.

Alternatively, for the simplest case (302 only), standardize on `redirect()` where already imported.

**Decision 3: File download Content-Disposition uses the `ContentDisposition` class**

The class handles filename encoding and quoting correctly — removing the current template-literal fragility.

**Decision 4: Tests use typed assertions via `from()` static methods**

Instead of `response.headers.get('Set-Cookie').includes('session=...')`, use `SetCookie.from(response.headers.get('Set-Cookie'))` and access typed `.name`, `.value` properties.

## Risks / Trade-offs

- **[Risk] Byte-level changes due to canonicalization**: `ContentType.from(mime).toString()` may produce slightly different casing or whitespace. → Mitigation: verify against existing response bodies in tests. Use `from()` and `toString()` roundtrip on current raw strings first.
- **[Risk] SuperHeaders performance in hot paths**: `Object.defineProperty` on every construction. → Acceptable for middleware (once per request). Not applied to individual controller redirects.
- **[Risk] Mixed patterns for ~120 seconds post-migration**: Some files use SuperHeaders, some use raw, some use value classes. → Acceptable; the migration is a net reduction in patterns (from ~3 to ~2, with raw eliminated).

## Why

Newapp's form handling lacks RESTful method support (PUT/DELETE), server-side validation rigor, and key infrastructure middlewares (compression, asset-entry) that the Remix demos demonstrate as proven patterns. Adding these fills gaps that slow development and degrade production performance — without introducing novel complexity.

## What Changes

- Add `methodOverride()` middleware so HTML forms can use PUT, DELETE, PATCH via `_method` override
- Add `RestfulForm` component providing a clean, type-safe wrapper for RESTful HTML forms
- Upgrade validation schemas with `minLength`, `email()`, `coerce.boolean()`, `defaulted()` checks across login, register, and client CRUD forms
- Add `compression()` middleware for gzip/brotli response compression
- Add asset-entry middleware pattern for pre-resolved script/stylesheet resolution at request time
- Refactor router from singleton module to factory function (`createNewappRouter`) for testability and configuration injection
- Export internal middleware values (sessionCookie, sessionStorage) for reuse and testing

## Capabilities

### New Capabilities
- `restful-forms`: Method override middleware and RestfulForm component enabling PUT/DELETE/PATCH from HTML forms with clean route contracts
- `data-validation`: Enhanced form validation schemas using data-schema with minLength, email, coerce, and defaulted for consistent server-side input checking
- `server-compression`: Compression middleware for smaller response payloads over the wire
- `asset-entry-middleware`: Request-scoped asset resolution middleware for script preloads, stylesheets, and configurable entry points
- `router-factory`: Factory function pattern for creating configurable, testable router instances with dependency injection

### Modified Capabilities
<!-- No existing capability specs are changing — this is purely additive infrastructure -->

## Impact

- `app/router.ts`: Refactored from singleton to factory function; exports `createNewappRouter()`
- `app/routes.ts`: Some POST routes become PUT/DELETE for RESTful semantics
- `app/actions/auth-login-controller.tsx`: Schema validation added where absent
- `app/actions/auth-register-controller.tsx`: Schema upgraded with minLength/email checks
- `app/actions/client/controller.tsx`: Routes switch to RESTful methods; validation added
- `app/middleware/`: New `asset-entry.ts` middleware file
- `app/ui/`: New `restful-form.tsx` component
- `app/middleware/session.ts`: Export sessionCookie, sessionStorage for factory DI
- `server.ts`: Updated to call factory function instead of using singleton
- `package.json`: No new runtime dependencies — all patterns use existing Remix APIs

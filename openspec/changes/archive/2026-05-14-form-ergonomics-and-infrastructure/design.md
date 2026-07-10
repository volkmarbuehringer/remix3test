## Context

Newapp's middleware stack and router are a singleton module — `app/router.ts` exports a single `router` instance used by `server.ts`. Session cookie and storage are module-level constants in `middleware/session.ts`. Assets are resolved via a simple `<script>` tag hardcoded in `document.tsx`. Forms use only GET/POST with manual method routing.

The Remix demos (`bookstore`, `social-auth`) demonstrate proven patterns for compression, method override, asset entry middleware, and factory-based router construction. This design adapts those patterns for newapp's architecture.

Current middleware stack order:

```
logger → formData → session → asyncContext → loadDatabase → loadAuth → render
```

## Goals / Non-Goals

**Goals:**

- Enable PUT/DELETE from HTML forms via `methodOverride` middleware and `RestfulForm` component
- Upgrade server-side validation schemas to use `minLength`, `email()`, `coerce`, `defaulted` across login, register, and client CRUD
- Add response compression for smaller payloads
- Create asset-entry middleware for configurable, pre-resolved script/stylesheet injection
- Refactor router to a factory function (`createNewappRouter`) accepting injectable dependencies
- Export session cookie/storage for use by factory callers

**Non-Goals:**

- No CSS stylesheet bundling (newapp uses `remix/ui` for all styling — no CSS files to inject)
- No OAuth/social login (saved for a separate change)
- No file upload support (out of scope)
- No external API integration changes
- No changes to the middleware execution model (order, error handling, etc.)

## Decisions

### Decision 1: Compression middleware placement

Compression should run early in the stack, before any response body is generated. Place it after `logger()` (for dev-friendly raw logging before compression) and before `formData()` (no need to compress incoming data).

**Why this placement:** Same pattern as the bookstore demo. No need to compress upstream middleware output (like logger formatting).

### Decision 2: methodOverride middleware insertion point

`methodOverride()` must run after `formData()` (which parses the request body where `_method` lives) but before `session()` and downstream middleware that might inspect `request.method`.

**Insertion:** Between `formData()` and `session()` in the middleware array.

**Why not after auth:** Auth checks could redirect based on method. Overriding before auth ensures the router sees PUT/DELETE for protected routes too.

### Decision 3: RestfulForm as pure server component

`RestfulForm` is a thin wrapper around `<form>`. It's a server-side-only component (no client JS). It intercepts the `method` prop and conditionally renders a hidden `_method` input.

**Pattern:**

```tsx
<RestfulForm method="PUT" action="/resource/42">
  → <form method="POST" action="/resource/42">
      <input type="hidden" name="_method" value="PUT" />
      ...children...
    </form>
```

GET and POST pass through unchanged. PUT, DELETE, PATCH trigger the override.

**Why not a client-side approach:** Pure server rendering means zero JS overhead, works without hydration, and is consistent with Remix 3's server-first philosophy.

### Decision 4: Validation schema location

Co-locate schemas with their controllers initially (`auth-login-controller.tsx`, `auth-register-controller.tsx`, `client/controller.tsx`). Extract to shared files only if a schema is reused across multiple controllers.

**Why co-located:** Keeps changes scoped. The bookstore and social-auth both use this pattern — schemas live near the action that uses them.

### Decision 5: Parse error handling pattern

For now, use try/catch on `s.parse()` and re-render with a generic form-level error message. Field-level error display is a future enhancement.

**Why not field-level:** The current controller pattern renders pages from actions. Adding field-level error propagation would require a mechanism to pass field errors back to the template. That's a larger change best done in a dedicated follow-up.

### Decision 6: Asset entry middleware interface

The middleware resolves asset URLs at request time and stores them in context:

```ts
interface AssetEntry {
  scriptSrc: string // Main entry module URL
  scriptPreloads: string[] // Module preload URLs (from static analysis)
}
```

The `render()` middleware and `Document` component read from context. If the middleware is not installed, they fall back to the current hardcoded behavior.

**Why not resolve at startup:** The asset server supports hot-reload in development. Deferred resolution ensures the freshest URLs.

### Decision 7: Router factory function signature

```ts
export interface NewappRouterOptions {
  sessionCookie?: Cookie
  sessionStorage?: SessionStorage
}

export function createNewappRouter(options?: NewappRouterOptions): Router
```

If no options provided, defaults use the current `sessionCookie` / `sessionStorage` values (backward compatible).

**Why optional params:** Zero-config for the default case. `server.ts` works unchanged. Test code injects mock storage.

**Why not a full DI container:** YAGNI. Current needs are simple — session config and (potentially) database injection later. A full container would be over-engineering.

### Decision 8: Export session middleware internals

`middleware/session.ts` already defines `sessionCookie` and `sessionStorage`. These are already exported (confirmed: `export const sessionCookie = ...`). No change needed for exports — but the router factory will accept them as parameters.

## Risks / Trade-offs

- **[Low] methodOverride changes request method globally within the request** → Same behavior as the bookstore demo. Framework middleware handles this transparently. No downstream code reads raw `request.method` after override.
- **[Low] Refactoring router to factory could break imports** → `server.ts` currently imports `{ router }` from `./app/router.ts`. The factory pattern changes this to `import { createNewappRouter }`. Single import change in one file.
- **[Low] Compression adds CPU overhead for small responses** → Compression middleware typically skips responses under a threshold. This is a solved problem in the Remix compression implementation.
- **[Medium] Asset entry middleware adds one async hop per request** → Resolution fetches from the asset server, which is in-process. Negligible latency. Worth it for the flexibility gains.

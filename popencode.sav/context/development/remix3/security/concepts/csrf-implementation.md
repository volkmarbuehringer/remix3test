<!-- Context: development/remix3/security/concepts/csrf-implementation | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# CSRF Implementation

**Core**: Dual-path token propagation — SSR forms get the token via `getContext()` + `getCsrfToken()`, client-side scripts read it from `<meta name="csrf-token">` in the document head.

## Architecture

```
csrf() middleware (after session, before asyncContext)
    │
    ├─ SSR forms  → getContext() + getCsrfToken() → <input name="_csrf">
    └─ Client-side → <meta name="csrf-token">
                      ├─ DelButton: formData.set('_csrf', token)
                      └─ ListsClient: headers['X-Csrf-Token'] = token
```

## Middleware Placement

In `app/router.ts` (line 65), `csrf()` runs after `session()` and before `asyncContext()`:

```typescript
session(cookie, storage),
csrf(),
asyncContext(),
```

**Why this order**: CSRF needs the session to read/write tokens; asyncContext must be active for `getCsrfToken(getContext())` to work in SSR components.

## SSR Forms: CsrfTokenInput

`app/ui/csrf-token-input.tsx` — renders a hidden `<input name="_csrf">` during SSR:

```typescript
export function CsrfTokenInput() {
  return () => {
    try {
      let token = getCsrfToken(getContext())
      return <input type="hidden" name="_csrf" value={token} />
    } catch {
      return null  // CSRF middleware not active
    }
  }
}
```

Usage in any SSR form:
```tsx
<form method="POST">
  <CsrfTokenInput />
  ...
</form>
```

## Client-Side: Meta Tag

`app/ui/document.tsx` embeds the token in `<head>`:

```typescript
function CsrfMetaTag() {
  return () => {
    try {
      let token = getCsrfToken(getContext())
      return <meta name="csrf-token" content={token} />
    } catch { return null }
  }
}
```

Client components read it from the DOM:

- **DelButton** (`app/assets/client-del-button.tsx`): `formData.set('_csrf', csrfToken)` from `<meta>` content
- **ListsClient** (`app/assets/lists-client.tsx`): `headers['X-Csrf-Token'] = csrfToken` for JSON POST

## RestfulForm Auto-Inclusion

`app/ui/restful-form.tsx` auto-includes `_csrf` for any non-GET method, with optional explicit `csrfToken` prop override.

## Related

- `concepts/session-security.md` — Session regeneration and security
- `guides/testing-with-csrf.md` — How to write tests with CSRF tokens
- `../../errors/csrf-middleware-gotchas.md` — Common CSRF pitfalls

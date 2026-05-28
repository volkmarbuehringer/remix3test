## Context

The `newapp` app uses session cookies to authenticate users and has multiple mutation endpoints (admin CRUD, client CRUD, messages, auth, AI agents). Three issues were identified:

1. **No CSRF middleware**: The middleware chain (`app/router.ts`) includes `session()`, `formData()`, and `methodOverride()` but no `csrf()` middleware. Any cross-origin form can mutate state on behalf of an authenticated user.

2. **No session regeneration on login**: The login controller (`app/actions/auth-login-controller.tsx`) calls `session.set('auth', ...)` without first calling `session.regenerate()`. The logout handler already calls `session.regenerateId(true)` — so only the login path is missing it.

3. **Hardcoded HTML fallback in `requireAdmin()`**: The `app/middleware/admin.ts` function has a fallback path (lines 48-70) that returns a hardcoded HTML string with `<style>` tags and `className` attributes, violating the mandatory `css()` mixin standard. The function already supports `customForbidden` override — only the default fallback needs replacement.

## Goals / Non-Goals

**Goals:**
- Add CSRF token validation to all state-changing POST/PUT/DELETE requests using `remix/csrf-middleware`
- Regenerate session ID on successful login to prevent session fixation
- Replace the hardcoded HTML fallback in `requireAdmin()` with a proper component rendered through the existing renderer, using `css()` mixins and theme tokens

**Non-Goals:**
- Not modifying the overall middleware architecture or ordering beyond adding CSRF
- Not adding CSRF to API-style endpoints that use token auth (there are none currently)
- Not changing the `customForbidden` override mechanism — it stays

## Decisions

### 1. CSRF middleware placement

| Option | Verdict |
|--------|---------|
| Before `session()` in the chain | Rejected — CSRF needs session to validate tokens |
| After `session()`, before `asyncContext()` | Rejected — too early for form parsing |
| After `methodOverride()`, before `session()` | Rejected — CSRF reads session |
| **After `session()`, after `formData()`, after `methodOverride()`** | **Chosen** |

The CSRF middleware needs:
- The session to be available (to read/store CSRF tokens)
- The form data to be parsed (to read the CSRF token from the form body)
- The method override to have run (so DELETE/PUT requests from forms are correctly identified)

Final placement in the chain:
```
logger → securityHeaders → compression → formData → methodOverride → session → csrf → asyncContext → ...
```

### 2. CSRF token strategy

| Option | Verdict |
|--------|---------|
| Per-session token stored in session | **Chosen** — straightforward, no DB needed, tied to authenticated session |
| Per-form token with HMAC | Rejected — adds complexity without clear benefit for this app |
| Double-submit cookie pattern | Rejected — `remix/csrf-middleware` uses session storage natively |

The `csrf()` middleware from `remix/csrf-middleware` stores a token in the session. Forms include this token as a hidden field. On submission, the middleware compares the submitted token against the session-stored token.

```ts
import { csrf } from 'remix/csrf-middleware'

// In middleware chain, after session():
csrf(),
```

### 3. Session regeneration timing

| Option | Verdict |
|--------|---------|
| Before `session.set('auth')` | **Chosen** — standard practice, prevents fixation |
| After `session.set('auth')` | Rejected — regenerating after setting auth data would lose it |

The session should be regenerated *before* writing auth data:

```ts
session.regenerate()
session.set('auth', { userId: user.id })
```

### 4. `requireAdmin()` default forbidden page

| Decision | Verdict |
|----------|---------|
| Extract a reusable `ForbiddenPage` component in `app/ui/` | **Chosen** — follows existing pattern (shared UI in `app/ui/`) |
| Inline the component in `admin.ts` | Rejected — duplicates if other middleware needs it |
| Use the customForbidden override pattern exclusively | Rejected — should provide a quality default |

A small `app/ui/forbidden-page.tsx` component will render the 403 page using the existing `Layout` wrapper, `css()` mixins, theme tokens, and a `Glyph` icon (already used elsewhere in the app). The `requireAdmin()` fallback will call `context.get(Renderer)` — which it already has access to — to render it.

## Risks / Trade-offs

- **[CSRF middleware order]** If CSRF runs before formData or methodOverride, it won't see the token from POST bodies (works fine for header-based tokens, but forms submit as body). **Mitigation**: Place after both formData and methodOverride.
- **[Session regeneration]** Regenerating the session discards all existing session data. **Mitigation**: Regenerate *before* setting auth data, not after.
- **[requireAdmin refactor]** The `Renderer` is already accessible via `context.get(Renderer)` in the middleware. **Mitigation**: The current code already has this pattern working for `customForbidden` — we're just extending it to the default path.

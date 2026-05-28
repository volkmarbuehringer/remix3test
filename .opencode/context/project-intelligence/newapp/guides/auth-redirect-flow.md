<!-- Context: project-intelligence/newapp/guides/auth-redirect-flow | Priority: high | Version: 1.0 | Updated: 2026-05-13 -->

# Guide: Auth Redirect Flow

**Core Idea**: When an unauthenticated user visits a protected page, `requireAuth()` captures the current path as a `returnTo` parameter and redirects to `/login?returnTo=/original/path`. After successful login, the user is redirected back to their original destination.

---

## Flow Diagram

```
User visits /admin/chatlog (not logged in)
  → requireAuth() middleware triggers onFailure
  → getSafeReturnTo(context.url.pathname) → "/admin/chatlog"
  → Redirect to /login?returnTo=%2Fadmin%2Fchatlog
  → User submits login form
  → Login controller reads returnTo param
  → Session created, redirect to /admin/chatlog
```

## 1. `requireAuth()` Captures Current Path

`app/middleware/auth.ts`:

```tsx
export function requireAuth(options?: { redirectTo?: string }) {
  let redirectTo = options?.redirectTo ?? '/login'

  return requireAuthenticatedUser({
    onFailure(context) {
      let returnTo =
        getSafeReturnTo(context.url.searchParams.get('returnTo')) ?? context.url.pathname
      let location = returnTo
        ? `${redirectTo}?returnTo=${encodeURIComponent(returnTo)}`
        : redirectTo
      return new Response(null, {
        status: 302,
        headers: { Location: location },
      })
    },
  })
}
```

Key behavior:
- `getSafeReturnTo(context.url.pathname)` — falls back to current path as `returnTo` if no `returnTo` param exists yet
- This means the first redirect always captures the original destination
- `getSafeReturnTo()` prevents open-redirect attacks (only same-site absolute paths)

## 2. `getSafeReturnTo()` Open-Redirect Protection

`app/utils/redirect.ts`:

```tsx
export function getSafeReturnTo(returnTo: string | null): string | undefined {
  if (returnTo == null || returnTo === '') return undefined
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return undefined
  return returnTo
}
```

Only allows:
- Absolute paths starting with `/` (e.g., `/admin/chatlog`, `/ai/chat`)
- Rejects: `//evil.com`, `https://evil.com`, `null`, and empty strings

## 3. Login Controller Reads `returnTo`

`app/actions/auth-login-controller.tsx`:

```tsx
// GET — render login page
index(context) {
  let render = context.get(Renderer)
  let returnTo = context.url.searchParams.get('returnTo') ?? undefined
  return render(<LoginPage returnTo={returnTo} />)
},

// POST — handle login
async action(context) {
  let user = await verifyCredentials(passwordProvider, context)
  if (user == null) {
    // Show error, preserve returnTo
    let returnTo = context.url.searchParams.get('returnTo') ?? undefined
    return render(<LoginPage error="Invalid email or password." returnTo={returnTo} />, { status: 401 })
  }

  // Create session
  session.set('auth', { userId: user.id })

  let returnTo = getSafeReturnTo(context.url.searchParams.get('returnTo')) ?? '/'
  return redirect(returnTo)
},
```

## 4. Login Form Has Explicit Action

The login form includes the `returnTo` query parameter in its action URL to prevent Remix client-side routing from stripping the query string:

```tsx
<form method="POST" action={`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}>
```

Without the explicit `action` attribute, Remix's client-side form handling might use the current URL (which may not have the `returnTo` param) or strip the query string.

## Usage

Apply `requireAuth()` in controller middleware where authentication is needed:

```tsx
export default createController<typeof routes.admin, AppContext>(routes.admin, {
  middleware: [requireAuth(), requireAdmin()],
  actions: { ... }
})
```

For admin routes, stack `requireAuth()` before `requireAdmin()` — auth check must run before role check.

## Other Auth Flows Using Same Pattern

| Flow | File | returnTo source |
|------|------|----------------|
| Login form redirect | `middleware/auth.ts` | `context.url.pathname` (current page) |
| Link with returnTo | Any view | `?returnTo=` in URL |
| `requireAdmin()` not auth'd | `middleware/admin.ts` | `context.url.searchParams.get('returnTo')` |

## 📂 Codebase References

- **Auth middleware**: `app/middleware/auth.ts` — `requireAuth()` with returnTo capture
- **Admin middleware**: `app/middleware/admin.ts` — `requireAdmin()` reuses same redirect pattern
- **Redirect util**: `app/utils/redirect.ts` — `getSafeReturnTo()` validation
- **Login controller**: `app/actions/auth-login-controller.tsx` — Reads returnTo on GET and POST
- **Login form**: `app/actions/auth-login-controller.tsx` — Form action with explicit returnTo param
- **Controller usage**: `app/actions/admin-controller.tsx`, `app/actions/ai-controller.tsx` — Middleware stacks

## Related

- [App architecture](../concepts/architecture.md) — Middleware stack ordering
- [Admin frame-nav pattern](./admin-frame-nav-pattern.md) — Admin pages use requireAuth + requireAdmin
- [Session config](../middleware/session.ts) — Session cookie and storage

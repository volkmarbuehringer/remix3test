---
title: CSRF Middleware Gotchas
category: errors
type: context
source: /home/lucky/remix/packages/csrf-middleware/src/index.ts
tags: [remix3, errors, csrf, middleware, gotchas]
---

# CSRF Middleware Gotchas

## Core Concept
Common CSRF middleware misconfigurations, including missing token injection and expired token handling. Prevents false positives in form submissions.

## Common Issues

### Missing CSRF Token in Forms
❌ **Wrong**:
```html
<form method="POST">
  <button>Submit</button>
</form>
<!-- 403 Forbidden: Missing CSRF token -->
```

✅ **Correct**:
```ts
// In loader:
export function loader() {
  return { csrfToken: getCsrfToken() }
}
```
```html
<form method="POST">
  <input type="hidden" name="_csrf" value={csrfToken} />
  <button>Submit</button>
</form>
```

### Token Expiration Too Short
```ts
// Increase token expiration (default: 1 hour)
app.use(csrf({ secret: process.env.CSRF_SECRET, tokenExpiration: 86400 }))
```

### Not Excluding Public Routes
```ts
// Exclude public API routes from CSRF check
app.use(csrf({
  secret: process.env.CSRF_SECRET,
  exclude: (request) => request.url.pathname.startsWith('/api/public'),
}))
```

## Reference
- [OWASP CSRF Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

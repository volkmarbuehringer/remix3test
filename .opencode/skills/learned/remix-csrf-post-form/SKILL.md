---
name: remix-csrf-post-form
description: "Every POST form in a Remix 3 app with csrf() middleware needs a CsrfTokenInput hidden field or requests get 403"
user-invocable: false
origin: auto-extracted
---

# Remix 3 CSRF Token on POST Forms

**Extracted:** 2026-06-12
**Context:** Remix 3 apps using `csrf()` from `remix/middleware/csrf`

## Problem

Creating a new form with `method="POST"` in a Remix 3 app and getting a **403 Forbidden** response on submit. The error is silently logged as "missing csrf token" by the CSRF middleware configured in the root middleware stack.

This happens because `csrf()` is installed globally in the app's middleware stack and validates every non-GET request. Without the hidden `_csrf` input field, the middleware rejects the request before it reaches the controller.

## Solution

Add the `<CsrfTokenInput />` component inside every `<form method="POST">`:

```tsx
import { CsrfTokenInput } from './csrf-token-input.tsx'

<form method="POST" action={routes.someRoute.index.href()}>
  <CsrfTokenInput />
  {/* other form fields */}
  <button type="submit">Submit</button>
</form>
```

The `CsrfTokenInput` component renders `<input type="hidden" name="_csrf" value="<token>" />` during SSR by reading the CSRF token from the async request context via `getCsrfToken(getContext())`.

## When to Use

- You're creating a new `<form method="POST">` in a Remix 3 app
- The app uses `remix/middleware/csrf` (check `app/middleware/root.ts` for `csrf()`)
- POST requests return 403 with no obvious error
- You see "missing csrf token" in server logs at the POST request timestamp

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

### Alternative: clientEntry Forms (No Server Context)

Forms rendered inside `clientEntry` components cannot use `<CsrfTokenInput />` because they have no access to server async context. Inject the CSRF token from the DOM `<meta>` tag on submission:

```tsx
<form action="/logout" method="post" id="logout-form">
  <button
    type="submit"
    mix={[
      on('click', () => {
        let form = document.getElementById('logout-form') as HTMLFormElement | null
        if (form && !form.querySelector('input[name="_csrf"]')) {
          let token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
          if (token) {
            let input = document.createElement('input')
            input.type = 'hidden'
            input.name = '_csrf'
            input.value = token
            form.appendChild(input)
          }
        }
      }),
    ]}
  >
    Logout
  </button>
</form>
```

The `on('click')` handler injects the hidden input just before submission, keeping the token fresh. The CSRF token is served in `<meta name="csrf-token">` in the document `<head>`, making it always available client-side.

## When to Use

- You're creating a new `<form method="POST">` in a Remix 3 app
- The app uses `remix/middleware/csrf` (check `app/middleware/root.ts` for `csrf()`)
- POST requests return 403 with no obvious error
- You see "missing csrf token" in server logs at the POST request timestamp

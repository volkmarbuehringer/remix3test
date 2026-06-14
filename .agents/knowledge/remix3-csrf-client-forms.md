---
title: "CSRF token in client-side POST forms in Remix 3"
tags: [remix3, csrf, auth, client-entry, forms]
created: 2026-06-01
status: archived
---

## Problem

A `<form method="POST" action="/logout">` rendered inside a `clientEntry` component (the sidebar at `/appointments`) produced `Forbidden: missing CSRF token`. The CSRF middleware rejects POST requests without a valid `_csrf` field.

Server-rendered forms use `<CsrfTokenInput />` which reads the token from async context, but client components have no access to server context at render time.

## Solution

Inject the CSRF token from the DOM meta tag on form submission:

```tsx
<form action="/logout" method="post" id="appt-logout-form">
  <button
    type="submit"
    mix={[
      on('click', () => {
        let form = document.getElementById('appt-logout-form') as HTMLFormElement | null
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
    Abmelden
  </button>
</form>
```

For server-rendered forms (not inside `clientEntry`), use the `<CsrfTokenInput />` component or pass the token as a hidden input from server context:

```tsx
<form method="POST" action="/logout">
  <input type="hidden" name="_csrf" value={csrfToken} />
  <button type="submit">Logout</button>
</form>
```

## Why

- Remix 3 applies CSRF protection globally via middleware for all POST/PUT/DELETE requests.
- `clientEntry` components render in the browser and cannot access the async context that server-rendered components use.
- The CSRF token is served in `<meta name="csrf-token">` in the document `<head>`, making it always available client-side.
- Using `on('click')` ensures the token is injected just before submission, so it stays fresh even if the page has been open a while.

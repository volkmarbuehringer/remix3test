---
name: remix-sse-endpoint-csrf-bypass
description: 'Skip CSRF middleware for SSE streaming endpoints in Remix 3 to prevent 403 on client-side fetch()'
origin: auto-extracted
---

# Remix SSE Endpoint CSRF Bypass

**Extracted:** 2026-07-15
**Context:** Adding SSE streaming endpoints to a Remix 3 app that has CSRF middleware configured. The client uses `fetch()` (not HTML forms) to POST to the endpoint, so it doesn't include a CSRF token.

## Problem

When you add an SSE streaming endpoint (POST handler that returns `text/event-stream`) and the app has CSRF middleware, the client receives HTTP 403 on every POST. The SSE streaming endpoint uses `fetch()` with `FormData` or JSON body — there's no way to include a CSRF token in an SSE-initiated fetch (tokens are embedded in HTML forms via `CsrfTokenInput`).

The error:

```
[HTTP/1.1 403]
```

## Solution

Add the SSE endpoint paths to the CSRF skip list in the middleware:

```typescript
// app/middleware/skip-csrf.ts
export function skipCsrf(): Middleware {
  return async (context, next) => {
    if (
      context.url.pathname === '/route-agent' ||
      context.url.pathname.startsWith('/route-agent/') ||
      // Add your SSE endpoint here ↓
      context.url.pathname === '/mastra/chat' ||
      context.url.pathname.startsWith('/mastra/chat/')
    ) {
      return next()
    }
    return csrfMiddleware(context, next)
  }
}
```

### Optional: Custom header check for extra safety

Since skipping CSRF entirely opens the endpoint to `<form>` CSRF attacks, add a custom header check that blocks requests without the expected header (forms can't set custom headers):

```typescript
if (context.url.pathname === '/mastra/chat' || context.url.pathname.startsWith('/mastra/chat/')) {
  if (context.request.headers.get('X-SSE-Request') !== '1') {
    return new Response('Forbidden', { status: 403 })
  }
  return next()
}
```

Then ensure the client sends the header:

```typescript
fetch('/mastra/chat', {
  method: 'POST',
  headers: { 'X-SSE-Request': '1' },
  body: formData,
})
```

## How to detect

- SSE streaming endpoint returns 403
- App uses `remix/middleware/csrf` middleware
- The endpoint is called via `fetch()` not HTML `<form>` POST
- No CSRF token in the request body

## When to Use

- Adding SSE streaming endpoints to a Remix app with CSRF protection
- The streaming endpoint is consumed via client-side `fetch()` (not HTML forms)
- You've confirmed that CSRF middleware is intercepting the POST

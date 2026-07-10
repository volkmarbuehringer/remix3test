# Design

## Change

Add tunnel-compatible origin to `csrf()` in `app/middleware/root.ts`.

## File changes

| File                     | Change                                                 |
| ------------------------ | ------------------------------------------------------ |
| `app/middleware/root.ts` | Add `origin: /\.trycloudflare\.com$/` to `csrf()` call |

## How it works

The CSRF middleware origin validator (in `packages/csrf-middleware/src/lib/csrf.ts`)
accepts a `RegExp` in the `origin` option:

```ts
// Line 296-298
if (configuredOrigin instanceof RegExp) {
  return configuredOrigin.test(requestOrigin)
}
```

Passing `/\.trycloudflare\.com$/` allows any tunnel URL like
`https://word-word-word.trycloudflare.com` while still:

- Requiring a valid CSRF token in the POST
- Validating same-origin for all other environments (localhost, production)

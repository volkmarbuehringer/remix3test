---
title: Method Override Middleware
category: concepts
type: context
source: /home/lucky/remix/packages/method-override-middleware/src/index.ts
tags: [remix3, concepts, middleware, forms, http]
---

# Method Override Middleware

## Core Concept
Middleware overriding HTTP methods for Remix handlers using `_method` form field or `X-HTTP-Method-Override` header. Enables PUT/DELETE from HTML forms.

## Key Points
- Checks `X-HTTP-Method-Override` header first
- Falls back to `_method` form field
- Ignores override for GET/HEAD requests
- Integrates with Remix's form-data middleware
- Prevents method override on safe methods

## Example
```ts
import { methodOverride } from 'remix/method-override-middleware'

app.use(methodOverride())

// In HTML form:
// <input type="hidden" name="_method" value="DELETE">
```

## Reference
- [HTTP Method Override RFC](https://datatracker.ietf.org/doc/html/rfc7231#section-4.2.2)

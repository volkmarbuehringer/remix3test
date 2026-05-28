<!-- Context: development/remix3/middleware/concepts/form-data-middleware | Priority: high | Version: 2.0 | Updated: 2026-05-05 -->

# FormData Middleware

**Core Idea**: `remix/form-data-middleware` parses request body once and caches FormData for reuse across middleware and controllers.

## Problem & Solution
```typescript
// ❌ Without: each read consumes the body
let data1 = await request.formData()  // Reads body
let data2 = await request.formData()  // Error: Body already read!

// ✅ With: returns cached instance
async action({ get }) { let formData = get(FormData) }
```

## Registration Order
```typescript
middleware.push(formData({ uploadHandler }))  // 1st: Parse body (must be early!)
middleware.push(methodOverride())            // 2nd: May read FormData
middleware.push(session(cookie, storage))    // 3rd
middleware.push(loadAuth())                  // 4th: Reads FormData for login
```

## Context Access
```typescript
// In controller:  let formData = get(FormData)
// In middleware:   context.get(FormData)
// In auth provider (createCredentialsAuthProvider):  context.get(FormData)
```

## Type Safety
```typescript
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
const userSchema = f.object({ email: f.field(s.email()), name: f.field(s.string()) })
async action({ get }) { let user = s.parse(userSchema, get(FormData)) }
```

## Reference
- Guide: `../../data/guides/form-data-handling.md`
- Errors: `../../errors/body-unusable.md`
- Middleware composition: `../../middleware/guides/middleware-composition.md`

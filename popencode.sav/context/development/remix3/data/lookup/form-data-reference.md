<!-- Context: development/remix3/data/lookup/form-data-reference | Priority: medium | Version: 2.0 | Updated: 2026-05-05 -->

# FormData Quick Reference

**Purpose**: Quick lookup for FormData patterns with `remix/form-data-middleware` and `remix/data-schema/form-data`.

## Basic Patterns
```typescript
async action({ get }) {
  let formData = get(FormData)              // With form-data-middleware
  let value = formData.get('fieldName')     // Single: string | File | null
  let tags = formData.getAll('tags')        // Multiple: (string | File)[]
  let exists = formData.has('field')        // Check existence
}
```

## With Schema Validation
```typescript
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
const schema = f.object({ email: f.field(s.email()), name: f.field(s.string()) })
let data = s.parse(schema, get(FormData))
```

## Route Helpers
| Helper | Creates | Use |
|--------|---------|-----|
| `form('contact')` | `GET /contact` + `POST /contact` | Simple forms |
| `route('x', { index: get('/'), action: post('/') })` | Manual GET/POST | Complex forms |
| `post('/weather')` | `POST /weather` | API endpoints |

## Middleware Order
```typescript
middleware.push(formData({ uploadHandler }))  // 1. Body parsing (first!)
middleware.push(methodOverride())              // 2. May read FormData
middleware.push(session(cookie, storage))      // 3. Session
middleware.push(loadAuth())                    // 4. Custom
```

## Common Errors
| Error | Cause | Fix |
|-------|-------|-----|
| "Body is unusable" | Body already read | Use only `get(FormData)` |
| "Field not found" | Missing field | Check `formData.has()` first |
| "Invalid email" | Schema reject | Use `s.email()` validator |

## Reference
- Guide: `../guides/form-data-handling.md`
- Errors: `../../errors/body-unusable.md`
- Examples: `../examples/form-data-patterns.md`

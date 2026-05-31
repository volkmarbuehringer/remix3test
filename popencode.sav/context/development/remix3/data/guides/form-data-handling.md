<!-- Context: development/remix3/guides/form-data-handling | Priority: critical | Version: 1.1 | Updated: 2026-04-11 -->

# Form Data Handling in Remix 3

Proper patterns for reading and parsing form data in controllers.

## Two Approaches

| Approach | When to Use | Method |
|----------|-------------|--------|
| **`get(FormData)`** | Standard forms with middleware | `let formData = get(FormData)` |
| **`request.formData()`** | Direct request access (rare) | `let formData = await request.formData()` |

**Always use `get(FormData)`** - it's type-safe and integrates with middleware.

## Standard Pattern with `get(FormData)`

### Route Definition
```typescript
export let routes = route({
  contact: form('contact'),  // Auto-handles GET/POST
  assistant: route('assistant', {
    index: get('/'),
    action: post('/'),
  }),
})
```

### Controller
```typescript
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

const messageSchema = f.object({
  message: f.field(s.string()),
})

export default {
  actions: {
    async action({ get }) {
      let formData = get(FormData)
      let { message } = s.parse(messageSchema, formData)
    },
  },
}
```

## Required Setup

### 1. Add formData Middleware
```typescript
import { formData } from 'remix/form-data-middleware'

middleware.push(formData({ uploadHandler }))  // Must be early
```

### 2. Type-Safe Schema Validation
```typescript
const schema = f.object({
  email: f.field(s.email()),
  name: f.field(s.string(), { maxLength: 100 }),
  age: f.field(s.optional(s.number())),
})
```

## Route Type Differences

### `form()` Helper Routes
```typescript
contact: form('contact')
```
- Automatically creates GET (index) and POST (action) handlers
- Use `form()` for simple CRUD forms

### Explicit `route()` with POST
```typescript
assistant: route('assistant', {
  index: get('/'),
  action: post('/'),
})
```
- Explicit control over HTTP methods
- Use `route()` for complex multi-action controllers

## Related

- `errors/body-unusable.md` — Body consumption errors
- `guides/form-patterns.md` — Form UI patterns (edit/create inputs, dropdowns, redirects)
- `data/guides/input-validation.md` — Schema validation with `s.parse()` and `f.object()`
- ⚠️ `s.number()` does **not** coerce from FormData strings — use `coerce.number()` from `remix/data-schema/coerce` for numeric form fields

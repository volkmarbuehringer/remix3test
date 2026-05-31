<!-- Context: development/remix3/errors/body-unusable | Priority: high | Version: 1.0 | Updated: 2026-04-09 -->

# Error: Body is unusable - Body has already been read

**Error**: `TypeError: Body is unusable: Body has already been read`
**Occurs when**: Calling `get(FormData)` after the request body has been consumed elsewhere.

## Root Cause
The Fetch API Request body is a readable stream that can only be consumed once. The `formData` middleware reads and caches the body, but if something reads it first, the cache is invalidated.

## Common Causes

### 1. Middleware Ordering Issue
```typescript
// WRONG: Something reads body before formData middleware
middleware.push(someMiddlewareThatReadsBody()) // Reads body
middleware.push(formData({ uploadHandler }))   // Body already consumed
```

### 2. Manual Body Reading
```typescript
// WRONG: Reading body before get(FormData)
async action({ request }) { let text = await request.text(); let formData = get(FormData) }
```

### 3. Double FormData Access
```typescript
// WRONG: Without caching
async action({ get }) { let data1 = get(FormData); let data2 = get(FormData) }
```

## Solutions

### ✅ Cache FormData Reference
```typescript
async action({ get }) { let formData = get(FormData); let message = formData.get('message'); let other = formData.get('other') }
```

### ✅ Check Middleware Order
```typescript
middleware.push(formData({ uploadHandler })) // Register before body-reading middleware
middleware.push(methodOverride())
middleware.push(session(cookie, storage))
```

### ✅ Use Schema Parsing Directly
```typescript
const schema = f.object({ message: f.field(s.string()) })
async action({ get }) { let formData = get(FormData); let { message } = s.parse(schema, formData) }
```

## Debugging Steps
1. Check middleware order in `router.ts` - `formData` should be early
2. Search for `request.text()` or `request.json()` in middleware
3. Verify only one `get(FormData)` call per action handler
4. Check route definition - ensure it's not mapped twice

## Prevention
- Always use `get(FormData)` provided by formData middleware
- Never call `request.formData()`, `request.text()`, or `request.json()` directly
- Cache the FormData reference in a local variable
- Keep body-reading middleware after formData middleware

## Specific Example: Assistant Controller Issue

### ❌ Incorrect Pattern
```typescript
assistant: get('/assistant'),
export default { actions: {
  async index() { /* shows form */ },
  async action({ request }) { let formData = await request.formData() /* Error */ }
}}
```

### ✅ Correct Pattern
```typescript
assistant: route('assistant', { index: get('/'), action: post('/') }),
export default { actions: {
  async index() { return render(<AssistantPage />) },
  async action({ get }) { let formData = get(FormData); let { message } = s.parse(schema, formData) }
}}
```
**Key Differences**: Route uses `route()` with both `index` and `action` sub-routes. Controller uses `{ get }` to access FormData from middleware. Never use `{ request }` directly.

## 📂 Codebase References
**Implementation**: `bookstore/app/router.ts:72`, `bookstore/app/middleware/auth.ts:42`
**Examples**: `bookstore/app/controllers/checkout/controller.tsx:40-43`, `bookstore/app/controllers/api/controller.tsx:51-52`, `bookstore/app/controllers/contact/controller.tsx`, `bookstore/app/controllers/assistant/controller.tsx`
**Related**: `guides/form-patterns.md`, `guides/middleware-composition.md`, `guides/input-validation.md`

## Related Errors
- `guides/form-patterns.md` - General form handling
- `errors/form-hydration.md` - Form hydration issues
- `guides/input-validation.md` - Validation patterns

<!-- Context: development/remix3/middleware/concepts/request-context-get-pattern | Priority: high | Version: 1.0 | Updated: 2026-05-07 -->

# RequestContext.get() Null-Check Pattern

**Core Concept**: Since `RequestContext.get()` returns `undefined` for unset keys (instead of throwing), always use `get() == null` with an early `throw` instead of `context.has()` or bare `as` casts.

## Key Points

- `context.get(Key)` returns `T | undefined` — check before use
- Use `== null` (catches both `null` and `undefined`) for the guard
- Early throw with descriptive error messages: which middleware was expected and why
- Replace `context.has(Key)` with the guard — `get()` + check is one step, more idiomatic
- Avoid `as T` casts — they mask missing-middleware bugs at runtime

## Pattern

```typescript
import { FormData } from 'remix/form-data-middleware'

function handler(context) {
  let formData = context.get(FormData)
  if (formData == null) {
    throw new Error('Expected formData() middleware before handler')
  }
  // formData is now FormData, not FormData | undefined
  // ... use formData ...
}
```

## Where to Use

| Context | Pattern | Example |
|---------|---------|---------|
| Auth middleware | `context.get(FormData)` | `passwordProvider.parse()` in `middleware/auth.ts` |
| Auth verify | `context.get(Database)` instead of `context.db` | `passwordProvider.verify()` in `middleware/auth.ts` |
| Admin middleware | `context.get(Auth)` | `requireAdmin()` in `middleware/admin.ts` |
| Utility helpers | `getContext().get(Auth)` | `getCurrentAuth()` in `utils/context.ts` |
| Controllers | `get(FormData)` via action destructuring | `{ get }` in action handlers |

## Error Message Convention

Descriptive errors that name the missing middleware and where it was expected:

```typescript
// Good — names the middleware and the consumer
throw new Error('Expected formData() middleware before password auth provider')
throw new Error('Expected database middleware before password auth provider')
throw new Error('Expected auth() middleware before requireAdmin()')
```

## Why Not `context.has()`?

The `has()` method still works but `get() == null` is preferred because:
- It reads the value and checks in one line
- The value is immediately available after the guard
- Upstream is moving toward `get()` as the primary interface

## Why Not `as T`?

```typescript
// ❌ Bypasses null safety
let db = context.get(Database) as Database

// ✅ Preserves null safety with explicit check
let db = context.get(Database)
if (db == null) throw new Error('...')
```

## References

- `my_app/app/middleware/auth.ts` — FormData and Database null guards
- `my_app/app/middleware/admin.ts` — Auth null guard
- `my_app/app/utils/context.ts` — Auth null guard with getContext()
- `packages/fetch-router/src/context.ts` — RequestContext.get() implementation

## Related

- `../guides/middleware-composition.md` — Middleware ordering and context population
- `../../routing/concepts/controller-architecture.md` — AppController type binding
- `../../guides/typed-context.md` — Context typing and augmentation
- `../../../project-intelligence/my_app/guides/request-context-usage.md` — My_app patterns

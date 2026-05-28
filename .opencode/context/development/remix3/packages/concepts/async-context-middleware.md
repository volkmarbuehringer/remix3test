<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: Async Context Middleware

**Purpose**: Request-scoped async context via Node.js AsyncLocalStorage. Access request context anywhere in the same async call stack.

**Key Points**:
- Uses `AsyncLocalStorage` for request context isolation
- `getContext()` retrieves current request context (reuses `RouterTypes.context`)
- Augment `RouterTypes.context` via module declaration for app-typed context
- Requires Node.js runtime (uses async hooks)
- Works with any fetch-router middleware

**Minimal Example**:
```ts
import { asyncContext, getContext } from 'remix/middleware/async-context'

let router = createRouter({
  middleware: [asyncContext()],
})

router.get('/users/:id', async () => {
  let context = getContext()
  let userId = context.params.id
  return users.getById(userId)
})
```

**Typed Context**:
```ts
import type { AnyParams, ContextWithParams, MiddlewareContext } from 'remix/router'

export type RootMiddleware = [ReturnType<typeof loadSession>, ReturnType<typeof loadAuth>]
export type AppContext<params extends AnyParams = {}> = ContextWithParams<
  MiddlewareContext<RootMiddleware>, params
>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}
```
After augmentation, `getContext()` returns your app context values everywhere.

**Reference**: https://github.com/remix-run/remix/tree/main/packages/async-context-middleware

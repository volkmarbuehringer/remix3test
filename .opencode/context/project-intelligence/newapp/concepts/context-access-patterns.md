<!-- Context: project-intelligence/newapp/concepts/context-access-patterns | Priority: critical | Version: 1.0 | Updated: 2026-05-13 -->

# Concept: Context Access Patterns

**Core Idea**: After migration from `context.get(Key)` to direct properties, there are three tiers of context access. Choose the right one based on where you are in the codebase.

---

## Three Access Tiers

### Tier 1: Direct Properties (Controllers) ✅

Use `context.render`, `context.db`, `context.auth`, `context.session`, `context.formData` directly.

```tsx
// Controller actions — preferred pattern
index(context) { return context.render(<Page />) }
async action({ db, formData }) { await db.create(...) }
```

**Where**: Controller actions in `app/actions/`, anywhere `AppContext` is available.

### Tier 2: getContext() (No Direct Context) ⚠️

Call `getContext()` from `remix/async-context-middleware` to access the current request context.

```tsx
// UI layout files, utility functions, SSE subscribe handlers
import { getContext } from 'remix/async-context-middleware'

function MyUtility() {
  let { request, url } = getContext()
  // ...
}
```

**Where**: Layout files (`app/ui/`), utility functions (`app/utils/`), SSE handlers, standalone actions.

### Tier 3: context.get(Key) (Anonymous Contexts) 🔧

Use `context.get(FormData)` or `context.get(Database)` when the context type is not `AppContext`.

```tsx
// Middleware callbacks — auth scheme/providers use anonymous context
createSessionAuthScheme({
  async verify(value, context) {
    let db = context.get(Database)  // context is not AppContext here
  },
})
```

**Where**: `app/middleware/auth.ts` (scheme callbacks), `app/middleware/admin.ts` (standalone middleware).

---

## Decision Flow

```
Are you in a controller action with typed AppContext?
  → YES: Use direct properties (context.render, context.db, etc.)
  → NO: Does the function have its own context parameter?
    → YES: Check if context type is AppContext or anonymous
      → AppContext: Use direct properties
      → Anonymous: Use context.get(Key)
    → NO (no context parameter): Use getContext()
```

## Direct Property Reference

| Property | Type | Available After |
|----------|------|-----------------|
| `context.render(node)` | `(node, init?) => Response` | render() middleware |
| `context.db` | `Database` | loadDatabase() |
| `context.auth` | `AuthState<User>` | loadAuth() |
| `context.session` | `Session` | session() |
| `context.formData` | `FormData` | formData() |
| `context.url` | `URL` | Built-in |
| `context.params` | `Record<string, string>` | Built-in |
| `context.request` | `Request` | Built-in |

## 📂 Codebase References

- **RouterTypes augmentation**: `app/router.ts` — Makes `getContext()` return `AppContext`
- **Context type**: `app/types/context.ts` — `AppContext = MiddlewareContext<RootMiddleware>`
- **Migration completed**: 18 files migrated from `context.get(Key)` to direct properties
- **getContext() retained**: `app/utils/context.ts`, `app/ui/layout.tsx`, `app/actions/admin-messages-controller.tsx`
- **context.get() retained**: `app/middleware/auth.ts`, `app/middleware/admin.ts`

## Related

- [Middleware Chain](./middleware-chain.md) — What installs each property
- [Controller Pattern](../guides/controller-pattern.md) — How controllers access context
- [Architecture Overview](./architecture.md) — File ownership

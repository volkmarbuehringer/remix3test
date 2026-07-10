## Context

The remix "direct context properties" feature (commits `970e2cd7f`, `e803fdc90`, `29bd16291`) allows middleware to install values as direct named properties on `RequestContext` via the `property` field. All built-in remix middleware now does this:

| Middleware       | Property           | Status in newapp                                           |
| ---------------- | ------------------ | ---------------------------------------------------------- |
| `auth()`         | `context.auth`     | Not used — still `context.get(Auth)`                       |
| `session()`      | `context.session`  | Not used — still `getContext().get(Session)`               |
| `formData()`     | `context.formData` | Not used — still `context.get(FormData)`                   |
| `renderWith()`   | `context.render`   | Not used — still `context.get(Renderer)` / `get(Renderer)` |
| `logger()`       | `context.logger`   | Not used — no custom logging                               |
| `loadDatabase()` | ❌ no property     | Missing entirely                                           |

The `loadDatabase()` custom middleware was updated in a previous change (`fix-typecheck-errors`) to use the new `ContextEntry` object format, but it doesn't set `{ property: 'db' }`.

Additionally, auth controllers (`auth-login`, `auth-register`) inconsistently mix `context.get()` (via the action's context param) with `getContext().get()` (via AsyncLocalStorage) in the same file, making the pattern unclear.

## Goals / Non-Goals

**Goals:**

- Replace all `context.get(Key)` / `getContext().get(Key)` calls with direct property access where available
- Add `{ property: 'db' }` to `loadDatabase()` to complete the set
- Unify `getContext()` vs `context` parameter usage in auth controllers — always use `context` when inside a controller action
- Remove unnecessary `!` non-null assertions that were only needed due to broken types
- Zero behavioral changes — this is a code-style refactor

**Non-Goals:**

- No API surface changes — `context.get(Key)` remains available and functional
- No runtime behavior changes — `context.get(Key)` is still used internally; just not directly in controller code
- No canonical import path migration (`remix/router` vs `remix/fetch-router`) — blocked on upstream exports

## Decisions

**Decision 1: Migrate per-property in dependency order**

- `loadDatabase()` first (adds the `db` property) → Database consumers can then use `context.db`
- `render()` already has `property: 'render'` → straightforward substitution
- All other properties (`auth`, `session`, `formData`) are already set by remix middleware → straightforward substitution
- Auth controller unification happens alongside the property migration since the same files are affected

**Decision 2: Convert `get(Renderer)` call sites in two patterns**

Controllers that use `get(Renderer)` via destructured `{ get }`:

```ts
// Before
index({ get }) {
  return renderAiPage(get(Renderer), 'dashboard', <Content />)
}

// After
index(context) {
  return renderAiPage(context.render, 'dashboard', <Content />)
}
```

Controllers that use `context.get(Renderer)`:

```ts
// Before
index(context) {
  let render = context.get(Renderer)
  return render(<Page />)
}

// After
index(context) {
  return context.render(<Page />)
}

// Or with helper functions that accept a render function:
index(context) {
  return renderAdminPage(context.render, 'dashboard', <Content />)
}
```

**Decision 3: Use the `context` parameter directly in auth controllers instead of `getContext()`**

In `auth-login-controller.tsx` and `auth-register-controller.tsx`, replace:

```ts
let session = getContext().get(Session)
```

with:

```ts
let session = context.session
```

This eliminates the `getContext()` import and makes the data flow clearer — the action's `context` is the single source of truth.

**Decision 4: Remove `!` assertions that are no longer needed**

In `controller.tsx`:

```ts
// Before
let render = context.get(Renderer)!
return render(<Layout>...</Layout>)

// After (direct property, resolve type without null)
return context.render(<Layout>...</Layout>)
```

The `!` was only necessary when `context.get(Renderer)` could return `undefined` due to the broken type cascade. With correct types and direct properties, it's unnecessary.

## Risks / Trade-offs

- **[Low] A `context.render()` call passes the wrong args** → TypeScript catches it immediately since the render function signature is fixed
- **[Low] Missing direct property on a context key** → TypeScript won't auto-complete it; the dev falls back to `context.get(Key)` as before
- **[Low] `getContext()` still used in utility functions** — `utils/context.ts` and `utils/error-handling.ts` use `getContext()` because they're called outside controller action scope. These utilities legitimately need `getContext()` since they don't have a `context` parameter available. They can be updated to use direct properties where possible, but some `getContext().get()` calls will remain where the return type is a specific subtype (e.g., `getCurrentAuth()` narrows `AuthState<User>`).

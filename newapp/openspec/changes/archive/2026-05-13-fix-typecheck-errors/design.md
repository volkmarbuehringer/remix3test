## Context

The remix framework's `ContextEntries` type recently changed shape as part of the "direct context properties" feature (commits `970e2cd7f`, `e803fdc90`, `29bd16291`). The old tuple format:

```ts
type ContextEntries = readonly (readonly [object, unknown])[]
// Middleware used: Middleware<readonly [typeof Key, ValueType]>
```

was replaced with a `ContextEntry` object format:

```ts
interface ContextEntry<key extends object = object, value = unknown> {
  key: key
  value: value
  property?: string
}
type ContextEntries = readonly ContextEntry[]
// Middleware now uses: Middleware<{ key: typeof Key; value: ValueType }>
```

All built-in remix middleware (`auth`, `session`, `formData`, `renderWith`, `logger`) were updated to use the new format. However, `newapp`'s custom `loadDatabase()` middleware still uses the old tuple format. This single mismatch breaks the entire `MiddlewareContext` type chain:

```
loadDatabase() returns OLD Middleware<readonly [typeof Database, Database]>
  → RootMiddleware doesn't satisfy readonly AnyMiddleware[] constraint
  → AppContext (= MiddlewareContext<RootMiddleware>) can't compute entries
  → All context.get() lookups fall back to default types
  → context.get(Renderer) resolves to AnyRenderer (Renderer<never, never>)
  → Passing renderer to renderAiPage/renderAdminPage fails ("never")
  → get(Renderer) without ! → "possibly undefined"
```

Upstream remix packages (shipped as `remix@preview/main`) already contain the new types — this is newapp catching up.

## Goals / Non-Goals

**Goals:**
- Restore clean typecheck (`tsc --noEmit` passes with 0 errors)
- Update `loadDatabase()` to align with the new `ContextEntry` API shape
- No runtime behavior changes

**Non-Goals:**
- Migrating to direct context properties (e.g., `context.db` instead of `context.get(Database)`) — that's a follow-up improvement
- Updating import paths to canonical forms (`remix/router` vs `remix/fetch-router`) — not yet available as exports
- Refactoring controllers to use `context.render` direct property — nice-to-have, not required

## Decisions

**Decision 1: Only update the type annotation, not the `context.set()` call**
- The `context.set(Database, db)` runtime call doesn't need to change — it accepts both old and new formats
- Only the return type `Middleware<...>` needs updating because the generic constraint on `AnyMiddleware` changed
- Adding `{ property: 'db' }` to `context.set()` would be a follow-up; the direct property feature is optional

**Decision 2: Use the minimal object format without `property`**
- Format: `Middleware<{ key: typeof Database; value: Database }>`
- This satisfies the new `ContextEntry` constraint
- The `property` field is optional and omitting it keeps scope minimal

**Decision 3: No specs needed**
- This change fixes existing functionality rather than introducing new capabilities
- There are no requirement changes to capture in spec files
- The change is purely implementation (type annotation alignment)

## Risks / Trade-offs

- **[Low] Remix may further evolve the ContextEntries type** → Mitigation: the pattern is stable across 3 commits on main; the object format is the final form
- **[Low] Other custom middleware could exist** → Mitigation: verified all middleware files; only `loadDatabase()` uses the old tuple format
- **[None] Runtime breakage** → The `set()` and `get()` methods are unchanged; this is purely a type-level fix

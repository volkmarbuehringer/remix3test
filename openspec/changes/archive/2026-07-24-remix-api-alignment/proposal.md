## Why

The app was scaffolded against an earlier Remix 3 beta. Several API patterns have since been refined — redundant generics, a `mount()` API for route grouping, and direct context properties. These don't change behavior but bring the codebase in line with current conventions, reducing boilerplate and improving readability.

## What Changes

- **Drop explicit `AppContext` generic** from all `createController<..., AppContext>` and `createAction<..., AppContext>` calls (~45 sites). The `RouterTypes` augmentation already makes `DefaultContext` resolve to `AppContext` — the second generic is dead code.
- **Adopt `router.mount()`** for logical route groups (admin, verwaltung). Mount prefix params merge into `context.params`; the hierarchical structure mirrors the route tree.
- **Use direct context properties consistently** where property names are already registered (`logger`, `jsonBody`, `apiUser`) but controllers still use `context.get(Key)`.

## Capabilities

### New Capabilities
- `remix-api-conventions`: Internal codebase conventions for controller signatures, route registration, and context access patterns.

### Modified Capabilities

None — no existing user-facing capabilities change behavior.

## Impact

- ~38 controller/action files get simplified imports and call signatures
- `app/router.ts` restructured into nested mount groups
- No runtime behavior changes in any case

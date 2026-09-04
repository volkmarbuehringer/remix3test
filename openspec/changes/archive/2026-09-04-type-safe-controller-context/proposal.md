## Why

The app's controllers are fully typed at the `createController` handler boundary (`RouterTypes.context = AppContext` in `app/router.ts`), but 18 helper functions across 10 controllers throw that typing away with `context: any`, plus one `db: any`. This is the largest cluster of `any` in the app (146 total) and it is pure type-erasure — the typed value already exists at every call site. It also hides the `getAdminIdentity` `as unknown as` cast in `app/utils/context.ts`.

## What Changes

- Replace `context: any` with `context: AppContext` in the ~11 helpers that genuinely consume multiple context members (db + url + session + render).
- Narrow the ~7 render-only helpers to `{ render: AppContext['render'] }` and the single url-only helper to `{ url: AppContext['url'] }`.
- Replace `db: any` with `db: AppContext['db']` in `validateCreate`.
- Type `getAdminIdentity(auth: AuthState<User> | undefined)` and drop the `as unknown as` cast.
- Establish the narrow-slice pattern as a written convention (spec) so future controllers follow it.

No runtime behavior changes. Purely a type-level refactor.

## Capabilities

### New Capabilities
- `controller-context-typing`: Convention for typing controller helper functions — full `AppContext` when a helper consumes multiple context members, narrow slices (`db`, `render`, `url`) when it consumes one.

### Modified Capabilities
<!-- None — no runtime behavior changes. -->

## Impact

- 10 controllers under `app/actions/` (appointments-new, verwaltung/{offerings,appointments,resources,offering-configs,report1,users-export}, admin/{messages,chatlog}, webhook-requests).
- `app/utils/context.ts` (`getAdminIdentity`).
- Verified by `npm run typecheck` and `npm test`.
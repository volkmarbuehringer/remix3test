## Why

The app ships a textbook repository pattern at `app/data/appointments.ts` but only ~10 of ~24 controllers honor it. The other ~14 reach past `context.db` to call `pool.query` with hand-rolled SQL, inline `BEGIN/COMMIT/ROLLBACK`, and manual `paramIndex++` bookkeeping. Meanwhile `app/lib/` (26 files, referenced by 51 sources) and a UI→controller type-import coupling silently violate the documented conventions in AGENTS.md, and `app/router.ts` hides workflow registration behind a side-effect import while exporting a module-level singleton that defeats `createNewappRouter(options)` in tests. This change collapses three of the highest-impact issues surfaced in the architecture audit (R1+R2, R3, R5) into one coordinated refactor so the long-tail controllers match the quality of the best modules.

## What Changes

- **R1 — Lift raw SQL into repositories.** Move all `pool.query` blocks currently living in `app/actions/nutzer/controller.tsx`, `app/actions/verwaltung/offerings/controller.tsx`, `app/actions/verwaltung/appointments/controller.tsx`, `app/actions/admin/*`, and the inline `BEGIN/COMMIT/ROLLBACK` transaction in `nutzer/controller.tsx:237-265` into typed repository modules under `app/data/` modeled on `app/data/appointments.ts`. Controllers consume them via `context.db` only.
- **R1 — Promote `audit-log` to the repository seam.** Change `app/data/audit-log.ts:1-29` from `(pool, entry)` to `(db, entry)` and update ~14 call sites.
- **R2 — Move types out of controllers.** All exported `Row`/`Option` types currently declared in `actions/.../controller.tsx` (e.g. `OfferingRow` at `app/actions/verwaltung/offerings/controller.tsx:61`, `OfferingsResourceOption` at `:72`) move into the corresponding `app/data/` repository module (or a dedicated `app/types/<domain>.ts` when no repository owns them). The 15 `app/ui/**` files importing types from controllers switch to importing from `app/data/` (or `app/types/`).
- **R3 — Eliminate `app/lib/`.** Dispatch its 26 files to their nearest owner: theme primitives → `app/ui/theme/`; domain modules (`lists-api.ts`, `chatlog.ts`) → `app/data/`; pure utilities (`request-ip.ts`, `sse.ts`, `math.ts`, etc.) → `app/utils/`. Drop `app/lib/**` from the `allow` list in `app/assets.ts:12`.
- **R5 — Replace side-effect import.** Swap `import './workflows/definitions/index.ts'` at `app/router.ts:39` for an explicit `import { registerWorkflows } from './workflows/definitions/index.ts'` followed by a `registerWorkflows()` call inside `createNewappRouter()`.
- **R5 — Remove router singleton.** Drop `export const router = createNewappRouter()` at `app/router.ts:139`; export only `createNewappRouter`. Move the singleton to the server entry and update `app/test-utils.ts:5` to build its own router via `createNewappRouter({ ... })` with test overrides.
- **BREAKING (internal only)** — `app/data/audit-log.ts` and the moved domain modules gain new function signatures taking `Database` instead of `Pool`. No public API changes; this affects internal call sites only.

## Capabilities

### New Capabilities

- `data-access-repositories`: A single typed repository layer in `app/data/` that owns all SQL and business-rule validation; controllers and middleware consume it via `context.db` only and never touch `Pool` directly.
- `layer-ownership-boundaries`: Enforced disk layout where `app/ui/` imports types only from `app/data/` (or `app/types/`), `app/lib/` does not exist, and `app/assets.ts:12`'s allow list excludes `app/lib/**`.
- `router-composition-root`: The `app/router.ts` composition root is side-effect-free and dependency-injected: workflow registration is an explicit call, and the router instance is constructed by the entry point, not by the module.

### Modified Capabilities

<!-- No existing spec-level behavior changes; this is an internal refactor preserving all user-facing and HTTP behavior. -->

## Impact

- **Code moved/created**:
  - New repositories: `app/data/nutzer.ts`, `app/data/offerings-queries.ts`, `app/data/lists.ts` (moved from `app/lib/lists-api.ts`), `app/data/chatlog.ts` (moved from `app/lib/chatlog.ts`).
  - Modified: `app/data/audit-log.ts` (signature), `app/router.ts` (no side-effect import / no singleton), `app/test-utils.ts` (builds own router), `app/assets.ts:12` (allow list trimmed).
  - New: `app/ui/theme/` (absorbs `app/lib/theme*`, `glyph*`, `separator*`, `button.ts`).
  - Updated import sites: ~14 controllers, ~15 UI files, ~51 files currently importing from `app/lib/`.
- **No DB schema migrations, no HTTP route changes, no dependency additions.**
- **Tests**: existing co-located tests (`nutzer/controller.test.tsx`, `offerings-index.test.ts`, etc.) shift from mocking `pool.query` row-by-row to stubbing repository functions — a cleaner seam. `test-utils.ts` no longer relies on the production singleton; coverage of repository modules is added where missing.
- **Risk**: pure refactor; behavior-preserving if done in small commits with `npm test` + `npm run typecheck` between each. Rollback is `git revert`. Migration is mechanical per the `remix-consolidate-controllers` and `remix-route-relocation` skills.

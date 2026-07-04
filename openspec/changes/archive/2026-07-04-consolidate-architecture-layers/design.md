## Context

The remix3test app has a well-formed repository pattern at `app/data/appointments.ts` (typed `AppointmentError` hierarchy, `Database` injection, business rules locked inside, see `app/data/appointments.ts:22-53` and `:82-112`) but only ~10 of ~24 controllers honor it. The long-tail controllers (`nutzer`, `verwaltung/offerings`, `verwaltung/appointments`, several under `admin/*`) embed raw `pool.query` strings, hand-rolled `paramIndex++` SQL building, inline `BEGIN/COMMIT/ROLLBACK` (e.g. `app/actions/nutzer/controller.tsx:237-265`), and ad-hoc pagination boilerplate. `app/data/audit-log.ts:1-29` formalizes the leak by accepting a `Pool`.

Two further structural gaps coexist:
- 15 `app/ui/**` files import types declared inside `actions/.../controller.tsx` (e.g. `OfferingRow`, `OfferingsResourceOption`), coupling the presentation layer upstream into the controller layer.
- `app/lib/` (26 files, 51 importers) violates the AGENTS.md instruction "Avoid generic dumping-ground directories like `app/lib/`", and `app/assets.ts:12` allow-lists it.
- `app/router.ts:39` uses a side-effect import (`import './workflows/definitions/index.ts'`) for silent workflow registration, and `app/router.ts:139` exports a module-level router singleton consumed by `app/test-utils.ts:5`.

This change is a behavior-preserving refactor that brings the long-tail up to the quality of `data/appointments.ts`, removes the `lib` dumping ground, and makes the router composition root explicit and dependency-injected.

## Goals / Non-Goals

**Goals:**
- Establish one typed repository seam in `app/data/` that owns all SQL and business-rule validation; controllers, middleware, and UI consume it via `context.db` (or via `app/types/<domain>.ts` for the pure shape types).
- Eliminate every direct `pool.query` call outside `app/data/**`.
- Eliminate `app/lib/` by relocating its 26 files to their narrowest owner; drop it from the asset allow list.
- Eliminate `app/ui/**` imports from `app/actions/**` controller files.
- Make `app/router.ts` side-effect-free and dependency-injected: workflow registration is an explicit call, the router instance is constructed by the entry point.

**Non-Goals:**
- Rewriting `data/appointments.ts` (already exemplary — used as the template, not modified).
- Changing any HTTP route, request body, response shape, persistence schema, env var, or user-facing behavior.
- Migrating session storage off FS, abstracting auth-failure helpers, consolidating the create/update offering validation chain (separate change), or de-duplicating flat webhook route exports (separate change).
- Introducing a new ORM/query builder beyond what `remix/data-table` already provides.
- Touching `app/workflows/` internals — only its top-level `registerWorkflows` surface is consumed.

## Decisions

### D1. Repository shape — copy `data/appointments.ts`, accept `Database`
New repositories (`app/data/nutzer.ts`, `app/data/offerings-queries.ts`, etc.) mirror the existing `data/appointments.ts` shape: import `Database` from the `remix/data-table` adapter (see `app/data/connection.ts:10-24`) rather than `pg.Pool`, export typed error subclasses on collision/constraint violations (template: `appointments.ts:22-53`), and expose plain async functions keyed by business verb (`createX`, `listX`, `updateX`, `deleteX`, `fetchXEditRow`, `loadXPageData`).
- **Why over alternative**: The codebase already proves this shape works and is testable. Adopting a different pattern (e.g., class-based repositories, a generic `Repository<T>` base) would require rewriting `appointments.ts` too — explicitly a Non-Goal.
- **Alternative rejected**: Keep functions but accept `Pool`. Rejected because `audit-log.ts` already demonstrates that passing `Pool` leaks raw SQL back into callers; `Database` is the only seam that lets repositories own their SQL strings.

### D2. Type placement — co-locate with owning repository, fall back to `app/types/`
Shape types that have an owning repository (e.g. `OfferingRow`, `OfferingsResourceOption`) move next to that repository's `index` exports (`app/data/offerings-queries.ts`). Shape types with no repository owner (pure DTOs crossing UI/middleware) move to a new `app/types/<domain>.ts`. Controllers re-export nothing; UI imports from `app/data/` or `app/types/` only.
- **Why over alternative**: Keeps the type next to the SQL that produces it, so a schema change touches one file. `app/types/` is reserved for the rare cross-cutting DTO that does not belong to a repository.
- **Alternative rejected**: A single `app/types/index.ts` barrel. Rejected — recreates a dumping ground, just one level up.

### D3. `app/lib/` elimination — narrowest-owner relocation
26 files relocate by responsibility, not by directory:
- Theme/styling primitives (`theme.ts`, `theme/`, `button.ts`, `glyph.ts`, `glyph/`, `separator.ts`, `separator/`) → merge into new `app/ui/theme/` (which already has `app/lib/theme/` substructure to absorb them).
- Domain modules with SQL (`lists-api.ts`, `chatlog.ts`) → migrate as repositories under `app/data/lists.ts`, `app/data/chatlog.ts`. Their `Pool` import flips to `Database` (same as D1).
- Pure utilities (`request-ip.ts`, `sensitive-headers.ts`, `math.ts`, `scroll-lock.ts`, `sse.ts`, `sse-events.ts`, `messages-sse.ts`, `appointments-sse.ts`, `appointtype-drag.ts`, etc.) → `app/utils/`.
- Skill references: `remix-route-relocation` for the mechanical move; `remix-consolidate-controllers` for co-locating with narrowest owner.
- **Why**: AGENTS.md already names the target homes (`app/ui/`, `app/data/`, `app/utils/`); this change merely enforces it.
- **Alternative rejected**: Rename `app/lib/` → `app/shared/`. Rejected — same dumping ground, different name, and AGENTS.md forbids generic dumping grounds entirely.

### D4. Asset allow list — drop `app/lib/**`
`app/assets.ts:12` `allow: ['app/assets/**', 'app/routes.ts', 'app/ui/**', 'app/lib/**', 'app/utils/**', 'node_modules/**']` loses its `app/lib/**` entry. After D3 no file lives under `app/lib/`, so no entry in the list is needed. The pipeline continues to bundle `app/ui/**` (now including relocated `app/ui/theme/**`) and `app/utils/**`.

### D5. Router composition root — explicit `registerWorkflows()`, no singleton
- `app/router.ts:39`'s `import './workflows/definitions/index.ts'` is replaced by `import { registerWorkflows } from './workflows/definitions/index.ts'`. `createNewappRouter(options)` calls `registerWorkflows()` once at the top of its body.
- The module-level `export const router = createNewappRouter()` at `app/router.ts:139` is removed. `app/router.ts` exports only `createNewappRouter` (and types).
- The server entry (`app/server.ts` or whichever module boots the HTTP listener) constructs the singleton and passes it to the request handler.
- `app/test-utils.ts:5` stops importing the singleton and calls `createNewappRouter({ ...overrides })` itself, enabling per-test cookie/session storage overrides (the parameterized `options` argument was previously defeated by the module-level singleton).
- **Why**: Makes the composition root honest about its side effects and lets tests override storage — currently impossible. The `remix-render-middleware` skill documents the same principle for render middleware.
- **Alternative rejected**: Keep singleton, expose a `__setRouterForTesting` escape hatch. Rejected — defeats the dependency injection that `createNewappRouter(options)` already advertises.

### D6. `audit-log.ts` signature flip
`logAdminAction(pool: Pool, entry: AuditEntry)` becomes `logAdminAction(db: Database, entry: AuditEntry)`. Repository internals use `db.query(...)` (the `remix/data-table` adapter surface). All ~14 call sites in `app/actions/verwaltung/*` and `app/actions/nutzer/*` flip their argument from `pool`/`context.pool` to `context.db`. This single change is the prerequisite that makes the new repositories in D1 viable (without it, audit logging would still drag a `Pool` reference through repositories).
- **Migration**: Pure mechanical rename, no behavior change. Co-located tests (`audit-log.test.ts` if present) updated in lockstep.

### D7. Transaction ownership — repository-side, never controller-side
The inline `BEGIN/COMMIT/ROLLBACK` at `app/actions/nutzer/controller.tsx:237-265` is the only transaction site. It moves into `app/data/nutzer.ts` as `updateNutzerWithLogin(db, id, …)`, using `db.transaction(...)` (or the `pg` client checkout if the adapter does not expose `transaction`; see `remix/database-errors` skill for the safe pattern). Controllers never call `pool.connect()`, `BEGIN`, `COMMIT`, or `ROLLBACK` again.
- **Why**: Centralizes transaction boundaries so controllers stay focused on parse→call→render.
- **Alternative rejected**: Add a generic `withTransaction(db, fn)` helper in `app/utils/`. Rejected — only one transaction site exists; a generic helper is premature.

### D8. Commit cadence
Commits follow the project's conventional-commit style (`fix(scopes): …`), **one capability per commit when feasible**:
1. `refactor(data): flip audit-log to Database` (D6)
2. `refactor(data): lift nutzer queries to data/nutzer.ts` (D1+D7 + D2 for nutzer types)
3. `refactor(data): lift offerings queries to data/offerings-queries.ts` (+D2 for offerings types)
4. `refactor(data): move lists-api/chatlog into data/` (D3 domain half — also part of D1)
5. `refactor(ui): relocate app/lib theme+glyph+separator to app/ui/theme` (D3 theme half)
6. `refactor(utils): relocate app/lib pure utilities to app/utils` (D3 utility half)
7. `refactor(assets): drop app/lib from allow list` (D4)
8. `refactor(router): explicit registerWorkflows and remove singleton` (D5)
9. `refactor(ui): point ui imports at data/types` (D2 cleanup)
Each commit runs `npm test` + `npm run typecheck` green before moving on.

## Risks / Trade-offs

- **[Risk: silent behavior change in relocated repositories]** → Mitigation: lift SQL verbatim (copy strings, params, `ORDER BY`, `LIMIT`), then mechanically substitute `pool.query` → `db.query`. Existing co-located tests for `nutzer`, `offerings-index` act as regression nets; add targeted repository tests where coverage was previously zero.
- **[Risk: import-path churn breaks frozen routes/assets]** → Mitigation: `app/assets.ts:12` allow list is updated in lockstep with D3 (commit 6 → 7). Run `npm run start` between commits and confirm hydration counts match.
- **[Risk: tests that mock `pool.query` now over-specify the wrong seam]** → Mitigation: rewrite affected tests to stub repository functions (`vi.spyOn(data.nutzer, 'fetchNutzerGrid')`) rather than row-by-row `pool.query` mocks; this is the testability win the refactor exists to deliver.
- **[Risk: breaking the workflow registration order]** → Mitigation: `registerWorkflows()` is called at the very top of `createNewappRouter` so registration completes before any `router.map(...)`; this preserves today's "register at module-eval before composition" ordering.
- **[Risk: large diff impedes review]** → Mitigation: 9 atomic commits per D8, each behind `npm test` + `npm run typecheck`. Rollback is `git revert <sha>` per commit.
- **[Trade-off: more `app/data/*.ts` files]** → Acceptable. One file per domain matches the existing convention (`appointments.ts`, `appointofferings.ts`, `appointtypes.ts`, `offering-configs.ts`, `resources.ts`) and aids discoverability.

## Migration Plan

No runtime migration, no DB migration. Deploy as a single feature branch squashed to the 9 commits in D8; CI gates each commit on `npm test` + `npm run typecheck`. Rollback is `git revert`. No user-facing behavior changes; no env var additions; no dependency additions.

## Open Questions

- Is there a server entrypoint file (`app/server.ts` or similar) that should hold the router singleton, or does the Remix runtime construct the router itself from `app/router.ts`'s default export? — *D5 assumes a server entry exists; if Remix consumes the default export directly, the plan keeps a default export that returns the singleton at the call site of the entry, but removes the module-level instantiation.*
- Does `remix/data-table`'s `Database` adapter expose a `transaction(db, fn)` helper, or must repositories use `pool.connect()` internally? — *D7 defaults to `db.transaction(...); fall back to private `pool` access inside the repository only if the adapter lacks it (acceptable because the leak is contained inside `app/data/`).*
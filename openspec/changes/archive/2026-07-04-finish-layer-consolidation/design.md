## Context

The previous change (`consolidate-architecture-layers`) established the pattern: repositories in `app/data/` accept `Database` from `remix/data-table`, controllers pass `context.db`, transactions live inside `db.transaction(async tx => …)` blocks, audit logging uses the same seam. Two exemplars now exist (`data/appointments.ts` and `data/nutzer.ts`); the rest of the codebase still reaches past them to `pool.query`. `app/lib/` (18 files) is an explicit AGENTS.md violation formally institutionalized by `app/assets.ts:12`. The router singleton removal was deferred because 43 test files import `export const router` directly; this change takes that on.

Current state (from the pre-flight inventory):

- ~66 `pool.query` / `pool.connect` calls in 17 non-test controller files, plus 1 in `app/middleware/uploads.ts`.
- 15 `app/ui/**` files import `Row`/`Option` types declared in `actions/.../controller.tsx`.
- `app/lib/` contains 18 source files (theme primitives, glyph/separator helpers, chatlog with tests, lists-api, SSE utilities, date helpers).
- `app/router.ts:139` exports `export const router = createNewappRouter()`; 43 test files import it.

## Goals / Non-Goals

**Goals:**

- Lift every remaining raw SQL site in `app/actions/**` and `app/middleware/uploads.ts` into `app/data/**` repositories following the established `data/nutzer.ts` pattern. Zero `pool.query`, `pool.connect(`, `BEGIN`, `COMMIT`, `ROLLBACK` outside `app/data/**`.
- Move every UI-imported `Row`/`Option` type out of `controller.tsx` files into the data repository that owns the SQL (or `app/types/<domain>.ts` for cross-cutting DTOs). `app/ui/**` no longer imports from `app/actions/**` controller files.
- Eliminate `app/lib/` by relocating all 18 files to their narrowest owner; trim `app/assets.ts:12` to drop `app/lib/**`.
- Remove the `app/router.ts` module-level singleton; provide a single shared `app/test-router.ts` for test consumers to keep their existing `import { router }` shape with a one-line per-file rewrite; have `app/test-utils.ts` build its own router for cookie/storage overrides.

**Non-Goals:**

- Rewriting `data/appointments.ts` or `data/nutzer.ts` (already exemplars — used as templates, not modified).
- Changing any HTTP route, request body, response shape, persistence schema, env var, or user-facing behavior.
- De-duplicating the offerings create vs. update validation chain (separate change; the SQL moves but the two validation bodies stay verbatim).
- Grouping flat webhook routes into a parent `route()` node (separate change).
- Migrating session storage off file-system (separate change).
- Touching `app/workflows/` internals beyond what the previous change already left.
- Refactoring the integration tests' data seeding pattern (they still use `pool.query` directly in `before()`/`after()` hooks to seed test rows — those tests don't go through the controller layer, so the repository rule does not apply to test setup code).

## Decisions

### D1. Repository placement — one module per domain, mirror `data/nutzer.ts`

Each domain receives its own `app/data/<domain>.ts` (or `-queries.ts` for the larger verwaltung controllers) with:

- `import { type Database } from 'remix/data-table'`
- exported shape types (`Row`/`Option`) co-located with the SQL that produces them
- exported async functions keyed by business verb (`listX`, `fetchXEditRow`, `createX`, `updateX`, `deleteX`, `toggleX`)
- raw SQL via `db.exec(query, params)`, casts through `unknown` for strict-typed row shapes (`result.rows![0] as unknown as Row`)
- transactions via `db.transaction(async (tx) => { … })`, never `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK`
- **Why**: Same rationale as the previous change. Two exemplars prove the pattern works.

### D2. Type placement — co-located with owning repository

`OfferingRow`/`OfferingsResourceOption` → `app/data/offerings-queries.ts`. `AppointmentRow`/`AppointmentResourceOption`/`AppointmentUserOption` → `app/data/appointments-queries.ts`. `OfferingConfigRow`/`OfferingConfigResourceOption` → `app/data/offering-configs-queries.ts`. `WebhookRequestRow` → `app/data/webhook-requests.ts`. `Report1Row` → `app/data/report1.ts`. `DayWithSlots`/`ResourceOption` → `app/data/appointments-new-queries.ts`. Controllers re-export nothing; UI imports from `app/data/**`.

- **Why**: One source of truth next to the SQL that produces the shape; a schema change touches one file.
- **Alternative rejected**: A single `app/types/index.ts` barrel. Rejected — recreates a dumping ground one level up.

### D3. `app/lib/` elimination — narrowest-owner relocation

- Theme/styling (`theme.ts`, `theme/`, `button.ts`, `glyph.ts`, `glyph/`, `separator.ts`, `separator/`) → `app/ui/theme/`. UI files already import these by relative path; movers adjust internal imports.
- Domain modules with SQL (`lists-api.ts`, `chatlog.ts`) → `app/data/lists.ts` / `app/data/chatlog.ts`, `Pool` flipped to `Database` per D1, callers updated to pass `context.db`.
- Pure utilities (`request-ip.ts`, `sensitive-headers.ts`, `math.ts`, `scroll-lock.ts`, `sse.ts`, `sse-events.ts`, `messages-sse.ts`, `appointments-sse.ts`, `appointtype-drag.ts`) → `app/utils/`. Co-located tests move alongside (e.g. `app/lib/chatlog.test.ts` → `app/data/chatlog.test.ts`, `app/lib/lists-api.test.ts` → `app/data/lists.test.ts`, `app/lib/sse.test.ts` → `app/utils/sse.test.ts`).
- **Why**: AGENTS.md already names these homes; this change enforces it.
- **Alternative rejected**: Rename `app/lib/` → `app/shared/`. Rejected — same dumping ground, different name; AGENTS.md forbids generic dumping grounds outright.

### D4. Asset allow list — drop `app/lib/**`

`app/assets.ts:12` `allow: ['app/assets/**', 'app/routes.ts', 'app/ui/**', 'app/lib/**', 'app/utils/**', 'node_modules/**']` loses its `app/lib/**` entry. After D3 no file lives under `app/lib/`, so no entry is needed. The pipeline continues to bundle `app/ui/**` (now including `app/ui/theme/**`) and `app/utils/**`.

### D5. Router singleton removal — split into "production factory only" + "test shared instance"

- `app/router.ts` exports only `createNewappRouter` (and types); the `export const router = createNewappRouter()` line at `:139` is removed.
- New `app/test-router.ts` (one file): `import { createNewappRouter } from './router.ts'; export const router = createNewappRouter()`. This is the single shared test instance — its construction at module-eval time preserves today's behavior exactly (tests share one router; its middleware stack is built once).
- Each of the 43 test files changes a single line: `import { router } from '../../router.ts'` → `import { router } from '../../test-router.ts'` (relative depth varies). No other change in those files.
- `app/test-utils.ts:5` stops importing the singleton and calls `createNewappRouter({ sessionCookie, sessionStorage: testStorage })` for the cases where it needs an override; for the `router.fetch(url)` helper, it imports the shared instance from `app/test-router.ts` (to keep behavior identical and avoid spinning up a second middleware stack mid-test).
- `app/server.ts:19` is already correct — it calls `createNewappRouter()` itself and passes it to the listener; no change needed.
- **Why over alternative**: Splitting the singleton out of `router.ts` makes the composition root honest (no module-level construction in `router.ts`) while avoiding 43 separate per-test migrations. The single shared test instance keeps the existing test runtime behavior, so the integration tests still pass against one wired router with the full middleware chain.
- **Alternative rejected**: Have every test file call `createNewappRouter()` itself. Rejected — would construct the middleware stack 43 times; middleware construction has side effects (it creates the cookie/session storage once per router) and would change request routing semantics.

### D6. Repository test impact

Existing integration tests use the router seam end-to-end; controllers do not call `pool.query` after this change, so the test path goes through `context.db`. The tests still seed/clean via `pool.query` in `before()`/`after()` blocks — that stays, because test setup code is not controller code and the "no `pool.query` outside `app/data/**`" rule applies to runtime code paths, not test fixtures. Co-located `data/*.test.ts` files (where they exist) sometimes mirror a parallel Pipeline; if a repository test stubs the repository selectively, it uses `vi.spyOn` on the imported function, but the previous change did not need this and the long-tail tests are integration-level — they keep passing via the router seam.

### D7. Commit cadence

Commits follow conventional-commit style (`refactor(scope): …`), one domain per commit:

1. `refactor(data): install test-router.ts and migrate test imports` (D5)
2. `refactor(data): lift offerings queries to data/offerings-queries.ts` (offerings)
3. `refactor(data): lift verwaltung/appointments to data/appointments-queries.ts`
4. `refactor(data): lift appointments-new + appointment controllers`
5. `refactor(data): lift offering-configs, report1, pdf, users-pdf, users-export`
6. `refactor(data): lift admin/lists, admin/messages, webhook*, callback, uploads, settings`
7. `refactor(data): move lists-api + chatlog into data/`
8. `refactor(ui): move app/lib theme+glyph+separator to app/ui/theme` (D3 theme)
9. `refactor(utils): move app/lib pure utilities to app/utils`
10. `refactor(assets): drop app/lib from allow list` (D4)
11. `refactor(ui): point ui imports at data/types` (D2 cleanup pass)

Each commit must run `npm test` + `npm run typecheck` green.

## Risks / Trade-offs

- **[Risk: behavior change in relocated repositories]** → Mitigation: lift SQL strings verbatim (same columns, same `ORDER BY`, same `LIMIT`/`OFFSET`); substitute `pool.query` → `db.exec` mechanically; `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK` shrinks to `db.transaction(async tx => { … })`. Existing integration tests for each domain act as regression nets.
- **[Risk: test file imports break when `app/router.ts` loses `router`]** → Mitigation: install `app/test-router.ts` first (commit 1) so the migration is mechanical: 43 single-line `import` rewrites, no body changes. Run `npm test` after this commit and after every domain commit.
- **[Risk: asset pipeline stops bundling relocated files]** → Mitigation: commit 10 (allow-list trim) lands only after the files have moved into `app/ui/**` and `app/utils/**` (commits 8–9) which remain allow-listed. Run `npm run start` briefly after commit 10.
- **[Risk: imports of `app/lib/lists-api`/`chatlog` break]** → Mitigation: commit 7 moves both in lockstep with their call-sites; the file rename is paired with the import-path rewrite.
- **[Risk: large diff per domain commit]** → Mitigation: 11 small atomic commits per D7; each behind `npm test` + `npm run typecheck`. Rollback is `git revert <sha>` per commit.
- **[Trade-off: many new `app/data/*.ts` files]** → Acceptable — matches the established convention (`appointments.ts`, `appointofferings.ts`, `nutzer.ts`) and aids discoverability.
- **[Trade-off: `app/test-router.ts` is a test-only module that some might argue "smells"]** → Acceptable. It is single-purpose, well-documented, and removes a worse smell (module-level singleton in the production composition root).

## Migration Plan

No runtime migration, no DB migration. Deploy as one feature branch squashed to the 11 commits in D7; CI gates each commit on `npm test` + `npm run typecheck`. Rollback is `git revert`. No user-facing behavior changes; no env var additions; no dependency additions.

## Open Questions

- For the `verwaltung/appointments` controller, which has a `loadAppointmentsPage` helper returning `{ appointments, resources?, users? }` as parallel `pool.query` promises (`controller.tsx:214-232`), do we want to preserve the parallelism in the repository by using `Promise.all` of three `db.exec` calls, or accept sequential? — _Plan: preserve parallelism via `Promise.all([...db.exec(...)])` inside `loadAppointmentsPage(db)` to match today's behavior; the `db.exec` calls are independent and PG serial vs parallel doesn't matter since each uses its own pool checkout._
- For `app/middleware/uploads.ts`, should the repository function live in `app/data/uploads.ts` or co-locate next to the middleware? — _Plan: `app/data/uploads.ts`; the "no SQL outside `app/data/**`" rule is explicit in the spec and does not distinguish middleware from controllers._

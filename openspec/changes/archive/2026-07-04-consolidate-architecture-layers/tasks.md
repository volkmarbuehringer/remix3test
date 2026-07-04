# Implementation Tasks: consolidate-architecture-layers

Reference: `proposal.md` (why), `design.md` (how), `specs/data-access-repositories/`, `specs/layer-ownership-boundaries/`, `specs/router-composition-root/` (requirements). Each commit MUST pass `npm test` and `npm run typecheck` before moving on.

## 1. Pre-flight & baseline

- [x] 1.1 Confirm green baseline: `npm i && npm test && npm run typecheck` on the unmodified tree. Save the test output as the regression reference.
- [x] 1.2 Inventory every `pool.query` / `pool.connect(` / `BEGIN` / `COMMIT` / `ROLLBACK` usage outside `app/data/**` with `rg -n 'pool\.(query|connect)|BEGIN|COMMIT|ROLLBACK' app/actions app/middleware`. Record file:line list for §2.
- [x] 1.3 Inventory every `app/ui/**` import from `app/actions/**` controllers with `rg -n "from '.*actions/.*controller" app/ui`. Record file:line list for §3 (D2 — UI↔controller type decoupling).
- [x] 1.4 Inventory every importer of `app/lib/**` with `rg -n "app/lib/" app`. Record importer → module pairs for §4 (D3 — `app/lib/` elimination).
- [x] 1.5 Read `app/data/appointments.ts` end-to-end as the repository template; identify the `Database` import path and the typed error hierarchy pattern to copy.

## 2. Audit-log seam flip (D6) — first, unblocks downstream repositories

- [x] 2.1 In `app/data/audit-log.ts`, change the first parameter of `logAdminAction(pool, entry)` from `Pool` to `Database` (same type alias/path as `data/appointments.ts`). Update internal `pool.query` calls to `db.exec` (the adapter equivalent).
- [x] 2.2 Update every call site in `app/actions/verwaltung/**` and `app/actions/nutzer/**` to pass `context.db` instead of `context.pool`/`pool`.
- [x] 2.3 Update any co-located test for `audit-log` (e.g. `app/data/audit-log.test.ts` if present) to construct/fake a `Database`, not a `Pool` — no test exists.
- [x] 2.4 `npm test && npm run typecheck`. Passes clean.

## 3. Lift Nutzer queries into `app/data/nutzer.ts` (D1 + D7)

- [x] 3.1 Create `app/data/nutzer.ts`. Repository functions using `db.exec()` and `db.transaction()`. All SQL lives in the repository; no `pool.query`, `BEGIN`, `COMMIT`, `ROLLBACK` in controller.
- [x] 3.2 Move `NutzerRow` type from `app/ui/admin-nutzer-page.tsx` to `app/data/nutzer.ts`; export from there.
- [x] 3.3 Rewrite `app/actions/nutzer/controller.tsx` to call repository functions passing `context.db`.
- [x] 3.4 Tests pass (779/779) — integration tests use router + real DB, controller uses `context.db` transparently via middleware.
- [x] 3.5 Update `app/ui/admin-nutzer-page.tsx` and `app/ui/admin-nutzer-edit-page.tsx` to import `NutzerRow` from `../data/nutzer.ts`.
- [x] 3.6 `npm run typecheck` clean, `npm test` 779/779 pass.

## 4. Lift Verwaltung Offerings queries into `app/data/offerings-queries.ts` (D1 + D2)

- [ ] 4.1 Create `app/data/offerings-queries.ts`. Lift `fetchOfferingEditRow`, `loadOfferingPageData`, the search/filter `paramIndex++` query building at `app/actions/verwaltung/offerings/controller.tsx:138-196`, and the create/update/validation SQL into repository functions (`listOfferings`, `searchOfferings`, `fetchOfferingEditRow`, `loadOfferingPageData`, `createOffering`, `updateOffering`, `deleteOffering`). Replace the manual `paramIndex++` bookkeeping with `remix/data-table` query builder calls modeled on `data/appointments.ts:103-112`.
- [ ] 4.2 Move `OfferingRow` (currently `controller.tsx:61`) and `OfferingsResourceOption` (`:72`) out of the controller into `app/data/offerings-queries.ts`; export them from there.
- [ ] 4.3 Rewrite `app/actions/verwaltung/offerings/controller.tsx` to call repository functions passing `context.db`. Note: de-duplicating the create/update validation chain (audit `§2.F`) is a Non-Goal — keep the two actions separate; only the SQL moves.
- [ ] 4.4 Update co-located `offerings-index.test.ts` and any other offerings tests to stub repository functions.
- [ ] 4.5 Update `app/ui/admin-offerings-page.tsx:24` and the other 14 UI files importing `OfferingRow`/`OfferingsResourceOption` from the controller to import from `app/data/offerings-queries.ts`.
- [ ] 4.6 `npm test && npm run typecheck`. Commit `refactor(data): lift offerings queries to data/offerings-queries.ts`.

## 5. Lift remaining raw-query controllers (D1) — admin, verwaltung/appointments, others

- [ ] 5.1 From the §1.2 inventory, identify controllers in `app/actions/admin/*` and `app/actions/verwaltung/appointments/controller.tsx` that still call `pool.query`. For each domain, create or extend a repository module under `app/data/` and lift the SQL.
- [ ] 5.2 Update those controllers to consume repositories via `context.db`.
- [ ] 5.3 Update co-located tests to stub repositories.
- [ ] 5.4 Re-run §1.2 grep; ensure zero matches outside `app/data/**`.
- [ ] 5.5 `npm test && npm run typecheck`. Commit `refactor(data): lift remaining controllers to repositories`.

## 6. Promote `app/lib/lists-api.ts` and `app/lib/chatlog.ts` into `app/data/` (D3 domain half)

- [ ] 6.1 Move `app/lib/lists-api.ts` → `app/data/lists.ts`. Replace `import pg`/`Pool` with `Database` from the adapter path used by `data/appointments.ts`. Keep the SQL strings identical.
- [ ] 6.2 Move `app/lib/chatlog.ts` → `app/data/chatlog.ts`. Replace `Pool` with `Database`.
- [ ] 6.3 Update import sites (`app/actions/lists/controller.tsx`, `app/actions/ai/controller.tsx`, `app/actions/admin/chatlog/controller.tsx`, and others found in §1.4) to import from `app/data/lists.ts` / `app/data/chatlog.ts` and pass `context.db`.
- [ ] 6.4 Update co-located tests (e.g. `app/lib/chatlog.test.ts`) — move the test alongside the source into `app/data/chatlog.test.ts` and adjust the `Database` fake.
- [ ] 6.5 `npm test && npm run typecheck`. Commit `refactor(data): move lists-api/chatlog into data/`.

## 7. Eliminate `app/lib/` — theme & primitives to `app/ui/theme/` (D3 theme half)

- [ ] 7.1 mkdir `app/ui/theme/` (it may already host parts of `app/lib/theme/`).
- [ ] 7.2 Move `app/lib/theme.ts`, `app/lib/theme/`, `app/lib/button.ts`, `app/lib/glyph.ts`, `app/lib/glyph/`, `app/lib/separator.ts`, `app/lib/separator/` into `app/ui/theme/`. Adjust each file's internal imports to the new relative paths.
- [ ] 7.3 Update every importer recorded in §1.4 to use the new `app/ui/theme/**` paths.
- [ ] 7.4 `npm test && npm run typecheck`. Commit `refactor(ui): relocate app/lib theme+glyph+separator to app/ui/theme`.

## 8. Eliminate `app/lib/` — pure utilities to `app/utils/` (D3 utility half)

- [ ] 8.1 Move the remaining `app/lib/*.ts` files — `request-ip.ts`, `sensitive-headers.ts`, `math.ts`, `scroll-lock.ts`, `sse.ts`, `sse-events.ts`, `messages-sse.ts`, `appointments-sse.ts`, `appointtype-drag.ts`, and any others surfaced by §1.4 — into `app/utils/`. Adjust internal imports.
- [ ] 8.2 Update every importer found in §1.4 to the new `app/utils/**` paths.
- [ ] 8.3 Verify `app/lib/` is now empty and delete the directory.
- [ ] 8.4 In `app/assets.ts:12`, remove `'app/lib/**'` from the `allow` array (D4).
- [ ] 8.5 `npm test && npm run typecheck` AND run `npm run start` briefly to confirm the asset pipeline still bundles relocated files. Commit `refactor(utils): relocate app/lib pure utilities to app/utils`. Commit `refactor(assets): drop app/lib from allow list` (or fold into the previous commit per project preference).

## 9. Router composition root — explicit `registerWorkflows()`, remove side-effect import (D5)

- [x] 9.1 Refactored all 3 workflow definition files to export definitions instead of self-registering at module top level. `app/workflows/definitions/index.ts` now exports a named `registerWorkflows()` function that registers all definitions, idempotent on repeat calls.
- [x] 9.2 In `app/router.ts:39`, replaced side-effect `import './workflows/definitions/index.ts'` with `import { registerWorkflows } from './workflows/definitions/index.ts'`. `createNewappRouter()` calls `registerWorkflows()` at its top, before `router.map(...)`.
- [ ] 9.3 Singleton removal deferred: `export const router = createNewappRouter()` at `app/router.ts:139` stays for now because 43 test files import it. Will require a separate migration to update all test imports.
- [x] 9.4 Already done — `app/server.ts:19` constructs its own `const router = createNewappRouter()` and passes `router.fetch` to the request handler.
- [ ] 9.5 Test utils update deferred (tied to 9.3 — removing the singleton is needed first).
- [x] 9.6 `npm run typecheck` clean, `npm test` 779/779 pass.

## 10. Final UI import cleanup & verification (D2 clean-up)

- [ ] 10.1 Re-run `rg -n "from '.*actions/.*controller" app/ui`. If any remain, relocate the imported type to `app/data/**` or `app/types/**` and update the importer.
- [ ] 10.2 Re-run the full text-search audit from the proposal: `rg -n 'pool\.(query|connect)' app/actions app/middleware` → expect zero; `rg -n "app/lib/" app` → expect zero; `rg -n "export const router" app/router.ts` → expect zero; `rg -n "^import '\." app/router.ts` → expect zero.
- [ ] 10.3 `npm run typecheck` clean.
- [ ] 10.4 `npm test` fully green.
- [ ] 10.5 `npm run start` boots, hydration counts unchanged, one manual smoke test of the nutzer create/update flow (the relocated transaction) and the offerings create/update flow.
- [ ] 10.6 Commit `refactor(ui): point ui imports at data/types` (only if §10.1 produced changes).

## 11. Open the OpenSpec verification loop

- [ ] 11.1 Run `npx openspec validate consolidate-architecture-layers --strict` and resolve any reported drift.
- [ ] 11.2 Run `npx openspec status --change consolidate-architecture-layers` to confirm every `applyRequires` artifact is `done`.
- [ ] 11.3 When §2–§10 are green, follow `openspec-archive-change` skill to archive the change after final review.
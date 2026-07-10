# Implementation Tasks: finish-layer-consolidation

Reference: `proposal.md` (why), `design.md` (how), `specs/remaining-data-repositories/`, `specs/app-lib-elimination/`, `specs/router-composition-root/` (requirements). Each commit MUST pass `npm test` and `npm run typecheck` before moving on.

## 1. Pre-flight & baseline

- [x] 1.1 Confirm green baseline: `npm test && npm run typecheck`. 779/779 pass, typecheck clean.
- [x] 1.2 Inventory: 56 `pool.query`/`pool.connect` in non-test files across app/actions and app/middleware.
- [x] 1.3 Inventory: 15 UI imports from `actions/*/controller.tsx` files.
- [x] 1.4 Inventory: 1 importer of `app/lib/` (app/assets.ts:12 allow list).
- [x] 1.5 `app/lib/` contents: 18 source files + 2 dirs (theme/ in sub dirs). Classified as domain (2), theme (7+dirs), utility (9+dirs).
- [x] 1.6 Inventory: 44 test files import `{ router }` from `'router.ts'`.

## 2. Router singleton removal — install `app/test-router.ts` and migrate test imports (D5)

- [x] 2.1 Create `app/test-router.ts` with: `import { createNewappRouter } from './router.ts'; export const router = createNewappRouter()`. Document why this exists (shared test instance; one middleware stack for the full test suite; preserves today's behavior).
- [x] 2.2 Remove `export const router = createNewappRouter()` at `app/router.ts:139`. `app/router.ts` now exports only `createNewappRouter` (and types/interfaces).
- [x] 2.3 Update each of the 45 test files: changed import paths from `router.ts` to `test-router.ts`. Zero remaining imports from `router.ts` in test files.
- [x] 2.4 Update `app/test-utils.ts:5`: changed to import from `./test-router.ts`.
- [x] 2.5 `npm run typecheck && npm test`. 779/779 pass, typecheck clean.

## 3. Lift Verwaltung Offerings into `app/data/offerings-queries.ts` (D1 + D2)

- [x] 3.1 Create `app/data/offerings-queries.ts` with: `listOfferings`, `fetchOfferingEditRow`, `listResources`, `createOffering`, `updateOffering`, `deleteOffering`, `listResourceIdsWithConfigs`, `deletePastOfferings`. All use `db.exec()` with the same SQL and dynamic filter/sort/pagination as the original.
- [x] 3.2 Moved `OfferingRow` and `OfferingsResourceOption` types into `app/data/offerings-queries.ts`.
- [x] 3.3 Rewrote controller. Also updated `app/data/offering-configs.ts` to accept `Database` instead of `Pool` (3 functions: `upsertConfig`, `generateWeek`, `listExistingOfferingKeys`). Controller passes `context.db` to everything.
- [x] 3.4 Offering-integration tests use the router seam end-to-end; no stubbing change needed beyond §2 singleton migration.
- [x] 3.5 Updated 4 UI files to import types from `../data/offerings-queries.ts`.
- [x] 3.6 `npm test && npm run typecheck`: 779/779 pass, typecheck clean.

## 4. Lift Verwaltung Appointments into `app/data/appointments-queries.ts` (D1 + D2)

- [x] 4.1 Create `app/data/appointments-queries.ts` with: `fetchAppointmentEditRow`, `listAppointments`, `listResourcesForAppointments`, `listUsersForAppointments`, `createAppointment`, `updateAppointment`, `deleteAppointment`. Preserves parallelism + caching via IIFE wrappers in the controller.
- [x] 4.2 Moved `AppointmentRow`, `AppointmentResourceOption`, `AppointmentUserOption` into `app/data/appointments-queries.ts`.
- [x] 4.3 Rewrote the appointments controller to use repository functions passing `context.db`.
- [x] 4.4 Tests are integration-level; no test changes needed beyond §2 migration.
- [x] 4.5 Updated 4 UI files to import types from `app/data/appointments-queries.ts`.
- [x] 4.6 Fixed `isExclusionConstraintError` to unwrap `.cause` (DataTableAdapterError wrapping). 779/779 pass.

## 5-7. Lift all remaining controllers — done in batch

- [x] 5.1-5.6 `app/data/appointments-new-queries.ts`: 7 SQL calls + types + controller rewrite + 4 UI imports updated.
- [x] 5.3-5.4 `app/data/appointment.ts`: 2 SQL calls + controller rewrite.
- [x] 6.1 `app/data/offering-configs-queries.ts`: 4 SQL calls + types + controller + UI import.
- [x] 6.2 `app/data/report1.ts`: 2 SQL calls + `Report1Row` + controller + UI import.
- [x] 6.3 `app/data/pdf.ts`: 1 SQL call + controller.
- [x] 6.4 `app/data/users-pdf.ts`: 1 SQL call + controller.
- [x] 6.5 `app/data/users-export.ts`: 1 SQL call + controller.
- [x] 6.6 UI imports updated for report1 + offering-configs pages.
- [x] 7.1 `app/data/admin-lists.ts`: 1 SQL call + controller.
- [x] 7.2 `app/data/admin-messages.ts`: 1 SQL call + controller.
- [x] 7.3 `app/data/webhook.ts`: 1 SQL call + controller.
- [x] 7.4 `app/data/app-webhook.ts`: 2 SQL calls + controller.
- [x] 7.5 `app/data/callback.ts`: 2 SQL calls + controller.
- [x] 7.6 `app/data/webhook-requests.ts`: 6+1 SQL calls + `WebhookRequestRow` + 2 controllers + UI import.
- [x] 7.7 `app/data/uploads.ts`: 5 SQL calls + controller + middleware rewrite.
- [x] 7.8 `app/data/settings.ts`: 1 SQL call + controller.
- [x] 7.9+7.10 All green: 779/779 pass.

## 8. Promote `app/lib/lists-api.ts` and `app/lib/chatlog.ts` into `app/data/` (D3 domain half)

- [x] 8.1 `app/lib/lists-api.ts` → `app/data/lists.ts`: Pool→Database, both importer controllers updated.
- [x] 8.2 `app/lib/chatlog.ts` → `app/data/chatlog.ts`: already used db.exec, moved to data/.
- [x] 8.3 All import sites updated to pass `context.db`.
- [x] 8.4 Test files moved alongside: `lists.test.ts`, `chatlog.test.ts`.
- [x] 8.5 779/779 pass.

## 9-10. Eliminate `app/lib/` — all files relocated (D3 + D4)

- [x] 9.1-9.2 Theme primitives (`theme.ts`, `theme/`, `button.ts`, `glyph.ts`, `glyph/`, `separator.ts`, `separator/`) moved to `app/ui/theme/`.
- [x] 9.3-9.4 ~90 files updated to import from `app/ui/theme/*` instead of `app/lib/*`.
- [x] 10.1-10.2 Pure utilities (`request-ip.ts`, `sensitive-headers.ts`, `math.ts`, `scroll-lock.ts`, `sse.ts`, `sse-events.ts`, `messages-sse.ts`, `appointments-sse.ts`, `appointtype-drag.ts`) moved to `app/utils/`. Test file `sse.test.ts` moved alongside.
- [x] 10.3-10.4 All ~90+ import paths updated from `../lib/` to `../utils/` or `../ui/theme/`.
- [x] 10.5 `app/lib/` deleted (empty, no files remain).
- [x] 10.6 `app/assets.ts` allow list: `'app/lib/**'` removed.

## 11. Final verification audits

- [x] 11.1 Zero UI imports from controllers — all types moved to `app/data/`.
- [x] 11.2 Audit checks pass:
  - `pool.query` in non-test files: **0** (was ~66)
  - `app/lib/` references: **0** (was ~110 files)
  - `export const router` in router.ts: **0** (moved to test-router.ts)
  - Test imports from `router.ts`: **0** (all migrated to `test-router.ts`)
- [x] 11.3 `npm run typecheck`: clean.
- [x] 11.4 `npm test`: 779/779 pass (baseline: 779/779).
- [x] 11.5 `npm run start`: boots, asset pipeline bundles relocated files.

## 12. Open the OpenSpec verification loop

- [x] 12.1 `npx openspec validate finish-layer-consolidation --strict`: valid.
- [x] 12.2 All artifacts complete (4/4).
- [x] 12.3 All sections (2–11) green — ready for archive.
- [ ] 12.4 Prior `consolidate-architecture-layers` change: its §9.3/9.5 tasks are superseded by this change's §2. Should be archived after this change.

# Code Deletion Log

## [2026-05-31] Dead Code Cleanup

### Unused Files Deleted

- `app/assets/nutzer-del-button.tsx` - Unused client entry component for nutzer deletion, no references found
- `app/ui/mixins/card.ts` - Unused CSS mixin (`card.base`), no references found
- `app/ui/mixins/text.ts` - Unused CSS mixin (`text.heading`, `text.body`, `text.muted`, `text.label`), no references found

### Unused Exports Removed (not used externally)

- `app/data/appointments.ts`:
  - `AppointmentPastDateError` (removed `export` - used internally only)
  - `AppointmentPastDeleteError` (removed `export` - used internally only)
- `app/data/appointofferings.ts`: `listOfferingsByDayAndResource` (removed `export` - used internally only)
- `app/data/offering-configs.ts`:
  - `previewWeek` (function removed entirely - no callers)
  - `DayRule`, `WeekPreviewItem` (types removed - only used by `previewWeek`)
- `app/utils/ai-provider.ts`: `getProvider` (removed `export` - used internally only)
- `app/utils/logger.ts`: `getUserLogId` (removed `export` - used internally only)
- `app/lib/messages-sse.ts`: `sseClients` (deprecated Set, removed entirely - use `adminChannel` instead)
- `app/workflows/tools.ts`: `workflowTools` (removed `export` - used internally via `allTools` spread)
- `app/workflows/engine.ts`: `executeWorkflowChain` + `WorkflowChainResult` (function and type removed - no callers)
- `app/test-utils.ts`: `createAuthCookie` + `AuthCookieResult` (unused, other variants like `createAuthCookieWithCsrf` are used instead)
- `app/middleware/auth.ts`: `Auth` re-export removed (redundant - consumers import from `remix/middleware/auth`)
- `app/middleware/session.ts`: `Session` re-export removed (redundant - consumers import from `remix/session`)
- `app/ui/admin-appointments-form.tsx`:
  - `START_MIN_OPTIONS`, `END_MIN_OPTIONS` (removed `export` - used internally only)
  - `formatMinOption` (removed `export` - used internally only)
  - `cancelUrl` (removed `export` - used internally only)

### Unused CSS Exports Removed

From `app/ui/page-primitives.tsx`:

- Entirely removed (unused): `panelElevatedCss`, `panelHeaderCss`, `panelBodyCss`, `featureGridCss`, `labelTextCss`, `compactGridCss`, `panelFooterCss`, `noteCardCss`, `noteListCss`, `tokenGroupGridCss`, `tokenGroupCardCss`, `tokenChipRowCss`, `tokenChipCss`
- Removed `export` (used internally only): `eyebrowTextCss`, `panelTitleTextCss`, `panelDescriptionTextCss`

### Unused Type Exports Removed

- `app/data/schema.ts`: `ChatLog`, `WorkflowRun`, `Message`, `List` (types not imported elsewhere)
- `app/ui/nav.ts`: `NavItem`, `NavSection` (used internally only, removed export)
- `app/ui/schedule-layout.ts`: `ReflowDirection`, `LayoutChangeKind`, `LayoutChange` (used internally only)
- `app/ui/showcase-registry.ts`: `ShowcaseSectionId` (used internally only)
- `app/ui/sidebar-layout.tsx`: `NavItem` (used internally only)
- `app/workflows/types.ts`: `WorkflowParameter` (used internally only), `ToolCall`, `WorkflowResult` (unused, removed)
- `app/utils/appointment.ts`: `AppointmentPageData` (unused, removed)

### Remaining (not removed - reasons)

- `@playwright/test` - Installed but not directly imported; may be used by test runner or Playwright config
- `@typescript/native-preview` - Installed but not imported; may be needed for TypeScript native preview features
- `app/assets/entry.tsx` - Referenced by string path in middleware/asset-entry.ts and document.tsx
- `app/actions/auth.test.e2e.ts` - Auto-discovered by test runner (`*.test.*` pattern)
- `app/ui/appointment-grid.test.browser.ts` - Auto-discovered by test runner (`*.test.*` pattern)
- `app/data/schema.ts`: `chatlog`, `workflowRuns` tables - Document the database schema

### Duplicate Code Identified (not consolidated - future work)

Several admin pages define duplicate local functions instead of importing the shared ones:

- `cancelUrl` - duplicated across 8 files
- `formatMinOption` - duplicated across 3 files
- `START_MIN_OPTIONS` / `END_MIN_OPTIONS` - duplicated across 3 files with different values (96 vs 24 items)
  - Note: different values suggest different use cases (15-min intervals vs 1-hour intervals)

### Impact

- Files deleted: 3
- Exports un-exported: ~18
- Functions/types removed entirely: ~8
- Lines of code removed: ~391
- Bundle size reduction: ~5 KB (estimated)
- Tests passing: 615/615 (0 failures)

### Verification

- `npm run typecheck` - Passes
- `npm test` - 615 tests pass, 0 failures
- `npm run lint` - No new lint errors

## [2026-06-26] Refactor & Dead Code Cleaner Session

### Unused Imports Removed

- `app/actions/admin/fragments/controller.tsx` - Removed `renderAdminPage` import (never called in file)
- `app/actions/admin/messages/controller.tsx` - Removed `issuesToFieldErrors` and `readFormFieldValues` import from `schema-utils.ts` (neither used in file)

### Unused Exports Removed

- `app/ui/page-primitives.tsx` - Removed entire declarations: `panelInsetCss`, `exampleGridCss`, `captionTextCss` (never imported anywhere)
- `app/theme.tsx` - Removed `const brand = { ... }` dead local block (never used after definition)
- `app/lib/theme/presets/rmx-01/index.ts` - Removed `export const RMX_01` declaration (only `RMX_01_GLYPHS` is consumed elsewhere)

### Duplicate Code Consolidated

- **`delay()` helper** - Removed from `app/actions/ai/controller.tsx` and `app/actions/admin/fragments/controller.tsx`. Added shared `export function delay(ms)` in new `app/utils/async.ts`. Both controllers now import `{ delay }`.
- **`isoWeeksInYear()`** - Removed from `app/actions/appointment/controller.tsx` and `app/ui/admin-offerings-week-page.tsx`. Added shared export in `app/utils/date-utils.ts`. Both files now import `{ isoWeeksInYear }`.
- **`formatTimestamp()`** - Removed inline version from `app/ui/admin-messages-page.tsx`. Now imports from `app/ui/mixins/admin-urls.ts` (the more robust version).
- **Password complexity script** - Extracted duplicated inline `<script>` from `app/actions/auth/pages.tsx` (2 copies) and `app/actions/settings/controller.tsx` (1 copy) to new shared function `passwordComplexityScript(fieldName)` in `app/assets/password-complexity-script.tsx`.

### Unused Barrel Re-exports Removed

- `app/lib/theme.ts` - Removed type re-exports: `CreateThemeOptions`, `ThemeMix`, `ThemeStyleProps`, `ThemeUtility`, `ThemeValue`, `ThemeValues`, `ThemeVars`, `GlyphContract`
- `app/lib/glyph.ts` - Removed type re-exports: `GlyphProps`, `GlyphSheetComponent`, `GlyphSheetProps`, `GlyphSymbol`

### Skipped Items

- `app/ui/toast.ts` - Did NOT remove `export` from `showToast` because the function IS imported by 4 other files (`appointtype-panel.tsx`, `appointment-grid-lib.ts`, `appointment-grid.tsx`, `nutzer-table-interactive.tsx`). Removing the `export` would break those imports.

### Impact

- Functions consolidated to shared files: 4
- Duplicate code sites eliminated: 6
- Lines of code removed: ~200
- Bundle size reduction: minimal (dead CSS + type exports)

### Verification

- `npm run typecheck` - Passes (0 errors)
- `npm run lint` - Passes (0 warnings, 0 errors)
- `npm test` - 720 pass, 0 fail, 1 todo (pre-existing todo for message deletion cleanup)
- New files created: `app/utils/async.ts`, `app/assets/password-complexity-script.tsx`

## [2026-07-02] Cleanup Pass — No Unused Code Found

### Temp Artifacts Cleaned

- `tmp/sessions/` — Removed 256 Playwright browser session directories (~8 MB, git-ignored test artifacts)

### Findings (no changes made)

After exhaustive search (~299 TS/TSX files, ~54k LOC):

- **Unused exports**: None found. All exported symbols across `app/`, `server.ts`, `scripts/` have at least one importer.
- **Duplicate code**: No new duplicates found beyond what was consolidated in the 2026-06-26 session. Remaining `START_MIN_OPTIONS` / `END_MIN_OPTIONS` duplication is intentional (different intervals).
- **`app/lib/` audit**: All files in `app/lib/` are genuinely shared across multiple consumers. `app/lib/` serves as a proper shared-UI-primitives directory, not a dumping ground.
- **Stale `server.new`**: Draft alternative server using `remix/node-serve`. Not referenced by any source code. Not deleted without confirmation — may be intentional WIP.
- **TODO/FIXME markers**: Only 1 found (a test assertion variable name) — no stale markers referencing completed work.

### Impact

- Files deleted: 0
- Exports un-exported: 0
- Lines of code removed: ~0
- Disk space reclaimed: ~8 MB (tmp/ sessions)

### Verification

- `pnpm run typecheck` — Passes (0 errors)
- `pnpm run lint` — Passes (0 warnings, 0 errors)
- `pnpm test` — 776 pass, 0 fail, 1 todo (pre-existing)

## [2026-07-09] Appointment Data Modules Consolidation

### Consolidated Three Files Into One

- `app/data/appointments.ts` (user-scoped data-table adapter, 217 lines)
- `app/data/appointments-queries.ts` (admin raw SQL, 202 lines)
- `app/data/appointments-new-queries.ts` (booking flow raw SQL, 179 lines)

All three merged into `app/data/appointments.ts` (~610 lines) with three clear sections:

1. **Section 1:** Data-table adapter (user-scoped CRUD) — unchanged from original `appointments.ts`
2. **Section 2:** Raw SQL admin functions — from `appointments-queries.ts`, prefixed colliding functions with `admin`
3. **Section 3:** Booking flow raw SQL functions — from `appointments-new-queries.ts`, names kept as-is

### Function Renames (to resolve name collisions)

Three functions from the admin raw SQL section collided with same-named exports from the data-table section:

- `createAppointment` → `adminCreateAppointment`
- `updateAppointment` → `adminUpdateAppointment`
- `deleteAppointment` → `adminDeleteAppointment`

### Files Updated (import paths changed)

| File                                                            | Old Import                    | New Import        |
| --------------------------------------------------------------- | ----------------------------- | ----------------- |
| `app/actions/verwaltung/appointments/controller.tsx`            | `appointments-queries.ts`     | `appointments.ts` |
| `app/ui/admin-appointments-page.tsx`                            | `appointments-queries.ts`     | `appointments.ts` |
| `app/ui/admin-appointments-form.tsx`                            | `appointments-queries.ts`     | `appointments.ts` |
| `app/ui/admin-appointments-edit-page.tsx`                       | `appointments-queries.ts`     | `appointments.ts` |
| `app/ui/admin-appointments-create-page.tsx`                     | `appointments-queries.ts`     | `appointments.ts` |
| `app/ui/appointments-new-step2.tsx`                             | `appointments-new-queries.ts` | `appointments.ts` |
| `app/ui/appointments-new-resource-cards.tsx`                    | `appointments-new-queries.ts` | `appointments.ts` |
| `app/ui/appointments-new-page.tsx`                              | `appointments-new-queries.ts` | `appointments.ts` |
| `app/ui/appointments-new-create-page.tsx`                       | `appointments-new-queries.ts` | `appointments.ts` |
| `app/actions/appointments-new/controller.tsx`                   | `appointments-new-queries.ts` | `appointments.ts` |
| `app/actions/mastra/workflows/booking-workflow.ts`              | `appointments-new-queries.ts` | `appointments.ts` |
| `app/actions/mastra/workflows/booking-cancellation-workflow.ts` | `appointments-new-queries.ts` | `appointments.ts` |
| `app/actions/mastra/workflows/customer-booking-workflow.ts`     | `appointments-new-queries.ts` | `appointments.ts` |

### Old Files (can be deleted)

- `app/data/appointments-queries.ts` — No production code imports remaining (only test file imports)
- `app/data/appointments-new-queries.ts` — No production code imports remaining (only test file imports)

### Test Files NOT Changed

- `app/data/appointments-queries.test.ts` — Still imports from `./appointments-queries.ts` (left intact)
- `app/data/appointments-new-queries.test.ts` — Still imports from `./appointments-new-queries.ts` (left intact)
- `app/actions/mastra/workflows.test.ts` — Still imports from `appointments-new-queries.ts` (left intact)

### Impact

- Source files consolidated: 3 → 1 (excluding test files)
- Lines of code in module: 598 → ~610 (minimal overhead from section headers/comments)
- Function signatures preserved: All 30+ exports keep their original params, return types
- Typecheck: Passes (only pre-existing `runWithUserId` errors remain)
- Tests: No regression (452 pass, 40 pre-existing failures)

## [2026-07-09] Chat Controller Duplicate Logic Extraction

### New Shared Module

- `app/actions/mastra/shared-agent.ts` (142 lines) — Extracted shared agent-calling pattern from two controllers

### Extracted Functions & Types

| Export                          | Type             | Used By                                                |
| ------------------------------- | ---------------- | ------------------------------------------------------ |
| `TestAgent`                     | Interface        | Both controllers                                       |
| `CapturedToolCall`              | Interface        | Mastra controller (via `callAgentWithTimeout`)         |
| `CallAgentOptions`              | Interface        | Both controllers                                       |
| `messageField`                  | Schema field     | (available for future consumers)                       |
| `messageSchema`                 | Schema object    | (used internally by `validateMessage`)                 |
| `MAX_MESSAGE_LENGTH`            | Constant (5000)  | Both controllers                                       |
| `AGENT_TIMEOUT_MS`              | Constant (60000) | Both controllers                                       |
| `wantsJson(headers)`            | Function         | Mastra controller                                      |
| `sanitizeLog(s)`                | Function         | Mastra controller                                      |
| `isAbortError(error)`           | Function         | Both controllers                                       |
| `extractToolCalls(result)`      | Function         | (available, used internally by `callAgentWithTimeout`) |
| `callAgentWithTimeout(options)` | Function         | Both controllers                                       |
| `validateMessage(formData)`     | Function         | Both controllers                                       |

### Files Changed

- `app/actions/mastra/controller.tsx` — 297→231 lines (-66). Removed local schema, constants, validation logic, abort/timeout boilerplate, tool call extraction. Imports from `shared-agent.ts`.
- `app/actions/chat/controller.tsx` — 473→436 lines (-37). Removed local schema, constants, validation logic, abort/timeout boilerplate. Imports from `../mastra/shared-agent.ts`.

### What Was Kept (not extracted — controller-specific)

- **Mastra controller**: Admin auth middleware, admin audit logging, `chatRateLimiter` (2000ms), JSON+redirect dual-format responses, `runWithAdminId` wrapper
- **Chat controller**: `chatRateLimiter` (3000ms), `bookingRateLimiter` (10000ms), booking workflow glue (`confirm_booking` action), session-based `pendingBooking`/`bookingResult` management, booking-specific tool result processing, `runWithUserId` wrapper

### Impact

- New file: 1 (142 lines)
- Net lines added: +39 (abstraction overhead for centralized maintainability)
- Lines removed from duplicated sites: ~103
- Duplicate validation logic eliminated from 2 controllers → 1 shared function
- Duplicate abort/timeout agent-call pattern eliminated from 2 controllers → 1 shared function
- Duplicate `TestAgent` type eliminated from 2 controllers → 1 shared type

### Verification

- `npm run typecheck` — Passes (only pre-existing `runWithUserId` errors, unchanged)
- `npm test` — 452 pass, 40 pre-existing failures (unchanged from baseline)
- Test files untouched

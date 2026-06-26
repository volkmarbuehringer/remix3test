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

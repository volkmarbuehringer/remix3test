# Code Deletion Log

## [2026-07-23] Refactor Session — Dead Code Cleanup

### Unused CSS Removed from `app/ui/layout.tsx`

Removed 19 unused CSS style constants that were never referenced in JSX templates or exported:

- `logoutFormStyle` — leftover from old header nav
- `logoutIconStyle` — leftover from old header nav
- `headerStyle` — replaced by `main-nav.tsx`'s own styles
- `containerStyle` — replaced by `main-nav.tsx`'s own styles
- `navStyle` — moved to `sidebar-layout.tsx` and `main-nav.tsx`
- `navSectionGroupCss` — moved to `main-nav.tsx`
- `navSectionLabelCss` — moved to `main-nav.tsx`
- `brandGroupCss` — replaced by `main-nav.tsx`'s own styles
- `logoStyle` — replaced by `main-nav.tsx`'s own styles
- `userEmailCss` — replaced by new user menu pattern
- `navLinkStyle` — moved to `sidebar-layout.tsx` and `main-nav.tsx`
- `navActiveStyle` — moved to `sidebar-layout.tsx` and `main-nav.tsx`
- `showcaseGroupStyle` — from iterative showcase dropdown (unused)
- `showcaseButtonStyle` — from iterative showcase dropdown (unused)
- `chevronStyle` — from iterative showcase dropdown (unused)
- `showcaseMenuStyle` — from iterative showcase dropdown (unused)
- `dropdownLinkStyle` — from iterative showcase dropdown (unused)
- `dropdownActiveStyle` — from iterative showcase dropdown (unused)
- `themeToggleStyle` — replaced by `main-nav.tsx`'s own toggle

File reduced from 350 lines to 157 lines.

### Seed Bug Fixed in `app/data/seed.ts`

- **Line 125:** Changed `res.description === 'resource2'` to `res.name === 'Raum 2'`
- **Reason:** The seed creates resources named "Raum 1" and "Raum 2" with German descriptions ("Hauptraum mit Beamer und Whiteboard", "Nebenraum für Kleingruppen"). The original condition checked `description === 'resource2'` which never matched, so all resources got the same default rules (Mon/Wed). Now "Raum 2" correctly gets Tue/Thu rules as intended.

### Duplicate `insertWebhookRequest` Consolidated

- **`app/data/webhook.ts`** — DELETED (16 lines)
- **`app/data/webhook-requests.ts`** — Updated `insertWebhookRequest` to return `Promise<string>` (ID) using `RETURNING id`, matching the signature previously in `webhook.ts`
- **`app/actions/webhook/controller.tsx`** — Updated import from `../../data/webhook.ts` to `../../data/webhook-requests.ts`, changed parameter key from `serialized` to `payload` to match the canonical API
- **Test impact:** `webhook-requests.test.ts` already imports from the canonical `webhook-requests.ts`; changing return type from `void` to `string` is backward-compatible (callers use `await` without storing result)

### Impact Summary

- Files deleted: 1
- Lines of code removed: ~210
- Tests passing: 1005 / 1006 (1 preexisting failure: AI API key configuration)
- File size reduction: `layout.tsx` 350 → 157 lines

## [2026-07-24] Refactor Session — Dead Code Cleanup & Consolidation

### Unused Exports Removed

- `__getTestAgent` — `app/actions/mastra/controller.tsx:39` (function only used via `__setTestAgent` in tests)
- `__getTestAgent` — `app/actions/workflow-agent/controller.tsx:25` (same pattern)
- `messageField`, `messageSchema` — `app/actions/mastra/shared-agent.ts:54-55` (made private, only used internally)
- `isAbortError` — `app/actions/mastra/shared-agent.ts:71` (no remaining callers after chat controller cleanup)
- `ErrorCode` (type) — `app/actions/mastra/tools/errors.ts:15` (not imported anywhere)
- `ErrorResult` (type) — `app/actions/mastra/tools/errors.ts:17` (not imported anywhere)
- `ApiToken` (type) — `app/data/schema.ts:529` (type defined but never imported)
- `getMigrations` (re-export) — `app/data/setup.ts:1` (kept internal import, removed redundant re-export)
- `createAuthCookieWithPendingBooking` — `app/test-utils.ts:121` (entire function removed, never imported)
- `ThemeComponent` (type), `glyphContract`, `glyphNames`, `GlyphName`, `GlyphValues` — `app/ui/theme/theme.ts` (re-exports never consumed from this path)
- `GlyphSheetProps` (type) — `app/ui/theme/glyph/glyph.tsx:8` (made private, only used internally)
- `filterAndForward` — `app/utils/agent-sse.ts:14` (made private, only used by `pipeStream` in same file)

### Duplicate Type Consolidated

- `Report1UserOption` — `app/ui/admin-report1-page.tsx` had its own duplicate definition; changed to import from `app/data/report1.ts` where the canonical version lives

### Shared SSE Utilities Extracted (`app/utils/agent-sse.ts`)

- `sseErrorResponse(error, status)` — Creates an SSE `agent-error` Response with proper headers in one call
- `sseEvent(type, data)` — Encodes a single SSE event for `controller.enqueue()` usage
- `safeClose(controller)` — Safely closes a ReadableStream controller, ignoring already-closed errors

### Shared Logger Utility Created (`app/utils/logger.ts`)

- `createLogger(prefix)` — Creates a Logger with `.error()` method that suppresses output in test environments
- Replaced `process.env.NODE_ENV !== 'test' ? console.log.bind(...) : () => {}` pattern in:
  - `app/actions/webhook/controller.tsx`
  - `app/actions/callback/controller.tsx`
  - `app/actions/app-webhook/controller.tsx`
- Replaced `if (process.env.NODE_ENV !== 'test') { console.error(...) }` pattern in:
  - `app/actions/chat/controller.tsx` (5 occurrences)

### Controller SSE Pattern Consolidation

Refactored 3 agent controllers (`route-agent`, `workflow-agent`, `mastra`) to use shared `sseErrorResponse()`, `sseEvent()`, and `safeClose()`:

- 20+ inline `sseEncoder.encode(...)` → `sseEvent()` calls
- 15+ multi-line SSE Response constructors → single-line `sseErrorResponse()` calls
- Eliminated ~270 lines of repetitive SSE boilerplate

### Type Cleanup

- `docDef: any` → `docDef: TDocumentDefinitions` in:
  - `app/actions/mastra/agents/workflow-agent.ts` (1 occurrence)
  - `app/actions/mastra/tools/support-tools.ts` (2 occurrences)

### Console.Error Cleanup

- `app/actions/mastra/controller.tsx` — removed `console.error` for recall failures (non-fatal; replaced with comment)
- `app/actions/chat/controller.tsx` — moved all 5 `console.error` calls to `chatLog.error` via shared logger

### Impact

- Files created: 1 (`app/utils/logger.ts`)
- Lines of code removed: ~427
- Lines of code added: ~145 (utilities + replacements)
- Net reduction: ~282 lines
- TypeScript: clean compile
- Tests: all passing (pre-existing DB contention failures in parallel runs only)

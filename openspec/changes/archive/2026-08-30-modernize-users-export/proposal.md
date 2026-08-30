# Modernize /verwaltung/users-export

## Why

The `/verwaltung/users-export` route works but has correctness gaps (date-window mismatch between query and labels, invalid calendar dates silently accepted, silently swallowed errors), duplicates PDF/response/data-layer code that also exists in `/verwaltung/users-pdf` and `/verwaltung/pdf`, and has clunky UX (no shareable export URL, empty results rendered as a 404 error box, single-message validation errors). It is also the only route in the PDF export family without a spec.

## What Changes

- **Correctness**
  - Validate start/end dates as real calendar dates (currently `2024-02-31` is accepted and silently rolls over to March 2).
  - Use one date convention end-to-end: UTC day boundaries for both the query window and the rendered "Zeitraum" labels (today the query window is UTC-based while labels are rendered from local-midnight parsing).
  - Log errors in the PDF-generation catch blocks via `context.logger` (brings the controller into compliance with the existing `catch-error-logging` spec; currently the catch is silent).
  - Replace the locally re-invented `formatDate()` with `formatDateDE()` from `app/utils/date-utils.ts`.
- **Consolidation (narrow)**
  - Extract a shared user-summary PDF document builder used by the users-export and users-pdf controllers.
  - Extract a shared PDF attachment-response helper (SuperHeaders content-type/disposition/length) into `app/utils/pdf-utils.ts`.
  - Extract the shared row-mapping/truncation boilerplate in `app/data/users-export.ts` and `app/data/users-pdf.ts` into one mapper. The two SQL queries stay separate functions (INNER JOIN + date range vs LEFT JOIN + all users — different semantics; a previous consolidation attempt that merged them was reverted).
  - Document the consolidation in `docs/DELETION_LOG.md` per project convention.
- **UX**
  - Support `GET /verwaltung/users-export?startDate=...&endDate=...` so a chosen range is a bookmarkable/shareable download link; the POST form action is kept as fallback (CSRF stays on POST).
  - Render an empty result as a neutral empty-state notice on the form page (200) instead of a 404 error box.
  - Show per-field validation errors using `issuesToFieldErrors()` (compliance with `parse-safe-consistency`), preserving submitted values.
  - Add the `X-Remix-Frame` download shim (302 out of the frame) that `/verwaltung/users-pdf` already has, so downloads work from the frame-based verwaltung shell.

## Capabilities

### New Capabilities

- `users-export`: The date-filtered user-summary PDF export at `/verwaltung/users-export` — form page, GET/POST download, date validation, UTC-day window convention, empty-state behavior, frame download shim, admin-only access.

### Modified Capabilities

(none — the consolidation is behavior-preserving for `users-pdf-export`; `catch-error-logging` and `parse-safe-consistency` already mandate the patterns we adopt, so their requirements do not change)

## Impact

- **Code**: `app/actions/verwaltung/users-export/controller.tsx`, `app/ui/users-export-page.tsx`, `app/data/users-export.ts`, `app/data/users-pdf.ts`, `app/actions/verwaltung/users-pdf/controller.tsx` (shared helpers + logger), `app/utils/pdf-utils.ts` (new helper), new `app/utils/user-summary-pdf.ts`, `app/utils/date-utils.ts` (possibly extend `formatDateDE` for null handling).
- **Tests**: `app/data/users-export.test.ts`, `app/data/users-pdf.test.ts` keep passing (mapping refactor is behavior-preserving); new controller-level tests for GET download, validation, empty state, frame shim.
- **Specs**: new `openspec/specs/users-export/spec.md` on archive; no existing spec requirements change.
- **No dependency changes, no API/schema changes.**

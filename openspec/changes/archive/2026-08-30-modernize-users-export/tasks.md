# Tasks — modernize-users-export

## 1. Shared helpers (consolidation, B)

- [x] 1.1 Extract shared user-summary row mapper into `app/data/users-export.ts`/`users-pdf.ts` internal usage: row-coercion + `limit+1` truncation in one place; both exported functions keep their own SQL. Verify `users-export.test.ts` and `users-pdf.test.ts` pass unmodified (`npm test -- users-export users-pdf`).
- [x] 1.2 Add `pdfAttachmentResponse(buffer, filename)` to `app/utils/pdf-utils.ts` (SuperHeaders content-type/disposition/length + Uint8Array Response). Verify with a unit test asserting headers on a sample buffer.
- [x] 1.3 Create `app/utils/user-summary-pdf.ts` with `buildUserSummaryPdf({ title, subtitleLines, rows, truncated })`; port table body mapping, truncated note, and styles from the users-pdf controller. Verify it produces a Buffer for sample rows.
- [x] 1.4 Extend `formatDateDE()` in `app/utils/date-utils.ts` to accept `number | null` and render `—` for null/invalid (UTC rendering for period labels per design D1). Verify with unit tests for null, invalid, and leap-day inputs.

## 2. Correctness in users-export (A)

- [x] 2.1 Replace the date regex-only refine with the calendar round-trip refine (design D2), shared for startDate/endDate; German per-field messages. Verify: `2024-02-31` rejected, `2024-02-29` accepted, valid range accepted.
- [x] 2.2 Switch the controller to `issuesToFieldErrors()` per-field errors (parse-safe-consistency) and pass `fieldErrors` + preserved values to `UsersExportPage`. Verify a bad submit re-renders 400 with per-field errors.
- [x] 2.3 Normalize labels to UTC: replace `toLocalDateString`/local `formatDate` with the UTC-based date-utils helpers (design D1). Verify the subtitle for `2026-01-01`–`2026-01-31` renders "1. Januar 2026 – 31. Januar 2026" and matches the query window.
- [x] 2.4 Add `context.logger` call to the generation catch block in users-export and users-pdf controllers (catch-error-logging compliance). Verify a forced generation error logs and returns the 500 German message.

## 3. UX in users-export (C)

- [x] 3.1 Support GET download on `index` when both query params are present; render the form otherwise (design D3). Verify `GET /verwaltung/users-export?startDate=…&endDate=…` as admin returns PDF with correct headers; no params returns the form page.
- [x] 3.2 Change the form to `method="GET"` and keep the POST `create` action delegating to the same internal download function (CSRF token stays on the form). Verify POST download still works and CSRF rejection still applies.
- [x] 3.3 Replace the 404 error box with a 200 neutral empty-state notice prop on `UsersExportPage`. Verify a range with no users returns 200 + notice + preserved values.
- [x] 3.4 Add the `X-Remix-Frame: true` → 302 shim to the download paths, mirroring users-pdf (design D6). Verify a framed download request redirects out of the frame.

## 4. Rewire controllers to shared helpers (B finish)

- [x] 4.1 Refactor `users-export` and `users-pdf` controllers to use `buildUserSummaryPdf` and `pdfAttachmentResponse`; delete the duplicated inline definitions. Verify both routes still return PDFs with unchanged filenames/layout via controller tests.
- [x] 4.2 Delete the duplicated local `formatDate()`/`UserSummaryRow` copies where the shared versions suffice (controllers import the row type from the data modules). Verify `npm run typecheck` is clean.

## 5. Verification and documentation

- [x] 5.1 Add/extend controller-level tests for users-export: GET download, POST download, per-field validation, empty state 200, frame shim, auth (redirect/403). Verify `npm test` green.
- [x] 5.2 Run full checks: `npm test`, `npm run typecheck`, `npm run lint`. Verify all pass.
- [x] 5.3 Add the consolidation entry to `docs/DELETION_LOG.md` (what was shared, what was deliberately kept separate and why, test impact). Verify the entry follows the existing log format.

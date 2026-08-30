# Design — modernize-users-export

## Context

The `/verwaltung/users-export` controller (`app/actions/verwaltung/users-export/controller.tsx`) validates a date range with `s.parseSafe`, queries aggregated user summaries via raw SQL (`db.exec`), and builds the PDF inline with pdfmake. `/verwaltung/users-pdf` does the same without the date filter. Both data modules (`app/data/users-export.ts`, `app/data/users-pdf.ts`) share identical row-mapping/truncation code but differ in JOIN semantics. The verwaltung area renders inside a frame shell; `/verwaltung/users-pdf` already carries an `X-Remix-Frame` redirect shim for downloads, users-export does not.

Constraints that shape the approach:

- **Reverted history**: commit `8f4dfee` (2026-07-31) merged the data functions of users-pdf/users-export and was reverted within hours (`bd78294`). `docs/DELETION_LOG.md` records the project's convention of narrow, documented consolidations. Consolidation here stays at the identical-code level only.
- **Specs already mandate patterns**: `catch-error-logging` requires `context.logger` in bare `catch {}`; `parse-safe-consistency` requires `issuesToFieldErrors()` for field-level errors. This change brings users-export into compliance rather than inventing new conventions.
- **UTC-day is an existing norm**: `app/utils/date-utils.ts` already exposes `getTodayUtcMidnight()` and `formatDateDE(epochMs)`; the app thinks in UTC days elsewhere.

## Goals / Non-Goals

**Goals:**

- One consistent UTC-day convention for query window and rendered labels.
- Field-level validation with real calendar-date checks.
- Shared helpers for the pieces that are byte-for-byte identical across the export family (row mapper, PDF doc builder, attachment response).
- Shareable GET download with POST form fallback.
- Download behavior inside the frame shell identical to users-pdf.

**Non-Goals:**

- Merging `listUserSummaries` and `listUserSummariesByDateRange` into one function (distinct JOIN/WHERE semantics).
- Touching `/verwaltung/pdf` or `/verwaltung/report1` beyond what shared helpers naturally serve (they can adopt later; not required here).
- HTML preview of the export data.
- Timezone-aware (Europe/Berlin) day boundaries.
- Changing the 10.000-row truncation limit or the PDF visual design.

## Decisions

### D1: UTC-day boundaries end-to-end (not Europe/Berlin)

Query window: `startMs = Date.parse(startDate + 'T00:00:00Z')`, `endMs = startMsExclusive + 86_400_000` — unchanged query math. The change is on the label side: `toLocalDateString` is replaced by UTC-based rendering (extend `formatDateDE` with an explicit UTC variant or pass `timeZone: 'UTC'`) so labels always describe the exact queried window.

*Alternatives considered*: Europe/Berlin boundaries would match user intuition for near-midnight appointments but introduces a TZ dependency, DST edge cases, and diverges from the existing `getTodayUtcMidnight()` norm. Rejected for now; documented convention makes a later switch contained.

### D2: Calendar validation via parse-refine round-trip

Keep the `YYYY-MM-DD` regex as a first gate, then refine by round-tripping: `Date.parse(v + 'T00:00:00Z')` must yield a timestamp whose own UTC ISO date equals the input (`2024-02-31` fails; `2024-02-30` fails; `2024-02-29` passes in leap years). Implemented once as a shared schema fragment used for both fields. Errors surface per-field via `issuesToFieldErrors()` per `parse-safe-consistency`.

*Alternatives considered*: a `z.date()`-style coercion schema (remix/data-schema) — round-trip refine is simpler and keeps German messages co-located.

### D3: GET download on `index`, POST `create` kept

`index` renders the form when no params are present and performs the download when both `startDate` and `endDate` are present. The form uses `method="GET"` **and `data-rmx-document`**: the attribute opts the submission out of frame interception (see `navigation.ts` `getSourceElementNavigation`), so the browser performs a native navigation, receives the `attachment` response, and downloads the PDF without leaving the page — in both full-document and frame-fragment contexts. Without it, the frame runtime fetches the submission with `X-Remix-Frame: true` and swallows the binary response (rendering the marker page instead of downloading). POST stays as a fallback path with identical logic behind a shared internal function.

*Alternatives considered*: a dedicated `download` action route (`/verwaltung/users-export/download`) — cleaner REST separation but adds a route and forces the form/page link to diverge; the two-actions-one-route shape matches how `index`+`create` already work here. GET needs no CSRF token (no mutation); POST keeps CSRF middleware protection.

### D4: Consolidation boundary — share mappers and builders, keep queries separate

- `app/data/users-export.ts` / `users-pdf.ts`: both keep their exported functions and SQL; the shared row-coercion + `limit+1` truncation moves into one internal mapper used by both.
- New `app/utils/user-summary-pdf.ts`: `buildUserSummaryPdf({ title, subtitleLines, rows, truncated })` returns the pdfmake document definition → buffer. Both controllers feed it their own header text.
- `app/utils/pdf-utils.ts`: add `pdfAttachmentResponse(buffer, filename)` encapsulating SuperHeaders + `new Response(new Uint8Array(...))`.
- `formatDate()` in three controllers → `formatDateDE()` from date-utils (extend it to render `—` for null/invalid, matching current controller behavior).
- Consolidation documented in `docs/DELETION_LOG.md` per project convention.

*Rationale vs. the reverted attempt*: that commit merged the data functions themselves (INNER vs LEFT JOIN) and swept 13 unrelated files. Sharing only byte-identical code keeps each route's observable behavior and data semantics explicit.

### D5: Empty state as 200 notice, not 404

Valid range + zero rows re-renders the form page with a neutral notice prop and status 200. Validation failures remain 400. Generation failures remain 500 with logging. This matches the spec's empty-state requirement and avoids styling an ordinary outcome as an error.

### D6: Frame shim uses a marker URL, not a bare redirect

A frame fetch carries `X-Remix-Frame: true`, and fetch preserves custom headers on same-origin redirects — a bare 302 to the same URL loops (controller 302 → fetch re-requests with the header → …) until the browser aborts with a NetworkError. The shim therefore redirects framed download requests once to the same URL plus a `frameDownload=1` marker param. The marked request renders the form page as HTML, terminating the chain; frame clients with a target (`frame-response.browser.tsx`) see `response.redirected` and perform `window.location.assign` to the marker URL — a full-page navigation without frame headers, which downloads the PDF. Target-less frame fetches (top-frame resolutions) render the marker page as a fragment instead. The primary download path is the form's `data-rmx-document` native navigation (D3); the shim is the safety net for frame-initiated download fetches (e.g. agent navigation tools). (users-pdf's bare-redirect shim has this latent loop; it is not exercised by any current UI path and is pinned by the `users-pdf-export` spec, so it stays untouched here.)

## Risks / Trade-offs

- [GET download bypasses CSRF token presence] → GET is side-effect-free (read + PDF render), same auth/admin middleware applies; POST keeps CSRF. Risk accepted; consistent with how users-pdf downloads via GET today.
- [Consolidation regresses users-pdf behavior] → controller-level tests assert both routes still emit identical headers/filenames; data-layer tests (`users-export.test.ts`, `users-pdf.test.ts`) unchanged and must pass untouched.
- [UTC-day label convention surprises users near midnight] → labels now always match the queried window; a later Berlin-timezone switch is contained to D1's helper.
- [Shared helper becomes a grab-bag] → `user-summary-pdf.ts` accepts only user-summary-shaped data; appointment-shaped exports (`/pdf`) stay out.

## Migration Plan

Pure app-code refactor + behavior additions; no DB, schema, or dependency changes. Deploy with the normal dev flow. Rollback = revert the change commit; the shared helpers are additive and removing them restores inline implementations. A GET-bookmark breaking edge: none — new URL pattern, nothing consumed it before.

## Open Questions

None — the date-convention, consolidation boundary, and GET/POST decisions above were surfaced during exploration and are resolved here.

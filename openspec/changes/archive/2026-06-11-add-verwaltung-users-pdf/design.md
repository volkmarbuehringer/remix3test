## Context

The existing `/verwaltung/pdf` route lists every appointment individually in a single table, which is useful for detailed exports but lacks a per-user summary view. Admins need a compact report showing all user accounts with a one-line summary of each user's appointment activity. The app already has pdfmake wired via `generatePdfBuffer()` in `app/utils/pdf-utils.ts`, and the PDF controller pattern is established at `app/actions/verwaltung/pdf/controller.tsx`.

## Goals / Non-Goals

**Goals:**

- Create a new route `/verwaltung/users-pdf` that returns a downloadable PDF
- The PDF SHALL list every user account with: name, email, total appointments, total booked minutes (HH:MM), first appointment date, last appointment date
- Follow the same controller pattern as the existing PDF route (`createController`, `requireAuth` + `requireAdmin`, pdfmake, `new Response` with Uint8Array)
- Add a dashboard card on `/verwaltung` linking to the new PDF
- Include frame-to-full-page redirect (same as existing PDF)

**Non-Goals:**

- No interactive filtering or date range selection (all users, all time)
- No CSV/XLSX export variant
- No changes to the existing `/verwaltung/pdf` route
- No pagination (typically a small number of users)

## Decisions

### Decision: Route name `usersPdf` at `/verwaltung/users-pdf`

**Rationale**: Follows the existing `pdf` sub-route naming convention under `verwaltung`. The path segment `users-pdf` clearly communicates the contents. The key in the route map aligns with the kebab-case segment.

**Alternatives considered**:

- `nutzer-pdf` → mixes German/English; most route segments are English
- `user-summary-pdf` → more descriptive but longer; `users-pdf` is concise

### Decision: LEFT JOIN for users without appointments

**Rationale**: Admins need to see all accounts, including newly created users who have no appointments yet. Using `LEFT JOIN` with `GROUP BY` ensures every user appears. Users with zero appointments show `0` for count and `—` for dates/minutes.

### Decision: SQL aggregation over application-level grouping

**Rationale**: A single SQL query with `COUNT`, `SUM`, `MIN`, `MAX` is simpler and more efficient than fetching all appointments and grouping in JS. The data volume is small (typically <100 users), so either approach works; the SQL approach matches the existing report1 pattern.

### Decision: Reuse pdfmake's `lightHorizontalLines` layout

**Rationale**: Matches the existing PDF visual style. Consistency across admin PDF exports is more important than unique styling per report.

### Decision: Dashboard card label "Benutzer-PDF"

**Rationale**: Existing dashboard cards use German labels (Auswertung, Angebote, Termine). "Benutzer-PDF" is concise and clear.

## Risks / Trade-offs

**[Risk] SQL query may need adjustment if user/appointment tables grow large** → Mitigation: The query aggregates across all users and appointments. If performance becomes an issue, add a date filter or limit to active users. Acceptable for current scale.

**[Risk] LEFT JOIN shows users with 0 appointments** → Intentional design choice (see decision above). Trade-off: admins see all accounts at a glance.

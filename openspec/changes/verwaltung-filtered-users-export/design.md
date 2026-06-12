## Context

The existing `/verwaltung/users-pdf` route exports ALL users as a PDF with appointment statistics, with no filtering. Admins need to export only users who had appointments within a given time range (e.g., current month, last quarter). The existing pattern (route + controller in `app/actions/verwaltung/users-pdf/controller.tsx`) serves as the template.

This is a new route, not a modification of the existing one, to keep concerns separate and avoid breaking existing functionality.

## Goals / Non-Goals

**Goals:**
- Provide a full-page route at `/verwaltung/users-export` with a date range filter form
- On form submission, generate and download a filtered PDF (same format as `users-pdf`)
- Only include users who have at least one appointment with `date` in the chosen range
- Add a dashboard card in the `/verwaltung` overview linking to the new page
- Maintain same admin-only access, PDF layout, and download behavior as `users-pdf`

**Non-Goals:**
- Modifying the existing `/verwaltung/users-pdf` route
- Adding CSV or other export formats
- Adding pagination or sorting to the filter page (simple form + submit)
- Changing the appointment or user data model

## Decisions

**Decision 1: New route vs. modifying existing `users-pdf` with query params**
- **Chosen**: New route `/verwaltung/users-export` with its own controller
- **Rationale**: Keeps the existing simple "export all" route unchanged. The filtered version needs a UI page with a form, which is architecturally distinct from the current stateless download endpoint. A separate route avoids tangled logic and keeps each controller focused.
- **Alternative considered**: Adding `?start=&end=` params to `users-pdf`. Rejected because the existing route does not have a UI page, and adding form rendering logic to it would mix concerns.

**Decision 2: Filter form as a full-page route vs. a frame**
- **Chosen**: Full-page route (like `report1`)
- **Rationale**: PDF downloads require a document-level navigation (the `rmx-document` attribute pattern). A frame-based approach would need the redirect workaround already used in `users-pdf`. A full-page route is simpler and matches user expectation for a "page with a form that triggers a download."

**Decision 3: Date range pickers vs. period presets**
- **Chosen**: Native HTML date inputs (start/end)
- **Rationale**: More flexible than presets. Admins often need arbitrary ranges (e.g., "last 3 months" or "Q2"). The existing `getPeriodRange()` utility could be added later as shortcuts, but the core should accept arbitrary dates.

**Decision 4: Reuse `generatePdfBuffer` and PDF layout from `users-pdf`**
- **Chosen**: Same PDF utility, same table layout
- **Rationale**: Consistency in admin exports. The PDF will note the filter range in the subtitle to distinguish it from the full export.

## Risks / Trade-offs

- **[UX Risk]** User submits form with no users in range → PDF will be empty (header + no table rows). Mitigation: validate on the server and show an error message on the page before generating the PDF.
- **[SQL Injection Risk]** Date inputs from the form must be validated as numeric epoch values, not raw strings. Mitigation: parse with `Number()` and validate before using in parameterized queries.

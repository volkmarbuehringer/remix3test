## Context

The app has a working webhook pipeline: external services POST to `/app-webhook`, which inserts into `webhook_requests` and forwards to Hermes. Admins can resend rows via a button. Missing: a way to create rows from the admin UI itself.

Existing patterns used:
- `ListsClient` at `app/assets/lists-client.tsx`: clientEntry managing an array of items with add/remove/edit, submit via fetch POST
- Admin messages page: textarea + send on same view as list
- Admin sidebar layout with nav items under "Daten"

## Goals / Non-Goals

**Goals:**
- Key-value grid (clientEntry) for composing a flat JSON payload
- Form POST with hidden input for the serialized JSON
- Insert row into `webhook_requests` with empty token and empty headers
- 303 redirect to `/webhook-requests` list on success
- "Compose" button in the header of the existing webhook-requests page

**Non-Goals:**
- No Hermes forwarding on insert (uses existing "Resenden" button)
- No nested JSON or type coercion (all values are strings)
- No editing or deleting composed rows from the grid (use existing list view)

## Decisions

1. **Form+hidden input over fetch POST** — follows the dominant pattern in the codebase (standard 303 redirect, uses `<CsrfTokenInput />`). The hidden payload value is synced via a ref on submit, which is a one-line cost.

2. **Empty string for token** — `token TEXT NOT NULL` requires a non-null value. Empty string `''` serves as the sentinel for manually-created rows. The token column is used only for auth in `/webhook` and `/app-webhook` endpoints; the resend logic does not read it.

3. **clientEntry for grid interactivity** — necessary because add/remove rows and live preview require DOM state. The `ListsClient` pattern shows this is the established approach. Does not degrade without JS (the page is admin-only, JS is expected).

4. **New page at `/webhook-requests/create`** — keeps the list page focused. A "Compose" button in the header navigates to the create page.

5. **Flat `Record<string, string>` payload** — simplest approach. No type column, no nested object support. Hermes receives all values as strings and can coerce as needed.

## Risks / Trade-offs

- **[Token sentinel]** Empty token in manual rows could confuse filtering if admins filter by token expecting meaningful values. → The filter bar on the list page searches by `token ILIKE`, so an empty string filter or `''` search would match them.
- **[No validation]** No restriction on duplicate keys in the grid. → Last-write-wins in JSON serialization; the preview shows the assembled object so the admin can verify.
- **[All strings]** True integers/bools get sent as strings to Hermes. → The Hermes subscription prompt is LLM-based and handles string-to-type conversion naturally.

## Context

newapp needs a `/client` route demonstrating server-rendered Frame-based grid patterns with pagination, sorting, filtering, and form-based CRUD. The `my_app` project has an equivalent route (`routes.client`) that was ported in design — this design adapts it to newapp's conventions: flat controllers, `input.base`/`input.focus` mixins, theme tokens, `Layout` wrapper, and Frame-based navigation for the grid content.

The route uses **no clientEntry or custom client JS** — all interactions are standard Frame navigation, `<a>` links, `<form>` POST/GET submissions, and `<Frame>` content loading. This is the strictest Remix-compliant approach.

## Goals / Non-Goals

**Goals:**
- Add a `/client` route with Frame-based grid (pagination, sort, filter, edit links, delete forms)
- Full-page edit form at `/client/edit/:rowId` with save/redirect
- POST-based delete handling with Frame refresh
- `clients` table in schema with 200 seed rows
- Full compliance with newapp's code conventions

**Non-Goals:**
- No clientEntry, client JS, or DOM manipulation
- No inline editing
- No edit panel Frame alongside the grid
- No JSON API endpoints

## Decisions

| # | Decision | Rationale | Alternatives Considered |
|---|----------|-----------|------------------------|
| 1 | **Frame-based grid** | The grid content (table + pagination + sort + filter) is a `<Frame>` that navigates via query param changes. Sort headers are `<a>` links, pagination is `<a>` links, filter is a `<form method="GET">`. All are intercepted by the Frame runtime. | clientEntry + JSON fetch (more complex, more JS); Full page reload (breaks UX) |
| 2 | **Flat controller file** | `app/actions/client-controller.tsx` — matches newapp's `admin-messages-controller.tsx` pattern | Directory-based `client/controller.tsx` (my_app convention, diverges from newapp) |
| 3 | **Grid page as separate component** | `client-grid-page.tsx` lives at `app/actions/` alongside its controller, matching `lists-show-page.tsx` pattern | Putting it in `app/ui/` (too far from the route owner) |
| 4 | **Edit page as full page** | `/client/edit/:rowId` is a full server-rendered page using `<Layout>`. On save, redirects to `/client?offset=...&sort=...&order=...` preserving grid state. | Frame-based edit panel (adds complexity without benefit for a full form experience) |
| 5 | **Delete via POST form** | Each row has a `<form method="POST" action="/client/destroy/:rowId">` with a delete button. POST is intercepted by Frame — redirect to `/client/grid?...` refreshes the Frame content. | AJAX delete + manual Frame refresh (more JS, less Remix-compliant) |
| 6 | **`clients` table uses `remix/data-table`** | Consistent with all other tables in newapp (users, messages, chatlog, workflowRuns). Uses `c.integer()`, `c.text()`, `c.bigint()` column types. | Raw SQL queries (bypasses data-table layer) |

## Risks / Trade-offs

- [Risk] Delete inside a Frame uses form POST → redirect to grid → Frame refreshes. If the redirect URL doesn't match the Frame's current URL exactly, the Frame may not update properly. → **Mitigation**: Redirect to `/client/grid?offset=...&sort=...&order=...` with the current grid params, ensuring the Frame navigates correctly.
- [Risk] The `clients` table adds schema migration overhead. → **Mitigation**: The table uses the same `CREATE TABLE IF NOT EXISTS` pattern as all other tables in `setup.ts`, so it's idempotent.
- [Trade-off] No inline editing means users must click Edit → full page load → edit → save → redirect back. This is slower than inline editing but avoids any client JS complexity.

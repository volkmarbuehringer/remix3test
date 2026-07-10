## Context

The `/nutzer` page is a standalone top-level route that renders a full-page admin CRUD with inline editing, server-side validation, and render-on-error. Every other admin page (users, chatlog, messages, lists) lives under `/admin` and uses a shared sidebar Frame layout.

Previous attempts to move `/nutzer` under `/admin` failed because form validation errors didn't render. The root cause was three interacting issues:

1. **No `rmx-target` on nav elements** — sort, pagination, and filter links navigate the full page, breaking out of the Frame
2. **Controller uses `<Layout>` directly** — render-on-error returns a full HTML document, but the Frame expects an HTML fragment
3. **Hardcoded `/nutzer` URLs** — form actions, redirects, and fetch URLs all point to the wrong path

## Goals / Non-Goals

**Goals:**

- Move `/nutzer` route under `/admin/nutzer` with the sidebar Frame layout
- Preserve render-on-error with inline field errors inside the Frame
- Keep the same UI (two-column grid + edit panel, sorting, pagination, filtering, context menu)
- All existing tests pass after URL updates

**Non-Goals:**

- Changing the nutzer page UI or behavior
- Refactoring other admin pages to use render-on-error
- Changing the admin Frame architecture

## Decisions

### Decision 1: Use `renderAdminPage()` instead of `<Layout>`

The nutzer controller currently renders full HTML pages via `context.render(<Layout title="Nutzer">...)`. The admin Frame expects HTML fragments when `X-Remix-Target` is set.

`renderAdminPage()` wraps content in `ShellOrFragment`, which checks `X-Remix-Target`:

- **Present** → renders only the sidebar + content fragment
- **Absent** → renders the full page shell with `<Frame>` for initial page loads

Render-on-error with `{ status: 400 }` is passed through to `context.render()` inside `ShellOrFragment`. The Frame ignores the status code when swapping HTML fragments, so inline field errors will render correctly.

### Decision 2: Add `rmx-target` to all navigational elements

Every `<a>` link (sort, pagination, filter clear, "Neu anlegen") and the filter `<form>` needs `rmx-target={frames.adminContent}` (`"admin-content"`). This attribute tells the Remix Frame Navigation API to navigate the Frame instead of the full page.

The `RestfulForm` PUT/POST for inline editing doesn't need `rmx-target` explicitly — form submissions inside a Frame are automatically intercepted by the Frame's navigation handler.

### Decision 3: Use route references instead of hardcoded path strings

Wherever possible, replace `'/nutzer'` with `routes.admin.nutzer.index.href()` or a typed route reference. This ensures URL consistency and makes future route changes less error-prone.

Exceptions: The `ADMIN_BASE` constant in `admin-nutzer-page.tsx` can be set to `/admin/nutzer` (used in URL-building helpers that append query params). The `fetch()` calls in `nutzer-table-interactive.tsx` target JSON endpoints and use string paths.

## Risks / Trade-offs

| Risk                                                                                                  | Mitigation                                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Render-on-error + `{ status: 400 }` inside a Frame is untested** — no existing admin page does this | The `ShellOrFragment` code is agnostic to status codes; it only checks `X-Remix-Target`. Verified by tracing the render path.     |
| **Controller tests break** — ~40 `/nutzer` references + new `rmx-target` assertions                   | Mechanical find-and-replace. Tests change URL expectations and add `rmx-target` assertions matching the admin-users-page pattern. |
| **`nutzer-table-interactive.tsx` JSON fetch URLs** — 5 hardcoded paths in a `clientEntry` component   | Straightforward string replacements; the API contract doesn't change, only the URL.                                               |

## Context

The app has `users` and `resources` tables defined in `app/data/schema.ts` with full data-table CRUD support, but no admin UI to manage them. Existing admin routes (nutzer, offerings, appointments, chatlog, messages, lists) follow a consistent pattern: controller in `app/actions/`, UI page in `app/ui/`, route definition in `app/routes.ts`, registration in `app/router.ts`, nav entry in `app/ui/admin-layout.tsx`, and label in `app/ui/route-labels.ts`.

Both tables use the `remix/data-table` primitives (db.create, db.update, db.delete, db.query), so the CRUD logic can leverage them directly.

## Goals / Non-Goals

**Goals:**
- Provide full admin CRUD (list, create, update, delete) for the `users` table at `/admin/users`
- Provide full admin CRUD (list, create, update, delete) for the `resources` table at `/admin/resources`
- Follow existing admin UI patterns: paginated table with sort, filter/search, inline edit/create panels via grid state (offset, sort, order, filter)
- Respect security: routes protected by `requireAuth()` and `requireAdmin()` middleware

**Non-Goals:**
- Password management for users (password_hash is written on create, not re-displayed on read — same pattern as current registration)
- Role editing beyond what the `users.role` column supports (enum: customer/admin)
- Any changes to the existing `nutzer` or `login` tables
- Batch operations or bulk delete

## Decisions

1. **Use data-table directly instead of raw SQL** — The `users` and `resources` tables have `db` wrappers available via `remix/data-table`. Existing admin controllers like `admin-offerings` use raw SQL for legacy nutzer tables, but the schema.ts tables are designed for data-table usage. Using `db.query(users).where(...)` is simpler and type-safe.

2. **Inline edit/create panels** — Follow the offerings pattern: the main page renders a table list; clicking "Edit" sets `?editing=<id>`, clicking "Add New" sets `?creating=true`. Both render a side panel with the edit/create form in a two-column layout. This avoids page navigation.

3. **Sensitive columns** — For users, `password_hash` is never returned to the client. On create, a default placeholder hash is used (user must reset via a separate flow). The controller accepts `name`, `email`, `role`, and optionally `password` (which gets hashed).

4. **Search with ILIKE** — Use parameterized ILIKE queries for filter/search, matching the existing admin pattern. Users can be searched by `name` and `email`; resources by `description`.

## Risks / Trade-offs

- Password handling for new users: If created without a password, the user cannot log in until an admin sets one. This is acceptable — a future "reset password" action (like `nutzer` has) can be added. For now, the create form will include a password field.
- Existing appointments reference `resources` via `resource_id` with ON DELETE RESTRICT. Deleting a resource will fail if appointments reference it. This is correct DB-level protection.
- The `users` table has existing constraints (`email UNIQUE`, `role TEXT NOT NULL`). The controller validation must catch these before the DB throws.

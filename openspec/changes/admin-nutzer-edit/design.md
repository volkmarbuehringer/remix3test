## Context

The `/admin/nutzer` page is a read-only grid displaying data from two joined tables:

```sql
nutzer (n_id PK, n_vorname, n_name, n_email, n_verpflichtung, n_lid FK → login)
login  (l_id PK, l_login, l_aktiv, l_gesperrt, l_letzte_login)
```

The current controller (`admin-nutzer-controller.tsx`) only has an `index` handler (GET). The page description reads _"Übersicht aller Nutzer mit Login-Daten. Sortierbar, filterbar, read-only."_

The admin panel uses a frame-based sidebar layout (`admin-layout.tsx`). Pages render via `renderAdminPage()` which routes content through `X-Remix-Target=admin-content` frames.

The existing Client Lab at `/client` provides the exact inline-editing pattern to replicate: a two-column layout where the table grid sits on the left and an edit/create form panel appears on the right when activated via URL state (`?editing=N` or `?creating=true`).

## Goals / Non-Goals

**Goals:**

- Add PUT, POST, DELETE handlers to the nutzer controller
- Support inline editing of all fields except `l_letzte_login` (system-set)
- Support creating new nutzer+login pairs
- Support deleting nutzer+login pairs
- Follow the Client Lab UI pattern (sidebar edit panel, row actions)
- Use two sequential SQL statements for updates (UPDATE nutzer; UPDATE login)

**Non-Goals:**

- No password management (the `users` table handles auth, not `login`)
- No bulk operations
- No audit logging
- No changes to the data model or schema
- No changes to the `users` / `messages` / `chatlog` tables

## Decisions

### 1. Two SQL statements for updates (not transactions)

**Decision**: Update handlers will execute `UPDATE nutzer` and `UPDATE login` as separate statements without wrapping in a transaction.

**Rationale**: This is an admin tool, not a financial system. Partial failures are detectable and recoverable. The Client Lab follows the same approach (single-table, no TX). Keeping it simple avoids adding transaction boilerplate with no concrete benefit for this use case.

**Alternative considered**: Using a `BEGIN/COMMIT` transaction. Rejected because the added complexity (error handling, rollback in catch) provides no practical benefit for admin CRUD — the operations are idempotent and easily retried.

### 1a. Two separate PKs for the UPDATEs (not a JOIN)

**Decision**: The update handler uses `n_id` (from the route param) for the nutzer UPDATE and `l_id` (from a hidden form field) for the login UPDATE — two independent WHERE clauses with no JOIN.

**Rationale**: The edit-load query already fetches both `n_id` and `l_id` from the JOIN. Passing `l_id` as a hidden form field alongside `n_id` gives each UPDATE a direct primary-key WHERE, which is simpler, faster, and more readable than a JOIN-based UPDATE. No need to JOIN `login` through `nutzer` at write time — the relationship was already resolved at read time.

```sql
-- edit-load query (reads both PKs)
SELECT n_id, n_vorname, ..., l_id, l_login, ...
FROM nutzer JOIN login ON n_lid = l_id
WHERE n_id = $1

-- update queries (each uses its own PK from the form)
UPDATE nutzer SET ... WHERE n_id  = $1  -- from route param
UPDATE login  SET ... WHERE l_id  = $1  -- from hidden form field
```

### 2. Client Lab UI pattern (sidebar panel, not modal or separate page)

**Decision**: Inline edit/create panels appear beside the table grid when activated via URL state (`?editing=N` or `?creating=true`), exactly like the Client Lab.

**Rationale**: Users are familiar with the pattern from Client Lab. It preserves grid context (no page navigation). The existing code (`edit-page.tsx`, `create-page.tsx`, `RestfulForm`, `GridStateHiddenInputs`) can be directly adapted.

### 3. Delete via client-entry button (JavaScript confirmation)

**Decision**: Delete uses a client-entry button (like `client-del-button.tsx`) that shows a browser `confirm()` dialog and does a `fetch` to `DELETE /admin/nutzer/:id`, then reloads the frame.

**Rationale**: Same pattern as Client Lab. The confirm dialog prevents accidental deletes. The frame reload ensures the grid reflects the change.

### 4. Edit/create forms inside the admin frame (not parent page navigation)

**Decision**: Unlike Client Lab where the edit panel lives on the **parent** page (outside the grid frame), the nutzer edit panel lives **within** the admin frame itself. The controller's `index` handler renders both the table and optionally the edit/create panel side by side.

**Rationale**: The nutzer page is already a frame within the admin layout. Navigating the parent page (outside the frame) would require a different architecture. Instead, the single `index` handler toggles between "grid only" and "grid + panel" modes based on URL params.

### 5. Field mapping between form and SQL

**Decision**: The form sends flat field names. The controller maps them to the appropriate table in SQL:

| Form field      | SQL target        | Table  |
| --------------- | ----------------- | ------ |
| `_l_id`         | `login.l_id`      | —      |
| `vorname`       | `n_vorname`       | nutzer |
| `name`          | `n_name`          | nutzer |
| `email`         | `n_email`         | nutzer |
| `verpflichtung` | `n_verpflichtung` | nutzer |
| `login`         | `l_login`         | login  |
| `aktiv`         | `l_aktiv`         | login  |
| `gesperrt`      | `l_gesperrt`      | login  |

### 6. ID routing uses `n_id`, login ID via hidden field

**Decision**: The `:id` param in routes maps to `nutzer.n_id`. The `l_id` is carried as a hidden form field (`_l_id`) populated from the edit-load query, so each UPDATE targets its own table's primary key directly.

### 7. Create flow: login first, then nutzer

**Decision**: On create, insert into `login` first (to get the `l_id`), then insert into `nutzer` with that `l_id`.

### 8. Delete flow: nutzer first, then login

**Decision**: On delete, delete from `nutzer` first (FK to login), then delete from `login`.

## Risks / Trade-offs

- **[Low] Frame navigation vs parent navigation**: The edit panel lives inside the admin frame, not on the parent page. This means clicking "Edit" triggers a frame navigation (not a full page load). If the edit form submission needs to "escape" the frame, the redirect target must be the frame URL (not the parent). Solution: all form submissions redirect to `/admin/nutzer` (targeting the admin-content frame).
- **[Low] Deleting login rows**: If a `l_id` is referenced by multiple `nutzer` rows (unlikely given the schema but not enforced), deleting a login row would fail with a FK violation. Solution: the delete order (nutzer first, then login) handles the common 1:1 case.

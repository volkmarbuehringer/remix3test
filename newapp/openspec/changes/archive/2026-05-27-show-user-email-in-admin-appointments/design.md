## Context

The admin appointments page at `/admin/appointments` displays a table of appointments with columns for ID, title, user, resource, date, time, created/updated timestamps. Currently the "Benutzer" column displays the user's name (`u.name`) retrieved via a LEFT JOIN from the `users` table. Operators need to see the user's email directly in the grid for quick identification and communication.

The `users` table already has an `email` column (UNIQUE TEXT, normalized to lowercase). The SQL query already JOINs `users u ON u.id = a.user_id`, so adding the email field is a straightforward SELECT addition with no schema changes needed.

## Goals / Non-Goals

**Goals:**
- Display user email in the admin appointments grid instead of user name
- Update SQL queries, types, and column renderings accordingly
- Update sort/search to work with email instead of name

**Non-Goals:**
- No changes to the users table schema
- No changes to create/edit forms (they still use user_id dropdown with names)
- No changes to the non-admin appointment views
- No changes to the context menu or other interactions

## Decisions

1. **Replace name with email (not add both)**: The grid has limited horizontal space (8 columns). Showing both name and email would require either a wider column or an additional column, both of which reduce space for other data. Email is more useful for operator workflows, so replace name entirely.

2. **Rename column header from "Benutzer" to "E-Mail"**: Accurately reflects the displayed data. Operators familiar with the page will immediately understand the change.

3. **Sort by `u.email` instead of `u.name`**: Consistent with the displayed value. Email sorting is alphabetically meaningful for lookup.

4. **Search includes `u.email` instead of `u.name`**: Keeps the search functionality consistent with the displayed column. The global filter bar searches across title, user, and resource — swapping `u.name` for `u.email` in the SEARCH_COLUMNS array maintains the same search surface area.

5. **Remove `user_name` from `AppointmentRow` interface**: Since nothing renders or uses `user_name` after the change, keeping it would be dead code. Remove it along with the `u.name AS user_name` SELECT clause.

6. **Use INNER JOIN instead of LEFT JOIN for users**: The `appointments.user_id` column is `NOT NULL` with a FK constraint `REFERENCES users(id) ON DELETE CASCADE` — every appointment always has a valid user. An `INNER JOIN` enforces this invariant at the query level. The `LEFT JOIN` was unnecessary since `user_id` can never be NULL. The `resources` join remains `LEFT JOIN` since `resource_id` could theoretically reference a deleted resource (though restricted by `ON DELETE RESTRICT` in the current schema, keeping it as LEFT JOIN is safer for future flexibility).

## Risks / Trade-offs

- **[Risk] Existing bookmarks or links that sort by `u.name` will break**: When the `sort=u.name` parameter is no longer a valid sort column, the controller will fall back to the default sort (`a.date ASC`). This is acceptable — the sort parameter is a query string, not a permanent link.
- **[Risk] Operators used to sorting by name may need to adjust**: They'll now sort by email, which is alphabetical but may feel different. Mitigation: the column header change makes this obvious.
- **[Trade-off] Hiding the user's name removes a human-readable identifier**: Email addresses are less personal than names. However, email is more functional for the admin workflow (copy/paste into communication), and the full user detail is always available in the edit panel.

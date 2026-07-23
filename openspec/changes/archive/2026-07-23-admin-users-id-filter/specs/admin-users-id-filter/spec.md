# admin-users-filter-numeric-id

**Capability**: Filter users by numeric ID in the admin users grid.

## Behavior

- When `?filter=` is a string of only digits (e.g. `?filter=42`), the controller interprets it as a user ID lookup: `id = 42`
- When `?filter=` contains any non-digit characters, existing behavior is preserved (ILIKE search on name/email)
- The special string values `enabled` and `disabled` retain their existing status-toggle behavior
- An empty or missing `?filter=` param returns all users (no predicate)

## Rationale

Pure numeric input cannot be a meaningful name or email substring search. Interpreting it as an ID lookup serves the common admin workflow of jumping to a specific user record without scrolling.

## Non-Behavior

- Numeric ID filter is exclusive — it does not combine with status tabs
- No new query parameters are introduced
- No UI components are added or modified beyond a placeholder text update

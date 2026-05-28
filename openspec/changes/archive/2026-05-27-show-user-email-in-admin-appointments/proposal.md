## Why

The admin appointments grid currently displays the user's name in the "Benutzer" column, but operators need to see the user's email address for communication and identification purposes. Showing the email directly in the grid eliminates the need to open each record or cross-reference with the users list.

## What Changes

- Add `u.email AS user_email` to the SQL SELECT query in the admin appointments controller
- Add `user_email: string | null` to the `AppointmentRow` interface
- Update the grid's "Benutzer" column to display the user's email instead of the user's name
- Update column sorting to sort by `u.email` instead of `u.name`
- Update search to include `u.email` alongside existing search columns
- Rename column header from "Benutzer" to "E-Mail" to reflect the new content
- The `user_name` field and `u.name` reference can be removed from the grid query and interface

## Capabilities

### New Capabilities
*(none — this is an incremental UI refinement to an existing capability)*

### Modified Capabilities
*(none — no spec-level requirement changes; this is an implementation-level change to the admin appointments grid)*

## Impact

- **Controller**: `admin-appointments-controller.tsx` — SQL query changes and interface updates
- **UI Page**: `admin-appointments-page.tsx` — column header rename and display field change
- **Sorting**: sort column changes from `u.name` to `u.email`
- **Search**: search will include `u.email` instead of `u.name`
- **No database schema changes**: the `users.email` column already exists

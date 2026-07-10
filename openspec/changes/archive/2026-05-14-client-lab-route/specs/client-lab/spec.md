## ADDED Requirements

### Requirement: Client records have an identifiable schema

The system SHALL store client records with the following fields: `id` (auto-increment integer, primary key), `name` (text, required), `email` (text, required), `role` (text, one of Admin/Editor/Viewer), `status` (text, one of Active/Inactive), `registered` (bigint, timestamp). On create, `role` defaults to `'Viewer'`, `status` defaults to `'Active'`, and `registered` defaults to `Date.now()`. On create, `name` is required. On create and update, `name` and `email` are trimmed.

#### Scenario: Create valid client record

- **WHEN** a create operation is submitted with valid `name`, `email`, `role`, `status`
- **THEN** the record is inserted with default `registered` timestamp, `role` defaults to `'Viewer'`, `status` defaults to `'Active'`
- **AND** `name` and `email` are trimmed

#### Scenario: Reject create without name

- **WHEN** a create operation is submitted without a `name`
- **THEN** validation fails with a "Name is required" error

---

### Requirement: Client grid displays paginated records

The system SHALL render a server-rendered table of client records at `/client/grid` (a Frame fragment). The grid SHALL accept optional query params: `offset` (integer, default 0), `sort` (field name, default `id`), `order` (`asc` or `desc`, default `asc`), `filter` (text, optional). Each page SHALL display 20 rows. The grid SHALL show a "Next" button if more rows exist, and a "Prev" button if not on the first page.

#### Scenario: First page shows prev disabled

- **WHEN** grid is loaded with `offset=0`
- **THEN** 20 rows are displayed, prev button is disabled, next button is enabled if more rows exist

#### Scenario: Sort by column ascending

- **WHEN** user clicks a column header link (e.g., `?sort=name&order=asc`)
- **THEN** grid re-renders with rows sorted by that column ascending, sort arrow shown on header

#### Scenario: Filter by search text

- **WHEN** filter form is submitted with `filter=john`
- **THEN** grid re-renders showing only rows where name or email contains "john"

---

### Requirement: Users can edit a client record

The system SHALL provide a full-page edit form at `/client/edit/:rowId` that accepts `offset`, `sort`, `order` query params for redirect. The form SHALL use newapp's `input.base`/`input.focus` mixins for all text inputs and `<select>` elements for role and status. On POST to `/client/save`, the system SHALL validate and update the record, then redirect to `/client` with preserved query params. If the row is not found, return 404.

#### Scenario: Edit form displays current values

- **WHEN** user navigates to `/client/edit/1?offset=20&sort=name&order=asc`
- **THEN** the form is pre-filled with the client's current `name`, `email`, `role`, `status`, `registered` values
- **AND** a breadcrumb link returns to `/client?offset=20&sort=name&order=asc`

#### Scenario: Save redirects to grid with preserved state

- **WHEN** user submits the edit form with new values and `_offset=20`, `_sort=name`, `_order=asc`
- **THEN** the record is updated in the database
- **AND** user is redirected to `/client?offset=20&sort=name&order=asc`

#### Scenario: Edit non-existent row returns 404

- **WHEN** user navigates to `/client/edit/99999`
- **THEN** a 404 response is returned

---

### Requirement: Users can delete a client record

The system SHALL provide a delete form for each row in the grid. The form SHALL POST to `/client/destroy/:rowId` with hidden `_offset`, `_sort`, `_order` fields. On success, the server SHALL redirect to `/client/grid?offset=...&sort=...&order=...` to refresh the Frame content. Invalid rowId returns 400.

#### Scenario: Delete row refreshes grid

- **WHEN** user clicks delete on a row with `_offset=20`, `_sort=name`, `_order=asc`
- **THEN** the row is deleted from the database
- **AND** server redirects to `/client/grid?offset=20&sort=name&order=asc` to refresh the grid Frame

#### Scenario: Delete invalid rowId returns 400

- **WHEN** user submits delete for `rowId=0` or `rowId=-1`
- **THEN** a 400 response is returned

---

### Requirement: Navigation includes Client Lab link

The system SHALL add a "Client Lab" navigation item to the "Pages" section of `NAV_SECTIONS` in `app/ui/nav.ts`, linking to `/client`.

#### Scenario: Nav link visible to all authenticated users

- **WHEN** a user is logged in and views the navigation
- **THEN** the "Client Lab" link is visible

---

### Requirement: Database seeds 200 client records

On first initialization, the system SHALL seed 200 client records with alternating roles (Admin, Editor, Viewer), mostly Active status (every 4th is Inactive), unique names (User 1-200), and staggered registration dates.

#### Scenario: Seed creates 200 records

- **WHEN** a fresh database is initialized
- **THEN** the `clients` table contains exactly 200 rows

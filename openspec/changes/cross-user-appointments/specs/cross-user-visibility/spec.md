## ADDED Requirements

### Requirement: Cross-user appointment visibility

The system SHALL display appointments belonging to all users in the weekly grid, not only the current user's own appointments.

#### Scenario: All appointments visible

- **WHEN** a user views the `/appointment` page
- **THEN** the grid SHALL show appointments for ALL users for the selected week
- **THEN** appointments belonging to the current user SHALL be included

#### Scenario: Full week range

- **WHEN** a user navigates to any week
- **THEN** all appointments from all users within that ISO week SHALL be displayed

#### Scenario: Own appointments remain

- **WHEN** a user views the grid
- **THEN** their own appointments SHALL continue to appear and behave as before

### Requirement: Visual differentiation by ownership

The system SHALL visually distinguish appointments belonging to other users from the current user's own appointments.

#### Scenario: Different background color

- **WHEN** the grid renders an appointment where `user_id !== currentUserId`
- **THEN** the block SHALL use a visually distinct background color (e.g., muted/lighter shade) compared to own appointments

#### Scenario: Ownership indicator

- **WHEN** the grid renders a foreign appointment
- **THEN** the block SHALL display a subtle visual cue (e.g., colored left-border accent) indicating it belongs to another user

#### Scenario: Own appointments unchanged

- **WHEN** the grid renders the current user's own appointment
- **THEN** the block SHALL use the standard styling (no muted colors, no border accent)

### Requirement: Foreign appointments read-only

The system SHALL prevent users from modifying appointments they do not own.

#### Scenario: Drag disabled

- **WHEN** a user attempts to pointer-down on a foreign appointment block
- **THEN** the drag operation SHALL NOT start
- **THEN** the block SHALL NOT move

#### Scenario: Resize disabled

- **WHEN** a user attempts to pointer-down on a foreign appointment's resize handle
- **THEN** the resize operation SHALL NOT start
- **THEN** the block SHALL NOT change

#### Scenario: Inline edit disabled

- **WHEN** a user double-clicks a foreign appointment block
- **THEN** the inline edit (textarea, save/cancel buttons) SHALL NOT appear

#### Scenario: Delete disabled

- **WHEN** a user drags a foreign appointment block toward the trashcan zone
- **THEN** the block SHALL NOT initiate drag (and therefore cannot reach trashcan)

#### Scenario: Create type from foreign appointment disabled

- **WHEN** a user attempts to drag a foreign appointment block onto the types panel
- **THEN** the drag SHALL NOT start, so the block cannot be dropped on the types panel

#### Scenario: Cursor indicates non-interactive

- **WHEN** a user hovers over a foreign appointment block
- **THEN** the cursor SHALL be `default` (not `pointer` or `grab`)

### Requirement: Global overlap prevention

The database exclusion constraint SHALL prevent overlapping appointments regardless of which user they belong to. No two appointments can occupy overlapping time ranges on the same date.

#### Scenario: Constraint is global

- **WHEN** the server starts
- **THEN** the `appointments` table SHALL have a `CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (date WITH =, during WITH &&)` — without filtering by user_id

#### Scenario: Different users cannot overlap

- **WHEN** user A has an appointment at 10:00–11:00 on a given date
- **THEN** user B SHALL NOT be able to create an appointment at 10:30–11:30 on the same date

#### Scenario: Own drag blocked by foreign obstacle

- **WHEN** a user drags their own appointment to a time or day where it would overlap a foreign appointment
- **THEN** the layout solver SHALL return `unresolved: true` (the drop is prevented)
- **THEN** the block SHALL snap back to its original position

#### Scenario: Own resize blocked by foreign obstacle

- **WHEN** a user resizes their own appointment such that it would overlap a foreign appointment
- **THEN** the layout solver SHALL return `unresolved: true` (the resize is prevented)
- **THEN** the block SHALL snap back to its original size

### Requirement: Layout solver respects ownership

The client-side layout solver SHALL treat foreign appointment blocks as fixed obstacles that cannot be shifted during conflict resolution.

#### Scenario: Foreign blocks never shifted

- **WHEN** the layout solver resolves overlaps during a drag or resize of the current user's own block
- **THEN** it SHALL only shift the current user's own blocks
- **THEN** foreign blocks SHALL remain in their original position

#### Scenario: Overlap with foreign = unresolved

- **WHEN** the proposed placement of a dragged/resized own block would overlap a foreign block
- **THEN** the solver SHALL NOT attempt to shift the foreign block
- **THEN** the solver SHALL return `unresolved: true`

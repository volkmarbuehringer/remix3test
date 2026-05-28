## Purpose

How client entries can trigger targeted frame reloads (`handle.frame.reload()`, `handle.frames.top.reload()`) to refresh specific content or the full document without navigation.

## Requirements

### Requirement: Client grid auto-refresh after CRUD

When a create, update, or delete operation completes on the client grid, the grid frame SHALL automatically reload to reflect the change without a full page navigation.

#### Scenario: Grid refreshes after edit save

- **WHEN** user edits a client row and saves
- **THEN** the page redirects to `/client`
- **AND** the client grid frame SHALL reload its content automatically
- **AND** the sort, filter, and pagination state SHALL be preserved

#### Scenario: Grid refreshes after delete

- **WHEN** user deletes a client row
- **THEN** the page redirects to `/client`
- **AND** the client grid frame SHALL reload its content automatically

#### Scenario: Grid refreshes after create

- **WHEN** user creates a new client record
- **THEN** the page redirects to `/client`
- **AND** the client grid frame SHALL reload its content automatically

### Requirement: Frame-scoped reload from client entry

A client entry inside a Frame SHALL be able to trigger a reload of that specific frame's content using `handle.frame.reload()`.

#### Scenario: Inline refresh button reloads only the frame

- **WHEN** user clicks a "Refresh" button rendered inside a Frame
- **THEN** only that frame's content SHALL be re-fetched from its `src` URL
- **AND** the parent page, sibling frames, and layout SHALL NOT be affected

### Requirement: Top-level frame reload from client entry

A client entry SHALL be able to trigger a full document-level reload using `handle.frames.top.reload()`.

#### Scenario: Client entry triggers full page reload

- **WHEN** user clicks a button in a client entry that calls `handle.frames.top.reload()`
- **THEN** the root document frame SHALL re-render with fresh server data
- **AND** persistent client entries SHALL retain their local state across the reload

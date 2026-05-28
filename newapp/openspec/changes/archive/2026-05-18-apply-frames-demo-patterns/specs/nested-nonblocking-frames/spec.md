## ADDED Requirements

### Requirement: Admin dashboard with independent frame sections

The admin dashboard SHALL render multiple `<Frame>` sections that load independently, with at least one frame containing a nested frame.

#### Scenario: Dashboard renders stats and activity frames

- **WHEN** user navigates to `/admin`
- **THEN** the page SHALL render with two or more frame sections (stats, recent activity, etc.)
- **AND** each frame SHALL load its content independently
- **AND** a fallback loading indicator SHALL be shown for each frame while its content streams in
- **AND** a fast-loading frame SHALL NOT be delayed by a slower-loading frame

#### Scenario: Activity frame contains nested user detail frame

- **WHEN** the recent activity frame finishes loading
- **THEN** each activity entry SHALL contain a nested `<Frame>` for user detail
- **AND** the nested frame SHALL have its own fallback loading indicator
- **AND** the nested frame SHALL only resolve when it enters the DOM (lazy loading)
- **AND** nested frames SHALL NOT block their parent frame from appearing

### Requirement: Frame content independence

Each frame in a nested hierarchy SHALL load and render independently from its parent, siblings, and children.

#### Scenario: Single frame failure doesn't cascade

- **WHEN** one frame in a hierarchy fails to load (e.g., returns 500)
- **THEN** the error SHALL be contained within that frame's boundary
- **AND** sibling and parent frames SHALL remain unaffected
- **AND** nested frames inside the failed frame SHALL NOT attempt to load

#### Scenario: Deep nesting with independent streaming

- **WHEN** a page contains frames nested 3 levels deep
- **THEN** each level SHALL stream its content as it becomes available
- **AND** a deep level SHALL NOT block rendering of shallower levels

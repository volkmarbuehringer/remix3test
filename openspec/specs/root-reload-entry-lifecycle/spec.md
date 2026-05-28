## Purpose

How client entries behave during document-level reloads (`handle.frames.top.reload()`), including cleanup via abort handlers, post-hydration setup via `queueTask()`, and state persistence for entries present in both old and new HTML.

## Requirements

### Requirement: Client entry cleanup on unmount

A client entry SHALL be able to register cleanup logic that runs when the entry is removed from the DOM (e.g., during a root reload or view toggle).

#### Scenario: Cleanup on root reload

- **WHEN** the root document frame reloads via `handle.frames.top.reload()`
- **THEN** each disposed client entry's abort handler SHALL be called
- **AND** the entry SHALL have an opportunity to clean up event listeners, timers, or DOM mutations

#### Scenario: Cleanup on client-mounted frame unmount

- **WHEN** a client-mounted `<Frame>` is unmounted by toggling its parent state to `false`
- **THEN** any client entries inside that frame SHALL have their abort handlers called
- **AND** resources SHALL be released

### Requirement: Post-hydration setup task

A client entry SHALL be able to schedule a task that runs after the initial hydration render is complete, using `handle.queueTask()`.

#### Scenario: Setup runs after hydration

- **WHEN** a client entry first renders during SSR and hydrates on the client
- **THEN** `handle.queueTask()` SHALL schedule the callback to run after the first client render
- **AND** the task SHALL only execute once per hydration cycle
- **AND** the task SHALL NOT execute during SSR

### Requirement: Persistent client entries across root reload

A client entry SHALL be able to preserve its local state across root document reloads when its server-rendered counterpart appears in the new HTML.

#### Scenario: Counter persists across root reload

- **WHEN** the root document reloads
- **THEN** persistent client entries (those present in both old and new HTML) SHALL retain their local state
- **AND** they SHALL receive updated server props from the new HTML
- **AND** transient entries (present in old but absent from new HTML) SHALL be properly disposed

### Requirement: Removable client entries with dispose detection

A client entry SHALL be able to detect when it is no longer present in the server-rendered HTML after a root reload.

#### Scenario: Removable entry dispatches dispose event

- **WHEN** a client entry is present in the old HTML but absent from the new HTML after a root reload
- **THEN** the entry SHALL be disposed
- **AND** its abort handler SHALL be called
- **AND** the entry SHALL NOT appear in the rendered page

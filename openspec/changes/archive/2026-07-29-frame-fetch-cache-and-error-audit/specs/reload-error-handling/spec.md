## ADDED Requirements

### Requirement: Navigation reload errors are visible to the user

When an agent-driven navigation triggers `frame.reload()`, errors SHALL be surfaced to the user rather than silently swallowed.

#### Scenario: Navigation error in agent-events-stream
- **WHEN** the agent streams a `navigate` event in `agent-events-stream.browser.tsx`
- **THEN** the `frame.reload()` rejection SHALL be handled with a user-visible error (not silent `() => {}`)

#### Scenario: Navigation error in workflow-agent-stream
- **WHEN** the agent streams a `navigate` event in `workflow-agent-stream.browser.tsx`
- **THEN** the `frame.reload()` rejection SHALL be handled with a user-visible error (not silent `() => {}`)

### Requirement: User-initiated refresh shows errors

When a user clicks a refresh button, errors from `frame.reload()` SHALL be handled gracefully.

#### Scenario: Grid refresh button handles rejection
- **WHEN** a user clicks the refresh button in `grid-refresh-button.browser.tsx`
- **AND** `handle.frame.reload()` rejects
- **THEN** the component SHALL catch the rejection and reset its pending state

### Requirement: SSE invalidate reload catches errors

When an SSE `invalidate` event triggers a background reload, errors SHALL NOT produce unhandled promise rejections.

#### Scenario: Connection indicator catches reload rejection
- **WHEN** the SSE `invalidate` event fires in `connection-indicator.browser.tsx`
- **AND** `handle.frame.reload()` rejects
- **THEN** the promise rejection SHALL be caught (not unhandled)

### Requirement: Existing background refresh suppression is preserved

All existing `.catch(() => {})` sites for frame reloads triggered by background events (SSE complete, SSE reconnection, form submission, frame switching) SHALL continue to suppress errors silently.

#### Scenario: All existing catch sites remain
- **WHEN** a frame reload is triggered by a background event (not user navigation)
- **THEN** the error SHALL be suppressed via `.catch(() => {})`

#### Scenario: Complete handler reloads in all 5 stream files
- **WHEN** an SSE `complete` event fires in any of the 5 stream files
- **THEN** `frame.reload()` SHALL still use `.catch(() => {})`

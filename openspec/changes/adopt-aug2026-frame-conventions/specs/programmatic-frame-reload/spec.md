## MODIFIED Requirements

### Requirement: Top-level frame reload from client entry

A client entry SHALL be able to trigger a full document-level reload using `handle.frames.top.reload()`.

#### Scenario: Client entry triggers full page reload

- **WHEN** user clicks a button in a client entry that calls `handle.frames.top.reload()`
- **THEN** the root document frame SHALL re-render with fresh server data
- **AND** persistent client entries SHALL retain their local state across the reload

#### Scenario: Reload response redirects to another page

- **WHEN** a top-level frame reload's server response is a redirect
- **THEN** the browser SHALL navigate to the redirect destination as a full document navigation
- **AND** the redirected document SHALL NOT be rendered inside any frame

## ADDED Requirements

### Requirement: Frame reload redirects navigate the top frame

When a frame reload's server response is a redirect, the frame runtime SHALL NOT render the redirected document inside the subframe; it SHALL navigate the top frame to the destination URL instead.

#### Scenario: Redirected frame reload bails to full navigation

- **WHEN** a frame reload request returns a redirect response while a frame target is set
- **THEN** the client runtime SHALL assign the destination URL as a top-level navigation
- **AND** the redirected document SHALL NOT be injected into the subframe
## Purpose

Behavior contract for Remix 3 frame navigation conventions: client-entry module preloading, redirect handling during frame reloads, the subframe-vs-topframe auth distinction, and history semantics for GET frame navigation.

## Requirements

### Requirement: Client entries preload their browser module graphs

The server renderer SHALL return preload hrefs alongside each resolved client entry so the browser can fetch the entry's module graph before hydration.

#### Scenario: Client entry resolves with preloads

- **WHEN** the server resolves a client entry during render
- **THEN** the resolved entry SHALL include preload hrefs for its browser module graph
- **AND** the document SHALL reference those preloads so the browser fetches them eagerly

### Requirement: Frame reload redirects navigate the top frame

When a frame reload's server response is a redirect, the frame runtime SHALL NOT render the redirected document inside the subframe; it SHALL navigate the top frame to the destination URL instead.

#### Scenario: Redirected frame reload bails to full navigation

- **WHEN** a frame reload request returns a redirect response while a frame target is set
- **THEN** the client runtime SHALL assign the destination URL as a top-level navigation
- **AND** the redirected document SHALL NOT be injected into the subframe

#### Scenario: Non-redirected frame reload stays in the frame

- **WHEN** a frame reload returns a normal `200` (or `422` validation) response
- **THEN** the response SHALL be rendered inside the subframe as usual

### Requirement: Unauthenticated subframe requests return 401 fragments

An unauthenticated request SHALL be treated as a subframe request — and answered with a 401 HTML fragment — only when both `X-Remix-Frame: true` and an `X-Remix-Target` header are present.

#### Scenario: Subframe request is unauthenticated

- **WHEN** a request carries `X-Remix-Frame: true` and `X-Remix-Target`
- **AND** the user is not authenticated
- **THEN** the response SHALL be a 401 HTML fragment (not a redirect)

#### Scenario: Top-frame reload of a frame-destined URL is unauthenticated

- **WHEN** a request carries `X-Remix-Frame: true` but no `X-Remix-Target`
- **AND** the user is not authenticated
- **THEN** the response SHALL redirect to the login page rather than return a 401 fragment

### Requirement: GET filter navigation replaces history entries

GET form navigations that filter or sort grid content SHALL replace the current history entry so successive filter changes do not accumulate history entries.

#### Scenario: Filter change replaces history entry

- **WHEN** the user changes a GET filter on an admin grid and submits
- **THEN** the frame navigates to the filtered URL with `replace` history semantics
- **AND** the previous filter URL SHALL NOT remain in the history stack

#### Scenario: Initial filter state still pushable

- **WHEN** the user navigates to a grid for the first time
- **THEN** the navigation SHALL push a normal history entry as usual
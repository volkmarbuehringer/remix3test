## Purpose

Keeps admin subframe form submissions (grid CRUD, agent panel frames) in-frame when the server responds with a redirect, so the host agent page is not replaced. Applies to admin frame targets only in step 1.

## ADDED Requirements

### Requirement: Admin subframe PRG redirects follow in-frame

When a form submission rendered inside an admin target frame (`X-Remix-Frame: true` with an `X-Remix-Target` in the admin target set) returns a same-origin redirect, the system SHALL re-fetch the redirect destination as a GET carrying the frame headers so the destination renders a fragment into the target frame, rather than letting the browser bail to a top-level navigation.

#### Scenario: Admin subframe form submission redirects in-frame

- **WHEN** a form inside an admin target frame (e.g. the agent-events-panel) submits to a route that returns a same-origin redirect
- **THEN** the redirect destination SHALL be re-fetched as a GET with the frame headers
- **AND** the destination fragment SHALL be returned to the frame instead of a redirect response
- **AND** the host page SHALL NOT be replaced

#### Scenario: Non-admin frame target redirect is returned unchanged

- **WHEN** a frame request carries an `X-Remix-Target` outside the admin target set and returns a redirect
- **THEN** the redirect SHALL be returned unchanged for the client to handle

#### Scenario: Non-frame request redirect is returned unchanged

- **WHEN** a request without `X-Remix-Frame: true` (or without an `X-Remix-Target`) returns a redirect
- **THEN** the redirect SHALL be returned unchanged

#### Scenario: Cross-origin redirect is not followed in-frame

- **WHEN** an admin subframe form submission redirects to a different origin
- **THEN** the redirect SHALL be returned unchanged for the client to handle

#### Scenario: Redirect depth limit prevents a loop

- **WHEN** an admin subframe form submission redirects and the redirect depth limit is reached
- **THEN** the redirect SHALL be returned unchanged rather than re-fetched again

### Requirement: In-frame followed redirects reconcile the frame source

When an admin subframe form submission's redirect is followed in-frame, the system SHALL reconcile the target frame's source to the redirect destination so a subsequent frame reload requests the GET-able destination, not the POST action URL.

#### Scenario: Frame reload after an in-frame PRG redirects

- **WHEN** an admin subframe form submission (e.g. activate/deactivate a user) follows a redirect in-frame
- **THEN** the target frame's source SHALL be set to the redirect destination
- **AND** a later frame reload (e.g. after the agent workflow finishes) SHALL render the destination fragment instead of a 404 for the POST action URL

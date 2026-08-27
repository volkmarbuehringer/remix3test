## MODIFIED Requirements

### Requirement: Frame reload redirects navigate the top frame

When a frame reload's server response is a redirect, the frame runtime SHALL NOT render the redirected document inside the subframe; it SHALL navigate the top frame to the destination URL instead. Admin subframe form submissions that return a same-origin redirect are the exception — they are followed in-frame (see `admin-frame-redirect-follow`).

#### Scenario: Redirected frame reload bails to full navigation

- **WHEN** a frame reload request returns a redirect response while a frame target is set
- **THEN** the client runtime SHALL assign the destination URL as a top-level navigation
- **AND** the redirected document SHALL NOT be injected into the subframe

#### Scenario: Admin subframe form submission stays in-frame

- **WHEN** a form submission rendered inside an admin target frame returns a same-origin redirect
- **THEN** the redirect destination SHALL be re-fetched as a GET with the frame headers and rendered as a fragment into that frame
- **AND** the redirect is resolved server-side before it reaches the client, so it does not bail to a top-level navigation

#### Scenario: Non-redirected frame reload stays in the frame

- **WHEN** a frame reload returns a normal `200` (or `422` validation) response
- **THEN** the response SHALL be rendered inside the subframe as usual

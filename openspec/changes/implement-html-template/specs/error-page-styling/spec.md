## ADDED Requirements

### Requirement: Server error page (500)
The system SHALL return a styled HTML page with status 500 when an unhandled error escapes the router. The page SHALL be a complete HTML document with inline CSS matching the app's light-mode theme. The page SHALL display the heading "Serverfehler" and the message "Bitte versuchen Sie es später erneut." Content SHALL be in German.

#### Scenario: Unhandled error triggers styled 500 page
- **WHEN** an unhandled error is thrown during request processing
- **THEN** the server returns a 500 response with Content-Type `text/html` and a styled HTML body containing "Serverfehler" and "Bitte versuchen Sie es später erneut."

### Requirement: Rate limit error page (429)
The system SHALL return a styled HTML page with status 429 when an IP exceeds the configured request rate limit. The page SHALL include the retry-after duration in human-readable form. The response SHALL include the same rate-limit headers as the current implementation (`Retry-After`, `Ratelimit-Limit`, `Ratelimit-Remaining`, `Ratelimit-Reset`).

#### Scenario: Rate limited user sees styled 429 page
- **WHEN** a request exceeds the configured rate limit
- **THEN** the middleware returns a 429 response with Content-Type `text/html`, a styled HTML body with "Zu viele Anfragen" heading, an explanation message, and the retry-after duration displayed as "Wiederholen in X Sekunden"

#### Scenario: Rate limit headers preserved on HTML response
- **WHEN** a rate-limited response is returned
- **THEN** the response includes `Retry-After`, `Ratelimit-Limit`, `Ratelimit-Remaining`, and `Ratelimit-Reset` headers with the same values as the current implementation

### Requirement: Import pattern consistency
The system SHALL use `import { html } from 'remix/html-template'` and coerce the result with `String(html\`...\`)`, matching the existing pattern in `auth.ts`, `render.tsx`, and `send-email.ts`.

#### Scenario: Pattern matches existing usage
- **WHEN** an HTML error page is constructed
- **THEN** it uses `String(html\`...\`)` with the `html` tagged template from `remix/html-template`

### Requirement: 500 page minimality
The 500 error page SHALL contain only essential HTML structure and a minimal set of inline styles to reduce risk of cascading failures. It SHALL NOT import or depend on any external resources (fonts, images, scripts).

#### Scenario: 500 page has no external dependencies
- **WHEN** the 500 page is rendered
- **THEN** the response HTML contains no external resource references (no `<link>`, no `<script src>`, no `@import` in CSS)

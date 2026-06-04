## ADDED Requirements

### Requirement: SMTP transport via nodemailer

The system SHALL provide an SMTP transport configured from environment variables, using the `nodemailer` library.

#### Scenario: Transport reads SMTP config from env

- **WHEN** the mailer middleware initializes
- **THEN** a nodemailer transport is created using `SMTP_HOST` and `SMTP_PORT` environment variables
- **AND** if `SMTP_HOST` is not set, it defaults to `localhost`
- **AND** if `SMTP_PORT` is not set, it defaults to `1025` (Mailpit default)

#### Scenario: Transport available via middleware context

- **WHEN** a controller/action accesses the request context
- **THEN** `context.mailer` provides a typed `sendEmail` function

### Requirement: Send email helper

The system SHALL provide a `sendEmail` helper that composes and sends emails with HTML and plain text bodies.

#### Scenario: Send a simple email

- **WHEN** `sendEmail({ to, subject, text, html })` is called
- **THEN** an email is dispatched via the SMTP transport
- **AND** the `from` address defaults to a configurable value (env `SMTP_FROM` or `noreply@localhost`)
- **AND** both `text` and `html` versions are included if provided

#### Scenario: Send email with CC and BCC

- **WHEN** `sendEmail({ to, cc, bcc, subject, text })` is called
- **THEN** the email includes CC and BCC recipients
- **AND** BCC recipients are not visible to other recipients

#### Scenario: Email sending returns info

- **WHEN** an email is successfully sent
- **THEN** the function returns the nodemailer `SentMessageInfo` for logging

### Requirement: Verification email template

The system SHALL render verification emails using `remix/html-template` for safe HTML generation.

#### Scenario: Verification email content

- **WHEN** a verification email is composed for user "John" with token "abc123"
- **THEN** the HTML body contains a greeting addressing "John"
- **AND** the body contains a link to the verification URL (e.g., `https://example.com/auth/verify/abc123`)
- **AND** the body mentions the 24-hour expiration
- **AND** the plain text body contains the same information as the HTML body

### Requirement: Mailer middleware

The system SHALL provide a `mailer()` middleware that creates the nodemailer transport and exposes it via the middleware context.

#### Scenario: Mailer middleware registered in the stack

- **WHEN** the application middleware stack is composed
- **THEN** the `mailer()` middleware is included after `loadDatabase()` and before `render()`
- **AND** the transport is created once at startup and reused across requests

#### Scenario: Mailer transport cleaned up on shutdown

- **WHEN** the application process exits
- **THEN** the nodemailer transport is closed to release connections

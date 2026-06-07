## ADDED Requirements

### Requirement: SMTP auth via env vars
The system SHALL read `SMTP_USER` and `SMTP_PASSWORD` from environment variables to authenticate with the SMTP server. When both are non-empty, the transport SHALL include nodemailer auth credentials. When either is empty/missing, the transport SHALL omit auth (backward compatible with local SMTP).

#### Scenario: Auth credentials provided
- **WHEN** `SMTP_USER` and `SMTP_PASSWORD` are both set and non-empty
- **THEN** the nodemailer transport SHALL include `auth: { user, pass }`

#### Scenario: Auth credentials empty
- **WHEN** `SMTP_USER` or `SMTP_PASSWORD` is empty or unset
- **THEN** the nodemailer transport SHALL NOT include auth

### Requirement: Secure mode for port 465
The system SHALL set `secure: true` when SMTP_PORT is 465, and `secure: false` otherwise.

#### Scenario: Port 465
- **WHEN** `SMTP_PORT` is 465
- **THEN** transport SHALL use `secure: true`

#### Scenario: Non-465 port
- **WHEN** `SMTP_PORT` is not 465 (or default 1025)
- **THEN** transport SHALL use `secure: false`

### Requirement: Backward compatibility
The system SHALL preserve current default behavior when no auth env vars are set: `ignoreTLS: true`, `host: 'localhost'`, `port: 1025`.

#### Scenario: No env overrides
- **WHEN** no SMTP_* env vars are set
- **THEN** transport SHALL use `host: 'localhost'`, `port: 1025`, no auth, `secure: false`, `ignoreTLS: true`

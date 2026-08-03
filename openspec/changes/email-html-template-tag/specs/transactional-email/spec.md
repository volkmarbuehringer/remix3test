## ADDED Requirements

### Requirement: HTML email body escaping

The system SHALL render the HTML body of every transactional email through the `remix/html-template` `html` tagged template so that interpolated values (user names, URLs) are automatically HTML-escaped, and SHALL coerce the result to a plain string before it is passed to the email transport.

#### Scenario: HTML characters in user name are escaped

- **WHEN** a verification email is composed for a user whose name contains HTML markup (e.g. `<b>Max</b>`)
- **THEN** the HTML body contains the escaped form `&lt;b&gt;Max&lt;/b&gt;`
- **AND** the HTML body does not contain the raw markup

#### Scenario: Single quotes are escaped

- **WHEN** an email is composed with an interpolated value that contains a single quote (e.g. `O'Brien`)
- **THEN** the HTML body contains the escaped form `O&#39;Brien`
- **AND** the HTML body does not contain the raw single quote

#### Scenario: HTML body is a plain string for the transport

- **WHEN** a composed email is passed to the send function
- **THEN** the `html` field is a plain string value usable by nodemailer (not a `SafeHtml` wrapper object)

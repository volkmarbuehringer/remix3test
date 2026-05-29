## ADDED Requirements

### Requirement: Register endpoint rate limits excessive attempts per email

The registration POST endpoint SHALL rate-limit attempts keyed by normalized email address, blocking further attempts after a configurable threshold within a time window.

#### Scenario: Successful registration within rate limit
- **WHEN** a user submits valid registration data for a new email address
- **THEN** the account SHALL be created and the user SHALL be redirected to `/`
- **AND** the rate limiter SHALL NOT block the request

#### Scenario: Rate limit exceeded by repeated registration attempts for same email
- **WHEN** the same email address exceeds 5 registration attempts within a 15-second window
- **AND** the first 4 attempts may have failed for various reasons (duplicate email, invalid input)
- **THEN** the 5th+ attempt within that window SHALL receive a 429 response
- **AND** the response SHALL include a meaningful error message indicating rate limiting

#### Scenario: Rate limit resets after window expires
- **WHEN** an email address has been rate-limited
- **AND** the 15-second window elapses without further attempts
- **THEN** a new registration attempt SHALL be allowed (the rate limit resets)

#### Scenario: Successful registration resets the rate limit counter for that email
- **WHEN** a registration attempt for an email address succeeds (account created)
- **THEN** the rate limit counter for that email SHALL be reset to zero

#### Scenario: Rate limit uses normalized email (case-insensitive, trimmed)
- **WHEN** a user submits registration with email `"User@Example.COM "`
- **THEN** the rate limit key SHALL use the normalized form `user@example.com`
- **AND** subsequent attempts with any casing variation SHALL count against the same bucket

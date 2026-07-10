## ADDED Requirements

### Requirement: Suppress successful asset request logs

The system SHALL NOT log HTTP requests where the path starts with `/assets/` and the response status is less than 400.

#### Scenario: Successful asset request is suppressed

- **WHEN** a request to `/assets/app/ui/something.js` returns status 200
- **THEN** no log line SHALL be written for that request

#### Scenario: Asset error is still logged

- **WHEN** a request to `/assets/app/ui/something.js` returns status 404 or 500
- **THEN** a log line SHALL be written for that request

#### Scenario: Non-asset requests are unaffected

- **WHEN** a request to `/admin/users` returns any status
- **THEN** a log line SHALL be written for that request

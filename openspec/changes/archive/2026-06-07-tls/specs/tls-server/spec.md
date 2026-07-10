## ADDED Requirements

### Requirement: Production server SHALL use HTTPS with self-signed certificates

When NODE_ENV=production, the server SHALL create an HTTPS server using TLS key and certificate files from the project root.

#### Scenario: Production starts with valid cert files

- **WHEN** NODE_ENV=production and key.pem and cert.pem exist in project root
- **THEN** server SHALL start on the configured port using https.createServer with those files

#### Scenario: Production starts without cert files

- **WHEN** NODE_ENV=production and key.pem or cert.pem is missing
- **THEN** server SHALL log an error and exit with a non-zero code

#### Scenario: Development starts with HTTP

- **WHEN** NODE_ENV is not production
- **THEN** server SHALL start using http.createServer regardless of cert file presence

### Requirement: Certificate files SHALL use hardcoded paths

The server SHALL read key and certificate from `./key.pem` and `./cert.pem` relative to the project root.

#### Scenario: Cert paths are fixed

- **WHEN** server starts in production mode
- **THEN** it SHALL read TLS key from `./key.pem` and certificate from `./cert.pem`

### Requirement: HTTPS request URLs SHALL use https protocol

The server SHALL construct request URLs with `https:` protocol when serving over TLS.

#### Scenario: Request protocol is correct

- **WHEN** an https request arrives at the production server
- **THEN** the request handler receives a Request object with protocol set to https

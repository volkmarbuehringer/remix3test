## ADDED Requirements

### Requirement: Server compresses responses with gzip/brotli

The middleware stack SHALL include the `compression()` middleware from `remix/compression-middleware`. Responses SHALL be transparently compressed based on the request's `Accept-Encoding` header.

#### Scenario: Browser supporting gzip receives compressed response

- **WHEN** a request arrives with `Accept-Encoding: gzip`
- **THEN** the response SHALL have `Content-Encoding: gzip` and a compressed body

#### Scenario: Browser supporting brotli receives compressed response

- **WHEN** a request arrives with `Accept-Encoding: br`
- **THEN** the response SHALL have `Content-Encoding: br` and a compressed body

#### Scenario: No compression for non-text responses

- **WHEN** a response has a binary Content-Type (e.g., image/png)
- **THEN** the compression middleware SHALL skip compression

### Requirement: Compression middleware runs early in the stack

The `compression()` middleware SHALL be placed after `logger()` and before `formData()` in the middleware array.

#### Scenario: Compression is before other processing middleware

- **WHEN** the middleware stack is inspected
- **THEN** `compression()` SHALL appear before `formData()`, `session()`, and downstream middleware

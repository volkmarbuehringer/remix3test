## ADDED Requirements

### Requirement: Rate limiter factory

The system SHALL provide a `createRateLimiter()` factory that creates rate limiter instances with configurable time windows, supporting both global and per-user modes.

#### Scenario: Global rate limiter check passes
- **WHEN** `rateLimiter.check()` is called after the configured window has elapsed since the last `rateLimiter.set()`
- **THEN** it SHALL return `{ allowed: true }`

#### Scenario: Global rate limiter check fails
- **WHEN** `rateLimiter.check()` is called within the configured window since the last `rateLimiter.set()`
- **THEN** it SHALL return `{ allowed: false, retryAfter: <seconds> }`

#### Scenario: Rate limiter reset
- **WHEN** `rateLimiter.reset()` is called
- **THEN** subsequent checks SHALL return `{ allowed: true }` as if no action was recorded

#### Scenario: Per-user rate limiter
- **WHEN** a rate limiter is created with `perUser: true`
- **THEN** `check(userId)` and `set(userId)` SHALL track each user independently, and `check(userId)` SHALL throw if called without a userId

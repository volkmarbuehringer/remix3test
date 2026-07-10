# catch-error-logging Specification

## Purpose

TBD - created by archiving change type-event-handlers-and-error-logging. Update Purpose after archive.

## Requirements

### Requirement: Bare catch blocks log errors via context.logger

The system SHALL log caught errors using `context.logger` (from `remix/middleware/logger`) in bare `catch {}` blocks.

#### Scenario: JSON body parsing failure logs the error

- **WHEN** `context.request.json()` throws in `lists/controller.tsx`
- **THEN** the catch block SHALL call `context.logger` with the error before returning the 400 response

#### Scenario: Invalid list ID parsing logs the error

- **WHEN** `s.parse(s.number(), ...)` throws in `lists/controller.tsx`
- **THEN** the catch block SHALL call `context.logger` with the error before returning the 400 response

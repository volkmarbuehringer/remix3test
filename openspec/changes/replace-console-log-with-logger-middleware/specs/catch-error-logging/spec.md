# catch-error-logging Specification

## Purpose

Extend `context.logger` usage from bare catch blocks to all server-side console calls, and remove the deprecated `userLogger` utility.

## MODIFIED Requirements

### Requirement: Bare catch blocks log errors via context.logger

The system SHALL log caught errors using `context.logger` (from `remix/middleware/logger`) in bare `catch {}` blocks, and all other server-side error/warning log calls SHALL also use `context.logger`.

#### Scenario: JSON body parsing failure logs the error

- **WHEN** `context.request.json()` throws in `lists/controller.tsx`
- **THEN** the catch block SHALL call `context.logger` with the error before returning the 400 response

#### Scenario: Invalid list ID parsing logs the error

- **WHEN** `s.parse(s.number(), ...)` throws in `lists/controller.tsx`
- **THEN** the catch block SHALL call `context.logger` with the error before returning the 400 response

#### Scenario: Auth email errors log via context.logger

- **WHEN** sending a verification or password-reset email fails in `auth/controller.tsx`
- **THEN** the catch block SHALL call `context.logger` instead of `console.error`

#### Scenario: Admin/conversation errors log via context.logger

- **WHEN** loading conversations fails in `admin/controller.tsx`
- **THEN** the catch block SHALL call `context.logger` instead of `console.error`

#### Scenario: Verwaltung constraint violations log via context.logger

- **WHEN** a DB constraint violation occurs in `verwaltung/controller.tsx`
- **THEN** the catch block SHALL call `context.logger` instead of `console.error`

#### Scenario: Nutzer DB errors log via context.logger

- **WHEN** a DB error occurs in `nutzer/controller.tsx`
- **THEN** the catch block SHALL call `context.logger` instead of `console.error`

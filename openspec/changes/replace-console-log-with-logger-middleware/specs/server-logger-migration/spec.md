# server-logger-migration Specification

## Purpose
Replace all server-side raw `console.log`/`console.warn`/`console.error` calls with `context.get(Logger)` from `remix/middleware/logger`, and remove the deprecated `userLogger` utility.

## ADDED Requirements

### Requirement: Controllers use context.logger instead of console.error

All server-side action handlers SHALL use `context.get(Logger)?.()` for error and warning log messages instead of raw `console.error` or `console.warn`.

#### Scenario: Auth controller email errors use context.logger

- **WHEN** sending a verification email fails in `auth/controller.tsx`
- **THEN** the catch block SHALL call `context.get(Logger)?.()` instead of `console.error`
- **WHEN** sending a password reset email fails in `auth/controller.tsx`
- **THEN** the catch block SHALL call `context.get(Logger)?.()` instead of `console.error`

#### Scenario: Admin chatlog errors use context.logger

- **WHEN** loading conversations fails in `admin/controller.tsx`
- **THEN** the catch block SHALL call `context.get(Logger)?.()` instead of `console.error`

#### Scenario: Verwaltung constraint violations use context.logger

- **WHEN** a constraint violation occurs during resource/offering-config CRUD in `verwaltung/controller.tsx`
- **THEN** the catch block SHALL call `context.get(Logger)?.()` instead of `console.error`

#### Scenario: Nutzer DB errors use context.logger

- **WHEN** a database error occurs during nutzer update or create in `nutzer/controller.tsx`
- **THEN** the catch block SHALL call `context.get(Logger)?.()` instead of `console.error`

### Requirement: userLogger utility is removed

The `app/utils/logger.ts` file SHALL be deleted and its callers in `ai/controller.tsx` SHALL use `context.get(Logger)` instead.

#### Scenario: AI controller chat/agent/workflow handlers use context.logger

- **WHEN** any action handler in `ai/controller.tsx` needs to log a message
- **THEN** it SHALL use `context.get(Logger)?.()` with an explicit user-context prefix (e.g., `[Chat] [user:${id}]`)
- **AND** the `userLogger` import SHALL be removed

### Requirement: Middleware files use context.logger for warnings

Middleware files SHALL use `context.get(Logger)` instead of raw `console.warn`.

#### Scenario: skipAssetsLogger asset errors use context.logger

- **WHEN** an asset request returns status >= 400 in `middleware/root.ts`
- **THEN** the warning SHALL use `context.get(Logger)?.()` instead of `console.warn`

#### Scenario: Global rate limit warnings use context.logger

- **WHEN** a rate limit is exceeded in `middleware/global-rate-limit.ts`
- **THEN** the warning SHALL use `context.get(Logger)?.()` instead of `console.warn`

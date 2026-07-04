## ADDED Requirements

### Requirement: `app/router.ts` exports only a factory
`app/router.ts` SHALL export `createNewappRouter` (and only related types). It SHALL NOT export a module-level constructed router instance named `router`.

#### Scenario: No module-level singleton
- **WHEN** a maintainer greps `app/router.ts` for `export const router`
- **THEN** zero matches are returned

#### Scenario: Factory is the only router export
- **WHEN** a maintainer enumerates the named exports of `app/router.ts`
- **THEN** `createNewappRouter` is present
- **AND** no `router` named export (a constructed instance) is present

### Requirement: Test consumers import the shared instance from `app/test-router.ts`
A single new module `app/test-router.ts` SHALL construct the shared test router once and re-export it. Test files that need a router instance SHALL import it from `app/test-router.ts`, not from `app/router.ts`.

#### Scenario: test-router.ts owns the shared singleton
- **WHEN** a maintainer reads `app/test-router.ts`
- **THEN** it calls `createNewappRouter()` exactly once at module scope
- **AND** exports the resulting instance as a named `router` export

#### Scenario: Test files import from the test helper
- **WHEN** a maintainer greps `app/actions/**/*.test.*` and `app/middleware/**/*.test.*` and `app/ui/**/*.test.*` and `app/router.test.ts` for `import { router } from`
- **THEN** every match's import path resolves to `app/test-router.ts`
- **AND** no test file imports `router` from `app/router.ts`

### Requirement: `app/test-utils.ts` builds its own router for overrides
`app/test-utils.ts` SHALL call `createNewappRouter({ ... })` to construct its own router when it needs test-specific cookie/session storage overrides. For the unconditional `router.fetch(url)` helper used by `createCsrfSession`, `test-utils.ts` MAY import the shared instance from `app/test-router.ts` to keep test runtime behavior identical.

#### Scenario: test-utils does not import the production singleton
- **WHEN** a maintainer greps `app/test-utils.ts` for `from './router.ts'`
- **THEN** zero matches are returned (any router import resolves to `./test-router.ts`)

#### Scenario: test-utils can override session storage
- **WHEN** a test needs a session storage backend that differs from production
- **THEN** `app/test-utils.ts` calls `createNewappRouter({ sessionCookie, sessionStorage })` with the override
- **AND** does not import a `router` singleton from `app/router.ts`

### Requirement: Server entry is the only production consumer of `createNewappRouter`
The HTTP listener entry point (`server.ts`) SHALL remain the only place in production code that constructs the router by calling `createNewappRouter(...)`.

#### Scenario: Entry point owns the production singleton
- **WHEN** a maintainer reads `server.ts`
- **THEN** `createNewappRouter(...)` is called there
- **AND** the returned router is passed to the request handler
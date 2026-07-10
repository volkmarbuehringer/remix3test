# Router Composition Root

## Purpose

The `app/router.ts` composition root SHALL be side-effect-free at module load time. Workflow registration SHALL be an explicit call, and the router singleton SHALL be constructed by the entry point — not by `app/router.ts` itself.

## ADDED Requirements

### Requirement: No side-effect imports in `app/router.ts`

`app/router.ts` SHALL NOT use side-effect imports (e.g. `import './workflows/definitions/index.ts'`) for registration. Any module that needs to register extensions with the router SHALL expose a named function the router entry calls explicitly.

#### Scenario: Workflows registered via explicit call

- **WHEN** a maintainer reads `app/router.ts`
- **THEN** an `import { registerWorkflows }` (or equivalent named import) is present
- **AND** `registerWorkflows()` is invoked inside `createNewappRouter()` before any `router.map(...)` call

#### Scenario: No bare import for side effects

- **WHEN** a maintainer greps `app/router.ts` for `^import './` (string-only side-effect imports)
- **THEN** zero matches are returned

### Requirement: `app/router.ts` exports a factory, not a singleton

`app/router.ts` SHALL export `createNewappRouter` (and only related types). It SHALL NOT export a module-level constructed router instance.

#### Scenario: No module-level singleton

- **WHEN** a maintainer greps `app/router.ts` for `export const router`
- **THEN** zero matches are returned

#### Scenario: Factory is the only export

- **WHEN** a maintainer enumerates the named exports of `app/router.ts`
- **THEN** `createNewappRouter` is present
- **AND** no `router` named export (a constructed instance) is present

### Requirement: The server entry constructs the router

The HTTP listener entry point (e.g. `app/server.ts`) SHALL construct the router by calling `createNewappRouter(...)` and pass the resulting instance to the request handler.

#### Scenario: Entry point owns the singleton

- **WHEN** a maintainer reads the server entry
- **THEN** `createNewappRouter(...)` is called there
- **AND** the returned router is passed into the request handler (or set as the module's default export consumed by Remix)

### Requirement: Tests build their own router

`app/test-utils.ts` SHALL construct its own router via `createNewappRouter(...)` with test-specific options (cookie/storage overrides) instead of importing a module-level singleton from `app/router.ts`.

#### Scenario: Test utils override session storage

- **WHEN** a test needs a session storage backend that differs from production
- **THEN** `app/test-utils.ts` calls `createNewappRouter({ ... })` with the override
- **AND** does not import a `router` singleton from `app/router.ts`

#### Scenario: Production singleton stays out of the test path

- **WHEN** a maintainer greps `app/test-utils.ts` for `from './router'` or `from '../router'`
- **THEN** the import (if any) resolves to the factory `createNewappRouter`
- **AND** no `import { router }` statement is present

### Requirement: Workflow registration ordering is preserved

`registerWorkflows()` SHALL be invoked before any `router.map(...)` call inside `createNewappRouter`, matching today's guarantee that workflows register before route mapping.

#### Scenario: Routes mapped after registration

- **WHEN** `createNewappRouter(...)` executes
- **THEN** `registerWorkflows()` completes
- **AND** only then does the first `router.map(...)` run

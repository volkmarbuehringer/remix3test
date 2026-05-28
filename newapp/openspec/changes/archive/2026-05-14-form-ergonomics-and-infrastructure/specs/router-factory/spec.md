## ADDED Requirements

### Requirement: Router is created via factory function

The router SHALL be created by calling `createNewappRouter(options?)` instead of being a module-level singleton. The function SHALL return a configured router instance.

#### Scenario: Factory called with no options
- **WHEN** `createNewappRouter()` is called without arguments
- **THEN** it SHALL use default values for sessionCookie and sessionStorage
- **THEN** it SHALL return a fully configured router with all routes mapped

#### Scenario: Factory called with custom session
- **WHEN** `createNewappRouter({ sessionCookie: customCookie, sessionStorage: customStorage })` is called
- **THEN** the router SHALL use the provided cookie and storage for sessions

### Requirement: Router factory creates middleware stack

The factory function SHALL construct the middleware stack internally, using the same order as the current singleton.

#### Scenario: Middleware stack order is preserved
- **WHEN** `createNewappRouter()` is called
- **THEN** the middleware stack SHALL be: logger → compression → formData → methodOverride → session → asyncContext → database → auth → assetEntry → render

### Requirement: Factory exports session defaults for DI

The factory callers SHALL be able to import `sessionCookie` and `sessionStorage` from `middleware/session.ts` (already exported) and pass them to the factory.

#### Scenario: server.ts uses factory
- **WHEN** `server.ts` imports `createNewappRouter`
- **THEN** it SHALL call the factory and use the returned router's `.fetch()` method
- **THEN** the application SHALL work identically to the singleton pattern

#### Scenario: Test uses factory with mock storage
- **WHEN** a test calls `createNewappRouter({ sessionStorage: mockStorage })`
- **THEN** the returned router SHALL use mockStorage for session data
- **THEN** no file system session files are created during the test

### Requirement: Router factory maps all routes

The factory function SHALL map all route trees (main, auth, AI, admin, workflow definitions) identically to the current singleton, preserving the complete route contract.

#### Scenario: All routes are mapped
- **WHEN** the factory creates a router
- **THEN** `router.fetch(new Request('/'))` SHALL return the home page
- **THEN** `router.fetch(new Request('/admin'))` SHALL return the admin page
- **THEN** `router.fetch(new Request('/ai/chat'))` SHALL return the AI chat page

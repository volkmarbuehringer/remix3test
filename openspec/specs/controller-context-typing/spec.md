# Controller Context Typing

## Purpose

Define how controller helper functions receive request context, keeping the `AppContext` typing from the router boundary intact and preventing `any` from re-entering the controller layer.

## Requirements

### Requirement: Controller helpers are typed, never `any`
Controller helper functions that receive request context SHALL be typed with `AppContext` or a narrow slice of it. No controller helper SHALL declare a `context` or `db` parameter as `any`.

#### Scenario: Helper consumes multiple context members
- **WHEN** a helper consumes multiple context members (e.g. `db`, `url`, `session`, `render`)
- **THEN** its `context` parameter is typed as a `Pick<AppContext, ...>` covering exactly those members

#### Scenario: Helper consumes a single context member
- **WHEN** a helper consumes only one context member
- **THEN** its parameter is typed as a narrow slice of `AppContext` (e.g. `{ render: AppContext['render'] }`, `{ url: AppContext['url'] }`, or `db: AppContext['db']`) rather than the full `AppContext`

### Requirement: No `as unknown as` casts on authenticated identity
The admin identity extraction helper SHALL accept the typed auth state (`AuthState<User>`) and SHALL NOT cast the identity with `as unknown as`.

#### Scenario: Extracting admin identity
- **WHEN** `getAdminIdentity` is called with the request context's auth state
- **THEN** the identity is returned through the typed `AuthState<User>` narrowing without an `as unknown as` cast
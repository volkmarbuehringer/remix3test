## ADDED Requirements

### Requirement: JSON API error responses SHALL use a consistent envelope

All JSON error responses from the timeboxer API SHALL use a single `ApiError` shape:

```typescript
type ApiError = {
  error: string
  fieldErrors?: Record<string, string>
}
```

- `error` SHALL always be present with a human-readable message string
- `fieldErrors` SHALL be present only for field-level validation errors, mapping field names to message strings
- The `issues` array from `data-schema` parsing SHALL NOT be included in API error responses

#### Scenario: Validation error returns field errors
- **WHEN** a request fails field-level validation
- **THEN** the response SHALL have status 400 and body `{ error: "Validation failed.", fieldErrors: { "name": "Name is required." } }`

#### Scenario: Resource not found
- **WHEN** a schedule is not found
- **THEN** the response SHALL have status 404 and body `{ error: "Schedule not found." }`

#### Scenario: Authentication required
- **WHEN** an unauthenticated request hits a guarded route
- **THEN** the response SHALL have status 401 and body `{ error: "Authentication required." }`

#### Scenario: Conflict error
- **WHEN** a schedule name conflicts with an existing one
- **THEN** the response SHALL have status 409 and body `{ error: "Name must be unique.", fieldErrors: { "name": "Name must be unique." } }`

### Requirement: Auth guard middleware SHALL enforce authentication for schedules

A `requireAuth` middleware SHALL check `context.get(Auth).ok` and return a 401 `ApiError` response when authentication fails.

#### Scenario: Unauthenticated request to schedule route
- **WHEN** a request without valid session reaches `GET /schedules/1`
- **THEN** the middleware SHALL return status 401 with `{ error: "Authentication required." }`
- **AND** the action handler SHALL NOT execute

#### Scenario: Authenticated request to schedule route
- **WHEN** a request with valid session reaches `GET /schedules/1`
- **THEN** the middleware SHALL call `next()` and the action handler SHALL execute normally

### Requirement: Auth routes SHALL remain accessible without authentication

The `requireAuth` middleware SHALL NOT be applied to auth routes (login, signup).

#### Scenario: Unauthenticated login page
- **WHEN** an unauthenticated request reaches `GET /auth/login`
- **THEN** the login page SHALL render normally

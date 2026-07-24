## ADDED Requirements

### Requirement: Controller creation omits redundant context generic

Controllers SHALL omit the explicit `AppContext` generic on `createController()` and `createAction()` calls. The second generic type parameter is redundant because `RouterTypes.context` augmentation already resolves `DefaultContext` to the app's context type.

#### Scenario: createController without explicit AppContext

- **WHEN** a controller file calls `createController(routes.X, { actions: {...} })` without a second generic parameter
- **THEN** the controller's actions receive `AppContext` as their context type via `DefaultContext` resolution
- **AND** no TypeScript compilation errors occur from the inferred context type

#### Scenario: createAction without explicit AppContext

- **WHEN** an action file calls `createAction(routes.X, handler)` without a second generic parameter
- **THEN** the action's handler receives `AppContext` as its context type via `DefaultContext` resolution

### Requirement: Route groups use mount() for hierarchical registration

Route groups with multiple sub-routes SHALL use `router.mount()` instead of flat `router.map()` when the group represents a logical subtree (admin, verwaltung). The mount prefix provides organizational structure.

#### Scenario: Admin routes mounted at /admin

- **WHEN** the router is created
- **THEN** all admin sub-routes are registered under a `router.mount('/admin', ...)` block
- **AND** the route patterns resolve identically to the current flat registration

#### Scenario: Verwaltung routes mounted at /verwaltung

- **WHEN** the router is created
- **THEN** all verwaltung sub-routes are registered under a `router.mount('/verwaltung', ...)` block

### Requirement: Context properties accessed directly where registered

Middleware that registers a context value with `{ property: 'name' }` SHALL have that value accessed via `context.name` rather than `context.get(Key)` in all controller code.

#### Scenario: Logger accessed as context.logger

- **WHEN** controller code needs to log a message
- **THEN** it SHALL use `context.logger?.('message')` instead of `context.get(Logger)?.('message')`

#### Scenario: JsonBody accessed as context.jsonBody

- **WHEN** controller code needs to read a parsed JSON request body
- **THEN** it SHALL use `context.jsonBody` instead of `context.get(JsonBody)`

#### Scenario: ApiUser accessed as context.apiUser

- **WHEN** controller code needs to read the authenticated API user
- **THEN** it SHALL use `context.apiUser` instead of `context.get(ApiUser)`

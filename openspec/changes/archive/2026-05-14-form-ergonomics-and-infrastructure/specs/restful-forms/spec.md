## ADDED Requirements

### Requirement: Server supports method override via _method field

The server SHALL support overriding the HTTP method of POST requests by reading a `_method` form field from the request body. The overridden method MUST be one of PUT, DELETE, or PATCH.

#### Scenario: Form with _method=PUT overrides to PUT
- **WHEN** a POST request arrives with `_method=PUT` in the form body
- **THEN** the router SHALL route the request as PUT, matching `put()` route definitions

#### Scenario: Form with _method=DELETE overrides to DELETE
- **WHEN** a POST request arrives with `_method=DELETE` in the form body
- **THEN** the router SHALL route the request as DELETE, matching `del()` route definitions

#### Scenario: Form without _method field stays POST
- **WHEN** a POST request arrives without a `_method` field
- **THEN** the router SHALL route the request as POST

#### Scenario: GET requests are not affected
- **WHEN** a GET request arrives
- **THEN** the method override middleware SHALL pass through unchanged

### Requirement: RestfulForm component renders correct form markup

The `RestfulForm` component SHALL render a `<form method="POST">` with a hidden `_method` input for PUT, DELETE, and PATCH methods. For GET and POST, it SHALL render a standard `<form>` without the override field.

#### Scenario: RestfulForm with method="PUT" renders hidden _method input
- **WHEN** `<RestfulForm method="PUT">` is rendered
- **THEN** the output SHALL be `<form method="POST">` with `<input type="hidden" name="_method" value="PUT">`

#### Scenario: RestfulForm with method="GET" renders plain form
- **WHEN** `<RestfulForm method="GET">` is rendered
- **THEN** the output SHALL be `<form method="GET">` without hidden inputs

#### Scenario: RestfulForm passes through additional props
- **WHEN** `<RestfulForm method="PUT" action="/resource/42" encType="multipart/form-data">` is rendered
- **THEN** the action and encType attributes SHALL be passed through to the rendered `<form>`

### Requirement: Routes use RESTful methods for CRUD operations

Route definitions in `app/routes.ts` SHALL use `put()` and `del()` (delete) for update and destroy operations where applicable.

#### Scenario: Client update route uses put
- **WHEN** the client lab save route is defined
- **THEN** it SHALL use `put('/client/:id')` instead of `post('/client/save')`

#### Scenario: Client destroy route uses del
- **WHEN** the client lab destroy route is defined
- **THEN** it SHALL use `del('/client/:id')` instead of `post('/client/destroy/:rowId')`

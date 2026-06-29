## ADDED Requirements

### Requirement: Authenticate via Bearer token

The API SHALL authenticate requests using the existing webhook token via `Authorization: Bearer <token>` header. The token SHALL be validated against `process.env.WEBHOOK_TOKEN`. Requests without a valid token SHALL receive a 401 response.

#### Scenario: Missing Authorization header
- **WHEN** a request is made without an `Authorization` header
- **THEN** the API SHALL return 401 with a JSON error body

#### Scenario: Invalid token
- **WHEN** a request includes `Authorization: Bearer wrong-token`
- **THEN** the API SHALL return 401 with a JSON error body

#### Scenario: Valid token
- **WHEN** a request includes `Authorization: Bearer <valid WEBHOOK_TOKEN>`
- **THEN** the API SHALL process the request normally

### Requirement: List all lists

`GET /api/lists` SHALL return a paginated, filterable JSON array of all lists ordered by `created_at` descending.

#### Scenario: No lists exist
- **WHEN** a GET request is made to `/api/lists` and no lists exist
- **THEN** the API SHALL return 200 with `{ "data": [], "hasMore": false, "offset": 0 }`

#### Scenario: Lists exist
- **WHEN** a GET request is made to `/api/lists`
- **THEN** the API SHALL return 200 with a `data` array containing list objects with `id`, `description`, `items`, `created_at`, `updated_at`

#### Scenario: Pagination with offset and limit
- **WHEN** a GET request is made to `/api/lists?offset=10&limit=5`
- **THEN** the API SHALL return up to 5 records starting from offset 10, with `hasMore` indicating whether more records exist

#### Scenario: Filter by description
- **WHEN** a GET request is made to `/api/lists?filter=grocery`
- **THEN** the API SHALL return lists whose description ILIKE matches `%grocery%`, case-insensitively

#### Scenario: Filter by item label
- **WHEN** a GET request is made to `/api/lists?filter=Milk`
- **THEN** the API SHALL return lists containing an item whose label ILIKE matches `%Milk%`, case-insensitively

### Requirement: Get a single list

`GET /api/lists/:id` SHALL return a single list object by its numeric ID.

#### Scenario: List exists
- **WHEN** a GET request is made to `/api/lists/1` and the list exists
- **THEN** the API SHALL return 200 with `{ "id": 1, "description": "...", "items": [...], "created_at": ..., "updated_at": ... }`

#### Scenario: List not found
- **WHEN** a GET request is made to `/api/lists/9999999` and no list has that ID
- **THEN** the API SHALL return 404 with `{ "error": "List not found" }`

#### Scenario: Invalid ID
- **WHEN** a GET request is made to `/api/lists/abc`
- **THEN** the API SHALL return 400 with `{ "error": "Invalid list ID" }`

### Requirement: Create a list

`POST /api/lists` SHALL accept a JSON body with `description` and `items`, validate them, persist the list, and return the new list's ID.

#### Scenario: Valid creation
- **WHEN** a POST request is made to `/api/lists` with `{ "description": "My list", "items": [{ "id": "1", "label": "Item A" }] }`
- **THEN** the API SHALL return 200 with `{ "id": <number>, "description": "My list" }`

#### Scenario: Missing description
- **WHEN** a POST request is made to `/api/lists` without a `description` field
- **THEN** the API SHALL return 400 with `{ "error": "Description and items are required" }` (or similar validation message)

#### Scenario: Empty description
- **WHEN** a POST request is made to `/api/lists` with `"description": ""`
- **THEN** the API SHALL return 400 with an error message

#### Scenario: Missing items
- **WHEN** a POST request is made to `/api/lists` without an `items` field or with `"items": []`
- **THEN** the API SHALL return 400 with an error message

#### Scenario: Invalid JSON body
- **WHEN** a POST request is made to `/api/lists` with a malformed JSON body
- **THEN** the API SHALL return 400 with `{ "error": "Invalid JSON body" }`

### Requirement: Update a list

`PUT /api/lists/:id` SHALL accept a JSON body with `description` and `items`, validate the list exists, update it, and return the updated ID.

#### Scenario: Valid update
- **WHEN** a PUT request is made to `/api/lists/1` with `{ "description": "Updated", "items": [{ "id": "1", "label": "Changed" }] }`
- **THEN** the API SHALL return 200 with `{ "id": 1, "description": "Updated" }`

#### Scenario: List not found
- **WHEN** a PUT request is made to `/api/lists/9999999`
- **THEN** the API SHALL return 404 with `{ "error": "List not found" }`

#### Scenario: Invalid ID
- **WHEN** a PUT request is made to `/api/lists/abc`
- **THEN** the API SHALL return 400 with an error message

### Requirement: Delete a list

`DELETE /api/lists/:id` SHALL delete a list by ID.

#### Scenario: Successful deletion
- **WHEN** a DELETE request is made to `/api/lists/1` and the list exists
- **THEN** the API SHALL return 200 with `{ "deleted": true }`

#### Scenario: List not found
- **WHEN** a DELETE request is made to `/api/lists/9999999`
- **THEN** the API SHALL return 404 with `{ "error": "List not found" }`

#### Scenario: Invalid ID
- **WHEN** a DELETE request is made to `/api/lists/abc`
- **THEN** the API SHALL return 400 with an error message

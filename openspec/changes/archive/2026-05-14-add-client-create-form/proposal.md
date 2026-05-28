## Why

The client lab grid supports editing and deleting records but has no way to create new ones. Users must insert rows directly in the database. Adding a create form completes the CRUD cycle — create, read, update, and delete are all available through the UI.

## What Changes

- Add `POST /client` route for creating new client records
- Add "Add New" button visible on the client page (when not editing or creating)
- Add `?creating=true` query param to open an inline create form in the edit column
- Create `ClientCreatePage` component (reuses field layout from edit form but starts blank with sensible defaults)
- Wire the create action to insert a row, then redirect to `?editing=<new-id>`

## Capabilities

### New Capabilities
- `client-create`: POST route, create action, blank form component, "Add New" button, and `?creating=true` flow

### Modified Capabilities
- `restful-forms`: Add `POST` to the client route set (was only PUT/DELETE, now includes create)

## Impact

- `app/routes.ts`: Add `create: post('/')` to client route tree
- `app/actions/client/controller.tsx`: Add `create` action; update `index` to handle `?creating=true`
- `app/actions/client/page.tsx`: Add "Add New" button; conditionally show create form in edit column
- `app/actions/client/create-page.tsx`: **New** — blank form component for creating records
- No new dependencies — uses existing `RestfulForm`, `input` mixins, and `clients` table schema

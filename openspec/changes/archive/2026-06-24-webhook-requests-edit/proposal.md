## Why

The webhook requests grid currently offers "Erstellen" (create) and "Resenden" actions, but no way to edit an existing row's payload JSON. When a webhook request is created with incorrect or incomplete payload data, the only remedy is to delete and recreate it. Editing existing payloads should work the same way as composing new ones — load the key-value grid pre-populated, make changes, and save.

## What Changes

- Add an "Edit" button to each row in the webhook requests grid
- Add a `PUT /webhook-requests/:id` route for updating the payload
- Reuse the `WebhookComposer` key-value JSON editor (pre-populated with existing payload) for editing
- Follow the existing `?editing=` sidebar pattern used by other admin grids (client, nutzer, offerings)
- The grid page gains a two-column layout when editing is active (grid left, edit panel right)
- The edit panel loads the existing payload, converts it back to key-value rows, and on submit saves the updated JSON

## Capabilities

### New Capabilities

- `webhook-requests-edit`: Admin can edit an existing webhook request's JSON payload via a side-panel that reuses the key-value composer grid, pre-populated with the row's current payload data

### Modified Capabilities

- `webhook-requests-viewer`: The webhook requests grid table gains an "Edit" action button per row; the page renders in a two-column layout when `?editing=<id>` is present; the editing row is visually highlighted
- `webhook-composer`: The `WebhookComposer` clientEntry component is extended to accept an optional initial payload — when provided it renders pre-populated rows instead of starting from one empty row

## Impact

- `app/routes.ts`: Add `PUT /webhook-requests/:id` route
- `app/router.ts`: Wire new route to controller
- `app/actions/webhook-requests/controller.tsx`: Add `update` handler for the PUT route
- `app/ui/webhook-requests-page.tsx`: Add edit button per row, two-column layout when editing, highlight editing row
- `app/assets/webhook-composer.tsx`: Accept optional initial payload prop, split form action between create and edit targets
- `app/actions/webhook-requests/create/controller.tsx`: Optionally extract shared validation/DB insert logic
- OpenSpec spec `webhook-requests-viewer/spec.md` gains edit-related scenarios
- OpenSpec spec `webhook-composer/spec.md` gains edit-mode scenarios

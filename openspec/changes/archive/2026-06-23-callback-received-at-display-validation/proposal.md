## Why

The `callback_received_at` timestamp column exists in the database and is populated by the callback endpoint, but is not visible in the webhook requests grid. Users have no way to see when a callback arrived. Additionally, the callback endpoint allows duplicate callbacks for the same webhook request, silently overwriting the previous callback — it should reject a callback if one has already been received.

## What Changes

- Add a `callback_received_at` column to the webhook requests table UI, displaying the formatted timestamp
- Add a sortable column header for `callback_received_at`
- Before updating a webhook request in the callback handler, check if `callback_received_at` is already set; if so, return HTTP 409 Conflict
- Update the existing webhook-requests-viewer spec to include the new column

## Capabilities

### New Capabilities

- `callback-duplicate-protection`: Reject duplicate callbacks on already-processed webhook requests

### Modified Capabilities

- `webhook-requests-viewer`: Add callback_received_at column requirement to the table display

## Impact

- **app/actions/callback/controller.tsx**: Add duplicate callback check
- **app/ui/webhook-requests-page.tsx**: Add callback_received_at column and sorting
- **app/actions/webhook-requests/controller.tsx**: Add callback_received_at to ORDER_BY_COLUMNS for sorting support
- **openspec/specs/webhook-requests-viewer/spec.md**: Update requirements
- **app/actions/callback/controller.test.ts**: Update/add tests for duplicate rejection

## Why

Admins need a way to manually craft webhook payloads for Hermes without using external tools (curl, Postman). Currently the only way to create a `webhook_requests` row is via incoming POST to `/webhook` or `/app-webhook` from external systems. A simple in-app JSON composer grid removes this dependency.

## What Changes

- New route `GET+POST /webhook-requests/create` with a key-value grid UI
- A `clientEntry` component that manages grid rows (add/remove/edit) with live JSON preview
- On submit, inserts a row into `webhook_requests` with `token=''` and `headers='{}'`
- After insert, redirects to `/webhook-requests` where the row appears and can be resent to Hermes via the existing resend button
- "Compose" button added to the header of the existing `/webhook-requests` page

## Capabilities

### New Capabilities
- `webhook-composer`: Manual JSON payload composition via a key-value grid, insert into webhook_requests table

### Modified Capabilities

None

## Impact

- New file: `app/actions/webhook-requests/create/controller.tsx`
- New file: `app/ui/webhook-composer-page.tsx`
- New file: `app/assets/webhook-composer.tsx` (clientEntry)
- Modified: `app/routes.ts` (add route)
- Modified: `app/router.ts` (wire route)
- Modified: `app/ui/webhook-requests-page.tsx` (add "Compose" button)

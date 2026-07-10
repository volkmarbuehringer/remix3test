## Why

Webhook requests that failed to reach hermes or whose callback was never received currently have no recovery path. The grid is read-only — operators must manually re-trigger the webhook at the source. Adding a per-row resend action lets operators retry delivery without external intervention.

## What Changes

- Add a "Resenden" action button to every row in the webhook-requests grid
- When clicked, clear `callback_response` and `callback_received_at` to NULL, then re-POST the stored payload to hermes
- Update `hermes_status` with the new HTTP status code (or `"error"`)
- Broadcast an SSE `new_request` event to refresh connected viewers
- Add a new controller action + route for the resend operation
- Add confirmation dialog before executing the resend

## Capabilities

### New Capabilities

- `webhook-resend`: Per-row resend action on the webhook-requests grid that clears callback columns and re-forwards the payload to hermes

### Modified Capabilities

- `webhook-requests-viewer`: Add per-row action button column; spec requires update to reflect the new interactive capability

## Impact

- `app/actions/webhook-requests/controller.tsx` — add resend action handler
- `app/ui/webhook-requests-page.tsx` — add "Resenden" button per row + confirmation
- `app/routes.ts` — add `webhookRequestsResend` route (POST)
- `app/router.ts` — wire the new route
- `openspec/specs/webhook-requests-viewer/spec.md` — update requirements
- New spec file: `openspec/specs/webhook-resend/spec.md`

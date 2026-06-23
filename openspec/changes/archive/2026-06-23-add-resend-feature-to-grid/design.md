## Context

The webhook-requests grid at `/webhook-requests` displays rows from the `webhook_requests` table with sorting, filtering, pagination, and SSE-driven live refresh. Currently it is read-only — no per-row actions exist.

The app-webhook controller at `app/actions/app-webhook/controller.tsx` already contains the hermes forwarding logic: it POSTs `{ id, callbackUrl, payload }` to `HERMES_URL` with a 3-second timeout and stores the HTTP status in `hermes_status`. The resend action will reuse the same hermes URL and payload construction pattern.

The callback columns (`callback_response`, `callback_received_at`) are set by the callback endpoint at `/callback`. On resend, both must be cleared before re-forwarding so that a future callback response is accepted (the callback endpoint uses `WHERE callback_received_at IS NULL` as duplicate protection).

## Goals / Non-Goals

**Goals:**
- Add a POST route for resending a webhook request to hermes
- Clear `callback_response` and `callback_received_at` to NULL before resending
- Reuse the existing hermes URL and payload construction
- Update `hermes_status` with the new delivery result
- Add a "Resenden" button per row with confirmation
- Broadcast SSE `new_request` event so connected viewers auto-refresh

**Non-Goals:**
- No UI for editing the payload before resend
- No queueing or rate-limiting of resends
- No retry logic beyond a single attempt (matching original hermes forwarding)

## Decisions

- **Single POST route per row ID**: Add `POST /webhook-requests/:id/resend` as a standalone route, similar to the existing `nutzer/:id/reset-password` pattern. This keeps the action scoped and avoids overloading the grid controller.
- **Reuse `hermesUrl()` function**: The resend handler will inline the same hermes URL resolution and payload construction as the app-webhook controller. A shared helper could be extracted in a follow-up but is not required for this change.
- **Confirm before resend**: Use the existing `data-confirm` pattern (see `confirm-delete.tsx` client entry) with capture-phase click delegation rather than building a custom dialog.
- **POST form per row**: Each row gets a `<form method="POST" action="/webhook-requests/:id/resend">` button, matching the existing "Del" button pattern in the client grid. Grid state hidden inputs preserve offset/sort/filter after the action.
- **SSE broadcast `new_request`**: The resend handler broadcasts the existing `new_request` event (not a new event type) because the grid already auto-refreshes on it.

## Risks / Trade-offs

- **No shared `forwardToHermes()` helper**: Inline duplication with app-webhook controller. Acceptable for now; extraction is low-risk if a third call site emerges.
- **Resending while original is still in-flight**: The hermes_status will be overwritten. This is acceptable — the operator explicitly triggered the resend.
- **Race condition with callback arriving during resend**: If a callback arrives between clearing the columns and the hermes POST, the callback will set the columns again. For the same id/UUID this scenario is extremely unlikely; no special handling needed.

## 1. Route and Controller Setup

- [ ] 1.1 Add `webhookRequestsResend` route in `app/routes.ts` as `post('/:id/resend')`
- [ ] 1.2 Import the new route in `app/router.ts` and wire with `router.post()`
- [ ] 1.3 Add `webhookRequestsResend` to the CSRF skip list in `app/middleware/skip-csrf.ts` (if CSRF is enforced for POST routes)
- [ ] 1.4 Export a `webhookRequestsResend` handler from `app/actions/webhook-requests/controller.tsx`
- [ ] 1.5 Verify typecheck passes: `npm run typecheck`

## 2. Resend Handler Logic

- [ ] 2.1 In the resend handler, validate the `:id` param is a UUID and the row exists (404 if not found)
- [ ] 2.2 SELECT the row's `payload` from `webhook_requests` to get the stored JSON
- [ ] 2.3 UPDATE the row: set `callback_response = NULL`, `callback_received_at = NULL`
- [ ] 2.4 Construct the hermes payload: `{ id, callbackUrl, payload }` (reuse the same callback URL env var)
- [ ] 2.5 POST to `HERMES_URL` with 3-second timeout, store the HTTP status in `hermes_status`
- [ ] 2.6 Broadcast `webhookChannel.broadcast('new_request')` so connected viewers refresh
- [ ] 2.7 Return a redirect (303) to the referring URL preserving grid state params

## 3. UI: Resend Button per Row

- [ ] 3.1 Add a new column header "Aktion" in the webhook-requests grid table
- [ ] 3.2 Render a `<form method="POST" action="/webhook-requests/:id/resend">` in each row with a submit button labeled "Resenden"
- [ ] 3.3 Include `data-confirm="Resend wirklich ausführen?"` on the submit button (uses existing capture-phase click delegation)
- [ ] 3.4 Include `<GridStateHiddenInputs>` or equivalent hidden fields (`_offset`, `_sort`, `_order`, `_filter`) to preserve grid state

## 4. Spec Updates

- [ ] 4.1 Update `openspec/specs/webhook-requests-viewer/spec.md` with the modified requirement (per-row resend action) for main spec sync
- [ ] 4.2 Ensure `openspec/specs/webhook-resend/spec.md` is created as a new permanent spec (sync on archive)

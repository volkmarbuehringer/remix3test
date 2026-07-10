## Why

The booking dialog in the customer chat dumps up to 30 slots (10 days × 3 slots) as radio buttons — overwhelming and hard to navigate. Users have no way to browse slots beyond what's shown except typing "Haben Sie später noch Termine?", and no way to dismiss the form. Adding pagination (1 day at a time), prev/next navigation, and a cancel button makes the dialog compact, browsable, and dismissable with minimal changes to existing code.

## What Changes

- Booking dialog shows **1 day of slots at a time** instead of all available days
- **← / → navigation links** to page through days that have available slots
- **Abbrechen link** to dismiss the dialog and clear session state
- Page state tracked via `?page=N` query parameter (no JS needed)
- Cancel link clears `pendingBooking` from session and redirects to clean URL
- No changes to the booking submission flow or agent tooling

## Capabilities

### New Capabilities

_(none — this is a UI improvement to the existing booking flow)_

### Modified Capabilities

_(none — no spec-level requirement changes; the booking capability still allows finding and booking slots the same way)_

## Impact

- `app/ui/customer-chat-page.tsx` — booking card UI: only render 1 day group, add nav links and cancel link
- `app/actions/chat/controller.tsx` — index handler: read `?page` and `?cancel` query params, clamp page to valid range, clear session on cancel
- No changes to agent instructions, tools, schemas, or booking workflow
- No new dependencies

# Session Flash for Soft-Fork Routing

## What This Covers

One-shot post-action UI state (e.g., a routing card after booking) that must render once and self-clear on refresh. Read this when `session.set()` leaves the UI stuck on refresh, or when a consumed display value and a persisting flag leave the page rendering nothing.

## Problem

When a user completes an action (e.g., booking an appointment) and you want to show a routing decision card ("Fertig" / "Noch einen Termin"), using `session.set()` creates a hard gate:

```
action handler:
  session.set('routingFlag', '1')  // ← persistent across refreshes

index handler:
  if (session.get('routingFlag')) → render routing card, hide textarea
```

This causes two bugs:

1. **Stuck state on refresh**: The flag persists, so the routing card shows again even after refresh. The user can't type or interact normally.
2. **Stuck state on missing display data**: If `session.set('bookingResult', msg)` is consumed but `session.set('routingFlag')` persists, the UI renders nothing — no routing card (no text), no textarea (flag blocks it).

## Solution

Use `session.flash()` instead of `session.set()` for any UI state that should only render once and disappear on refresh:

```typescript
// Action handler — use flash for one-time state
session.flash('postBookingDecision', '1')
session.set('bookingResult', 'Termin #42 wurde gebucht.')

// Index handler — flash is consumed on read
let postBookingDecision = session.get('postBookingDecision')  // returns '1' once, then null
let bookingResult = session.get('bookingResult')

// Always consume bookingResult after reading
if (bookingResult) session.unset('bookingResult')
```

The routing card renders only on the first GET after the POST. On refresh, the flash is gone and the normal chat UI returns.

For session-flash inside frame fragments (the flash renders only in the top-level Layout), see `remix3-session-flash-frames`.

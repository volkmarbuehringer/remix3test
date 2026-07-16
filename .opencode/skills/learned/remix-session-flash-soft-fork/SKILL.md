---
name: remix-session-flash-soft-fork
description: "Use session.flash() not session.set() for one-time UI routing decisions that should clear on refresh"
origin: auto-extracted
---

# Remix Session Flash for Soft-Fork Routing

**Extracted:** 2026-07-11
**Context:** Remix 3 applications with session-driven UI state for post-action routing decisions

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

## When to Use

- Post-action routing decisions ("Fertig" vs "Weiter machen")
- One-time notifications or flash messages
- Any session state that should self-clean on page refresh
- "Soft fork" UI patterns where the user should not be stuck

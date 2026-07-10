## Context

The customer chat page (`app/ui/customer-chat-page.tsx`) renders an inline booking card when `pendingBooking` is set in the session. Currently it shows all days as radio-button groups with a single "Termin buchen" submit button. No way to browse days or dismiss.

All slot data is already available in `pendingBooking.slots` (up to 10 days × 3 slots = max 30 entries). The page state (`?page=N`) already survives redirects since the chat uses URL query parameters for `threadId` and `error`.

## Goals / Non-Goals

**Goals:**

- Show 1 day of slots at a time in the booking card
- Prev/next links to navigate through available days
- Cancel link to dismiss the booking card and clear session
- Zero JavaScript — all navigation via GET links
- Status-quo booking submission (POST radio selection)
- Minimal changes to the controller

**Non-Goals:**

- No changes to agent instructions, tools, booking workflow, or data layer
- No overlay/modal — stays as inline card in chat
- No lazy loading of additional days (agent already returns up to 10 days)
- No changes to the booking confirmation flow

## Decisions

### Decision: Query parameter for page state instead of hidden form input

Page is tracked via `?page=N` on the chat index URL. This survives page refreshes and is trivially read in the index handler. Hidden form inputs would require a wrapping form or JS to update.

**Alternatives considered:**

- Hidden input in a wrapping `<form>` with onchange submit → requires JS
- Session-based page index → more complex, survives page turns but adds session management

### Decision: Cancel clears pendingBooking from session and redirects

Clicking "Abbrechen" navigates to `?cancel=1`. The index handler detects this, calls `session.unset('pendingBooking')`, and redirects to the clean chat URL. The user must ask the agent again to see slots.

**Alternatives considered:**

- Just hide the card without clearing session → card would reappear on next page load

### Decision: Navigation is prev/next links (GET), not a form submit

Each nav link appends `?page=N&threadId=T` to the current URL. This is a simple GET navigation — no form overhead. The radio selection resets on page change, which is acceptable since the user picks a slot just before booking.

### Decision: Day keys computed from sorted slots, page clamped

`pendingBooking.slots` is sorted by date, then grouped into unique days. The day array index is the page number. Controller clamps `?page=` to `[0, maxPage]`. If page is out of bounds, it defaults to 0.

## Risks / Trade-offs

- **[Edge case] Single day → nav links should be hidden** to avoid showing pointless prev/next
- **[Edge case] Empty slots → booking card won't render** (handled by existing `pendingBooking.slots.length > 0` guard)
- **[Data] Agent returns max 10 days → if resource has 10+ days of openings, only first 10 are available** This is an existing limitation, not introduced here

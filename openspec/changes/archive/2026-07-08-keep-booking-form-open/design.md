## Context

The booking form lifecycle is entirely session-driven:

```
User selects slot → POST confirm_booking
  → bookingWorkflow creates appointment
  → On success: session.unset('pendingBooking')   ← destroys form
  → redirect GET /chat → form gone
```

The session stores `{ slots: SlotItem[], resource_id, resource_name, title }`. Slots are identified by `(date_epoch_ms, start_min)` pairs. The booking workflow already validates each slot against the DB (`isSlotBookable()`), so stale slots produce a graceful "collision" error.

## Goals / Non-Goals

**Goals:**
- After a successful booking, the form stays open with the remaining slots (minus the just-booked one)
- The Cancel link still dismisses the form entirely
- Sending a new chat message still clears stale booking data (existing behavior at line 323)
- Booking the last available slot clears `pendingBooking` (form disappears naturally)

**Non-Goals:**
- No changes to the booking workflow, agent instructions, or tool definitions
- No UI changes
- No chat-thread message injection for booking results (existing flash `bookingResult` is sufficient)
- No "book different resource" flow — user types a new message for that (existing behavior)
- No fresh-slot re-fetch from the DB after booking

## Decisions

### Decision 1: Remove only the booked slot, keep remaining

**Choice:** After `bookingSucceeded === true`, filter `pending.slots` to exclude `(date, startMin)` and re-save if non-empty.

```typescript
if (bookingSucceeded) {
  let updated = pending.slots.filter(
    s => !(s.date_epoch_ms === date && s.start_min === startMin)
  )
  if (updated.length > 0) {
    session.set('pendingBooking', JSON.stringify({ ...pending, slots: updated }))
  } else {
    session.unset('pendingBooking')
  }
}
```

**Rationale:** Minimal change. The booking form in `CustomerChatPage` already handles the `pendingBooking.slots` array being rendered dynamically — fewer slots means fewer radio buttons. If all slots are consumed, `pendingBooking` is cleared and the form disappears, same as before.

### Decision 2: Don't re-fetch slots from DB

**Choice:** Use the session's remaining slots as-is. Don't call `find_next_available_slots` again after booking.

**Rationale:** The booking validation step (`isSlotBookable()`) already catches slots that were taken by others between the initial fetch and the submit. Re-fetching would require either an agent round-trip or a new API call — neither is necessary for correctness. The trade-off (rare collision error for slots booked by someone else in the same second) is acceptable and consistent with the existing design.

### Decision 3: Don't append booking confirmation to chat thread

**Choice:** Keep the existing `bookingResult` flash-message pattern. Don't inject the confirmation into Mastra memory as an assistant message.

**Rationale:** The `bookingResult` already appears above the form. Injecting into the chat thread requires changes to memory management and would create duplicate messages on page reload. A follow-up change could add this if needed.

## Flow After Change

```
Session: pendingBooking = { slots: [A, B, C, D] }
  ↓ user books A
Booking succeeds → filter out A
Session: pendingBooking = { slots: [B, C, D] }
  ↓ form still visible, user books B
Booking succeeds → filter out B
Session: pendingBooking = { slots: [C, D] }
  ↓ user books C
Session: pendingBooking = { slots: [D] }
  ↓ user books D
Session: pendingBooking = undefined (all used)
  ↓ form disappears
  ↓ or user clicks Cancel at any point → form disappears
```

## Risks / Trade-offs

- **[Risk] Slots grow stale between bookings:** The `isSlotBookable()` validation in the workflow already catches this. User gets a "not available" error and can pick another slot. No correctness issue.
- **[Risk] User forgets which slots they already booked:** The `bookingResult` flash message shows "Termin #X wurde für Di 14.07. um 10:00 Uhr gebucht" after each booking, so the user sees confirmation before the form refreshes.
- **[Acceptance] No "all done" indication:** When all slots are used, the form disappears. The user might wonder what happened. The last `bookingResult` message still shows. The Cancel link provides an explicit exit.

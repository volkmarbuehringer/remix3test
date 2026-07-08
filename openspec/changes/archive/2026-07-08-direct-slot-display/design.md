## Context

The customer chat agent currently uses a 3-step flow: (1) search resources by capability → (2) recommend a resource → (3) ask the customer "Möchten Sie verfügbare Termine sehen?". Only after customer approval does it call `find_next_available_slots`. This adds conversational friction.

The `find_next_available_slots` tool currently returns only the top 3 slots globally. The booking form renders them as a flat radio list. For the new 2-tier display (days → timeslots), the tool needs to return more slots and the form needs a grouped layout.

## Goals / Non-Goals

**Goals:**
- Agent immediately calls `find_next_available_slots` after recommending a resource (no "ask permission" step)
- `find_next_available_slots` returns enough slots to show up to 3 days with up to 3 timeslots each (= up to 9 slots)
- Booking form displays slots grouped by day, with day headers and timeslots listed under each day
- Tests are updated to reflect the new agent behavior

**Non-Goals:**
- No changes to the booking workflow, booking agent, or booking confirmation logic
- No changes to the search resources tool
- No changes to the session/thread handling

## Decisions

1. **Tool returns up to 9 slots instead of 3, with day-grouped structure**
   - Change `allSlots.slice(0, 3)` to `allSlots.slice(0, 9)`
   - The existing response schema already has `date_epoch_ms`, `date_display`, `start_min`, `end_min` — no schema change needed
   - The front-end already has all the data needed to group by day

2. **Booking form restructured to day-grouped layout**
   - Instead of a flat list of radio buttons, group slots by `date_epoch_ms`
   - Render a day header (e.g. "Di, 14.07.") then indent the timeslot radio buttons under it
   - Use a `<fieldset>` per day or nested div groups with clear visual hierarchy
   - Radio buttons still use the same `day_start` naming convention

3. **Agent instruction change: remove the "ask permission" rule**
   - Replace the rule "FRAGE den Kunden, ob er verfügbare Termine sehen möchte. Bei Zustimmung: Rufe sofort find_next_available_slots auf"
   - New rule: "Nachdem du eine Ressource empfohlen hast: Rufe sofort find_next_available_slots mit der resourceId auf, ohne zu fragen"
   - Keep the rule that when the customer directly asks for booking, also call the tool

4. **Test strategy: update existing tests, add day-grouping assertions**
   - `postChatAndFollow` helper generates mock slots — add more slots (at least 6) to test the 2-tier rendering
   - Add assertions checking that day-grouped structure appears in the HTML

## Risks / Trade-offs

- [Agent may call tool when not appropriate] → Agent instructions explicitly state to call after every resource recommendation; the tool is read-only so no data corruption risk
- [More slots = more API cost] → The tool is a local DB query with negligible cost difference between 3 and 9 rows
- [Too many options overwhelm users] → 3 days × 3 slots = 9 max is still manageable; the day grouping improves scanability

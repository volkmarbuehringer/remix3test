## Context

The customer agent (`/chat`) currently uses one tool — `searchResourcesByCapability` — and explicitly refuses booking requests ("Bitte nutzen Sie die Buchungsseite"). The appointment booking wizard at `/appointments/new` exists as a separate multi-step form with its own slot-computation logic (offering lookup, full-hour slot generation, booking dedup).

The Mastra orchestrator registers two agents: `supportAgent` (admin, 17 tools) and `customerAgent` (customer, 1 tool). Both use `@mastra/core/agent` with `@mastra/memory` backed by `PostgresStore`. No Mastra workflows exist; all agent calls use direct `agent.generate()`.

The chat controller at `app/actions/chat/controller.tsx` currently handles GET (page render) and POST (message → `customerAgent.generate()`). There is no branching on action type and no mutation path.

## Goals / Non-Goals

**Goals:**
- Add a `findNextAvailableSlots` tool to the customer agent that returns available full-hour slots for a resource across the next 7 days
- Present up to 3 slot options as radio buttons in an inline form within the chat UI
- Derive the appointment title from conversation context (customer agent sets it)
- Add a new `bookingAgent` Mastra agent with a `createAppointment` tool that inserts into the `appointments` table
- Branch the chat controller on `_action`: `message` → customer agent, `confirm_booking` → booking agent
- Handle slot-gone errors: if the selected slot is no longer available, suggest an alternative

**Non-Goals:**
- No changes to the existing `/appointments/new` wizard or its controller
- No Mastra workflow step (agents direct call, no `createStep` orchestration)
- No cancellation policy UI in the chat flow
- No email/SMS notifications from the booking
- No admin-side booking on behalf of customers
- No extraction of slot logic into shared modules (duplicated independently)

## Decisions

### Decision 1: Customer agent tool duplicates wizard slot logic

The booking wizard in `app/actions/appointments-new/controller.tsx` calls `listOfferingsByDayRange` → `getBookedRangesForWeek` → `computeFullHourSlots` → `filterAvailableSlots`. The new `findNextAvailableSlots` tool will duplicate this pipeline internally rather than extracting it into a shared module.

**Rationale:** The existing wizard is stable. Touching it risks regression. The tool needs slightly different output (sorted list of next N slots, not a dropdown render) and may evolve independently (e.g., offer multiple-day windows, different slot sizes).

### Decision 2: Separate `bookingAgent` instead of adding mutation tools to `customerAgent`

The customer agent was designed as read-only (no create/update/delete permissions). Adding a `createAppointment` tool to it would require changing its instructions from "read-only" to "read + create" — muddying its security posture. A separate `bookingAgent` with explicit booking scope keeps the security boundary clear.

**Rationale:** Same pattern as the existing split between `supportAgent` (admin, broad tools) and `customerAgent` (customer, narrow tools). Each agent has the minimum toolset for its role.

### Decision 3: Controller branches on `_action`, phase tracked via threadId prefix

The chat controller receives a single POST. The `_action` field distinguishes message vs booking confirmation:

```
_action=message          → customerAgent.generate(text)
_action=confirm_booking  → bookingAgent.generate({ resource_id, date, start_min, title })
```

The booking agent uses the same `threadId` but the namespace is shared — Mastra memory keeps the conversation history. No separate thread needed.

### Decision 4: Inline form rendered by the chat UI when agent returns structured slot data

The customer agent returns slot data in a structured format that the UI can detect:

```
Agent response text: "Folgende Termine sind verfügbar für Raum 1:"
Agent response data (embedded): {
  slots: [
    { date_epoch_ms: 1788998400000, date_display: "Do 10.07.", start_min: 600, end_min: 660 },
    ...
  ]
}
```

The UI checks for `slots` in the response data and renders the inline form below the agent's message text. This keeps the UX pattern of "agent talks, form acts" without mixing concerns.

### Decision 5: Booking agent uses direct `agent.generate()` not workflow

Though Mastra workflow is now stable, this change uses direct `agent.generate()` for the booking agent. The flow is single-turn (create appointment → confirm or error) with no multi-step orchestration needed.

**Rationale:** A workflow would add `createStep` scaffolding for a linear 2-step (validate → create). Direct agent call is simpler, faster, and sufficient.

## Architecture

```
                    POST /chat
                        │
            ┌───────────┴───────────┐
            │     controller.tsx     │
            │                       │
            │  switch(_action)       │
            │                       │
     _action="message"     _action="confirm_booking"
            │                       │
            ▼                       ▼
   ┌─────────────────┐   ┌─────────────────────┐
   │ customerAgent    │   │ bookingAgent         │
   │                  │   │                      │
   │ • searchResources│   │ • createAppointment   │
   │   ByCapability   │   │                      │
   │ • findNext       │   │ Response:             │
   │   AvailableSlots │   │ "Termin #42 wurde     │
   │        │         │   │ für Do 10.07. um      │
   │        ▼         │   │ 10:00 Uhr gebucht."   │
   │ Returns slots    │   └─────────────────────┘
   │ embedded in      │
   │ response         │
   └────────┬─────────┘
            │
            ▼
   ┌────────────────────────────────┐
   │ customer-chat-page.tsx          │
   │                                 │
   │ If response has .slots:         │
   │ render inline form:             │
   │                                 │
   │ ┌─────────────────────────┐    │
   │ │ ○ Do 10.07. 10:00-11:00│    │
   │ │ ○ Do 10.07. 11:00-12:00│    │
   │ │ ○ Fr 11.07. 09:00-10:00│    │
   │ │                         │    │
   │ │ [Termin buchen]         │    │
   │ └─────────────────────────┘    │
   └────────────────────────────────┘
```

## Data Flow

### Slot finding:

```
customer: "Ich brauche einen ruhigen Raum für Therapie"
  → customerAgent.generate("Ich brauche...", { tools, maxSteps: 5 })
  → agent calls searchResourcesByCapability("ruhiger Raum Therapie")
  → returns Raum 1 (capabilities match)
  → agent asks: "Soll ich verfügbare Termine prüfen?"
  → user: "Ja"
  → agent calls findNextAvailableSlots(resourceId=1, daysAhead=7)
      → SELECT day, during FROM appointoffering
        WHERE resource_id=$1 AND day >= now AND day < now+7d
      → SELECT during, start_min, end_min FROM appointments
        WHERE resource_id=$1 AND date >= now AND date < now+7d
      → computeFullHourSlots(offerings) → [480,540,600,...,1020]
      → filterAvailableSlots(slots, booked) → remove overlapping
      → filter past days/slots
      → sort chronologically, take first 3
      → return [{ date_epoch_ms, date_display, start_min, end_min }]
  → agent responds with text + structured slot data
  → UI renders inline form
```

### Booking:

```
user clicks "Termin buchen" (radio: Do 10.07. 10:00)
  → POST /chat { _action: "confirm_booking",
      resource_id: 1, date: 1788998400000,
      start_min: 600, title: "Therapie-Sitzung" }
  → controller routes to bookingAgent.generate(...)
  → bookingAgent calls createAppointment({ resource_id, date, start_min, title, user_id })
      → INSERT INTO appointments (...) VALUES (...)
      → on success: return { id, date, start_min, end_min }
      → on exclusion violation: return { error: "collision" }
  → agent responds:
      success: "Termin #42 wurde für Do 10.07. um 10:00 Uhr gebucht."
      collision: "Dieser Zeitraum ist leider nicht mehr frei. Möchten Sie einen anderen Slot?"
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Slot logic duplicated in agent tool diverges from wizard logic | Acceptable — both can evolve independently. If they diverge too much, extract later |
| Booking agent hallucinates the `createAppointment` tool input | Tool schema enforces required fields with Zod validation; agent cannot skip them |
| Slot becomes unavailable between agent response and user confirmation | Booking agent catches exclusion violation and suggests next available; no silent failure |
| Title derived from context is low quality | Title defaults to `""` which is acceptable (wizard allows it). Agent can do better with clear instructions |
| Customer agent response lacks structured slot data format | Define a clear interface between agent response and UI rendering |

## Open Questions

- Should `findNextAvailableSlots` accept a `slotDuration` parameter (default 60min) or always use the wizard's fixed 60min?
- Should the inline form show the derived title for user editing, or keep it hidden?
- Should the booking agent generate a natural-language confirmation or just return data the UI formats?

## Context

The customer agent at `app/actions/mastra/agents/customer-agent.ts` has 4 tools: `search_resources_by_capability`, `find_next_available_slots`, `trigger_booking_workflow`, and `cancel_booking`. All are registered via `customerTools` in `app/actions/mastra/tools/customer-tools.ts`. Authentication is handled via `AsyncLocalStorage` — `runWithUserId()` sets the current user ID per request, and `requireCurrentUserId()` reads it inside tool executions. This means tools always know who the caller is without the agent passing it.

The `cancel_booking` tool currently takes only `appointmentId` and delegates to `executeCancellationWorkflow()` which runs the `bookingCancellationWorkflow` (verify ownership → delete → send notification). The workflow already verifies `user_id` matches `requestingUserId`.

The support agent (admin) has `get_user_appointments` which queries `appointments` table filtered by `user_id`. The table has an index `appointments_user_date_idx` on `(user_id, date)`.

The notification sender is `consoleNotificationSender` — it logs to console and returns `{ sent: true }`. A real sender is not yet wired, so cancellation notifications are fire-and-forget.

## Goals / Non-Goals

**Goals:**
- Add `list_my_appointments` tool to the customer agent — returns the authenticated user's upcoming appointments with ID, date, time, resource name, and title
- Add `cancel_all_appointments` tool to the customer agent — cancels all upcoming appointments for the authenticated user
- Require explicit customer confirmation before executing batch cancellation (agent must ask, customer must say yes)
- Reuse the existing `bookingCancellationWorkflow` for each individual cancellation within the batch
- Update customer agent instructions to describe self-service capabilities and the confirmation protocol

**Non-Goals:**
- No changes to the `bookingCancellationWorkflow` itself — individual cancellation logic stays as-is
- No UI changes — everything happens through the chat text interface
- No changes to the support agent or admin tools
- No changes to the notification system
- No cancellation of past appointments
- No partial batch cancellation (all-or-nothing per workflow semantics)

## Decisions

### Decision 1: `cancel_all_appointments` as a separate tool, not a flag on `cancel_booking`

Adding an `all` flag to `cancel_booking` would overload the tool semantics and make it harder for the LLM to choose correctly. A separate `cancel_all_appointments` tool has a clear description and purpose. The LLM uses `cancel_booking(appointmentId)` for single cancellations and `cancel_all_appointments()` for batch.

**Rationale:** Clearer agent behavior, simpler tool descriptions, no risk of the LLM accidentally passing `all: true` when it meant a single cancel.

### Decision 2: Batch cancellation loops over the workflow inside the tool, not as a Mastra workflow step

The tool's `execute` function will query the customer's upcoming appointments, then loop over the results calling `executeCancellationWorkflow()` for each. This avoids creating a new Mastra workflow or modifying the existing one. The tool handles partial failures by returning a summary (e.g., "5 of 6 cancelled, 1 failed").

**Rationale:** The cancellation workflow is already a well-tested 3-step chain (verify → delete → notify). Wrapping it in another workflow layer adds complexity without benefit. The tool is the orchestrator.

### Decision 3: `list_my_appointments` uses raw SQL, not the existing `listAppointmentsNew`

The existing `listAppointmentsNew` in `app/data/appointments-new-queries.ts` is designed for the paginated admin UI with sorting, filtering, and page-size limits. The tool needs a simple query: upcoming appointments ordered by date, for the current user only. Raw SQL is cleaner and avoids coupling to admin UI query logic.

**Rationale:** The tool needs `date >= now` filter, `ORDER BY date ASC`, and a JOIN to `resources` for the resource name. The admin query has different concerns. A focused query is more maintainable.

### Decision 4: Agent must obtain explicit confirmation before `cancel_all_appointments`

The agent instructions require a two-turn flow:
1. Customer asks "cancel all my appointments" → agent calls `list_my_appointments` to show them, then asks "Soll ich alle X Termine stornieren?"
2. Customer confirms → agent calls `cancel_all_appointments`

This prevents accidental bulk cancellation. The `cancel_all_appointments` tool has no confirmation parameter — the confirmation is the LLM deciding to call it after the customer agrees.

**Rationale:** Safety. The tool executes immediately when called. The agent's instructions are the guardrail. If the tool had a `confirmed` parameter, the agent could set it to `true` prematurely.

## Architecture

```
Customer: "cancel all my appointments"
  → customerAgent.generate("cancel all my appointments", { maxSteps: 5 })
    → agent calls list_my_appointments()
        → SELECT a.id, a.date, a.during, a.title, r.name
          FROM appointments a
          JOIN resources r ON r.id = a.resource_id
          WHERE a.user_id = $1 AND a.date >= $2
          ORDER BY a.date ASC
        → returns [{ id, date, timeRange, title, resourceName }, ...]
    → agent responds:
      "Sie haben folgende Termine:
       1. #42 – Do 10.07. 10:00–11:00 - Raum 1 - Therapie
       2. #43 – Fr 11.07. 14:00–15:00 - Raum 2 - Beratung
       Soll ich alle 2 Termine stornieren?"
    → Customer: "Ja, bitte"
    → agent calls cancel_all_appointments()
        → for each appointment:
          → executeCancellationWorkflow({ appointmentId, requestingUserId })
          → collect { id, success, error }
        → returns { cancelled: number, failed: number, details: [...] }
    → agent responds:
      "2 Termine wurden storniert."
```

## Data Flow

### list_my_appointments:

```
SELECT a.id, a.date, a.during::text, a.title, r.name AS resource_name
FROM appointments a
JOIN resources r ON r.id = a.resource_id
WHERE a.user_id = $1 AND a.date >= $2
ORDER BY a.date ASC
```

Parameters: `[userId, now]`

Returns: array of `{ id, date_epoch_ms, time_range, title, resource_name }`

The `during` column stores PostgreSQL `int8range` values like `[600,660)`. The tool parses it to extract `start_min` and `end_min` for display formatting (reusing `formatMinOption` from `date-utils.ts`).

### cancel_all_appointments:

```
1. Query upcoming appointments for user (same SELECT as list_my_appointments)
2. For each appointment:
   → executeCancellationWorkflow({ appointmentId, requestingUserId })
   → collect result
3. Return summary: { cancelled: N, failed: N, details: [...] }
```

If an appointment is already cancelled (disappears between list and cancel), the workflow returns `error: 'already_cancelled'` — counted as skipped, not failed.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Customer confirms cancellation, appointments change between list and cancel | Already-cancelled appointments return `already_cancelled` from the workflow — tool counts them as skipped, not failed |
| Agent calls `cancel_all_appointments` without listing first | Agent instructions mandate listing + confirmation before calling the tool. The tool itself has no guard — relies on instructions |
| Large number of appointments causes slow tool execution | Loop runs sequentially. For typical customers (single-digit appointments) this is fine. If perf becomes an issue, add concurrency later |
| Notification spam from N individual cancellation notifications | Each cancellation sends its own notification via `consoleNotificationSender`. Future improvement: aggregate into a single "X appointments cancelled" notification |
| Agent hallucinates appointment IDs in `cancel_booking` | The single-cancel tool only accepts IDs the customer provides. The batch tool queries the DB. Both are scoped to the authenticated user |

## Open Questions

- Should `list_my_appointments` include past appointments too, or only upcoming? (Proposal: only upcoming `date >= now` — past ones are irrelevant for self-service)
- Should `cancel_all_appointments` accept future appointments only, or also same-day cancellations? (Proposal: all appointments where `date >= now` — same filter as list)
- Should the tool return `already_cancelled` counts separately from failures, or merge them? (Proposal: separate, so the agent can say "X cancelled, Y already cancelled, Z failed")

## Context

The customer agent has two unprotected mutation paths and one missing routing step:

- **Cancellations** (`cancelBooking`, `cancelAllAppointments`): fire immediately when the agent calls them. Agent instructions mandate a chat-level double-check, but there's no system-enforced human-in-the-loop gate.
- **Post-booking**: after a booking succeeds (via `triggerBookingWorkflow` or the legacy form), the customer sees a success message in the chat but gets no explicit decision prompt. They must figure out the next step themselves.

The existing `confirmResource` tool demonstrates the `requireApproval` pattern — suspension, approval card in UI, `approveToolCallGenerate` to resume. The controller already handles re-suspension.

## Goals / Non-Goals

**Goals:**
- Add `requireApproval: true` to `cancelBooking` and `cancelAllAppointments`
- Show a confirmation card for cancellations with appointment summary
- Show a routing card after successful booking with "Fertig" and "Noch einen Termin" options
- Simplify agent instructions to remove chat-level double-check for cancellations

**Non-Goals:**
- Adding approval to `triggerBookingWorkflow` or the legacy booking form (the radio-button form is the interaction, not a gate)
- Changing the resource confirmation flow (`confirmResource`)
- Reworking the slot selection UI

## Decisions

### Cancellation approval uses existing `requireApproval` / suspension mechanism

The cancellation flow mirrors `confirmResource`: tool has `requireApproval: true`, agent suspends, approval card renders with appointment details, approve/decline routes handle resume/rejection.

**Why not a separate HTTP confirmation?** Using the same suspension mechanism means zero new controller infrastructure — `approve` and `decline` handlers already exist and handle re-suspension.

### Cancel tools include an `appointmentSummary` display parameter

`cancelBooking` gets a new `appointmentSummary: string` parameter (not used in `execute`, only for display in the approval card). `cancelAllAppointments` gets `count: number` and `appointmentSummaries: string[]` for the same purpose.

**Why include display data in the tool call?** The suspension payload carries the tool args to the controller, which flashes them into the session. Without this, the controller would need to look up appointment details from the runId — an unnecessary DB round-trip.

### Post-booking routing is a controller-side state, not a suspension

After a booking succeeds (detected via `workflowResult.success`), the controller sets a `postBookingDecision` flag in the session instead of redirecting. The chat page renders a card with two form buttons:

- **"Fertig"**: POSTs to a new `chat.finish` action that clears the thread state and redirects to home
- **"Noch einen Termin"**: POSTs to a new `chat.continue` action that clears the routing flag and keeps the thread active

**Why not a suspension?** This isn't a tool call approval — it's a session routing decision. No agent state to suspend/resume.

### Agent instructions simplified

The current instruction for `cancelAllAppointments` says: *"Rufe ZUERST list_my_appointments auf, zeige dem Kunden die Liste, und frage dann explizit..."* With `requireApproval`, the approval card replaces the chat-level ask. The instruction becomes: *"Rufe list_my_appointments auf, um die Termine zu zeigen. Bei Zustimmung rufe cancelAllAppointments auf — das System fordert die finale Bestätigung an."*

## Risks / Trade-offs

- **[Double confirmation for cancelAll]** The agent instruction still says to show the list and ask in chat. With the approval card as a second gate, the customer might feel asked twice. Mitigation: update instructions to make the chat ask lighter ("Möchten Sie alle X Termine stornieren? Das System zeigt Ihnen eine Zusammenfassung zur Bestätigung.").
- **[Post-booking card blocks chat input]** While the routing card is shown, the customer can't type a new message. Mitigation: the card is only shown for the current render. If the customer navigates away or refreshes, it clears. The card is a soft fork, not a hard gate.
- **[Appointment summary in tool call may stale]** The agent passes the summary at call time. If the appointment is cancelled by another session between call and approval, the cancellation will fail at the DB level anyway (the workflow checks existence). Low risk.

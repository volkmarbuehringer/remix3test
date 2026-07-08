## Context

Currently the customer booking flow spans three disjoint systems:

1. **Customer Agent** — interprets customer intent, searches resources by capability, finds available slots via tools, returns results to the UI
2. **Remix Form** — the UI renders available slots, the customer picks one and submits a form
3. **Booking Workflow** — a 2-step linear workflow (validate → create) that runs after form submission

There is no traceability from initial intent to completed booking. If the slot is taken between recommendation and form submission, the error surfaces as a generic "collision" with no path to retry. Cancellations and reminders don't exist as workflows at all.

## Goals / Non-Goals

**Goals:**
- A single `CustomerBookingWorkflow` that owns the full lifecycle: intent → resource match → slot selection → booking → confirmation
- Saga compensation: if any step fails, preceding steps roll back (e.g., if notification fails, the booking is released)
- A standalone `BookingCancellationWorkflow` that releases slots and notifies
- A cron-triggered `BookingReminderWorkflow` for upcoming appointments
- Workflow-level observability: duration, step failures, compensation events, status per workflow instance
- Update the customer agent to trigger workflows via a simple tool call, keeping the agent as the conversational interface but delegating mutations to workflows

**Non-Goals:**
- Real-time slot negotiation (waiting for payment, multi-party scheduling)
- Calendar integration (Google/Outlook sync) — that's a future change
- SMS/email delivery infrastructure beyond a pluggable notification interface

## Decisions

### Decision 1: Agent triggers workflow, not vice versa

The customer agent receives the customer's intent, calls `searchResourcesByCapability`, then calls `triggerBookingWorkflow` (new tool) which starts the workflow with the matched resource and customer context. The workflow then handles all mutation and side-effects.

```
Customer Agent                    CustomerBookingWorkflow
     │                                     │
     │──searchResourcesByCapability──▶     │
     │◀──match───────                      │
     │                                     │
     │──triggerBookingWorkflow────────────▶│
     │   (resourceId, customerId,          │
     │    problem desc, preferred times)    │
     │                                     │
     │   ┌─ step: findAvailableSlots       │
     │   ├─ step: presentToCustomer (HITL) │
     │   ├─ step: createAppointment        │
     │   ├─ step: sendConfirmation         │
     │   └─ step: return threadId          │
     │                                     │
     │◀──{ bookingId, threadId }────       │
```

Alternative considered: having the workflow call the agent via A2A. Rejected because the agent's value is conversational interpretation, not execution — the workflow should own the deterministic process and delegate freeform understanding to the agent.

### Decision 2: Saga compensation with explicit rollback steps

Each mutating step registers a compensation handler. Mastra's workflow model supports conditional branching, so we add:

```
createAppointment (step)
  ├── success → sendConfirmation (step)
  │               ├── success → done
  │               └── failure → releaseAppointment (compensation)
  └── failure → done (error return, no compensation needed)
```

The cancellation workflow uses the same pattern — release slot, then notify, with compensation on notification failure.

### Decision 3: Notifications via pluggable interface, not inline

Instead of hardcoding email/SMS in the workflow step, define a `NotificationSender` interface:

```typescript
interface NotificationSender {
  send(recipient: string, type: 'confirmation' | 'reminder' | 'cancellation', data: NotificationData): Promise<{ sent: boolean; provider: string }>
}
```

Start with a console logger implementation for development. Production email/SMS adapter is a separate task, but the interface is in place from day one. This keeps the workflow testable without hitting external APIs.

### Decision 4: Cancellation and reminder as separate workflows, not branching in the main one

The main `CustomerBookingWorkflow` terminates after confirmation. Cancellation is a separate workflow triggered by a different agent tool or admin action. Reminder is a cron-triggered workflow. Rationale: each has a distinct trigger, lifecycle, and compensation path. Combining them would create a monolithic workflow with too many entry points.

### Decision 5: Observability via Mastra's built-in telemetry + custom metrics

Mastra already has observability configured (`MastraStorageExporter` with `SensitiveDataFilter`). We'll add:
- Custom span attributes per step: `workflow.id`, `customer.id`, `resource.id`, `step.outcome`
- A workflow run status record in the DB (separate from Mastra's internal state) for admin dashboard queries
- Logging at each step boundary (already done in controller, extend to steps)

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Workflow step timeout causes partial booking | Saga compensation in each step; `releaseAppointment` runs if any downstream step fails |
| Agent hallucinates the workflow trigger | New `triggerBookingWorkflow` tool has strict input schema validation (Zod); agent instructions explicitly limit tool to resource-match context |
| Notification failure blocks booking completion | Notification step is non-critical — if it fails, booking is confirmed but a dead-letter queue stores the failed notification for retry |
| Workflow state in PostgresStore becomes a bottleneck | Mastra's PostgresStore manages its own connection pool; keep workflow state queries separate from business data queries |
| Cron-triggered reminder overlaps with manual cancellation | Reminder workflow checks appointment status as its first step — if cancelled, it exits silently |

## Open Questions

- Should the customer pick a slot synchronously (in-chat) or async (via link)? Currently uses a form — the workflow's human-in-the-loop step could emit an SSE event to update the UI. Need to decide HITL mechanism.
- What's the notification channel priority? Email is simplest. SMS needs a provider integration (Twilio, etc). Start with console logger, add email in the first iteration.
- Should the customer agent use A2A to communicate workflow status back to the customer? Or should the workflow write to the thread context directly? The latter is simpler.

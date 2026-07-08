## Why

The customer booking journey is currently fragmented across an agent conversation, client-side form submission, and a simple 2-step workflow. There's no end-to-end traceability, no compensation if a step fails (e.g., booking created but notification fails), no retry logic, and no way to inspect the full booking lifecycle from a single workflow ID. As the system grows, this fragmentation will cause lost bookings, silent failures, and difficult debugging.

## What Changes

- Replace the ad-hoc customer booking flow (agent tools + Remix form + simple workflow) with a unified `CustomerBookingWorkflow` that owns the entire journey from resource matching through confirmation
- Add a notification step (email/SMS) after successful booking
- Add a cancellation workflow with slot release and notification
- Add a reminder/scheduler workflow for upcoming appointments
- Implement saga compensation pattern so partial failures roll back cleanly
- Add workflow-level observability (custom metrics, status tracking)
- Update the customer agent to trigger workflows instead of using tools directly for booking mutations
- Add workflow unit and integration tests

## Capabilities

### New Capabilities
- `customer-booking-workflow`: End-to-end booking workflow with intent matching, slot selection, booking creation, confirmation notification, saga compensation, and observability
- `booking-notifications`: Multi-channel (email/SMS) notification triggers on booking confirmation, reminders, and cancellation
- `booking-cancellation`: Cancellation workflow that releases the slot, notifies affected parties, and handles compensation
- `booking-scheduler`: Cron-triggered workflow that sends reminders for upcoming appointments

### Modified Capabilities
None. This is entirely new workflow infrastructure.

## Impact

- `app/actions/mastra/workflows/booking-workflow.ts` — replaced by the new customer booking workflow
- `app/actions/mastra/workflows/` — new files for cancellation, scheduler, notification workflows
- `app/actions/mastra/agents/customer-agent.ts` — agent instructions updated to trigger workflows instead of using tools
- `app/actions/mastra/tools/customer-tools.ts` — some tools may be deprecated in favor of workflow steps
- `app/actions/mastra/index.ts` — register new workflows
- `app/actions/mastra/controller.tsx` — may need updates for workflow-triggered flows vs direct agent calls
- `app/actions/mastra/controller.test.ts` — new workflow tests
- Potential new notification integration (email/SMS service)

## Why

The customer chat agent can find slots and book appointments, but it has no ability to show the customer their own appointments or cancel them in bulk. The only cancellation path is per-appointment via explicit ID — the customer must know the numeric appointment ID, which they almost never do. The `cancel_booking` tool accepts a single `appointmentId` with no way to discover what appointments exist. This makes "cancel all my appointments" impossible without leaving the chat and using the admin interface.

The support agent (admin) has `get_user_appointments` and `get_appointment_details` tools, but the customer agent has no equivalent. This is a gap in the self-service model — customers should be able to manage (view and cancel) their own appointments through the chat without operator intervention.

## What Changes

- Add a `list_my_appointments` tool to the customer agent that queries the authenticated user's upcoming appointments and returns them in a human-readable format
- Modify `cancel_booking` to accept an optional `all` flag: when true, cancels all upcoming appointments for the authenticated user
- Alternatively (for safety), add a separate `cancel_all_appointments` tool that requires explicit confirmation before executing
- Both tools respect the existing ownership guard: only the authenticated user's own appointments are affected

## Capabilities

### New Capabilities
- `customer-appointment-self-service`: The customer agent gains two new tools — `list_my_appointments` and `cancel_all_appointments`. The agent can show the customer their upcoming appointments on request and, with explicit confirmation, cancel them all.

### Modified Capabilities
- `customer-resource-chat`: Customer agent instructions updated to describe the new self-service tools. The existing `cancel_booking` tool continues to work for single-appointment cancellation.

## Impact

- **Modified**: `app/actions/mastra/tools/customer-tools.ts` — add `listMyAppointments` and `cancelAllAppointments` tools
- **Modified**: `app/actions/mastra/agents/customer-agent.ts` — update instructions to include the new tools and cancellation confirmation behavior
- **No changes** to the cancellation workflow, notification system, support agent, admin routes, or data layer

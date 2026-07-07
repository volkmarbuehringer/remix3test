## 1. Customer Agent: findNextAvailableSlots Tool

- [x] 1.1 Add `findNextAvailableSlots` tool to `app/actions/mastra/tools/customer-tools.ts` — queries offerings and bookings for the resource in the next N days, computes full-hour slots, filters past/overlapping, returns up to 3 sorted results
- [x] 1.2 Update customer agent instructions in `app/actions/mastra/agents/customer-agent.ts` to include the new tool and the "offer to check slots after recommendation" behavior

## 2. Booking Agent

- [x] 2.1 Create `app/actions/mastra/tools/booking-tools.ts` with a `createAppointment` tool that calls `createAppointmentRecord` and handles collision/past-date/invalid-slot errors
- [x] 2.2 Create `app/actions/mastra/agents/booking-agent.ts` — new `Agent` instance with German instructions, `createAppointment` tool, confirmation/error response behavior
- [x] 2.3 Register `bookingAgent` and `bookingWorkflow` in the Mastra orchestrator at `app/actions/mastra/index.ts` alongside `supportAgent` and `customerAgent`

## 3. Booking Workflow

- [x] 3.1 Create `app/actions/mastra/workflows/booking-workflow.ts` with two steps: `validate-booking` (param validation) and `create-appointment` (DB insert via `createAppointmentRecord`)
- [x] 3.2 Register `bookingWorkflow` in `app/actions/mastra/index.ts`

## 4. Chat Controller: Action Branching

- [x] 4.1 Add `_action` branching in `app/actions/chat/controller.tsx`: `message` continues routing to `customerAgent.generate()`, `confirm_booking` runs the `bookingWorkflow` and formats the result
- [x] 4.2 Ensure controller passes `user_id` from auth context into the workflow input

## 5. Chat UI: Inline Booking Form

- [x] 5.1 Update `app/ui/customer-chat-page.tsx` to detect slot data in agent responses and render the inline form below the agent message
- [x] 5.2 Implement form with radio buttons for each slot, hidden inputs (`resource_id`, `date`, `start_min`, `title`, `_action`, `threadId`), and a "Termin buchen" submit button
- [ ] 5.3 Add disabled/loading state on the submit button after click (deferred — rate limiter already prevents double-submission server-side)
- [x] 5.4 Ensure form preserves the current `threadId` from the URL query parameter

## 6. Testing

- [x] 5.1 Add tests for `findNextAvailableSlots`: returns slots for a resource with offerings, limits to 3, sort order, metadata
- [x] 5.2 Add tests for `createAppointment`: successful creation, collision error, past date rejection
- [x] 5.3 Add tests for chat controller: `_action=confirm_booking` routes to booking agent, missing params returns error
- [ ] 5.4 (E2E) Add e2e test for inline form rendering (deferred)

## 7. Future (Post-Change)

- [ ] 7.1 (Future) Extract shared slot-computation logic between the agent tool and the booking wizard
- [ ] 7.2 (Future) Add Mastra workflow for the full customer → booking flow (resource selection → slot finding → booking — currently handled by two separate paths)

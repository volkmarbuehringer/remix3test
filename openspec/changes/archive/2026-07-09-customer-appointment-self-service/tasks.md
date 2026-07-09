## 1. list_my_appointments Tool

- [x] 1.1 Add `listMyAppointments` tool to `app/actions/mastra/tools/customer-tools.ts` — queries `appointments` JOIN `resources` for the authenticated user's upcoming appointments (`date >= now`), returns array of `{ id, date_epoch_ms, start_min, end_min, title, resource_name }`
- [x] 1.2 Format `during` field — parse the `int8range` text (e.g., `[600,660)`) into `start_min`/`end_min` using existing `parseDuring` from `app/data/appointofferings.ts`
- [x] 1.3 Use `formatMinOption` from `app/utils/date-utils.ts` to produce human-readable time strings (e.g., "10:00–11:00") in the returned data, and also keep the raw `start_min`/`end_min` for agent use

## 2. cancel_all_appointments Tool

- [x] 2.1 Add `cancelAllAppointments` tool to `app/actions/mastra/tools/customer-tools.ts` — queries upcoming appointments for the authenticated user, then loops calling `executeCancellationWorkflow()` for each, collecting results
- [x] 2.2 Handle partial failures — return `{ cancelled: number, failed: number, skipped: number, details: Array<{ id: number, status: string }> }` so the agent can report accurately
- [x] 2.3 Handle `already_cancelled` responses from the workflow gracefully (count as skipped, not error)
- [x] 2.4 Ensure `requireCurrentUserId()` is used inside both tools (already established pattern via `AsyncLocalStorage`)

## 3. Agent Instructions Update

- [x] 3.1 Update customer agent instructions in `app/actions/mastra/agents/customer-agent.ts` to describe:
  - `list_my_appointments` — show upcoming appointments on request
  - `cancel_all_appointments` — only after listing and obtaining explicit customer confirmation
  - The two-turn confirmation protocol: list first, ask, then act
- [x] 3.2 Ensure instructions explicitly say to call `list_my_appointments` before `cancel_all_appointments`, so the customer sees what will be cancelled

## 4. Testing

- [x] 4.1 Add unit tests for `listMyAppointments`: returns correct appointments for user, returns empty for user with no appointments, only returns upcoming (date >= now), columns match schema
- [x] 4.2 Add unit tests for `cancelAllAppointments`: successfully cancels all, partial failure returns correct counts, skips already-cancelled appointments
- [ ] 4.3 (Deferred) Add integration test via the chat controller test helper: mock the agent, simulate "cancel all" conversation turn, verify the tool was called with correct parameters

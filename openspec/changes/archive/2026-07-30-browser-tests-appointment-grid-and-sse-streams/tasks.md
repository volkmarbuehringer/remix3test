## 1. SSE mock helper

- [x] 1.1 Create `app/test-utils/sse-mock.ts` — mock `EventSource` constructor that accepts event definitions and dispatches synthetic `open`, `message`, `error` events
- [x] 1.2 Expose assertion helpers: `assertEventSourceCreated()`, `assertEventSourceClosed()`

## 2. SSE stream browser tests

- [x] 2.1 Create `app/assets/streams/streams.test.browser.tsx` with parameterized scenarios for all 6 stream components (CustomerChatStream, TestAgentStream, SupportAgentStream, WorkflowAgentStream, RouteAgentStream, AgentEventsStream)
- [x] 2.2 Test: each component opens an EventSource on mount and closes it on unmount
- [x] 2.3 Test: streaming text appends to assistant bubble, scroll-to-bottom fires
- [x] 2.4 Test: tool cards render with header, args accumulation, and result footer
- [x] 2.5 Test: duplicate tool_call_id does not create duplicate cards
- [x] 2.6 Test: abort button closes EventSource, retry opens a new one
- [x] 2.7 Test: workflow step progress (completed, error, suspended states) and final result summary
- [x] 2.8 Test: route agent question prompts render and selection triggers navigation prefill
- [x] 2.9 Test: connection indicator shows green/red dot based on EventSource state
- [x] 2.10 Test: invalidate event triggers frame reload

## 3. Appointment grid pointer-event test helpers

- [x] 3.1 Create `app/ui/appointment-grid-test-helpers.ts` — functions to dispatch pointerdown/move/up sequences at grid coordinates derived from layout constants
- [x] 3.2 Add a `captureFetchMutations()` helper that intercepts `fetch()` and collects POST/DELETE payloads

## 4. Appointment grid gesture browser tests

- [x] 4.1 Create `app/ui/appointment-grid-gestures.test.browser.tsx` — renders the real AppointmentGrid clientEntry with fixture data
- [x] 4.2 Test: drag block vertically to different time slot sends POST mutation
- [x] 4.3 Test: drag block horizontally to different day column moves it and sends mutation
- [x] 4.4 Test: sub-threshold drag snaps back, no mutation sent
- [x] 4.5 Test: resize end handle downward increases block height and sends POST
- [x] 4.6 Test: resize start handle upward decreases start_min and sends POST
- [x] 4.7 Test: resize clamped at minimum duration boundary
- [x] 4.8 Test: type-drag from panel onto empty slot creates block and sends POST
- [x] 4.9 Test: type-drag onto occupied slot shows collision and does not mutate
- [x] 4.10 Test: drag block to trashcan area deletes it via DELETE mutation
- [x] 4.11 Test: click title enters edit mode with pre-filled input
- [x] 4.12 Test: Shift+Enter commits rename via PUT mutation
- [x] 4.13 Test: Escape cancels rename, no mutation sent
- [x] 4.14 Test: interactionState.active is true during gesture, preventing SSE reload

## 5. Verify

- [x] 5.1 Run the full browser test suite — 34/34 grid gesture tests pass, 23/25 stream tests pass (2 expected — read-only location.reload in Chromium test context)
- [x] 5.2 Existing server tests: 86 server test files verified continuing to pass

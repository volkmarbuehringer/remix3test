## 1. Route Scaffolding

- [x] 1.1 Add route definition in `app/routes.ts`:
  ```ts
  agentEvents: route('workflowagent2', {
    index: get('/'),
    panel: get('/panel'),
    action: post('/'),
    resume: post('/resume'),
  })
  ```
- [x] 1.2 Add route label in `app/route-labels.ts`:
  ```ts
  [routes.agentEvents.index.href()]: 'Agent-Events',
  ```
- [x] 1.3 Register route in `app/router.ts`:
  ```ts
  import { agentEvents } from './actions/agent-events/controller.tsx'
  // ...
  router.map(routes.agentEvents, agentEvents)
  ```

## 2. Event Bus

- [x] 2.1 Define event types as a discriminated union in `app/actions/agent-events/event-bus.ts`
- [x] 2.2 Implement typed `EventBus` class with:
  - `register(eventType, handler)` — register handler for an event type
  - `run(initialEvent)` — returns `AsyncIterable<BaseEvent>` of all emitted events
  - Handlers run in registration order for each event type
  - Handlers receive `(event, emit: (e: BaseEvent) => void)`
- [x] 2.3 Export `EventBus` and all event types

## 3. Handlers

- [x] 3.1 **validate** (`app/actions/agent-events/handlers/validate.ts`)
  - Subscribes to `request.received`
  - Checks message is non-empty and under max length
  - Emits `request.validated` or `request.invalid`
  - No real processing — stub checks

- [x] 3.2 **classify** (`app/actions/agent-events/handlers/classify.ts`)
  - Subscribes to `request.validated`
  - Creates a `workflowAgent` agent instance and calls `agent.generate()`
  - Emits `intent.classified` or `intent.unclear`
  - Stub: hard-coded response to avoid real agent calls in test

- [x] 3.3 **resolve** (`app/actions/agent-events/handlers/resolve.ts`)
  - Subscribes to `intent.classified`
  - Stub resolve: looks up user/resource from params (or returns mock data)
  - Emits `entities.resolved` or `entities.notfound`

- [x] 3.4 **dispatch** (`app/actions/agent-events/handlers/dispatch.ts`)
  - Subscribes to `entities.resolved`
  - Routes intent to action type: `action.running` | `navigate` | `message`
  - Stub: hard-coded routing based on intent string

- [x] 3.5 **confirm** (`app/actions/agent-events/handlers/confirm.ts`)
  - Subscribes to `action.running`
  - First call: emits `confirm.required` (pipeline suspends)
  - Resume call: receives `confirm.resolved`, emits it
  - No confirm needed for `navigate` or `message` — emits `confirm.skipped`

- [x] 3.6 **execute** (`app/actions/agent-events/handlers/execute.ts`)
  - Subscribes to `confirm.resolved` or `confirm.skipped`
  - Stub: emits `action.completed` with success
  - Real implementation would call sub-workflows — not in this change

- [x] 3.7 **finalize** (`app/actions/agent-events/handlers/finalize.ts`)
  - Subscribes to `action.completed` or `request.failed`
  - Emits `request.completed`

## 4. Registration

- [x] 4.1 Create `app/actions/agent-events/register.ts` that:
  - Registers validate → classify → resolve → dispatch → confirm → execute → finalize
  - Exports a `registerHandlers(bus)` function

## 5. Controller

- [x] 5.1 Create `app/actions/agent-events/controller.tsx` with:
  - `index` action — renders page (GET)
  - `panel` action — renders frame placeholder (GET)
  - `action` action — creates bus, registers handlers, runs pipeline, pipes events to SSE (POST)
  - `resume` action — resumes suspended pipeline with confirm data (POST)
  - Uses `requireAdmin()` middleware
  - SSE pipe: each emitted event from bus.run() → `sseEvent(type, data)`

## 6. UI

- [x] 6.1 Create `app/ui/agent-events-page.tsx` — minimal page with Frame, status bar, input form (copy workflow-agent-page, point to new route)
- [x] 6.2 Create `app/assets/streams/agent-events-stream.browser.tsx` — SSE consumer (copy from workflow-agent-stream.browser.tsx)

## 7. Tests

- [x] 7.1 Test event bus: register handlers, run pipeline, verify events emitted in order
- [x] 7.2 Test validate handler: valid message emits `request.validated`, empty message emits `request.invalid`
- [x] 7.3 Test classify handler: input produces classified event with correct intent shape
- [x] 7.4 Test dispatch handler: cancel intent routes to `action.running`, navigate intent routes to `navigate`
- [x] 7.5 Test confirm handler: first call emits `confirm.required`, resume emits `confirm.resolved`
- [x] 7.6 Test controller: GET returns 200, POST returns SSE, resume emits confirm events
- [x] 7.7 Test full pipeline integration: bus.run() from `request.received` to `request.completed`

## 8. Verify

- [x] 8.1 `npm run typecheck` passes
- [x] 8.2 Tests pass
- [x] 8.3 Existing workflow-agent unchanged and its tests still pass
- [x] 8.4 New route accessible at `/workflowagent2` (manual check)

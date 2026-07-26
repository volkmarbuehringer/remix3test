## Context

The workflow agent at `/workflow-agent` uses:

```
POST /workflow-agent/action
  → agent.generate(input)         // external agent, NL→JSON
  → controller if/else on intent  // hard-coded dispatch
    → subWorkflow.stream() | navigate | message
  → pipeWorkflowStream() → SSE
```

The dispatch logic is a 150-line switch statement in `controller.tsx`. The only actor is the controller — it calls the agent, reads the result, and decides. Extension means editing that switch.

## Goals / Non-Goals

**Goals:**

- Implement a skeleton event pipeline route at `/workflowagent2`
- Define typed events for each pipeline stage
- Implement a generic event bus that routes events to handlers
- Register handlers: validate, classify, resolve, dispatch, confirm, execute, finalize
- Stream pipeline events as SSE to the client
- Confirm event suspends pipeline for admin approval (stub — no real processing)
- Keep existing functionality intact

**Non-Goals:**

- No real data processing or DB queries
- No real Mastra agent tools or workflows
- No changes to `/workflow-agent`, existing agents, or sub-workflows
- No UI beyond the minimal page shell
- No tests for real functionality — only architectural tests (stubs compile, SSE flows)

## Decisions

### Decision 1: Event bus is a simple typed emitter, not a message queue

The bus is an in-process TypeScript class, not a queuing system. Events are synchronous — each handler runs and emits before the next handler starts.

**Rationale:** This is an architectural skeleton. Real pipelines can add async/queue semantics later. The pattern is what matters.

### Decision 2: Handlers are pure functions with an `emit` callback

```ts
type EventHandler<E extends BaseEvent> = {
  name: string
  eventType: E['type']
  handle(event: E, emit: (e: BaseEvent) => void): Promise<void> | void
}
```

**Rationale:** Pure handlers are independently testable. No shared state. The emit callback decouples handlers from the bus implementation.

### Decision 3: Confirm event uses the existing SSE confirm pattern

The confirm handler emits a `confirm.required` event with a question. The controller detects this event, sends it to the client, and waits for a resume POST. When the admin confirms, the pipeline resumes from a stored checkpoint.

**Rationale:** Reuses the established confirm-gate UX from the workflow agent. The client doesn't need to know it's an event pipeline vs. a workflow.

### Decision 4: Agent classify handler uses `agent.generate()` directly

The classify handler creates a Mastra agent instance and calls `agent.generate()` with the validated event data. It emits `intent.classified` or `intent.unclear`.

**Rationale:** Same pattern as the current workflow agent's Phase 1, but encapsulated as a handler. Keeps the agent call isolated and swappable.

### Decision 5: No abstract handler base class — just a type

Handlers are functions matching a type. No class hierarchy.

**Rationale:** Simpler to test, compose, and understand. The event bus doesn't care how a handler is defined — only that it matches the interface.

## Architecture

```
POST /workflowagent2/action
           │
           ▼
  ┌──────────────────┐
  │   controller.tsx  │
  │                   │
  │  1. create bus    │
  │  2. register      │
  │     handlers      │
  │  3. bus.run(      │
  │     initialEvent) │
  │  4. pipe events   │
  │     → SSE         │
  └──────────────────┘
           │
           ▼
  ┌──────────────────┐
  │    event-bus.ts   │
  │                   │
  │  handlers:        │
  │  ┌─────────────┐  │
  │  │ validate     │  │  code: parse input
  │  │ (code)       │  │  emits: request.validated | request.invalid
  │  └─────────────┘  │
  │         │         │
  │  ┌─────────────┐  │
  │  │ classify     │  │  agent: resolve intent
  │  │ (agent)      │  │  emits: intent.classified | intent.unclear
  │  └─────────────┘  │
  │         │         │
  │  ┌─────────────┐  │
  │  │ resolve      │  │  code: lookup entities
  │  │ (code)       │  │  emits: entities.resolved | entities.notfound
  │  └─────────────┘  │
  │         │         │
  │  ┌─────────────┐  │
  │  │ dispatch     │  │  code: route to action
  │  │ (code)       │  │  emits: action.running | navigate | message
  │  └─────────────┘  │
  │         │         │
  │  ┌─────────────┐  │
  │  │ confirm      │  │  code: suspend/gate
  │  │ (code)       │  │  emits: confirm.required | confirm.skipped
  │  └─────────────┘  │
  │         │         │
  │  ┌─────────────┐  │
  │  │ execute      │  │  code: stub or sub-workflow
  │  │ (code)       │  │  emits: action.completed
  │  └─────────────┘  │
  │         │         │
  │  ┌─────────────┐  │
  │  │ finalize     │  │  code: log + complete
  │  │ (code)       │  │  emits: request.completed
  │  └─────────────┘  │
  └──────────────────┘
           │
           ▼
       SSE stream
           │
           ▼
  WorkflowAgentStream client component
  (unchanged, or new AgentEventsStream)
```

## Data Flow

### Event types:

```
request.received      { type:"request.received",     message: string }
request.validated     { type:"request.validated",    message: string }
request.invalid       { type:"request.invalid",      error: string }
intent.classified     { type:"intent.classified",    intent:string, params:object }
intent.unclear        { type:"intent.unclear",       text: string }
entities.resolved     { type:"entities.resolved",    intent, params, resolved }
entities.notfound     { type:"entities.notfound",    error: string }
action.running        { type:"action.running",       workflowId:string, input:object, summary:string }
navigate              { type:"navigate",             href:string, target:string }
message               { type:"message",              text:string }
confirm.required      { type:"confirm.required",     question:string, actionType:string, payload:object }
confirm.skipped       { type:"confirm.skipped",      reason:string }
confirm.resolved      { type:"confirm.resolved",     confirmed:boolean }
action.completed      { type:"action.completed",     success:boolean, result:object }
request.completed     { type:"request.completed",    result:object }
request.failed        { type:"request.failed",       error:string }
```

### Handler flow:

```
1. validate
   input:  { type:"request.received", message: "cancel user 42" }
   output: { type:"request.validated", message: "cancel user 42" }

2. classify (agent)
   input:  { type:"request.validated", message: "cancel user 42" }
   output: { type:"intent.classified", intent: "cancel-user",
             params: { targetQuery: "42" } }

3. resolve
   input:  { type:"intent.classified", intent: "cancel-user",
             params: { targetQuery: "42" } }
   output: { type:"entities.resolved", intent: "cancel-user",
             params: { targetQuery: "42" },
             resolved: { userId: 42, userEmail: "user@example.com" } }

4. dispatch
   input:  { type:"entities.resolved", ... }
   output: { type:"action.running", workflowId: "userManagementWorkflow",
             input: { action:"cancel", targetUserId:42, ... },
             summary: "Cancel user 42 (user@example.com)" }

5. confirm
   input:  { type:"action.running", ... }
   output: { type:"confirm.required", question: "Cancel user 42?",
             actionType: "cancel", payload: { ... } }
   [pipeline suspends until resume POST]

6. execute
   input:  { type:"confirm.resolved", confirmed: true, payload: ... }
   output: { type:"action.completed", success: true, result: ... }

7. finalize
   input:  { type:"action.completed", ... }
   output: { type:"request.completed", result: ... }
```

### Confirm gate flow (SSE integration):

```
SSE events emitted during confirm:
  event: confirm.required
  data: { question, actionType, payload }

Client renders confirm UI (same as existing pattern).
Admin clicks "Yes".

POST /workflowagent2/resume { runId, confirmed: true }
  → Controller retrieves saved pipeline state
  → Injects { type:"confirm.resolved", confirmed: true } into bus
  → Handlers resume from execute
  → SSE continues
```

## File Structure

```
app/routes.ts                    + route definition
app/route-labels.ts              + label
app/router.ts                    + register

app/actions/agent-events/
  controller.tsx                 — thin: create bus, register handlers, pipe events to SSE
  event-bus.ts                   — typed bus + event types
  register.ts                   — register handler function
  handlers/
    validate.ts                  — code: validate message length, structure
    classify.ts                  — agent: agent.generate() to resolve intent
    resolve.ts                   — code: resolve user/resource from query
    dispatch.ts                  — code: route intent to action
    confirm.ts                   — code: emit confirm.required, handle resume data
    execute.ts                   — code: stub or sub-workflow call
    finalize.ts                  — code: emit request.completed
  controller.test.ts             — architectural tests

app/ui/
  agent-events-page.tsx          — minimal page shell

app/assets/streams/
  agent-events-stream.browser.tsx — SSE consumer
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Event types proliferate | Keep type union small; each pipeline stage has one input/output type |
| Handler order is implicit | Registration order defines flow. Make register.ts the single source of truth |
| Confirm gate adds complexity | Reuse existing workflow-agent confirm pattern (SSE suspend/resume) |
| No real functionality means no real validation | Architectural tests verify types compile and SSE flows, not business logic |

## Context

The current workflow-agent uses a single Mastra Agent (`workflowAgent`) as the top-level orchestrator. The agent has 5 tools (`lookupUser`, `cancelUserWorkflow_v2`, `lockUserWorkflow_v2`, `unlockUserWorkflow_v2`, `generateActionReport`) plus `askUserTool` and `routeNavigate`. Its instructions contain an 80-line protocol definition covering three phases (Lookup + Navigate → Confirm Gate → Execute). The agent manages protocol compliance, phase transitions, and context carry-over (targetUserId across calls).

The agent streams SSE events to the client via a custom protocol: `start`, `message`, `navigate`, `question`, `suspension`, `tool-result`, `complete`. The client (`workflow-agent-stream.browser.tsx`, ~690 lines) interprets these events to render chat bubbles, confirmation buttons, tool approval dialogs, and frame navigation.

Three Mastra Workflows exist for the deterministic parts: `userPreflightWorkflow` (1 step), `consistencyCheckWorkflow` (2 parallel steps), and `cancelUserWorkflow`/`lockUserWorkflow`/`unlockUserWorkflow` (3-4 steps each). They are invoked imperatively from agent tools via `workflow-executor.ts`.

The Mastra version in use (1.52.0) supports `run.stream()` with native SSE events (`workflow-start`, `workflow-step-start`, `workflow-step-output`, `workflow-step-progress`, `workflow-step-result`, `workflow-finish`), nested workflows (`.then(childWorkflow)`, `.parallel([...])`, `.foreach(childWorkflow)`), and `suspend()`/`resume()` with snapshot persistence.

## Goals / Non-Goals

**Goals:**

- Split the workflow-agent into two distinct phases: intent resolution (Agent) and execution (parent Workflow)
- Create a `userManagementWorkflow` parent workflow that owns the protocol: preflight → confirm gate → execute → finalize
- Replace `askUserTool` confirm gate with workflow `suspend()`/`resume()` — state survives crashes
- Replace agent SSE streaming with native workflow `run.stream()` SSE events
- Reduce agent instructions from ~80 lines of protocol to ~10 lines of intent resolution
- Keep the same page/route surface — single page, state-machine UI

**Non-Goals:**

- No changes to the individual workflows (cancel-user, lock-user, unlock-user, preflight, consistency-check) — they remain as-is
- No changes to the Mastra instance registration or other agents
- No changes to the appointment flow — appointment queries still go through agent+routeNavigate (that's genuinely fuzzy)
- No extraction of shared validation logic from workflows (acceptable duplication)
- No addition of agent-as-step inside the workflow (not needed for this simple case)

## Decisions

### Decision 1: Two-phase model — Agent resolves, Workflow executes

The agent receives the admin's natural language input, resolves it to a structured action, and returns. The workflow then executes the action deterministically.

```
Phase 1 (Agent, fire-and-forget):
  Input:  "cancel user 42"
  Output: { action: 'cancel', targetUserId: 42, ... }

Phase 2 (Workflow, streamed):
  Input:  Phase 1 output
  Steps:  preflight → confirm gate (suspend) → execute → finalize
  Output: { success: true, reportPdf: '...' }
```

**Rationale:** The protocol for user management (preflight → confirm → execute → report) is fixed and never varies. Having the LLM re-decide each step wastes tokens and adds failure modes. The LLM's strength is natural language understanding, not protocol compliance.

### Decision 2: Workflow `suspend()`/`resume()` for the binary confirm gate

The confirm gate step suspends the workflow with a typed schema containing the action details (target user, pending count, action type). The client renders these as a confirmation card with Bestätigen/Abbrechen buttons. The admin's click resumes the workflow.

```typescript
const confirmGateStep = createStep({
  id: 'confirm-gate',
  inputSchema: z.object({ action, targetUserId, userName, pendingCount }),
  suspendSchema: z.object({
    question: z.string(),
    actionType: z.enum(['cancel', 'lock', 'unlock']),
    targetUserName: z.string(),
    pendingCount: z.number(),
  }),
  resumeSchema: z.object({
    confirmed: z.boolean(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData?.confirmed) {
      return await suspend({
        question: `${inputData.action} für ${inputData.userName}?`,
        actionType: inputData.action,
        targetUserName: inputData.userName,
        pendingCount: inputData.pendingCount,
      })
    }
    return { confirmed: true, targetUserId: inputData.targetUserId }
  },
})
```

**Rationale:** Snapshot persistence means the workflow state survives server restarts, deploys, and page closures. The admin can walk away and come back. This is not possible with `askUserTool` which lives in agent memory.

### Decision 3: Native Mastra workflow SSE replaces custom agent SSE

The current pipeline has three SSE endpoints (`/workflow-agent`, `/answer`, `/tool-decision`) emitting a custom event protocol.

The new pipeline has one SSE stream from the workflow:

```
run.stream({ closeOnSuspend: false })
  → ReadableStream<WorkflowStreamEvent>
  → piped directly as SSE to the client
```

Events map directly:

| Workflow Event | Client Action |
|---|---|
| `workflow-start` | Show "Starting..." status |
| `workflow-step-start` | Show step indicator |
| `workflow-step-output` | Render step data (user info, counts) |
| `workflow-step-suspended` | Render confirm gate card from suspendPayload |
| `workflow-step-result` | Update step status to complete |
| `workflow-finish` | Show final result + PDF download |

The `closeOnSuspend: false` option keeps the SSE connection alive while the workflow is suspended (waiting for admin click). If the connection drops, the client can reconnect via `GET /stream?runId=xxx`.

**Rationale:** One standard stream instead of three custom endpoints. No protocol translation layer. Automatic snapshot persistence. Resume via a single `POST /resume` endpoint.

### Decision 4: Agent stripped to intent resolution only

Before (agent instructions, ~80 lines):
```
You help admins manage user accounts...
The protocol has three phases: Lookup + Navigate → Confirm Gate → Execute.
Phase 1 — Lookup + Navigate: Step 1: Call lookup_user...
Phase 2 — Confirm Gate: Step 3: Call ask_user...
Phase 3 — Execute: Step 4: Call cancel_user_workflow_v2...
Step 7: You MUST call generate_action_report...
Carry the targetUserId forward...
```

After (agent instructions, ~10 lines):
```
You help admins manage user accounts and browse appointments.
If the question is about appointments, return { type: 'appointment', filter, period, status }.
If the question is about user management, return { type: 'user-action', action: 'cancel'|'lock'|'unlock'|'lookup', targetQuery: '<name/email/id>' }.
If the question is unclear, ask a clarifying question before returning.
Do NOT execute any actions — just resolve intent.
```

The agent returns structured JSON instead of calling tools. The controller reads this JSON and either:
- Starts the `userManagementWorkflow` with the resolved parameters, or
- Navigates to the appointments grid, or
- Returns an error if intent is unclear

**Rationale:** The agent's only remaining job is natural language understanding. No protocol, no tool management, no phase tracking. This eliminates the most common failure mode (agent skips a step, forgets to carry context, hallucinates a tool call).

## Architecture

```
                    POST /workflow-agent
                        │
              ┌─────────▼─────────┐
              │   controller.tsx   │
              │                    │
              │  1. agent.generate │
              │     (intent only)  │
              │                    │
              │  2. switch(intent) │
              └──┬────────┬───────┘
                 │        │
    appointment  │        │  user action
                 │        │
                 ▼        ▼
       routeNavigate  ┌──────────────────┐
                      │ startWorkflow()  │
                      │                  │
                      │ run.stream({     │
                      │  closeOnSuspend: │
                      │  false           │
                      │ })              │
                      └────────┬─────────┘
                               │
                    ┌──────────▼──────────┐
                    │ userManagement      │
                    │ Workflow            │
                    │                     │
                    │ ┌─────────────────┐ │
                    │ │ preflight        │ │
                    │ │ (parallel        │ │
                    │ │  nested: user    │ │
                    │ │  preflight +     │ │
                    │ │  consistency)    │ │
                    │ └────────┬────────┘ │
                    │          │          │
                    │ ┌────────▼────────┐ │
                    │ │ confirm gate    │ │
                    │ │ suspend()       │ │
                    │ │ ◀─ admin click  │ │
                    │ └────────┬────────┘ │
                    │          │          │
                    │ ┌────────▼────────┐ │
                    │ │ execute         │ │
                    │ │ (nested:        │ │
                    │ │  cancel/lock/   │ │
                    │ │  unlock)        │ │
                    │ └────────┬────────┘ │
                    │          │          │
                    │ ┌────────▼────────┐ │
                    │ │ finalize        │ │
                    │ │ audit + notify  │ │
                    │ │ + report PDF    │ │
                    │ │ + navigate      │ │
                    │ └─────────────────┘ │
                    └─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │     SSE Stream      │
                    │  (piped directly)   │
                    │                     │
                    │ workflow-start      │
                    │ workflow-step-start │
                    │ workflow-step-result│
                    │ workflow-suspended  │
                    │ workflow-finish     │
                    └─────────────────────┘
```

## Data Flow

### Flow: User cancel action

```
Admin: "cancel user 42"
  → POST /workflow-agent { message: "cancel user 42" }
  → controller.tsx:
      agent.generate("cancel user 42")
        → returns { type: 'user-action', action: 'cancel', targetQuery: '42' }
      ─────────────────────────────────────────────────────────
  → startWorkflow({
      action: 'cancel',
      targetUserId: 42,
      adminId: session.adminId,
    })

  → userManagementWorkflow.run.stream({ closeOnSuspend: false })

  → Step 1 (preflight):
      .parallel([
        userPreflightWorkflow({ targetUserId: 42 }),
        consistencyCheckWorkflow({}),
      ])
    Stream: workflow-step-start, workflow-step-result
    Client shows: "✓ User lookup complete — Alice, alice@example.com"
                 "✓ Consistency check — 3 locked users with pending"

  → Step 2 (confirm gate):
      suspend({
        question: "Cancel user Alice?",
        actionType: 'cancel',
        targetUserName: 'Alice',
        pendingCount: 3,
        lockedUsersCount: 3,
        activeUsersCount: 12,
      })
    Stream: workflow-step-suspended { suspendPayload }
    Client shows: confirmation card with details + [Bestätigen] [Abbrechen]

  → Admin clicks [Bestätigen]
    → POST /workflow-agent/resume { runId, confirmed: true }
    → workflow resumes at confirm gate step
    → Step returns { confirmed: true, targetUserId: 42 }

  → Step 3 (execute):
      cancelUserWorkflow({ targetUserId: 42, ... })
    Stream: workflow-step-start, workflow-step-result
    Client shows: "✓ Account cancelled — 3 appointments deleted"

  → Step 4 (finalize):
      auditLog({ ... })
      notifyUser({ ... })
      generateActionReport({ ... })
      navigateTo('/admin/users', { filter: '42' })
    Stream: workflow-step-start, workflow-step-result, workflow-finish
    Client shows: "✓ All done" + [📄 Download report] + frame navigates
```

### Flow: Admin cancels mid-workflow

```
Admin types new message while workflow is running
  → Controller detects active runId for this session
  → run.cancel()
  → Client SSE stream closes
  → New agent call starts fresh
```

### Flow: Admin closes page, reconnects

```
Admin navigates away during confirm gate
  → Workflow remains suspended in storage (snapshot persisted)
  → Admin comes back, opens page
  → GET /workflow-agent finds suspended runId for this admin
  → Client connects to GET /stream?runId=xxx
  → Stream resumes from last event (workflow-step-suspended)
  → Confirm gate card re-rendered
```

## Route Surface

```
CURRENT                          PROPOSED
───────────────────────────      ───────────────────────────
GET  /workflow-agent             GET  /workflow-agent
  → renders page                   → renders page (state machine)
                                 GET  /workflow-agent/stream?runId
                                   → SSE reconnect for active workflow

POST /workflow-agent             POST /workflow-agent
  → agent stream (SSE)             → agent intent resolution (JSON)
                                   → start workflow + SSE stream

POST /workflow-agent/answer      POST /workflow-agent/resume
  → resume agent stream             → resume suspended workflow step
  (removed askUserTool)

POST /workflow-agent/tool-decision
  (removed tool approval)

GET  /workflow-agent/panel
  → frame placeholder (unchanged)
```

## Client State Machine

```
          ┌──────────┐
          │   IDLE    │
          └────┬─────┘
               │ submit message
               ▼
          ┌──────────┐
          │RESOLVING │  ← spinner, no chat
          └────┬─────┘
               │ agent returns intent
               ▼
          ┌──────────┐
          │ WORKFLOW │  ← step indicators + suspend card
          │ RUNNING  │
          └────┬─────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
  ┌──────────┐   ┌──────────┐
  │COMPLETE  │   │ CANCELLED│
  │(result)  │   │(reset UI)│
  └──────────┘   └──────────┘
       │               │
       └───────┬───────┘
               ▼
          ┌──────────┐
          │   IDLE    │
          └──────────┘
```

## Comparison: Current vs Proposed

| Aspect | Current | Proposed |
|---|---|---|
| Orchestrator | LLM agent (protocol in prompt) | Parent workflow (deterministic) |
| Agent purpose | Everything | Intent resolution only |
| Agent instructions | ~80 lines | ~10 lines |
| Confirm gate | `askUserTool` (agent memory) | `suspend()` (workflow snapshot, persistent) |
| SSE protocol | Custom: message, question, navigate, suspension, complete | Native: workflow-step-{start,result,suspended,output}, workflow-finish |
| SSE endpoints | 3 (main, answer, tool-decision) | 1 (main), 1 reconnect |
| State survival | Agent thread (if persisted) | Workflow snapshot (always persisted) |
| UI pattern | Chat bubbles + buttons | Status progress + confirm card |
| Client code | ~690 lines (chat rendering, SSE parsing, frame interaction) | ~200 lines (workflow events → status cards) |
| Token cost per action | High (protocol steps consume LLM context) | Low (agent is one call, workflow is deterministic) |

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Agent returns wrong intent (hallucinates action or target) | Keep the confirm gate — admin sees target details before confirming. If wrong, admin declines and retries |
| Workflow suspend/resume adds latency vs in-memory askUserTool | Snapshot persistence is fast (same Postgres store). The confirm gate is the only suspend point |
| `closeOnSuspend: false` keeps long-lived connections | Connection timeout of 5 minutes. After timeout, client reconnects via GET /stream |
| Two-phase model can't handle fuzzy multi-turn intent (admin doesn't provide enough info) | Agent can ask one clarifying question before returning intent. Strictly limited to 1-2 agent turns |
| Duplicated approach vs the appointment flow (which still uses agent + navigate) | Acceptable — the appointment flow is genuinely fuzzy (free-text search, date ranges). Different problems justify different architectures |
| Admin workflow is running, admin types new unrelated message | Cancel running workflow, start fresh agent call. The "new message" is implicitly an abort signal |

## Open Questions

- Should the agent response include a confidence score for the intent, and if low, prompt the admin before proceeding?
- Should the workflow's confirm gate card include edit capability (e.g., change action type from cancel to lock) or strictly binary?
- Should the workflow finalize step include automatic PDF generation, or should the UI request the PDF on demand?
- Frame: should `navigate` happen as the last workflow step, or should the client navigate independently when it receives `workflow-finish`?

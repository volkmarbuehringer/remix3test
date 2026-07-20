## Context

The existing `/mastra/chat` route provides a support agent with direct-DB tools. A new `/admin/workflow-agent` route separates concerns: the agent handles NL intent matching and human interaction (navigation, confirmations), while Mastra workflows handle durable data pipelines. The route reuses the existing SSE streaming infrastructure from `agent-sse.ts`, the `askUserTool` suspension pattern, and the `routeNavigate` for frame navigation.

The admin users page at `/admin/users` already supports `filter=enabled|disabled` and `editing=<id>` params — the workflow agent navigates there as its human-in-the-loop preview.

## Goals / Non-Goals

**Goals:**

- New `/admin/workflow-agent` route with admin-only auth and SSE streaming
- `workflowAgent` with typed tool per workflow: `cancelUserWorkflow_v2`, `lockUserWorkflow_v2`, `unlockUserWorkflow_v2`
- Each tool: lookup user → navigate to admin users page with editing param → askUser confirmation → conditional data check → execute workflow
- `lockUserWorkflow` and `unlockUserWorkflow` as Mastra `createWorkflow` definitions with validate + execute + auditLog steps
- Reuse existing `cancelUserWorkflow` from `workflow-executor.ts`
- Zero changes to existing `/mastra/chat`, `supportAgent`, or `support-tools.ts`

**Non-Goals:**

- Not modifying the `/admin/users` controller or page
- Not building a generic workflow runner or suspension-aware workflow engine
- Not replacing the existing support agent
- Not adding a workflow dashboard or run history UI

## Decisions

### 1. Typed tools per workflow (not generic `runWorkflow`)

Each workflow gets its own tool with explicit inputSchema. Avoids hallucinated workflow names. New workflows = new tool registration, but each is explicit and testable.

### 2. Tool-embedded interaction loop (not workflow-level)

The tool handler owns the lookup → navigate → confirm → execute sequence. The workflow (`createWorkflow`) remains a synchronous data pipeline. This keeps the workflow engine free of suspension concerns.

```
cancelUserWorkflow_v2 tool handler:
  ├── 1. lookupUser(userId)           → { name, email, apptCount }
  ├── 2. routeNavigate({             → frame navigates to admin/users
  │        path: '/admin/users',
  │        query: { editing: userId }
  │      })
  ├── 3. askUserTool({               → chat suspension, await admin response
  │        question: "Review user {name} in the panel. Lock if needed, then confirm.",
  │        options: [{ label: "Ready", description: "User is locked" }]
  │      })
  ├── 4. checkPendingAppts(userId)   → { count: 3 }
  ├── 5. if count > 0: askUserTool({
  │        question: "{name} has 3 pending appointments. Delete them?",
  │        options: [{ label: "Delete" }, { label: "Keep" }]
  │      })
  ├── 6. executeCancelUserWorkflow({
  │        targetUserId,
  │        adminUserId,
  │        adminEmail,
  │        deleteAppointments: boolean
  │      })
  └── 7. Return summary to agent
```

### 3. `cancelUserWorkflow_v2` reuses existing `cancelUserWorkflow`

The existing workflow at `app/actions/mastra/workflows/cancel-user-workflow.ts` already does validate → deleteAppointments → auditLog → notifyUser. The new tool adds the human-preview steps before calling it. No changes to the workflow itself.

### 4. Lock/unlock as new lightweight workflows

```typescript
lockUserWorkflow: createWorkflow(...)
  .then(validateStep)        // user exists, not already locked, not self
  .then(executeLockStep)     // UPDATE users SET disabled_at = now
  .then(auditLogStep)        // logAdminAction
  .commit()

unlockUserWorkflow: createWorkflow(...)
  .then(validateStep)        // user exists, already locked, not self
  .then(executeUnlockStep)   // UPDATE users SET disabled_at = NULL, token_version++
  .then(auditLogStep)
  .commit()
```

These are registered in `app/actions/mastra/index.ts` alongside existing workflows, and exposed via `workflow-executor.ts`.

### 5. Controller pattern: direct copy of route-agent

The controller reuses the same SSE streaming pattern: `action` (POST, SSE response), `answer` (resume askUser), `toolDecision` (approve/decline), `index` (GET, render page), `panel` (GET, render frame fallback). Auth via `requireAdmin()`. Rate limiting per-IP like route-agent.

### 6. Route: new top-level entry

```
route-agent → /admin/workflow-agent
```

Registered in `app/routes.ts`, mapped in `app/router.ts`, labeled in `app/route-labels.ts`, sidebar entry in admin layout.

## Risks / Trade-offs

- [Duplicate tool logic] Each tool reimplements lookup → navigate → confirm. → Acceptable for 3 workflows; consolidate into a helper if more appear.
- [State inconsistency] Admin might navigate away from users page before confirming. → Agent re-looks up user on confirmation to verify state hasn't changed.
- [Double execution] Admin locks user manually AND agent also runs lock workflow. → lock workflow checks `disabled_at` at start and is idempotent — no-op if already locked.
- [Error recovery] If workflow execution fails mid-step, human may not notice. → Workflow steps throw on failure; tool handler catches and surfaces error back through chat SSE.

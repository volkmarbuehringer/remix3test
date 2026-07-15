---
name: agent-aware-form-controller
description: "Make existing HTML form controllers return structured JSON when called from a Mastra agent, enabling agent-driven form workflows"
user-invocable: false
origin: auto-extracted
---

# Agent-Aware Form Controller

**Extracted:** 2026-07-14
**Context:** When a Mastra agent (route-agent) drives a user through an HTML form, the agent needs to see the submission result to continue the conversation.

## Problem

Standard HTML form controllers return HTML (re-render with errors or redirect). A Mastra agent that navigates a user to a form has no visibility into what was submitted or whether it succeeded. The agent's stream closes after navigation, and the submission result is lost.

## Solution

Add an agent-aware branch to the controller that detects an `X-Agent-Thread` header and returns JSON instead of HTML. The client intercepts the form POST and forwards the JSON to the agent's answer endpoint via `resumeStream`.

### Architecture

```
Agent → navigate → ask_user (suspends stream)
  → User fills form → clicks submit
  → Client intercept: POST + X-Agent-Thread header
  → Controller: validate (same Zod schema) → return JSON
  → Client sniff content-type → if JSON: POST /agent/answer { runId, answer, toolCallId }
  → Agent resumes with form data → reports result
```

### Controller Agent Branch

Add early-return JSON path behind an `X-Agent-Thread` header check:

#### Validation Deduplication

When the human and agent branches run the same validation logic (resource existence, duplicate checks, field constraints), extract a shared validation function instead of duplicating the checks in each branch:

```ts
interface CreateValidationResult {
  ok: true
  resourceId: number
  rules: Record<string, [number, number]>
  parsed: Record<string, string>
} | {
  ok: false
  status: number
  formValues: Record<string, string>
  fieldErrors?: Record<string, string>
  formError?: string
  issues?: readonly { path: readonly string[]; message: string }[]
}

async function validateCreate(db, schema, formData): Promise<CreateValidationResult> {
  let result = s.parseSafe(schema, formData)
  if (!result.success) {
    return { ok: false, status: 400, formValues, fieldErrors, issues: result.issues }
  }
  // ... existence, duplicate, business rule checks ...
  if (!resource) return { ok: false, status: 404, formValues, formError: 'Not found' }
  return { ok: true, parsed, resourceId, rules }
}
```

Both branches call the same function and format the response differently:
```ts
if (threadId) {
  let validation = await validateCreate(db, schema, formData)
  if (!validation.ok) {
    let issues = validation.issues ?? [{ message: validation.formError!, path: ['field'] }]
    return context.json({ status: 'validation_error', issues, threadId }, { status: validation.status })
  }
  // ... create row, log audit, return JSON ...
}
// Human branch below
let validation = await validateCreate(db, schema, formData)
if (!validation.ok) {
  return renderPage(context, {
    formValues: validation.formValues,
    fieldErrors: validation.fieldErrors,
    formError: validation.formError,
  }, { status: validation.status })
}
// ... create row, log audit, redirect ...
```

Use `issues` from `parseSafe` for schema errors (structured), and `issues: [{ message, path }]` for custom errors (normalized shape).

```ts
let threadId = context.request.headers.get('X-Agent-Thread')
if (threadId) {
  if (!result.success) {
    return context.json({ status: 'validation_error', issues: result.issues, threadId }, { status: 400 })
  }
  let row = await db.create(resources, { ... }, { returnRow: true })
  return context.json({
    status: 'created',
    data: { id: row.id, name, description },
    threadId,
  })
}
// Existing HTML path below — untouched
```

### Client Frame Form Intercept

In the route-agent's client entry, intercept frame form submissions and sniff for JSON responses:

```ts
async function handleFrameFormSubmit(e: Event) {
  if (!pendingQuestion || !currentThreadId) return  // only when agent expects form
  let form = (e.target as HTMLElement).closest('form')
  if (!form || form.id === 'route-agent-form') return  // don't intercept own form
  e.preventDefault()

  let headers: Record<string, string> = {}
  headers['X-Agent-Thread'] = currentThreadId
  let res = await fetch(form.action, { method: 'POST', headers, body: new FormData(form) })
  let ct = res.headers.get('content-type') || ''

  if (ct.includes('json')) {
    let data = await res.json()
    let body = new FormData()
    body.set('runId', currentRunId || '')
    body.set('answer', JSON.stringify(data))
    body.set('selectionMode', 'single_select')
    if (pendingQuestion?.toolCallId) body.set('toolCallId', pendingQuestion.toolCallId)
    startStream('/route-agent/answer', { method: 'POST', body })
    return
  }
  // HTML fallback: reload frame
  frame.reload()
}
```

### Agent Instructions

The agent needs instructions to navigate, ask_user, and expect JSON answer:

```
- Form submission protocol:
  Step 1: Navigate to the form page.
  Step 2: Call ask_user with "Please fill out the form and submit it." (no options).
  Step 3: The answer will be a JSON string containing the form result.
  Step 4: If status is "created", report success with the data.
  Step 5: If status is "validation_error", report errors and offer to navigate back.
```

### Frame Layout (Remix 3-specific)

When the form page renders inside a frame, the outer `<Layout>` (with navbar) must be stripped:

```ts
const FRAME_TARGETS = new Set(['admin-content', 'lists-content'])

export function renderVerwaltungPage(render, content, init?) {
  let isFrame = false
  try {
    let target = getContext().request.headers.get('X-Remix-Target')
    isFrame = target != null && FRAME_TARGETS.has(target)
  } catch { /* no request context */ }
  if (isFrame) return render(content, init)  // no outer Layout
  return render(<Layout>{content}</Layout>, init)
}
```

### Prerequisites

- The Mastra storage must be initialized (`disableInit: false` on PostgresStoreVNext) — the `mastra_workflow_snapshot` table must exist for `resumeStream` to find suspended agent runs
- The route-agent's `getTarget()` frame prefix matcher must include the path prefix mapping to the correct frame
- `pendingQuestion`, `currentRunId`, and `currentThreadId` must be cleared on stream `complete` event to prevent stale state leaking across sessions

### Multi-Form Chaining

To chain multiple forms sequentially (e.g., create resource → configure offerings), the agent continues the stream after the first form's JSON response and navigates to the second form with prefill data:

#### Agent Instructions

```
- Resource creation chaining protocol — after successfully creating a resource, continue with:
  Step 7: Navigate to the second form with prefill: navigate({
    path: "/verwaltung/offering-configs",
    query: { creating: "true" },
    data: { resource_id: String(data.id), ... }
  })
  Step 8: Call ask_user with "Please configure and submit."
  Step 9: Parse the JSON result.
  Step 10: Report success or validation errors.
```

#### Controller — Auto-Open on Prefill

In the second form's `index` action, force `creating: true` when agent prefill is detected, so the create panel opens regardless of URL params:

```ts
async index(context) {
  let prefill = readAgentPrefill(context.request)
  let overrides = prefill ? { formValues: prefill, creating: true } : undefined
  let data = await loadPageData(context, overrides)
  return renderPage(context, data)
}
```

Do the same in the first form's controller for consistency.

## Pitfalls and Race Conditions

### Frame reload after JSON response races with agent's next navigate

In the client frame intercept handler (`handleFrameFormSubmit`), **do not** reload the frame after a successful JSON response:

```ts
// ❌ BAD — this reload races with the agent's subsequent SSE navigate
if (data.status === 'created') {
  frame.src = new URL(form.action, location.origin).pathname
  frame.reload().catch(() => {})
}

// ✅ GOOD — remove it entirely; the agent will navigate where needed
// return immediately after starting the answer stream
startStream('/route-agent/answer', { method: 'POST', body })
return
```

The agent receives the JSON via SSE, processes it, and sends a `navigate` event. If the frame reloads in between, the navigate targets a mid-load frame, and the second form's create panel never opens.

### Frame stays on submitted form when agent completes without navigating

Track whether a navigate occurred during the stream, and reload the frame on `complete` if not:

```ts
let didNavigate = false  // reset on 'start' event

// in 'navigate' handler:
didNavigate = true

// in 'complete' handler:
if (!didNavigate) {
  let theFrame = handle.frames.get(activeFrame)
  if (theFrame) theFrame.reload().catch(() => {})
}
```

## When to Use

- You have an existing HTML form controller that you want to participate in an agent-driven workflow
- The agent navigates the user to a page and needs to know the form submission result
- You want to preserve the existing HTML form behavior for non-agent users (single controller, dual path)
- You need to chain multiple form submissions (multi-step workflows) through agent-guided navigation

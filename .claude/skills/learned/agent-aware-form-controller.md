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

## When to Use

- You have an existing HTML form controller that you want to participate in an agent-driven workflow
- The agent navigates the user to a page and needs to know the form submission result
- You want to preserve the existing HTML form behavior for non-agent users (single controller, dual path)

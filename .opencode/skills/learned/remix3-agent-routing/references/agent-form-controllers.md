# Agent-Aware Form Controllers

## What This Covers

Letting existing HTML form controllers participate in agent-driven workflows. Read this when adding an `X-Agent-Thread` JSON branch, intercepting a frame form submit, chaining multiple forms, or securing the agent endpoints.

- Controller agent branch + validation deduplication
- Client frame-form intercept
- Multi-form chaining and reload-race pitfalls
- CSRF bypass, rate limiting, path validation

For the navigate/prefill side, see `navigate-and-prefill.md`.

## Problem

Standard HTML form controllers return HTML (re-render with errors or redirect). A Mastra agent that navigates a user to a form has no visibility into what was submitted or whether it succeeded.

## Solution

Add an agent-aware branch to the controller that detects an `X-Agent-Thread` header and returns JSON instead of HTML.

```
Agent → navigate → ask_user (suspends stream)
  → User fills form → clicks submit
  → Client intercept: POST + X-Agent-Thread header
  → Controller: validate (same Zod schema) → return JSON
  → Client: if JSON → POST /agent/answer { runId, answer, toolCallId }
  → Agent resumes with form data → reports result
```

#### Controller Agent Branch

```typescript
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

#### Validation Deduplication

When both branches run the same validation logic, extract a shared function:

```typescript
async function validateCreate(db, schema, formData) {
  let result = s.parseSafe(schema, formData)
  if (!result.success) {
    return { ok: false, status: 400, formValues, fieldErrors, issues: result.issues }
  }
  if (!resource) return { ok: false, status: 404, formValues, formError: 'Not found' }
  return { ok: true, parsed, resourceId, rules }
}
```

#### Client Frame Form Intercept

```typescript
async function handleFrameFormSubmit(e: Event) {
  if (!pendingQuestion || !currentThreadId) return
  let form = (e.target as HTMLElement).closest('form')
  if (!form || form.id === 'support-agent-form') return
  e.preventDefault()

  let headers: Record<string, string> = { 'X-Agent-Thread': currentThreadId }
  let res = await fetch(form.action, { method: 'POST', headers, body: new FormData(form) })
  let ct = res.headers.get('content-type') || ''

  if (ct.includes('json')) {
    let data = await res.json()
    let body = new FormData()
    body.set('runId', currentRunId || '')
    body.set('answer', JSON.stringify(data))
    body.set('selectionMode', 'single_select')
    if (pendingQuestion?.toolCallId) body.set('toolCallId', pendingQuestion.toolCallId)
    startStream('/admin/support-agent/answer', { method: 'POST', body })
    return
  }
  // HTML fallback: reload frame
  frame.reload()
}
```

#### Multi-Form Chaining

Agent continues after first form's JSON response, navigates to the second form with prefill:

```
Step 7: Navigate to second form with prefill: navigate({ path: "/config", data: { resource_id: String(data.id) } })
Step 8: ask_user "Please configure and submit."
```

#### Pitfalls

**Frame reload after JSON response races with agent's next navigate:**

```typescript
// ❌ BAD — this reload races with the agent's subsequent SSE navigate
if (data.status === 'created') {
  frame.src = new URL(form.action, location.origin).pathname
  frame.reload().catch(() => {})
}

// ✅ GOOD — remove it entirely; the agent will navigate where needed
startStream('/admin/support-agent/answer', { method: 'POST', body })
return
```

**Frame stays on submitted form when agent completes without navigating:**

```typescript
let didNavigate = false // reset on 'start' event

// in 'navigate' handler:
didNavigate = true

// in 'complete' handler:
if (!didNavigate) {
  let theFrame = handle.frames.get(activeFrame)
  if (theFrame) theFrame.reload().catch(() => {})
}
```

## Security

### CSRF bypass for agent endpoints

```typescript
// app/middleware/skip-csrf.ts
if (context.url.pathname === '/admin/support-agent' || context.url.pathname.startsWith('/admin/support-agent/')) {
  return next()
}
```

### Rate limiting

```typescript
const agentRateLimiter = createRateLimiter({ windowMs: 10_000, perKey: true, maxAttempts: 5 })
if (!agentRateLimiter.attempt(ip)) {
  return new Response(
    sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error: 'Too many requests' })}\n\n`),
    { status: 429, headers: sseHeaders() },
  )
}
```

### Path validation (defense in depth)

Validate paths on both server (tool `execute`) and client (before `frame.src = href`) to prevent prompt injection navigation to malicious URLs.

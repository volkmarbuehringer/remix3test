---
name: remix3-agent-routing
description: 'Navigate Remix 3 Frames from agent SSE events, prefill forms, and submit via JSON — the full agent routing pipeline'
origin: consolidated
---

# Remix 3 Agent Routing Pipeline

**Consolidated from:** `remix3-agent-driven-frame-navigation`, `remix3-agent-form-prefill`, `agent-aware-form-controller`

The full agent → SSE → frame → form → JSON pipeline:
1. Agent-driven frame navigation (navigate event, validation, client handler)
2. Form prefill via SSE navigate (client store, header injection, server reader)
3. Agent-aware form controllers (JSON branch, X-Agent-Thread header, frame form intercept)

---

## Part 1: Agent-Driven Frame Navigation

### Problem

Agents in Remix 3 web apps are confined to chat-bubble output. When the user asks "show me the lists", the agent can only respond with text — it cannot navigate the user to the actual `/lists` route with its full grid UI.

### Solution

Give the agent a `navigate` tool that returns route data. The server-side SSE forwarder translates `tool-result` chunks into a `navigate` SSE event. The clientEntry navigates the Frame AND updates the URL bar via `history.pushState`.

#### 1. Navigate tool (server)

```typescript
export const routeNavigate = createTool({
  id: 'navigate',
  description: 'Navigate the user to a page in the app.',
  inputSchema: z.object({
    path: z.string().describe('Route path, e.g. /lists'),
    query: z.record(z.string(), z.string()).optional().describe('Query params'),
    data: z.record(z.string(), z.string()).optional()
      .describe('Form field values to prefill, e.g. { name: "Meeting Room A" }'),
  }),
  execute: async ({ path, query }) => {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
      return { type: 'error', error: 'path must be a relative route starting with /' }
    }
    if (/[:]/.test(path.includes('?') ? path.slice(0, path.indexOf('?')) : path)) {
      return { type: 'error', error: 'path must not contain a URL scheme' }
    }
    let params = new URLSearchParams(query)
    let qs = params.toString()
    let separator = path.includes('?') ? '&' : '?'
    return { type: 'route', path: qs ? `${path}${separator}${qs}` : path }
  },
})
```

#### 2. SSE controller: emit `navigate` event

```typescript
function filterAndForward(chunk, controller, runId) {
  // ...
  if (type === 'tool-result') {
    let result = p?.result as Record<string, unknown> | undefined
    if (result?.type === 'route' && typeof result.path === 'string') {
      let prefill = result.data as Record<string, string> | undefined
      fwd('navigate', {
        href: result.path,
        target: getTarget(result.path),
        history: 'push',
        ...(prefill ? { prefill } : {}),
      })
    }
  }
}
```

#### 3. Client: catch `navigate` event, reload frame, sync URL

```typescript
function handleNavigate(data: { href: string; target?: string; history?: string; prefill?: Record<string, string> }) {
  let { href, target, history: historyMode, prefill } = data

  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return

  if (prefill) {
    agentPrefillMap.set(href, prefill)
  }

  let frame = target ? handle.frames.get(target) : handle.frame
  if (frame) {
    frame.src = href
    frame.reload().catch(() => {})
    if (!historyMode || historyMode !== 'skip') {
      if (historyMode === 'replace') {
        window.history.replaceState({}, '', href)
      } else {
        window.history.pushState({}, '', href)
      }
    }
  }
}
```

#### 4. Frame in the page

```tsx
<Frame name="lists-content" src="/some-initial-route" fallback={<div>Loading...</div>} />
```

The `name` prop must match what the client uses in `handle.frames.get()`.

---

## Part 2: Form Prefill via SSE navigate

### Problem

When an agent navigates a user to a form page, the form renders with blank fields. The user must re-type information they already told the agent.

### Solution — Five-hop data flow

```
Agent tool return     →  SSE navigate event    →  client store
  { type: 'route',       navigate { href,         agentPrefillMap
    path, data }           prefill }

  client store          →  Frame GET header     →  controller reads
  agentPrefillMap          X-Agent-Prefill:         readAgentPrefill()
  .get(urlKey)             <base64 JSON>            → formValues
```

#### 1. Shared client store

```typescript
// app/assets/agent-prefill-store.ts
export const agentPrefillMap = new Map<string, Record<string, string>>()
```

#### 2. `resolveFrameResponse` injects header (UTF-8 safe)

In `entry.tsx`'s frame resolver:

```typescript
let prefillKey = url.pathname + url.search
let prefill = agentPrefillMap.get(prefillKey)
if (prefill) {
  let encoded = new TextEncoder().encode(JSON.stringify(prefill))
  let binary = String.fromCharCode(...new Uint8Array(encoded))
  headers.set('X-Agent-Prefill', btoa(binary))
}

let response = await fetch(url, { headers, signal })

if (prefill && response.ok) {
  agentPrefillMap.delete(prefillKey)
}
```

#### 3. Server reads header

```typescript
// app/utils/agent-prefill.ts
export function readAgentPrefill(request: Request): Record<string, string> | undefined {
  let raw = request.headers.get('X-Agent-Prefill')
  if (!raw) return undefined
  try {
    let json = Buffer.from(raw, 'base64').toString('utf-8')
    let parsed = JSON.parse(json)
    if (
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) &&
      Object.values(parsed).every((v) => typeof v === 'string')
    ) {
      return parsed as Record<string, string>
    }
  } catch { /* ignore */ }
  return undefined
}
```

#### 4. Controller merges prefill into formValues

```typescript
async index(context) {
  let prefill = readAgentPrefill(context.request)
  let overrides = prefill ? { formValues: prefill } : undefined
  let data = await loadPageData(context, overrides)
  return renderPage(context, data)
}
```

#### 5. Agent instructions

```
- If the user provided a value that maps to a form field, pass it as data:
  navigate({ path: "...", query: {...}, data: { name: "Meeting Room A" } }).
  Only prefill values you are confident about — do not guess.
```

### Key traps

- **Key matching:** `handleNavigate` stores relative path. `resolveFrameResponse` receives full URL. Use `url.pathname + url.search`.
- **UTF-8 base64:** Use `TextEncoder` + `btoa` on client, `Buffer.from` on server. `btoa`/`atob` throws on non-Latin-1 characters.
- **Don't delete before fetch:** Delete from Map only after `response.ok`.
- **Import chain:** Keep `agentPrefillMap` in a separate module — `entry.tsx` references `document` and can't be imported server-side.

---

## Part 3: Agent-Aware Form Controllers

### Problem

Standard HTML form controllers return HTML (re-render with errors or redirect). A Mastra agent that navigates a user to a form has no visibility into what was submitted or whether it succeeded.

### Solution

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
  if (!form || form.id === 'route-agent-form') return
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
    startStream('/route-agent/answer', { method: 'POST', body })
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
startStream('/route-agent/answer', { method: 'POST', body })
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

---

## Security

### CSRF bypass for agent endpoints

```typescript
// app/middleware/skip-csrf.ts
if (context.url.pathname === '/route-agent' || context.url.pathname.startsWith('/route-agent/')) {
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

---

## When to Use

- You have a Remix 3 app with a Mastra agent and want the agent to navigate users to routes
- You need form prefill from agent conversation context
- You want existing HTML form controllers to participate in agent-driven workflows
- You need to chain multiple form submissions through agent-guided navigation

## Related Skills

- `mastra-agent-streaming-sse` — the SSE transport that carries `navigate` and `question` events
- `form-error-handling-remix3` — validation errors re-render inline and preserve user edits over prefill values
- `remix-security-middleware` — CSRF configuration for agent endpoints
- `rate-limiter-pitfalls` — rate limiter settings for multi-step agent flows

---
name: remix3-agent-driven-frame-navigation
description: "Navigate Remix 3 Frames from agent SSE tool-result events in Mastra"
user-invocable: false
origin: auto-extracted
---

# Agent-Driven Frame Navigation via SSE Tool Results

**Extracted:** 2026-07-13
**Context:** Building a POC where a Mastra agent navigates a Remix 3 Frame to different routes. The agent has a `navigate` tool that returns `{ type: 'route', path: '...' }`. The SSE stream forwards this as a `tool-result` event, and the client catches it to navigate the frame.

## Problem

Agents in Remix 3 web apps are confined to chat-bubble output. When the user asks "show me the lists", the agent can only respond with text — it cannot navigate the user to the actual `/lists` route with its full grid UI. This forces duplicate UIs (one for direct navigation, one rendered inline by the agent).

## Solution

Give the agent a `navigate` tool that returns route data, then catch it client-side to programmatically navigate a Remix Frame.

### 1. Server: Define the navigate tool

The tool accepts a path and optional query params, validated to prevent prompt injection:

```ts
// app/actions/mastra/tools/route-navigate.ts
import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'

export const routeNavigate = createTool({
  id: 'navigate',
  description: 'Navigate the user to a page in the app.',
  inputSchema: z.object({
    path: z.string().describe('Route path, e.g. /lists'),
    query: z.record(z.string(), z.string()).optional().describe('Query params'),
  }),
  execute: async ({ path, query }) => {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
      return { type: 'error', error: 'path must be a relative route starting with /' }
    }
    let beforeQuery = path.includes('?') ? path.slice(0, path.indexOf('?')) : path
    if (/[:]/.test(beforeQuery)) {
      return { type: 'error', error: 'path must not contain a URL scheme' }
    }
    let params = new URLSearchParams(query)
    let qs = params.toString()
    let separator = path.includes('?') ? '&' : '?'
    return { type: 'route', path: qs ? `${path}${separator}${qs}` : path }
  },
})
```

**Key validation:** block absolute URLs (`https://...`) and scheme-bearing paths (`javascript:`) by checking `path.startsWith('/')` and rejecting colons before any `?`. This prevents prompt-injection where a user's data (e.g. a list description) tricks the LLM into navigating to a malicious URL.

### 2. Register the tool in the agent

```ts
// app/actions/mastra/agents/test-agent.ts
import { routeNavigate } from '../tools/route-navigate.ts'

export const testAgent = new Agent({
  // ...
  tools: { routeNavigate, /* other tools */ },
})
```

Add instructions telling the agent when to navigate vs when to chat:

```ts
instructions: `
  // ...
  - navigate: Navigate the user to a page in the app.
  - When the user asks to see, show, open, or navigate to something,
    call navigate with the appropriate path.
  - Use navigate even if you could answer with text — navigating is better
    because the user gets the full UI.
`,
```

### 3. SSE controller: forward tool-result events

The server action calls `agent.stream(message)` and stores the stream. The SSE endpoint reads from the stored stream and forwards chunks as SSE events. The `tool-result` event is forwarded as-is — the client discriminates by checking `result.type`.

```ts
// Inside the SSE stream forwarder:
if (type === 'tool-result') {
  let result = p?.result as Record<string, unknown> | undefined
  fwd('tool-result', {
    toolCallId: p?.toolCallId,
    toolName: p?.toolName,
    result,
    isError: p?.isError,
  })
}
```

### 4. Client: catch and navigate

The `clientEntry` listens for `tool-result` SSE events. When `result.type === 'route'`, it navigates the named frame:

```ts
// app/assets/route-agent-stream.tsx (clientEntry)
es.addEventListener('tool-result', (event) => {
  try {
    let data = JSON.parse(event.data)
    let result = data.result as Record<string, unknown> | undefined
    if (result?.type === 'route' && typeof result.path === 'string') {
      // Validate path on the client too (defense in depth)
      if (result.path.startsWith('/') && !result.path.startsWith('//')) {
        navigateFrame(result.path)
      }
    }
  } catch { /* ignore */ }
})

function navigateFrame(path: string) {
  let frame = handle.frames.get('lists-content')  // the Frame's name prop
  if (frame) {
    frame.src = path
    frame.reload().catch(() => {})
  }
}
```

**Frame naming:** The Remix `<Frame>` must have a `name` prop. The client accesses it via `handle.frames.get(frameName)`. This works from any clientEntry within the same VDOM tree.

### 5. The Frame in the page

```tsx
<Frame
  name="lists-content"
  src="/some-initial-route"
  fallback={<div>Loading...</div>}
/>
```

The `name` prop must match what the client uses in `handle.frames.get()`. The `X-Remix-Target` header, set automatically by the Frame, will contain this name — which the server uses to determine if a request is a fragment request.

### 6. Security: CSRF and requireToolApproval

Agent action/stream endpoints must be exempt from CSRF if the agent doesn't send CSRF tokens. Add them to the skip list:

```ts
// app/middleware/skip-csrf.ts
if (
  context.url.pathname === '/testagent' ||
  context.url.pathname.startsWith('/testagent/') ||
  context.url.pathname === '/route-agent' ||
  context.url.pathname.startsWith('/route-agent/')
) {
  return next()
}
```

Also pass `requireToolApproval` when calling `agent.stream()` to avoid silently bypassing approval gates that other routes enforce:

```ts
let output = await agent.stream(message, {
  requireToolApproval: (ctx) => ctx.toolName === 'mastra_workspace_read_file',
})
```

### 7. Rate limit agent endpoints

Agent actions call LLMs which cost money. Add rate limiting:

```ts
const agentRateLimiter = createRateLimiter({ windowMs: 10_000, perUser: false })

// In action:
if (!agentRateLimiter.attempt(ip)) {
  return context.json({ error: 'Too many requests' }, { status: 429 })
}
```

## When to Use

- You have a Remix 3 app with a Mastra agent and want the agent to navigate users to existing routes instead of rendering inline chat bubbles
- You're building a "command bar" interface where the agent serves as a routing layer
- The `navigate` tool result pattern is more appropriate when the agent should show the full route UI (grids, forms, pagination) rather than inline text

## Caveats

- **Path validation is critical.** Without it, a user can inject data that an LLM reads as a tool-call instruction, navigating the frame to an arbitrary URL. Validate on both server (in the tool's `execute`) and client (before assigning to `frame.src`).
- **The question handler must be implemented.** If the agent uses `ask_user`, the SSE stream emits a `question` event. The client must listen for it and provide an answer UI, or the agent hangs.
- **Not supported by Remix Frame `target` navigation of `<a>`/`<form>` elements.** This pattern navigates the frame programmatically via `handle.frames.get(name)`. Some Frame navigation patterns use `target="frameName"` on `<a>` links — those are separate mechanisms.
- **Rate limit ALL agent endpoints** (action + answer) to prevent unbounded LLM costs.

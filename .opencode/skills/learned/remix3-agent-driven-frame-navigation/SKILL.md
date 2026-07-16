---
name: remix3-agent-driven-frame-navigation
description: 'Navigate Remix 3 Frames from agent SSE tool-result events in Mastra'
user-invocable: false
origin: auto-extracted
---

# Agent-Driven Frame Navigation via SSE Tool Results

**Extracted:** 2026-07-13 (updated 2026-07-13 for single-request streaming + explicit navigate event)
**Context:** Building a POC where a Mastra agent navigates a Remix 3 Frame to different routes. The agent has a `navigate` tool that returns `{ type: 'route', path: '...' }`. The SSE stream emits a dedicated `navigate` event, and the client catches it to navigate the frame + sync the URL bar.

## Problem

Agents in Remix 3 web apps are confined to chat-bubble output. When the user asks "show me the lists", the agent can only respond with text — it cannot navigate the user to the actual `/lists` route with its full grid UI. This forces duplicate UIs (one for direct navigation, one rendered inline by the agent).

Additionally, Frame-based Remix apps have a disconnect between internal Frame navigation and the browser URL bar — Frame content can change while the URL stays frozen on the agent page.

## Solution

Give the agent a `navigate` tool that returns route data. The server-side SSE forwarder translates `tool-result` chunks with `type: 'route'` into a dedicated `navigate` SSE event. The clientEntry handles this event by navigating the Frame AND updating the URL bar via `history.pushState`.

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
// app/actions/mastra/agents/route-agent.ts
import { routeNavigate } from '../tools/route-navigate.ts'

export const routeAgent = new Agent({
  // ...
  tools: { routeNavigate, findList, askUserTool },
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

### 3. SSE controller: emit `navigate` event (single-request pattern)

In the `filterAndForward()` function (called from `pipeStream()` which reads the agent's fullStream inline), detect tool results with `type: 'route'` and emit a dedicated `navigate` SSE event instead of forwarding the raw `tool-result`:

```ts
function filterAndForward(
  chunk: Record<string, unknown>,
  controller: ReadableStreamDefaultController,
): 'suspended' | undefined {
  let p = chunk.payload as Record<string, unknown> | undefined
  let type = chunk.type as string

  function fwd(type: string, data: unknown) {
    controller.enqueue(sseEncoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`))
  }

  // ...other event types...

  if (type === 'tool-result') {
    let result = p?.result as Record<string, unknown> | undefined
    if (result?.type === 'route' && typeof result.path === 'string') {
      fwd('navigate', {
        href: result.path,
        target: 'lists-content', // the Frame's name prop
        history: 'push', // pushState or replace
      })
    } else {
      fwd('tool-result', { toolCallId, toolName, result, isError })
    }
  }
}
```

The `navigate` event carries three fields:

| Field     | Purpose                                                          |
| --------- | ---------------------------------------------------------------- |
| `href`    | The path to navigate to (e.g. `/lists?ids=5`)                    |
| `target`  | The Frame name (`lists-content`, `admin-content`, etc.)          |
| `history` | `'push'` (default), `'replace'`, or `'skip'` (no URL bar change) |

### 4. Client: catch `navigate` event, reload frame, sync URL bar

The client uses `fetch()` + `response.body.getReader()` (single-request pattern, not EventSource). The SSE parsing loop dispatches by event type:

```ts
async function startStream(url: string, init: RequestInit) {
  let res = await fetch(url, { ...init })
  let reader = res.body!.getReader()
  let decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    let { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    let parts = buffer.split('\n\n')
    buffer = parts.pop() || ''

    for (let part of parts) {
      let lines = part.split('\n')
      let eventType = ''
      let data = ''
      for (let line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7)
        else if (line.startsWith('data: ')) data = line.slice(6)
      }
      if (!data || !eventType) continue

      let parsed = JSON.parse(data)

      if (eventType === 'navigate') {
        handleNavigate(parsed) // frame reload + URL sync
      } else if (eventType === 'message') {
        // append text
      }
      // other events: question, suspension, complete, etc.
    }
  }
}

function handleNavigate(data: { href: string; target?: string; history?: string }) {
  let { href, target, history: historyMode } = data

  // Validate path (defense in depth)
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
    return
  }

  let frame = target ? handle.frames.get(target) : handle.frame
  if (frame) {
    frame.src = href
    frame.reload().catch(() => {})
    // Sync the URL bar
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

**Frame naming:** The Remix `<Frame>` must have a `name` prop. The client accesses it via `handle.frames.get(frameName)`. This works from any clientEntry within the same VDOM tree.

### 5. The Frame in the page

```tsx
<Frame name="lists-content" src="/some-initial-route" fallback={<div>Loading...</div>} />
```

The `name` prop must match what the client uses in `handle.frames.get()`. The `X-Remix-Target` header, set automatically by the Frame, will contain this name — which the server uses to determine if a request is a fragment request.

### 6. Security: CSRF and requireToolApproval

Agent action endpoints must be exempt from CSRF if the agent doesn't send CSRF tokens. Add them to the skip list:

```ts
// app/middleware/skip-csrf.ts
if (context.url.pathname === '/route-agent' || context.url.pathname.startsWith('/route-agent/')) {
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

Agent actions call LLMs which cost money. Add rate limiting. Return SSE error events (not JSON) since the client expects `text/event-stream`:

```ts
const agentRateLimiter = createRateLimiter({ windowMs: 10_000, perUser: false })

// In action:
if (!agentRateLimiter.attempt(ip)) {
  return new Response(
    sseEncoder.encode(
      `event: agent-error\ndata: ${JSON.stringify({ error: 'Too many requests' })}\n\n`,
    ),
    { status: 429, headers: sseHeaders() },
  )
}
```

## When to Use

- You have a Remix 3 app with a Mastra agent and want the agent to navigate users to existing routes instead of rendering inline chat bubbles
- You're building a "command bar" interface where the agent serves as a routing layer
- You need the browser URL bar to stay in sync with the Frame's internal navigation

## Related Skills

- `mastra-agent-single-request-streaming` — the transport layer this pattern builds on (piping agent fullStream directly into POST response)
- `mastra-askusertool-stream-integration` — adding question/answer flows alongside navigation

## Caveats

- **Path validation is critical.** Without it, a user can inject data that an LLM reads as a tool-call instruction, navigating the frame to an arbitrary URL. Validate on both server (in the tool's `execute`) and client (before assigning to `frame.src`).
- **The question handler must be implemented.** If the agent uses `ask_user`, the SSE stream emits a `question` event. The client must listen for it and provide an answer UI, or the agent hangs.
- **historyMode choice matters.** `'push'` creates a new history entry for each navigation; `'replace'` replaces the current entry (good for the first navigation from the agent page so back skips the agent).
- **Not supported by Remix Frame `target` navigation of `<a>`/`<form>` elements.** This pattern navigates the frame programmatically via `handle.frames.get(name)`. Some Frame navigation patterns use `target="frameName"` on `<a>` links — those are separate mechanisms.
- **Rate limit ALL agent endpoints** (action + answer) to prevent unbounded LLM costs.

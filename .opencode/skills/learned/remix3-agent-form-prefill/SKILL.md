---
name: remix3-agent-form-prefill
description: "Prefill Remix 3 forms from Mastra agent SSE navigate events via client store and HTTP header"
user-invocable: false
origin: auto-extracted
---

# Agent Form Prefill via SSE navigate Event

**Extracted:** 2026-07-14
**Context:** Extending the route-agent POC to carry structured form values alongside frame navigation. The agent extracts values from conversation (e.g. resource name), includes them in the `navigate` tool call, and they flow through SSE → client store → HTTP header → controller → form render.

## Problem

When an Remix 3 agent navigates a user to a form page (e.g. creating a resource), the form renders with blank fields. The user must re-type information they already told the agent ("create a resource called Meeting Room A"). This creates friction and wastes the agent's context.

The Remix 3 `<Frame>` loads content via GET fetches through `resolveFrameResponse` in `entry.tsx`. There is no built-in mechanism for an agent to pass structured prefill data alongside a navigation event.

## Solution

A five-hop data flow:

```
Agent tool return     →  SSE navigate event    →  client store
  { type: 'route',       navigate { href,         agentPrefillMap
    path, data }           prefill }

  client store          →  Frame GET header     →  controller reads
  agentPrefillMap          X-Agent-Prefill:         readAgentPrefill()
  .get(urlKey)             <base64 JSON>            → formValues
```

### 1. Extend the navigate tool with optional `data`

The `routeNavigate` tool accepts an optional `data: Record<string, string>` parameter and includes it in the return value:

```ts
// app/actions/mastra/tools/route-navigate.ts
inputSchema: z.object({
  path: z.string().describe('Route path'),
  query: z.record(z.string(), z.string()).optional().describe('Query params'),
  data: z.record(z.string(), z.string()).optional()
    .describe('Form field values to prefill, e.g. { name: "Meeting Room A" }'),
}),
execute: async ({ path, query, data }) => {
  // ...validation...
  return { type: 'route', path, data }  // data passed through
}
```

### 2. SSH `filterAndForward` passes `data` as `prefill`

In the SSE event stream handler, when a tool result has `type: 'route'`, extract `result.data` and include it as `prefill` on the `navigate` event:

```ts
// app/actions/route-agent/controller.tsx — filterAndForward
if (result?.type === 'route' && typeof result.path === 'string') {
  let prefill = result.data as Record<string, string> | undefined
  fwd('navigate', {
    href: result.path,
    target: getTarget(result.path),
    history: 'push',
    ...(prefill ? { prefill } : {}),
  })
}
```

### 3. Shared client store (no server-side side effects)

A separate module exports the prefill Map to avoid pulling `entry.tsx` (which references `document` at module scope) into the server import chain:

```ts
// app/assets/agent-prefill-store.ts
export const agentPrefillMap = new Map<string, Record<string, string>>()
```

Both `entry.tsx` and `route-agent-stream.tsx` import from this shared module.

### 4. Client stores prefill before frame reload

In the client's `handleNavigate`, save the prefill keyed by the href path:

```ts
// app/assets/route-agent-stream.tsx — handleNavigate
function handleNavigate(data: { href: string; prefill?: Record<string, string> }) {
  if (data.prefill) {
    agentPrefillMap.set(data.href, data.prefill)
  }
  frame.src = data.href
  frame.reload().catch(() => {})
}
```

### 5. `resolveFrameResponse` injects header (UTF-8 safe)

In `entry.tsx`'s frame resolver, use `url.pathname + url.search` to match the key format, and encode with `TextEncoder` + `btoa` for UTF-8 safety (umlauts, emoji, CJK):

```ts
// app/assets/entry.tsx — resolveFrameResponse
let prefillKey = url.pathname + url.search
let prefill = agentPrefillMap.get(prefillKey)
if (prefill) {
  let encoded = new TextEncoder().encode(JSON.stringify(prefill))
  let binary = String.fromCharCode(...new Uint8Array(encoded))
  headers.set('X-Agent-Prefill', btoa(binary))
}

let response = await fetch(url, { headers, signal })

// Only delete after successful fetch (survives transient network error)
if (prefill && response.ok) {
  agentPrefillMap.delete(prefillKey)
}
```

### 6. Server reads header with Buffer (codebase convention)

Match the existing codebase convention (`Buffer.from` not `atob`) and validate values are strings:

```ts
// app/utils/agent-prefill.ts
export function readAgentPrefill(request: Request): Record<string, string> | undefined {
  let raw = request.headers.get('X-Agent-Prefill')
  if (!raw) return undefined
  try {
    let json = Buffer.from(raw, 'base64').toString('utf-8')
    let parsed = JSON.parse(json)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Object.values(parsed).every((v) => typeof v === 'string')
    ) {
      return parsed as Record<string, string>
    }
  } catch {
    /* invalid prefill data — ignore */
  }
  return undefined
}
```

### 7. Controller merges prefill into formValues

The GET handler reads prefill and passes it as `formValues` which the template renders as `defaultValue`:

```ts
// app/actions/verwaltung/resources/controller.tsx — index action
async index(context) {
  let prefill = readAgentPrefill(context.request)
  let overrides = prefill ? { formValues: prefill } : undefined
  let data = await loadResourcePageData(context, overrides)
  return renderResourcePage(context, data)
}
```

The form component already renders `defaultValue={formValues?.name ?? ''}` — no template change needed when the schema key matches the form field name.

### 8. Agents instructions reference the capability

The agent needs to know when to extract prefill values:

```
Step 1: Navigate to the form page (e.g. "/verwaltung/resources?creating=true&sort=name&order=asc").
Step 2: If the user provided a value that maps to a form field (e.g. a resource name
        in "create a resource called Meeting Room A"), pass it as data:
        navigate({ path: "...", query: {...}, data: { name: "Meeting Room A" } }).
        Only prefill values you are confident about — do not guess.
```

## Key Traps

### Key matching: relative vs absolute URL

`handleNavigate` stores the key as a relative path (`/verwaltung/resources?creating=true`). `resolveFrameResponse` receives the full URL (`http://localhost:3000/verwaltung/resources?creating=true`). Use `url.pathname + url.search` for the lookup key, not `url.href`.

### `btoa`/`atob` breaks on non-ASCII

`btoa` throws on characters outside Latin-1 (U+0000–U+00FF). German umlauts actually work (they're within Latin-1), but `€`, emoji, and CJK throw. Use `TextEncoder` on the client and `Buffer.from` on the server for UTF-8 safe base64.

### Don't delete before fetch

Deleting the prefill entry from the Map before `await fetch(url)` means a network error loses the prefill permanently. Delete only after `response.ok` is confirmed.

### Import chain: avoid `entry.tsx` on server

`entry.tsx` calls `run({...})` at module scope which references `document`. Importing it from server-side code (or a clientEntry that could be pulled into the server chain) crashes tests. Use a separate shared module for the Map.

## When to Use

- An agent navigates to a server-rendered form page and you want to prefill fields with values from the conversation
- You're building the agent form submission protocol (navigate → prefill → user confirms → JSON result → agent notified)
- The form shares field names between the agent's data keys and the schema field names

## Related Skills

- `remix3-agent-driven-frame-navigation` — foundation this builds on (basic navigate event without data)
- `mastra-askusertool-stream-integration` — the question/answer flow that pairs with prefill (agent asks, user fills, agent gets result)
- `form-error-handling-remix3` — validation errors re-render inline and preserve user edits over prefill values

## Caveats

- **Only works on Frame GET navigations** — the prefill is a one-shot that flows through the Frame's `resolveFrameResponse`. Direct URL entry or browser back/forward won't carry prefill.
- **One-shot consumption** — prefill is deleted from the store after the first Frame GET. Navigating away and back shows blank fields.
- **String values only** — the current implementation handles `Record<string, string>`. Dates, numbers, or selects need string coercion or schema expansion.
- **Agent extraction quality** — relies on LLM instruction following to correctly extract field values from natural language. Include "only prefill values you are confident about" in instructions.

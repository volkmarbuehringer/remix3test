# Agent Navigate and Form Prefill

## What This Covers

Driving Remix 3 Frame navigation from agent SSE events and prefilling the destination form. Read this when an agent must "show me the lists", when a navigated-to form renders blank, or when building the client store/header prefill path.

- The `navigate` tool and its path validation
- Translating a `tool-result` chunk into a `navigate` SSE event
- The client handler: frame reload + `history.pushState`
- The five-hop prefill flow and its UTF-8/key-matching traps

For agent-aware form submission, see `agent-form-controllers.md`.

## Agent-Driven Frame Navigation

Agents in Remix 3 web apps are confined to chat-bubble output. When the user asks "show me the lists", the agent can only respond with text — it cannot navigate the user to the actual `/lists` route with its full grid UI.

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

## Form Prefill via SSE navigate

When an agent navigates a user to a form page, the form renders with blank fields and the user must re-type information they already told the agent.

### Five-hop data flow

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

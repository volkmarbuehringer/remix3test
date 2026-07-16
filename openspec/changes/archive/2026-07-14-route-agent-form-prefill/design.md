## Context

The route agent communicates with the client via SSE events (navigate, question, message, etc.). The client's `entry.tsx` resolves Frame GET fetches via `resolveFrameResponse`, which adds `X-Remix-Frame` and `X-Remix-Target` headers before fetching the Frame URL. When the agent navigates to a form page (e.g., `/verwaltung/resources?creating=true`), the form renders with blank inputs — any context the agent extracted from the conversation (e.g., "create a resource called Meeting Room A") is lost because there's no channel for prefill data to reach the server-rendered form.

The existing form reuse pattern (X-Agent-Thread header, JSON response on success, inline re-render on error) works for form submission but doesn't address the pre-submission step: rendering the form with values the agent already knows.

## Goals / Non-Goals

**Goals:**

- Agent can pass a `prefill: Record<string, string>` map with the `navigate` SSE event
- Prefill data reaches the controller on the subsequent Frame GET and renders as field defaults
- The resource create form is the first integration: "create a resource called {name}" pre-fills the name field
- Validation errors still re-render with inline errors and preserve user edits (existing behavior unchanged)

**Non-Goals:**

- Prefill for update/edit forms (same mechanism would work but out of scope for this test)
- Prefill for non-string field types (dates, selects, checkboxes — possible but not needed for POC)
- Agent filling multi-field forms (only name is pre-filled; user fills description and capabilities)

## Decisions

### Decision 1: Prefill data carried via request header, not URL query params

**Option A — URL query params**: `/verwaltung/resources?creating=true&name=Meeting+Room+A`

- Pro: visible, debuggable, stateless
- Con: visible in URL bar (leaks data), length limits, encoding edge cases

**Option B — X-Agent-Prefill header on Frame GET**:

- Pro: invisible to URL, arbitrary size, one mechanism
- Con: needs minimal client state (prefill store keyed by threadId)

**Chosen**: Option B. The client stores the prefill map in a `Map<string, Record<string, string>>` keyed by the current threadId. `resolveFrameResponse` checks this store and injects `X-Agent-Prefill: <base64-json>` on frame GETs. The controller reads the header, decodes it, and merges values into `formValues` at render time.

### Decision 2: No agent tool change — prefill is part of the SSE navigate event

**Option A — New agent tool `navigateWithData`**: Separate tool definition with a `data` field.

- Pro: explicit contract in the agent's tool schema
- Con: two navigate tools, agent must choose the right one

**Option B — Extend existing `routeNavigate` tool to accept optional `data`**:

- Pro: single navigate tool, `data` is optional, agent includes it when it has values
- Con: tool output already returns `{ type: 'route', path }` — needs a new field for prefill

**Chosen**: Option B, modified. The `routeNavigate` tool's `execute` function includes a `data` field in its return value: `{ type: 'route', path: '/x', data: { name: 'X' } }`. The `filterAndForward` function in the SSE handler passes this through as a `prefill` field on the `navigate` event. The client stores it and injects it on the next Frame GET.

### Decision 3: Client stores prefill ephemerally, not in session

The prefill is a one-shot value: stored before the Frame GET, consumed on that GET, discarded afterward. A simple `Map<string, Record<string, string>>` keyed by `currentThreadId` in the `entry.tsx` scope suffices. No session, no local storage, no persistence. If the Frame GET fails (network error), the prefill is lost — acceptable for a one-shot optimization.

## Risks / Trade-offs

- **Prefill is one-shot only** — If the Frame GET succeeds but the user navigates away without submitting, the prefill is gone. Returning to the form shows blank inputs. Acceptable for the initial test.
- **Base64 overhead** — Small for a single string field; the header approach doesn't scale to large prefill payloads (images, long text). Not a concern for form field values.
- **Only works for GET navigations** — The agent cannot prefill a form that's already rendered in the Frame. Prefill only applies when the agent navigates to the form URL. If the user navigates to the form independently, no prefill.
- **Agent must extract values correctly** — The agent's instruction needs to include extraction rules. If the user says "make a resource called X" vs "create X as a resource" the agent must consistently extract the name. Relies on the LLM's instruction following.

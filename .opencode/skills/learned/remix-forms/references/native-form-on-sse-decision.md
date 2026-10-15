# Native Form on an SSE-Backed Decision Path

**Extracted:** 2026-10-15
**Context:** Remix 3 customer chat (`/chat`) with a Mastra agent that suspends on a
`requireApproval` tool. Approve/decline was JS-only: the stream `clientEntry` built
buttons and `fetch()`ed `/chat/approve` with `X-Sse-Request: 1`. Vendor guide 09
(`node_modules/remix/guides/09-forms-and-mutations.md`) requires the form to submit
before JS enhances it.

## Problem

The gate is discovered at runtime (SSE `suspension` event), so there is no
server-rendered form to submit; and even if there were, three things block it:

1. `GET /chat` renders only the resolved transcript, not the gate.
2. `/chat/approve` is an agent path; the old `skipCsrf()` returned a blanket 403
   for any non-GET without `X-Sse-Request: 1`, which a native form cannot set.
3. The action answers `text/event-stream`; a native submit would paint raw SSE.

## Solution

### 1. Server-render the resolved gate as a form

`GET /chat` already resolves the durable pending gate (see `mastra-agent` →
`references/pending-gate-restore.md`). When `gateType === 'tool_decision'`, render a
form instead of leaving the card to the stream:

```tsx
// app/ui/agent-chat/approval-form.tsx
<form id="chat-approval" class="chat-decision-form" method="post"
      action={routes.chat.approve.href()}>
  <input type="hidden" name="_csrf" value={csrfToken()} />
  <input type="hidden" name="runId" value={runId} />
  {toolCallId ? <input type="hidden" name="toolCallId" value={toolCallId} /> : null}
  <button type="submit" name="decision" value="approve" class="approve-btn"
          formaction={routes.chat.approve.href()}>Bestätigen</button>
  <button type="submit" name="decision" value="decline" class="decline-btn"
          formaction={routes.chat.decline.href()}>Ablehnen</button>
</form>
```

One `<form>` serves both decisions via per-button `formaction`. Remix/component
passes it through (`EXECUTABLE_URL_ATTRIBUTES` in
`node_modules/.pnpm/@remix-run+component@*/…/runtime/core/attributes.ts`); the CSRF
token comes from `getCsrfToken(getContext())`, same as `app/ui/restful-form.tsx`.

### 2. Let the token-bearing native form through skipCsrf()

In `app/middleware/skip-csrf.ts`, keep the fast path and fall back to the regular
check — never a blanket 403:

```ts
if (isAgentPath(context.url.pathname)) {
  if (context.request.method === 'GET') return next()
  if (context.request.headers.get(SSE_REQUEST_HEADER) === '1') return next()
  return csrfMiddleware(context, next) // synchronizer token + origin
}
```

A cross-site `<form>` still fails the token/origin check; `fetch()`/EventSource keep
using the header.

### 3. Drain the SSE response, then redirect

The engine always answers with SSE. For a native request, drain it (running the
decision to completion or the next suspension), then `303` + flash. Detect the error
frame, not just the status:

```ts
async function completeDecisionForm(context, run, message) {
  let failed = false
  try {
    let response = await run()
    failed = response.status !== 200 || (await response.text()).includes('event: agent-error')
  } catch { failed = true }
  context.session.flash(failed ? 'error' : 'success', failed ? message.error : message.success)
  return redirect(routes.chat.index.href(), 303)
}
```

Approving again is safe: the redirect's GET re-resolves the gate, so a re-suspension
renders the new form and a settled run renders no form.

### 4. Enhance, don't duplicate

- The streamed card is the same form (`app/ui/agent-chat/cards.ts` builds it with DOM
  APIs); include `_csrf` from `<meta name="csrf-token">` (see `security-gotchas` →
  `references/security-middleware.md`).
- Intercept `submit` (not click) on the chat area, `preventDefault()`, read the
  submitter's `value`, and reuse the existing SSE fetch:

```ts
chatArea.addEventListener('submit', (e) => {
  let form = e.target
  if (!(form instanceof HTMLFormElement) || form.id !== 'chat-approval') return
  e.preventDefault()
  let submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null
  void handleApproval(submitter?.value === 'decline' ? 'decline' : 'approve', form)
}, { signal: lifecycleSignal })
```

- `showApproval()` must early-return when `#chat-approval` already exists, or
  `checkReconnect()` duplicates the server-rendered gate.
- `handleApproval` posts `new FormData(form)` over SSE and deletes `_csrf` (the
  header is the auth on that transport).

## Scope

Only the decision is no-JS: the message composer still returns SSE, so sending a
turn still needs JS, and `ask_user` question gates have no native form. Any future
native branch must preserve the route's `runId`/`toolCallId` field names.

## Tests

- Server (`app/actions/chat/controller.test.ts`): native POST with `_csrf` → `303`
  + flash; without `_csrf` → `403`; `GET /chat` with a suspended gate renders the
  form (`id="chat-approval"`, `formaction`, `_csrf`).
- Browser (`app/assets/streams/streams.test.browser.tsx`): dispatch `submit` with a
  `SubmitEvent` submitter, assert the fetch URL, `X-Sse-Request`, and that `_csrf`
  was dropped.

## When to Use

- A JS-only streamed action endpoint must also accept a real HTML form.
- Adding an approval/confirmation decision to a surface whose gate arrives as a
  stream event.
- A no-JS approval should `303` back to the page instead of rendering raw SSE.

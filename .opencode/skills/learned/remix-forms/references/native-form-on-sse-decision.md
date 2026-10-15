# Native Form on an SSE-Backed Decision Path

**Extracted:** 2026-10-15
**Context:** Remix 3 customer chat (`/chat`) with a Mastra agent that suspends on a
`requireApproval` tool. Approve/decline was JS-only: the stream `clientEntry` built
buttons and `fetch()`ed `/chat/approve` with `X-Sse-Request: 1`. Vendor guide 09
(`node_modules/remix/guides/09-forms-and-mutations.md`) requires the form to submit
before JS enhances it. The `ask_user` question gate (`/chat/answer`) was later
given the same treatment — see §5 — and the admin `/admin/support-agent` gates
follow in §6.

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

### 5. The same form for `ask_user` question gates

The question gate is the same shape — one form instead of two buttons:

- `GET /chat` resolves `gateType === 'question'` and renders `ChatQuestionForm`
  (`app/ui/agent-chat/question-form.tsx`) with hidden `runId`, `toolCallId`,
  `threadId` and `selectionMode`, plus the named `answer` control(s): radios for
  `single_select`, checkboxes for `multi_select`, a text input when `options` is
  empty.
- A real form repeats the field name, so a multi-select posts one `answer` per
  checked box. The engine expects a single JSON array string for `multi_select`,
  so the controller reads `context.formData.getAll('answer')` and stringifies the
  list before calling it (the engine then parses the leading `[`). Normalizing in
  the controller fixes the SSE transport too, because the streamed card now posts
  the same repeated fields.
- Guard the normalizer against double-encoding: the SSE transport may send one
  `answer` field holding an already-encoded JSON array, while a native
  multi-select with one checked box is also a single field. `normalizeAnswerFields`
  wraps a lone multi-select value only when it does not start with `[`; a
  pre-encoded array passes through untouched. A blanket
  `JSON.stringify(getAll('answer'))` resumes with `["[\"a\",\"b\"]"]` — caught by
  `app/actions/support-agent/controller.test.ts` ("passes multi-select answer as a
  JSON array").
- The streamed card (`customerQuestionCard` in `app/ui/agent-chat/cards.ts`) is
  the same `<form id="chat-question" method="post" action="/chat/answer">`; the
  stream intercepts its `submit`, drops `_csrf`, and posts over SSE.
  `showQuestion` early-returns when `#chat-question` already exists so a
  reconnect does not duplicate the server form.
- Reuse `tryGetCsrfToken()` (`app/ui/csrf-token-input.tsx`) instead of a private
  copy; the token is only needed on the native transport.

### 6. The support-agent gates (same pattern, one decision route)

The admin `/admin/support-agent` surface mirrors the customer treatment:

- `GET` renders `SupportApprovalForm` / `SupportQuestionForm`
  (`app/ui/agent-chat/support-approval-form.tsx`,
  `support-question-form.tsx`) when the durable gate row is
  `status = 'suspended'`. The support store has no `suspendedOnly` filter
  (unlike `chatGateStore`), so the index checks the status itself.
- The approval route is a single `tool-decision` action, not per-button
  `formaction`: both buttons share the form action and submit
  `decision=approve|decline`, and the controller validates that field.
- `toolDecision` and `answer` accept the native transport. A rate limit or an
  invalid decision flashes + `303`s instead of painting raw SSE (the SSE
  transport still gets its `agent-error` frame).
- The streamed cards (`supportApprovalCard` / `supportQuestionCard` in
  `cards.ts`) are the same forms. `support-agent-stream.tsx` intercepts
  `submit` on `#chat-messages` — the panel frame's `handleFrameFormSubmit`
  listener does not see the chat area — drops `_csrf`, and reuses the stream.
- Shared helpers live in `app/utils/agent-chat.ts`: `isSseRequest`,
  `completeDecisionForm(context, run, { success, error, redirectTo })` (the
  redirect target is now a parameter so both surfaces share it), and
  `normalizeAnswerFields(formData)`.
- Caveat, verified by `app/actions/support-agent/no-js-gate.test.e2e.ts`: the
  admin shell delivers page content through the **non-blocking** self-relay frame
  in `app/ui/frame-shell.tsx`. A full-document GET ships the fallback
  ("Inhalt wird geladen…") inline and the resolved fragment in a `<template>`
  that only the client runtime swaps in, so a genuinely JS-disabled browser never
  reaches the admin form (the whole admin app needs the client runtime). The
  native form is still reachable over the no-JS *transport* — the frame fragment
  renders it, a form-encoded POST without `X-Sse-Request` answers `303`, and
  the follow-up GET renders the flash — which the e2e proves over the real
  server. Reaching the form from a JS-disabled browser needs a **blocking**
  self-relay frame (the README's "without `fallback`" mode), a structural shell
  change rather than a gate change. `/chat` has no such frame, so its gate is
  driven by a real `javaScriptEnabled: false` Playwright context.

## Scope

Only the gates are no-JS: the message composer still returns SSE, so sending a
turn still needs JS. Both surfaces are covered — the customer `/chat` gates and
the admin `/admin/support-agent` gates. Any future native branch must preserve
the route's field names (`runId`/`toolCallId`, and `selectionMode`/`answer` for
the question gate).

## Tests

- Server (`app/actions/chat/controller.test.ts`): native POST with `_csrf` → `303`
  + flash; without `_csrf` → `403`; `GET /chat` with a suspended gate renders the
  form (`id="chat-approval"`, `formaction`, `_csrf`).
- Browser (`app/assets/streams/streams.test.browser.tsx`): dispatch `submit` with a
  `SubmitEvent` submitter, assert the fetch URL, `X-Sse-Request`, and that `_csrf`
  was dropped.
- Question gate: native `POST /chat/answer` → `303` + flash, a `multi_select` body
  of repeated `answer` fields arrives as an array, and `GET /chat` renders
  `id="chat-question"` with `name="answer"`/`name="selectionMode"`.
- Support gates (`app/actions/support-agent/controller.test.ts`): the same native
  `303` + flash for `POST /tool-decision` and `POST /answer`, repeated `answer`
  fields become a JSON array, and `GET /admin/support-agent` (frame target
  `admin-content`) renders `id="support-agent-approval"` /
  `id="support-agent-question"`.
- E2E (`app/actions/support-agent/no-js-gate.test.e2e.ts`): drives `/chat` in a
  Playwright context with `javaScriptEnabled: false` — the server-rendered form
  is clicked, the POST answers `303`, and the flash renders after the redirect;
  the admin gate is driven over the native HTTP transport (frame fragment must
  render the form, then a form POST with the rendered `_csrf` + follow-up GET)
  because the non-blocking frame needs JS to appear. Post the fragment's
  rendered `_csrf` value: the e2e's first cut posted the token returned by
  `createAuthCookieWithCsrfForUser` and got a 403, while the rendered token
  reached the 303. (The server tests' `router.fetch` POSTs do accept the helper
  token, so the discrepancy is specific to the real-HTTP/Playwright request
  path; parse the rendered token rather than assume they match.)

## When to Use

- A JS-only streamed action endpoint must also accept a real HTML form.
- Adding an approval/confirmation decision to a surface whose gate arrives as a
  stream event.
- A no-JS approval should `303` back to the page instead of rendering raw SSE.

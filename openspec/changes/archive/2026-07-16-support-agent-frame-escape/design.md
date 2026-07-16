## Context

The support agent page renders a full-height layout with a `<Frame name="admin-content">` occupying the flex space above an agent bar and input bar. The agent navigates the frame to admin pages (e.g. `/admin/nutzer?editing=123`) to let the user view and edit data. Three escape paths exist that navigate the top-level page away from the support agent, destroying the agent bar and input:

1. **Form submissions** — admin CRUD forms (`<form>` in `admin-nutzer-edit-page.tsx`, etc.) lack `rmx-target`, so Remix client router navigates top-level
2. **`fetch()` + `window.location.reload()`** — client entries like `nutzer-table-interactive.tsx` call `window.location.reload()` after successful fetch actions
3. **`window.location.href =`** — direct navigation from client entries

The route agent (`route-agent-stream.tsx`) has a partial solution: `handleFrameFormSubmit` intercepts form submits during active agent questions. The support agent has no equivalent.

## Goals / Non-Goals

**Goals:**
- Form submissions inside the support agent frame always stay within the frame (never navigate top-level)
- `fetch()`+`reload()` patterns in client entries reload the frame instead of the top-level page
- Agent receives form submission results when a question is pending
- All three escape paths are addressed

**Non-Goals:**
- Making every admin controller fully frame-aware (X-Remix-Target handling in POST handlers) — that is a larger change beyond this fix
- Fixing client entries outside the admin agent context — the utility degrades gracefully
- Generalizing to arbitrary frame nesting

## Decisions

### Layer 1: Frame form intercept (see route-agent pattern)

Register a `submit` event listener on `#support-agent-frame-container` that intercepts ALL form submissions from within the frame (not just during pending agent questions). The handler:

1. Prevents default form submission
2. Sends form data via `fetch()` to the form action URL
3. Reloads the active frame using `handle.frames.get(activeFrame).reload()`
4. If a pending agent question exists, parses the response for agent feedback

The same container-wide `submit` listener approach is already proved in `route-agent-stream.tsx:347-400`. The change extends it from "only during questions" to "always active".

### Layer 2: Frame-aware reload utility

Create `app/utils/frame-utils.ts` exporting:

```
safeReload(handle): void
  — If document has a support-agent or route-agent frame container,
    reloads the active frame instead of the top-level page.
  — Otherwise falls back to window.location.reload().

safeNavigate(href, handle): void
  — Same pattern for window.location.href assignments.
  — Navigates the active frame if inside an agent frame, top-level otherwise.
```

Client entries import `safeReload` and use it instead of bare `window.location.reload()`. This keeps the client entries explicit and testable — no monkey-patching of globals.

### Layer 3: Agent feedback

When `handleFrameFormSubmit` detects a pending question, after receiving the fetch response:

- If response Content-Type is JSON, parse it and send as answer via `/mastra/chat/answer`
- If not JSON, just reload the frame (agent receives no feedback — the UI updates are sufficient)

This matches the route-agent's `handleFrameFormSubmit` feedback pattern.

### Rejected alternatives

- **`Location.prototype` override** — fragile cross-browser, non-configurable in strict mode, hard to access `handle` at prototype level
- **Making all admin controllers frame-aware** — large scope, many files, not necessary when containment at the frame level suffices
- **Wrapping `window.fetch`** — fragile, race-condition-prone, hard to distinguish agent-internal fetches from admin interface fetches

## Risks / Trade-offs

- **Form intercept breaks if form uses iframe-targeted response** — unlikely in this codebase (no `target="_blank"` patterns found)
- **Fetch response after redirect may include full layout** — frame reload after fetch discards the response body and reloads the frame URL; the frame content is fetched fresh
- **`safeReload` requires importing in each client entry** — explicit but tedious; a babel transform could automate this but that is out of scope
- **Navigation during agent question gets no response** — the frame reloads but the agent does not receive the form result as structured data; the user may need to re-ask

## Context

Upstream Remix now handles form submissions inside Frames natively (#11668):
the runtime reads `rmx-target`/`rmx-src`/`rmx-reset-scroll`/`rmx-history`
directly from `<form>` elements and drives the frame through `resolveFrame`,
with redirects from frame reloads following into the active frame (#11667).
The learned skill `.opencode/skills/learned/remix3-frame-cliententry/SKILL.md`
has been corrected, and both the client `resolveFrame(src, options?)` in
`app/assets/entry.tsx` and the server `resolveFrame` in
`app/middleware/render.tsx` already run the new APIs.

The app retains two pre-native remnants:

1. `app/actions/client/grid-page.tsx` filter form (`method="GET"`) lacks
   `rmx-target`, so submitting it from inside the admin frame bypasses the
   native frame path.
2. `app/assets/streams/workflow-agent-stream.browser.tsx` re-implements generic
   form interception in `handleFrameFormSubmit` (GET query building, POST fetch,
   frame reload, history replace) — a strict subset of what the runtime now does
   natively.

## Goals / Non-Goals

**Goals:**

- Make the grid filter form a native frame navigation targeting `admin-content`
- Delete the redundant generic form shim from the workflow agent
- Update the `frame-form-intercept` spec to match native interception

**Non-Goals:**

- Touching the route/support-agent interceptors — they route JSON POST
  responses into the agent SSE answer stream, which native interception cannot do
- Touching `_method` overrides (`app/ui/restful-form.tsx`) or the
  `methodOverride` middleware — the runtime does not decode `_method`
- Removing `restoreFilterValue` — it preserves input values across the frame
  reload (frame DOM diffing caveat)

## Decisions

### Decision 1: Add `rmx-target="admin-content"` to the grid filter form

**Rationale**: The form at `app/actions/client/grid-page.tsx` (`method="GET"`,
`action="/admin/client"`) currently omits `rmx-target`, so its submission is not
routed through the frame API and reloads the top-level page. The rest of the
grid page already targets `admin-content` (edit/delete links, pagination).
Adding `rmx-target="admin-content"` makes the filter submission consistent with
the rest of the grid and lets the native runtime handle the reload.

**Alternative considered**: Re-registering a manual GET interception shim in the
workflow agent. Rejected because it duplicates native behavior and would also
duplicate the form (the grid page is reachable outside the workflow agent).

### Decision 2: Delete the workflow-agent generic form shim

**Rationale**: `handleFrameFormSubmit` (lines ~451-488) in
`app/assets/streams/workflow-agent-stream.browser.tsx` re-implements GET query
building, POST fetch, frame reload, and `history.replaceState`. Upstream now
does all of this natively from the form's `rmx-target`. Deleting the shim and
its container listener (line ~512) leaves native interception in charge.

**Alternative considered**: Keeping the shim as a fallback. Rejected — it is a
strict subset of native behavior and would fight the runtime for control of the
same events.

### Decision 3: Keep the route/support-agent interceptors

**Rationale**: The route (`route-agent-stream.browser.tsx:379`) and support
(`support-agent-stream.browser.tsx:500`) interceptors parse JSON POST responses
and feed them into the agent's SSE answer stream during pending questions.
Native interception does not route responses into an SSE stream, so these must
stay.

## Risks / Trade-offs

| Risk                                                              | Mitigation                                                                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Grid filter submission behavior changes (full reload → frame nav) | `restoreFilterValue` still restores input values after the frame reload; filter query params are preserved in the frame URL       |
| Native interception may not cover an edge case the shim handled   | The shim was a strict subset (GET + POST + reload + history.replaceState), all of which the runtime now does from `rmx-target`     |
| The workflow agent's frames may rely on the shim's answer routing | They do not — the workflow agent shim only fetches and reloads; JSON→SSE answer routing lives only in the route/support interceptors |

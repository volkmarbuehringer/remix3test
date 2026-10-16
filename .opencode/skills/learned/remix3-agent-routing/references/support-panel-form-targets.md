# Support-Agent Panel POST Forms: data-rmx-target Evaluation

**Source:** session 2026-10-16 (interactivity item #3 research; decision recorded,
implementation intentionally deferred). Verified against install build
`7f900151` (`@remix-run/component` `src/runtime/form-navigation.ts`,
`src/runtime/navigation.ts`).

## Problem

`support-agent-stream.tsx`'s `handleFrameFormSubmit` intercepts **every** POST
form submitted inside `#support-agent-frame-container` (`PANEL_CONTAINER_ID`)
and replays it over the plain fetch transport
(`support-agent-controller.ts` → `frameFormSubmit`, with `X-Agent-Thread`).
It never reads the form's `data-rmx-target`, and the blanket intercept hides a
real attribute bug:

- `app/utils/frame-target.ts` `getSelfFrameTarget()` returns the agent panel
  only for `frames.agentEventsPanel`; for a `support-agent-panel` render it
  falls back to `frames.adminContent` (its doc comment names only
  "agent-events-panel", and `frame-target.test.ts` only asserts the fallback).
- So a resources create form loaded into the support panel emits
  `data-rmx-target="admin-content"` — pointing at the **outer** frame. A
  deferred-to-runtime submit would swap the outer `admin-content` frame and
  tear down the host support page: the exact "agent dialog disappears" bug
  `getSelfFrameTarget()` was written to fix for the agent-events panel.

## Runtime mechanics (why ownership is a real decision)

Vendor form interception resolves through an **uncanceled** native submit:
`createFormNavigationResolver`'s `onFormData` bails on
`event.eventPhase !== Event.NONE || event.defaultPrevented`
(`form-navigation.ts:80`), so

- an app listener that calls `e.preventDefault()` in the `submit` handler
  cancels the submission entirely — no `formdata`, no runtime frame fetch;
  the replay owns the form;
- a form the app does **not** cancel is frame-fetch'd by the runtime with
  `X-Remix-Target` = the form's/submitter's `data-rmx-target` — with the real
  `FormData` (CSRF token intact) but **no `X-Agent-Thread`**: the runtime adds
  no application headers, and the outer document request never carried the
  header, so frame sub-headers do not include it.

A runtime frame fetch therefore can never trigger an `X-Agent-Thread` JSON
branch.

## Per-form decision

POST forms that can render inside the support panel (the panel is navigated by
the agent's `routeNavigate` to any admin route):

| Form | `data-rmx-target` emitted | Agent JSON branch | Decision |
| --- | --- | --- | --- |
| Resources create | `getSelfFrameTarget()` → `admin-content` (wrong inside panel) | yes (`resources/controller.tsx:218`) | **Client replay owns it.** A runtime fetch cannot carry `X-Agent-Thread`, so the pending `ask_user` gate would stall; and the attribute is wrong anyway. `preventDefault` must stay. |
| Offering-configs create/update (two-form chain) | same helper → `admin-content` | yes (`offering-configs/controller.tsx:371`) | **Client replay owns it** — same reasoning; this is the chain's second form. |
| Resources/others DELETE forms (`RestfulForm`), page-size control, misc admin POST forms | `getSelfFrameTarget()` or hardcoded → wrong/outside targets | no | **Replay until the attribute is fixed.** Deferring today swaps the outer frame. The replay posts with `X-Sse-Request: 1` (safe: only chat/support-agent controllers branch on `isSseRequest`) and keeps `_csrf` in the `FormData`. |
| Gate forms (`support-agent-approval` / `-question`) | none; rendered in the chat area, **not** the panel container | yes (SSE transport) | Out of scope — owned by the chat-level submit upgrade. |

## Implementation shape for item #3

1. Evaluate the form's `data-rmx-target` in the intercept: defer to the runtime
   when it names the support panel (submission proceeds uncanceled and the
   runtime frame-navigates the panel correctly), replay otherwise.
2. Prerequisite for actually deferring the non-agent forms:
   `getSelfFrameTarget()` must learn `frames.supportAgentPanel` (mirror the
   agent-events branch, update `frame-target.test.ts`).
3. The agent-aware create forms never defer, regardless of a corrected
   attribute — ownership stays with the replay in all cases.

## Related

- `agent-form-controllers.md` — the X-Agent-Thread JSON branch and the
  intercept this decision constrains
- `remix3-frame-cliententry/references/frame-navigation.md` — vendor frame
  interception background (pre-#11668 history is stale: this build intercepts
  at the Navigation API level, not pointer level)

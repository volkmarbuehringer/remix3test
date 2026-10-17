# Support-Agent Panel POST Forms: data-rmx-target Evaluation

**Source:** session 2026-10-16 (interactivity item #3 research; implemented the
same day). Verified against install build `7f900151`
(`@remix-run/component` `src/runtime/form-navigation.ts`, `src/runtime/navigation.ts`).

## Problem

`support-agent-stream.tsx`'s `handleFrameFormSubmit` originally intercepted
**every** POST form submitted inside `#support-agent-frame-container`
(`PANEL_CONTAINER_ID`) and replayed it over the plain fetch transport
(`support-agent-controller.ts` → `frameFormSubmit`, with `X-Agent-Thread`).
It never read the form's `data-rmx-target`, and the blanket intercept hid a
real attribute bug (fixed in item #3):

- `app/utils/frame-target.ts` `getSelfFrameTarget()` used to resolve only
  `frames.agentEventsPanel`; a `support-agent-panel` render fell back to
  `frames.adminContent`, so grid forms loaded into the support panel emitted
  `data-rmx-target="admin-content"` — pointing at the **outer** frame. A
  deferred-to-runtime submit would swap the outer `admin-content` frame and
  tear down the host support page: the exact "agent dialog disappears" bug
  `getSelfFrameTarget()` was written to fix for the agent-events panel.
  `selfFrameTarget()` now passes both panels through (unit cases in
  `frame-target.test.ts`, integration case in `resources.test.ts`).

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
| Resources create | `getSelfFrameTarget()` → `support-agent-panel` (post-fix) | yes (`resources/controller.tsx:218`) | **Client replay owns it** (carries `data-agent-form="true"`). A runtime fetch cannot carry `X-Agent-Thread`, so the pending `ask_user` gate would stall. |
| Offering-configs create (`admin-offering-configs-page.tsx`) | `getSelfFrameTarget()` → `support-agent-panel` (the form had **no** target before item #3) | yes (`offering-configs/controller.tsx:371`) — only the `create` handler; `update` has none | **Client replay owns it** (carries `data-agent-form="true"`); this is the chain's second form. |
| Resources/others DELETE forms (`RestfulForm`), page-size control, misc admin POST forms | `getSelfFrameTarget()` or hardcoded → now panel-correct for grid pages | no | **Deferred to the runtime** once the target names the panel: the submit proceeds uncanceled and the runtime frame-navigates the panel in place (real `FormData`, CSRF token intact, but no `X-Agent-Thread`). |
| Gate forms (`support-agent-approval` / `-question`) | none; rendered in the chat area, **not** the panel container | yes (SSE transport) | Out of scope — owned by the chat-level submit upgrade. |

## Resolution of the target/marker collision (recorded decision, user-confirmed)

After `getSelfFrameTarget()` learned `supportAgentPanel`, the agent-aware
create forms emit the **same** target as the defer-able non-agent forms, so the
target alone cannot express ownership. The intercept therefore needs a second
signal, chosen as a server-rendered marker:

- `support-agent-controller.ts` exports `AGENT_FORM_ATTRIBUTE`
  (`data-agent-form`) and the pure `deferPanelFormToRuntime(formTarget,
  agentAwareForm, panelTarget)` decision.
- The agent-aware create forms (`AdminResourcesCreatePanel`,
  offering-configs create panel) render `data-agent-form="true"`.
- `support-agent-stream.tsx` `handleFrameFormSubmit` defers only when
  `deferPanelFormToRuntime(...)` is true — i.e. the form targets the panel AND
  is not agent-marked — and replays everything else
  (`preventDefault` + `frameFormSubmit`).

Alternatives considered (rejected): gating deferral on agent state
(`resolveThreadId()`/pending gate) — weakens the "never defer" guarantee and
couples the intercept to thread lifecycle; literal target-only deferral —
strands a pending `ask_user` gate on every create submission.

## Related

- `agent-form-controllers.md` — the X-Agent-Thread JSON branch and the
  intercept this decision constrains
- `remix3-frame-cliententry/references/frame-navigation.md` — vendor frame
  interception background (pre-#11668 history is stale: this build intercepts
  at the Navigation API level, not pointer level)

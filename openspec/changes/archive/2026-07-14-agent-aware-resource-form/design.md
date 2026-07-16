## Context

Currently the route-agent drives a single-shot conversation: navigate to a page, stream closes. Forms inside frames submit via standard HTML POST, the controller returns HTML (either re-render with errors or redirect), and the frame reloads. The agent has no window into what was submitted or whether it succeeded.

The existing `handleFrameFormSubmit` in `route-agent-stream.tsx` already intercepts all frame form submissions — it sends the POST via `fetch()` and reloads the frame. It ignores the response body entirely.

## Goals / Non-Goals

**Goals:**

- Make the `verwaltung/resources` create controller return structured JSON when an `X-Agent-Thread` header is present
- Wire the JSON response back into the agent's stream via the existing `/route-agent/answer` endpoint
- Add agent instructions so the agent can participate in form-driven flows

**Non-Goals:**

- Not modifying other controllers (this is a pattern experiment with one controller)
- Not changing the existing HTML form behavior
- Not adding new agent tools (only modifying the controller response path + client intercept)
- Not handling multi-step wizard flows yet

## Decisions

**Decision 1: Header-based agent detection**
Instead of hidden form fields or cookies, the client sets `X-Agent-Thread` on the fetch. The controller checks this header — if present, returns JSON; if absent, follows the existing HTML path. Clean separation, no form markup changes.

**Decision 2: `ask_user` as the suspend point, form result as the answer**
The agent navigates to the form, then calls `ask_user("Please fill out the form and submit it.")`. This suspends the stream. The client intercepts the form POST, gets JSON from the controller, and calls `/route-agent/answer` with the form result. The agent receives the result as the answer to the `ask_user` prompt.

This reuses the existing suspend/resume mechanism without any changes to the streaming infrastructure.

Flow:

```
agent: navigate(/resources?creating=true)
agent: ask_user("Please fill out the form and submit it.")
       → stream suspends (awaiting answer)

user: fills form, clicks submit
client: form POST → controller returns JSON { status, data, threadId }
client: POST /route-agent/answer { runId, answer: JSON.stringify(formResult), toolCallId }
       → agent resumes with form data
agent: "Resource 'Test Raum' created successfully."
```

**Decision 3: No new event types or endpoints**
The form result is delivered as a standard answer payload. The agent instructions tell it to interpret structured JSON in answers after form navigation.

**Decision 4: Frame does not reload on JSON result**
If the response is HTML (non-agent flow), the frame reloads as before. If JSON, the frame stays on the current submission page — the agent reports the result in the bar.

## Risks / Trade-offs

- **Race condition**: If the user types a new message before the form result is forwarded, the answer resume may conflict. Mitigation: the client sets `currentRunId` from the latest stream start event, so the answer always targets the active run.
- **Error state**: If the controller returns validation errors as JSON, the agent receives structured error data. The agent can either report errors to the user or re-navigate to the form. The frame won't show inline error messages in this mode (because it doesn't reload).
- **One controller only**: This experiment only modifies the resources create controller. Other controllers remain HTML-only.

---
name: remix3-agent-routing
description: 'Use when a Mastra agent must navigate Remix 3 Frames, prefill forms from conversation context, or submit forms via JSON — the agent → SSE navigate → frame → form → JSON pipeline.'
origin: consolidated
---

# Remix 3 Agent Routing Pipeline

**Consolidated from:** `remix3-agent-driven-frame-navigation`, `remix3-agent-form-prefill`, `agent-aware-form-controller`

This skill is the **index** for the agent-routing pipeline. For the SSE transport that carries `navigate`/`question`/`suspension` events, see `mastra-agent`. For the frame/clientEntry mechanics, see `remix3-frame-cliententry`.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| An agent `navigate` tool; translating a `tool-result` into a `navigate` SSE event; client frame reload + `history.pushState`; prefilling a form via the `X-Agent-Prefill` header | `references/navigate-and-prefill.md` |
| An `X-Agent-Thread` JSON branch in a form controller; client frame-form intercept; multi-form chaining; CSRF/rate-limit/path-validation for agent endpoints | `references/agent-form-controllers.md` |

## Core Rules

- The agent's `navigate` tool returns `{ type: 'route', path }`; the SSE forwarder maps it to a `navigate` event carrying `href`, `target`, `history`, and optional `prefill`.
- Validate the path on **both** sides (tool `execute` and client before `frame.src = href`) — prompt injection must not reach arbitrary URLs.
- Prefill travels client store → `X-Agent-Prefill` base64 header → `readAgentPrefill()`; delete the store entry only after `response.ok`, and use `TextEncoder`/`Buffer.from` for UTF-8 safety.
- Form controllers gain an agent branch when the `X-Agent-Thread` header is present, returning JSON instead of HTML; the client intercepts the submit and posts the JSON to the agent's answer endpoint.
- Do **not** reload the frame after the JSON response (it races the agent's next navigate); let the agent navigate.

## Related Skills

- `mastra-agent` — the SSE transport that carries `navigate` and `question` events
- `form-error-handling-remix3` — validation errors re-render inline and preserve user edits over prefill values
- `remix-security-middleware` — CSRF configuration for agent endpoints
- `rate-limiter-pitfalls` — rate limiter settings for multi-step agent flows

## Context

The resource controller has an agent mode branch — when `X-Agent-Thread` is present, it validates via `s.parseSafe` and returns JSON instead of a 302 redirect. This lets the route agent programmatically create resources and receive back structured data (`{ status, data: { id, ... } }`).

The offering config controller lacks this branch entirely. Every `create` call returns a 302 redirect, even when called programmatically via the agent's frame form submission protocol. This means the route agent can create a resource but cannot continue the flow to configure its offerings — the agent has no machine-readable way to confirm success or extract the new config's ID.

The resource controller's agent branch at `controller.tsx:189-224` serves as the reference pattern.

## Goals / Non-Goals

**Goals:**

- Add agent mode to the offering config controller's `create` action, mirroring the resource controller pattern
- When agent mode is active, return JSON responses for both success and validation failure
- Integration test that validates the two-form chain: resource create → offering config create
- Update route agent instructions to include the chaining pattern

**Non-Goals:**

- No changes to the offering config controller's `update`, `destroy`, or `index` actions
- No changes to the offering config UI or human flow
- No changes to the resource controller
- No changes to the offering config validation rules or business logic
- No new capabilities or spec changes

## Decisions

### Decision 1: Agent branch placement — top of `create`, early return

Reference: resource controller at lines 189-224.

The agent check (`context.request.headers.get('X-Agent-Thread')`) goes at the very top of `create`, before any human-mode logic (grid state parsing, etc.). On the agent path, all validation errors return `context.json(...)` with status codes. On success, return `context.json({ status: "created", data: { id, resource_id, rules }, threadId })`.

The human path (else branch) remains unchanged — same grid state, redirects, error rendering.

### Decision 2: Validation error responses — structured JSON for schema issues, message string for custom validation

Schema validation failures (returned by `s.parseSafe`) already produce structured `issues` arrays — these pass through directly as `{ status: "validation_error", issues, threadId }`.

Custom validations (resource existence check, duplicate check, empty rules check) don't have structured issue types. For these, the agent mode branch returns:

```json
{ "status": "validation_error", "issues": [{ "message": "..." }], "threadId": "<id>" }
```

This matches the shape the route agent already handles — the agent instructions already say "If the JSON has status 'validation_error' with issues, report the errors."

### Decision 3: Admin action logging — same as human path, after successful create

The resource controller logs admin actions in both agent and human branches. The offering config controller follows the same pattern — log the action in the agent branch after `db.create` succeeds.

### Decision 4: Test — single integration test, not a new test file

The test goes in the existing `app/actions/verwaltung/offering-configs.test.ts`. It creates a resource via a direct `router.fetch` POST (with Cookie, no agent mode) to get a real resource ID, then creates the offering config via agent-mode POST with `X-Agent-Thread`.

Alternative considered: seeding the resource directly via `pool.query`. But using the controller itself is more realistic — it validates that the real HTTP flow produces a usable ID.

### Decision 5: Route agent instructions — add chaining pattern after resource creation

Current instructions have a "Form submission protocol" (steps 1-6) that ends at "report success." A new clause is added: after reporting resource creation success, if the user's intent suggests they want to configure offerings (or if they ask to continue), navigate to the offering config form with `resource_id` prefilled.

## Risks / Trade-offs

- **Duplicate code**: The agent branch duplicates some validation logic from the human path. Acceptable because it keeps both paths explicit and independently modifiable. If the validation logic grows, extract it to a shared function.
- **Agent mode doesn't write audit log for validation failures**: Same as the resource controller — no audit log for failed attempts. Acceptable because validation failures mean nothing was persisted.
- **The test creates a real resource via the controller**: This couples the test to the resource controller's behavior. If resource creation changes, the test might break. Alternative: seed via raw SQL. Accepted because testing through the real HTTP path is more realistic.

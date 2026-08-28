## Why

The support-agent (`/admin/support-agent`) is the only admin agent whose route handler is not a first-class, colocated controller. Its entire server-side logic lives in `app/actions/mastra/controller.tsx` as a generic-looking `mastraChat` controller and is re-exported through a one-line `app/actions/admin/support-agent/controller.tsx`. By contrast, the sibling `workflow-agent` and `agent-events` each own a dedicated `app/actions/<agent>/controller.tsx` with tests and sub-modules. This change folds the support-agent handler into a real colocated controller so all three admin agents share the same structure.

## What Changes

- **Create** `app/actions/support-agent/controller.tsx` from the current `mastraChat` handler in `app/actions/mastra/controller.tsx`, keeping the exact same actions and SSE behavior (`index`, `panel`, `action`, `toolDecision`, `answer`) and the same event payloads.
- **Move** the dedicated test surface from `app/actions/mastra/controller.test.ts` to `app/actions/support-agent/controller.test.ts`, adapting the imports (it currently reaches into `mastra/controller.tsx` for `__setTestAgent` and `chatRateLimiter`).
- **Update** `app/actions/admin/controller.tsx` to re-export the handler from `../support-agent/controller.tsx` instead of `./support-agent/controller.tsx`, matching the `workflow-agent` / `agent-events` wiring.
- **Remove** the one-line shell `app/actions/admin/support-agent/controller.tsx` and the now-unused `app/actions/mastra/controller.tsx`.
- **Repoint** `app/router.ts`'s `routes.admin.supportAgent` mapping through the new module (it imports from `admin/controller.tsx`, so no route-map change).
- No change to supported routes, tools, approval flow, or navigation semantics — the client stream (`support-agent-stream.tsx`) is untouched.

## Capabilities

### New Capabilities
<!-- none introduced by this change -->

### Modified Capabilities
- `controller-feature-colocation`: revise the existing "`mastra/` is an intentional exception" requirement — the `supportAgent` handler SHALL NOT remain in `app/actions/mastra/controller.tsx`. Instead it SHALL live in a colocated top-level `app/actions/support-agent/controller.tsx` (parallel to `workflow-agent` and `agent-events`), re-exported by `admin/controller.tsx`. The rest of the `mastra/` subsystem (agents, tools, workflows, scorers, storage, `index.ts`) remains untouched and is still not a route-controller group.

## Impact

- **Affected modules**: `app/actions/mastra/controller.tsx` (removed/emptied), `app/actions/admin/controller.tsx` (re-export path), `app/actions/admin/support-agent/controller.tsx` (removed), new `app/actions/support-agent/controller.tsx`, `app/actions/support-agent/controller.test.ts` (moved from `mastra/controller.test.ts`).
- **Router**: `app/router.ts` keeps mapping `routes.admin.supportAgent` to `admin.supportAgent`; only the module backing that export changes.
- **Dependencies / systems**: none — no new deps, no DB schema, no config. Behavior is preserved; this is a structural-ownership change plus test colocation.

## Non-goals

- Durable reconnect / confirm-gate resurfacing for pending tool approvals is explicitly **out of scope** for this change and deferred to a follow-up.
- No change to the support-agent's tool inventory, prompt, frame layout, navigation, rate limiting, or the client stream component.

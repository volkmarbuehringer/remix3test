## Why

`remix doctor` emits ~30 action-layout warnings. Investigation shows these are **not** accidental drift — they are the expected surface of the consolidation convention the repo already committed to:

- Open change `consolidate-auth-controller` already merged 5 flat auth dirs into one `app/actions/auth/controller.tsx` with named exports + `pages.tsx`.
- Spec `controller-feature-colocation` already defines the pattern: one `controller.tsx` per feature directory, pages extracted to `pages.tsx`, tests colocated, single router import.

The doctor, however, expects **one controller per `route()`/`resources()` node at a kebab path** (`auth/login/controller.tsx`, `admin/nutzer/controller.tsx`, …). The repo convention is **one controller per route *group*** with named exports. These are structurally incompatible — you cannot satisfy both for the same routes.

Decision (chosen: **D**): follow the consolidation direction the repo already started. Finish rolling it to `admin/*` and `verwaltung/*`, and treat `remix doctor`'s action-layout warnings as **known and non-gating**.

## What Changes

- **Roll consolidation to `app/actions/admin/*`** — merge the admin sub-controllers (`chatlog`, `fragments`, `lists`, `messages`, `users`, `dashboard`) and the flat admin routes (`nutzer`, `client`, `workflow-agent`, `agent-events`, `support-agent`) into a single `app/actions/admin/controller.tsx` with named exports + `pages.tsx`. Update `app/router.ts` imports.
- **Roll consolidation to `app/actions/verwaltung/*`** — merge `offerings`, `appointments`, `resources`, `offering-configs`, `report1`, `pdf`, `users-pdf`, `users-export` into `app/actions/verwaltung/controller.tsx` (+ `pages.tsx`).
- **Consolidate remaining top-level groups** — `api` (`login`/`logout`/`lists`), `appointment`, `chat`, `settings`, `uploads`, `mastra` (wired to `supportAgent`), and the `system` webhook routes (`webhook`, `app-webhook`, `callback`, `webhook-requests`, `webhook-requests/create`) into their group controllers.
- **Update `controller-feature-colocation` spec** — extend scope to all route groups; remove the `client/`+`nutzer/` "remain unchanged" scenario (they are now absorbed into `admin/`); add an explicit convention note that `remix doctor` action-layout warnings are expected and non-gating.
- **Document the doctor decision** (ADR-style in `design.md`) so future work knows `remix doctor` is not a CI gate for action-layout.

## Capabilities

### Modified Capabilities

- `controller-feature-colocation`: extend to `admin/*` and `verwaltung/*`; record the `remix doctor` non-gating decision.

## Impact

- Large but behavior-preserving structural refactor of `app/actions/**` and `app/router.ts` imports.
- **`remix doctor` warning count will rise, not fall**, as consolidation removes the per-node files the doctor wanted. The non-gating decision is therefore a prerequisite, not a side effect.
- Zero HTTP/URL/behavior changes — every route mapping produces identical responses.
- Follows the exact mechanics proven in `consolidate-auth-controller` (named exports, `pages.tsx`, `git mv`, single router import).

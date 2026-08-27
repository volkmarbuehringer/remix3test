## Context

See proposal.md - Why. Current state that shapes the approach:

- `app/middleware/frame-redirect.ts` provides `frameRedirects()` and has isolated unit tests, but it is NOT in `createNewappMiddleware` (`app/middleware/root.ts`).
- `getSelfFrameTarget()` (`app/utils/frame-target.ts`) already emits the correct `data-rmx-target="agent-events-panel"` at render time, so the toggle form is aimed at the right frame.
- The browser resolver `resolveFrameResponse` (`app/assets/frame-response.browser.tsx`) bails to `window.location.assign(dest)` whenever a fetch with a target follows a redirect — the runtime half that tears down the host page.
- Server-side grid tests (`admin-users.test.ts`) do not send `X-Remix-Frame`/`X-Remix-Target`, so wiring the middleware will not disturb them.

## Goals / Non-Goals

**Goals:**
- Follow same-origin redirects in-frame for admin target frames only: `admin-content`, `lists-content`, `workflow-agent-panel`, `agent-events-panel`, `support-agent-panel`.
- Preserve the host agent page when a grid CRUD PRG happens inside an agent panel frame.
- Add regression coverage that a redirect stays in-frame instead of bailing to a top-level navigation.

**Non-Goals (step 1):**
- Verwalung / appointment frames (`appointment-content`, `appoint-types`), top-level frames, and cross-origin redirects.
- Changing the controllers' PRG behavior (they keep returning `redirect`).
- Modifying the browser-side resolver's bail branch (it remains the final fallback for non-admin / unhandled cases).

## Decisions

### D1: Scope the middleware to admin frame targets
`frameRedirects()` currently follows any frame request (`X-Remix-Frame: true` + any `X-Remix-Target`) that redirects. To keep step 1 to admin only, add an `ADMIN_FRAME_TARGETS` set derived from the `frames` constants in `app/routes.ts`, and only follow in-frame when `target ∈ set`. Non-admin targets fall through to the client bail unchanged.

**Why admin-only first:** smaller blast radius; verwalung grid redirects keep their current (bail → full reload) behavior until phase 2. **Alternative considered:** apply globally — cleaner long-term but changes verwalung behavior now, which the user explicitly deferred.

### D2: Wire `frameRedirects()` into `createNewappMiddleware`
Add it near the inner end of the chain so it observes the controller's final response and can re-fetch via `context.router.fetch`. It re-sends the `Cookie` header from the original request so the destination render is session-authenticated. Confirm ordering against the shared `test-router.ts` stack.

**Why:** this is the only place the redirect can be resolved server-side before reaching the browser's `window.location.assign` bail. **Alternative considered:** leave unwired (status quo → the bug).

### D3: Amend `frame-navigation-conventions` (already in specs)
The MODIFIED delta copies the full "Frame reload redirects navigate the top frame" requirement block and carves out the admin-subframe in-frame follow exception, so archive-time reconciliation loses no detail.

### D4: Regression tests
- **Router-level (deterministic):** via `test-router`, POST `/admin/users/:id/toggle-disabled` with `X-Remix-Frame: true` + `X-Remix-Target: agent-events-panel`; assert a `200` fragment containing `data-rmx-target="agent-events-panel"` (i.e. the middleware followed the redirect in-frame and returned a fragment, not a bare `302`).
- **Playwright e2e (opportunistic, gated on the Mastra classifier):** load `/admin/agent-events`, send "cancel john doe", toggle a user, then assert the agent input/status bar are still present and the grid rendered inside the panel.

**Why both:** the router-level test is the reliable, always-runnable gate; the browser e2e directly proves "the agent dialog does not disappear."

### D5: Reconcile the frame source after an in-frame followed redirect
A followed-in-frame redirect returns a `200` fragment, so the frame runtime cannot infer the destination (`response.redirected` is `false`, and the vendor only updates `frame.src` for the top frame). Left unreconciled, the subframe's `src` stays at the POST action URL (e.g. `/admin/users/2/toggle-disabled`), so a later `frame.reload()` (e.g. the agent `workflow-finish` reload) GETs it → `404`.

Implementation: the `frameRedirects` middleware sets an `X-Remix-Redirect-To: <destination>` header on the fragment it returns; the client `resolveFrame` (`app/assets/entry.tsx`) reads it and sets the target frame's `src` to the destination. This keeps the frame's source as the GET-able destination so subsequent reloads render the page instead of a 404.

**Why header + client reconcile:** the destination is computed server-side and cannot be anticipated by the form; the vendor runtime only corrects the top-frame `src` on redirect, so the app must reconcile the subframe itself. **Alternative considered:** `data-rmx-src` on the form — rejected because the frame resolver fetches `frame.src` (not the form action), so it would break the POST.

## Risks / Trade-offs

- [Middleware ordering / router context] → wire where `context.router.fetch` and session cookie are available; verify via `test-router.ts`.
- [Admin-only scope inconsistency] → verwalung still bails to a full reload; documented as a phase-2 follow-up, and the `frame-navigation-conventions` carve-out explicitly names the admin exception.
- [Redirect loops] → keep the redirect-depth limit (already implemented + unit-tested) so a loop bails to the client fallback.
- [Spec drift at archive] → the MODIFIED delta carries the full original requirement block so nothing is lost on sync.
- [e2e flakiness from Mastra/DB] → the router-level test is the primary gate; the Playwright test is best-effort.

## Migration Plan

1. Add the admin target-scope gate in `app/middleware/frame-redirect.ts`.
2. Wire `frameRedirects()` into `createNewappMiddleware` in `app/middleware/root.ts`.
3. Add the router-level regression test; re-run the existing server grid + frame-redirect tests (expected unchanged).
4. Optionally add the Playwright e2e, gated on classifier availability.
5. Deploy and manually verify: from `/admin/agent-events`, send "cancel john doe", activate/deactivate a user — the host agent page must remain.

## Open Questions

- Whether to extend the in-frame follow to verwalung frames in a later phase (deferred; does not change these specs, approach, or tasks).

## Why

When a grid page (e.g. `/admin/users`) is loaded into a nested agent panel frame (`agent-events-panel`) — as happens after an admin types "cancel john doe" — and the user activates/deactivates a user, the toggle form POSTs and the controller returns a `302` (PRG). The browser-side frame resolver (`app/assets/frame-response.browser.tsx`) sees the redirected fetch and bails with `window.location.assign(destination)`, which **replaces the whole document**. Because the host is `/admin/agent-events`, the agent-events page ("the agent dialog") disappears.

A `frameRedirects()` middleware that would keep such redirects in-frame exists (`app/middleware/frame-redirect.ts`) and is unit-tested, but it is **never wired into the middleware stack** (`app/middleware/root.ts`). The render-time fix (`getSelfFrameTarget()`, `app/utils/frame-target.ts`) already points the form at the panel, but the runtime redirect bail is unhandled.

## What Changes

- Wire `frameRedirects()` into `createNewappMiddleware` (`app/middleware/root.ts`), **scoped to admin frame targets in step 1** (admin-content, lists-content, agent-events-panel, workflow-agent-panel, support-agent-panel). Verwalung / appointment frames are out of scope for now.
- The middleware re-fetches a same-origin redirect destination as a frame GET with the frame headers, so it renders a content fragment into the target frame instead of letting the browser bail to a top-level navigation.
- Amend the `frame-navigation-conventions` spec so its "Frame reload redirects navigate the top frame" requirement is carved out for admin subframe form submissions (which now follow in-frame).
- Add an end-to-end regression test covering the agent-events panel case (in-frame follow, no top-level bail).

## Capabilities

### New Capabilities

- `admin-frame-redirect-follow`: Admin-scoped subframe form submissions that end in a redirect are re-fetched in-frame as a GET fragment instead of bailing to a top-level navigation.

### Modified Capabilities

- `frame-navigation-conventions`: The "Frame reload redirects navigate the top frame" requirement is narrowed to exclude admin subframe PRG form submissions, which follow in-frame.

## Impact

- `app/middleware/root.ts` — wire the middleware; `app/middleware/frame-redirect.ts` — add the admin-target scope gate.
- `app/assets/frame-response.browser.tsx` — unaffected on its own; the middleware is what prevents reaching the bail branch.
- `app/actions/admin/admin-users.test.ts` and other server-side grid tests — unaffected (they do not send `X-Remix-Frame`/`X-Remix-Target`).
- `openspec/specs/frame-navigation-conventions/spec.md` — amend requirement.

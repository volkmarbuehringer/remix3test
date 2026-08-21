## Context

newapp currently uses Remix's `<Frame>` system for Admin and AI section navigation, and for the Client Lab CRUD grid. The frame navigation pattern is already established — `app/ui/nav-link.tsx` supports `rmx-target` and `rmx-document`, `app/middleware/render.tsx` installs a renderer with `resolveFrame`, and `app/middleware/auth.ts` has middleware guarding frame content. However, the `frame-navigation` demo (`~/remix/demos/frame-navigation`) reveals several gaps:

1. **`rmx-src` attribute**: The Remix runtime understands `rmx-src` on links to declare a frame's source URL, but newapp's `NavLink` doesn't pass it through.
2. **Frame redirect following**: When a form submission inside a frame issues a redirect, the frame fetch can break. The demo's `render.tsx` follows redirects up to 10 hops.
3. **Auth-aware frame errors**: Frame requests with expired sessions get a full-page redirect instead of an inline "session expired" message.
4. **Client-side frame error states**: The demo's `entry.tsx` handles 401→login redirect, non-ok responses with animated error cards, and fatal errors gracefully.
5. **Controller consolidation**: Admin subsections (chatlog, messages) each have their own controller despite sharing the same middleware and layout.

## Goals / Non-Goals

**Goals:**

- Add `rmx-src` support to `app/ui/nav-link.tsx` for complete Remix frame attribute coverage
- Add `followFrameRedirects()` utility to `app/middleware/render.tsx` for resilient frame form submissions
- Add auth-aware 401 handling for frame requests across Admin, AI, and Client sections
- Add client-side frame error states (401, non-ok, fatal) to `app/assets/entry.tsx`
- Add `@types/dom-navigation` devDependency

**Non-Goals:**

- Changing the Admin/AI shell-or-fragment architecture — it works well and is well-documented
- Adding new frame-based sections — this is purely about refining existing patterns
- Rewriting existing controllers — consolidation is optional and scoped to clear wins
- Adding animated error UI beyond what the demo demonstrates

## Decisions

### Decision 1: `followFrameRedirects()` as a shared utility, not middleware

**Rationale**: Frame redirect following is needed wherever form submissions happen inside frames (Client CRUD, Admin actions). Making it a shared export from `app/middleware/render.tsx` rather than duplicating it in each controller keeps it in one place. It will be integrated into the existing `resolveFrame` function in the render middleware.

**Alternative considered**: Per-controller redirect handling. Rejected because it would duplicate the logic across 3+ controllers.

### Decision 2: Auth error handling at the middleware level, not per-controller

**Rationale**: The `requireAuth()` middleware already exists and is used by Admin, AI, and Client controllers. Adding frame-aware 401 handling there means all frame-using sections get the upgrade automatically. The middleware checks `X-Remix-Frame` header and returns inline HTML instead of a redirect.

**Alternative considered**: Per-controller try/catch for auth errors. Rejected because middleware is the correct layer for cross-cutting auth concerns.

### Decision 3: Client-side error states in entry.tsx mirror the demo pattern

**Rationale**: The demo's `entry.tsx` is the canonical reference for how to handle frame fetch failures on the client. The patterns are well-tested and proven. Mirroring them directly reduces risk and aligns with the Remix framework's expectations.

**Alternative considered**: Custom error handling in each asset component. Rejected because `entry.tsx` is the single entry point for all client-side interactions.

### Decision 4: Controller consolidation deferred to separate task

**Rationale**: Consolidating admin sub-controllers is architecturally beneficial but operationally separate from the frame navigation refinements. It changes code organization, not behavior. Making it a separate task (lowest priority, optional) avoids scope creep.

**Alternative considered**: Consolidate everything in one pass. Rejected to keep the change focused and low-risk.

## Risks / Trade-offs

| Risk                                                                     | Mitigation                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `followFrameRedirects()` adds latency to frame fetches                   | Redirect following is bounded at 10 hops; most frames follow 0 redirects so the overhead is negligible in the common case                                                          |
| Auth middleware changes could break existing frame auth flows            | The change is additive — only fires when `X-Remix-Frame` is set. Existing top-level auth is unchanged                                                                              |
| Client entry.tsx changes affect all pages, not just frames               | The error handling only triggers on frame fetch failures from `resolveFrameResponse`. Normal navigation is unaffected                                                              |
| Adding `@types/dom-navigation` may conflict with TS 6.0's built-in types | The types file notes that as of TS 6.0 these are included in `lib.dom.d.ts`. The dependency is kept as a devDependency for explicit documentation of the Navigation API dependency |

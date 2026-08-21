## 1. NavLink `rmx-src` Support

- [x] 1.1 Add `frameSrc?: string` prop to `NavLinkProps` type in `app/ui/nav-link.tsx`
- [x] 1.2 Pass `rmx-src={frameSrc}` as extra attribute on rendered `<a>` element
- [x] 1.3 Verify `rmx-src` attribute renders on DOM element when prop is provided

## 2. Frame Redirect Following in Render Middleware

> ✅ Already implemented — `app/middleware/render.tsx` has `followFrameRedirects()` (10-hop limit) integrated into `resolveFrame()` with error HTML fallback, plus `fragmentResponseInit()` export.

- [x] 2.1 Add `followFrameRedirects()` function to `app/middleware/render.tsx` that follows HTTP 3xx redirects up to 10 hops
- [x] 2.2 Integrate `followFrameRedirects()` into the existing `resolveFrame` function so frame form submissions with redirects are handled
- [x] 2.3 Add error HTML fallback (`<pre>Frame error: {status} {statusText}</pre>`) for non-ok final responses
- [x] 2.4 Verify typecheck passes with `tsc --noEmit`

## 3. Auth-Aware Frame 401 Handling

> ✅ Already implemented — `app/middleware/auth.ts` `requireAuth()` detects `X-Remix-Frame`, returns inline 401 HTML, falls through to login redirect for top-level requests.

- [x] 3.1 Detect `X-Remix-Frame: true` header in `requireAuth()` in `app/middleware/auth.ts`
- [x] 3.2 Return inline HTML response with status 401 for unauthenticated frame requests (instead of redirect)
- [x] 3.3 Ensure top-level (non-frame) unauthenticated requests still redirect to login as before
- [x] 3.4 Verify typecheck passes with `tsc --noEmit`

## 4. Client-Side Frame Error States

> ✅ Already implemented — `app/assets/entry.tsx` handles 401→login redirect, non-ok→ErrorCard, fatal errors→fadeOut+ErrorCard, all with animation.

- [x] 4.1 Add 401 detection in `resolveFrameResponse` in `app/assets/entry.tsx` that redirects to login page
- [x] 4.2 Add error card rendering for non-ok, non-401 frame responses (with reload link using `rmx-document`)
- [x] 4.3 Add fatal runtime error handler: `app.dispose()`, animated body fade-out, error card with reload button
- [x] 4.4 Verify the error card component matches the demo pattern with proper CSS styling
- [x] 4.5 Verify build succeeds (`tsc --noEmit`)

## 5. Final Verification

- [x] 5.1 Run full typecheck: `tsc --noEmit`
- [x] 5.2 Run tests: `remix test`

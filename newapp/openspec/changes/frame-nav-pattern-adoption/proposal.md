## Why

newapp already uses frame-based navigation for its Admin and AI sections, but the `frame-navigation` demo (at `~/remix/demos/frame-navigation`) demonstrates several refinements — `rmx-src` attribute support, frame redirect following, and graceful auth-aware frame error handling — that would make newapp's frame navigation more robust while reducing boilerplate. Adopting these patterns closes the gap between newapp's current implementation and the canonical patterns the Remix framework supports.

## What Changes

- Add `rmx-src` attribute support to `app/ui/nav-link.tsx` so frame links can declare their source URL
- Add `followFrameRedirects()` to `app/middleware/render.tsx` so frame-fetched form submissions that issue redirects don't break
- Add auth-aware 401 handling for frame requests across all frame-using sections (Admin, AI, Client)
- Add client-side frame error states (401→login redirect, non-ok→error card, unhandled→fatal error card) to `app/assets/entry.tsx`
- Consolidate admin sub-section controllers (chatlog, messages) into a single controller when they share middleware and layout, reducing boilerplate
- Add `@types/dom-navigation` as an explicit dependency and document Navigation API usage

## Capabilities

### New Capabilities
- `frame-nav-refinements`: Server-side frame navigation utilities — `followFrameRedirects()` middleware helper, `rmx-src` attribute pipeline, and auth-aware frame error handling
- `frame-error-states`: Client-side frame error UI — graceful 401 handling, error cards with reload actions, and fatal error boundaries for the Remix frame runtime

### Modified Capabilities

None — no existing specs to modify.

## Impact

- **Files modified**: `app/ui/nav-link.tsx`, `app/middleware/render.tsx`, `app/middleware/auth.ts`, `app/assets/entry.tsx`
- **Files possibly created**: None (all changes are refinements to existing files)
- **Dependencies added**: `@types/dom-navigation` (devDependency)
- **Controllers potentially consolidated**: `admin-chatlog-controller.tsx` and `admin-messages-controller.tsx` could merge into a single `admin-controller.tsx` with multiple actions

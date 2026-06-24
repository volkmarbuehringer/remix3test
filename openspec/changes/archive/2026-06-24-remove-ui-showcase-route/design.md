## Context

The `/ui` and `/ui/:component` routes are defined in `app/routes.ts` and handled by the home controller (`app/actions/home/controller.tsx`). They render UI component showcase pages backed by `app/ui/showcase-pages.tsx` and `app/ui/showcase-registry.ts`. No in-app navigation links point to these routes — they were only reachable by typing the URL directly. The showcase pages and registry are not imported by anything outside the home controller.

## Goals / Non-Goals

**Goals:**
- Remove the route definitions from `app/routes.ts`
- Remove the action handlers and imports from the home controller
- Delete the showcase page files and their tests
- Preserve `app/ui/page-primitives.tsx` (shared utility used by other features)

**Non-Goals:**
- No changes to auth middleware, router config, or other controllers
- No changes to the `app/ui/layout.tsx` (dead CSS classes for the old Showcase dropdown can be cleaned up separately)
- Not removing any other unused routes or code

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Delete vs comment out** | Delete entirely | Dead code has no value — git history preserves it if needed |
| **Keep page-primitives.tsx** | Yes | Exported `PageSection`, `panelCss`, `bodyTextCss`, `pageStackCss` are used by 4 other controllers |
| **Cleanup approach** | Per-file edits + deletions | Minimal diff — only touch what's directly related to the showcase |

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Type errors if deleted files are imported elsewhere | Grep confirms only `page-primitives.tsx` is shared; all other imports are exclusive to the showcase route |
| Test breakage | Delete the showcase-specific test file `controller.ui.test.ts` alongside the implementation |
| Forgot a reference to `routes.ui` or `routes.uiComponent` | Run `npm run typecheck` after changes to catch dangling references |

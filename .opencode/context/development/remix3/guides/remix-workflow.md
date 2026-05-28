<!-- Context: development/remix3/guides/remix-workflow | Priority: high | Version: 1.0 | Updated: 2026-04-30 -->

# Guide: Default Remix Workflow

**Core Idea**: 9-step end-to-end workflow for building Remix 3 features — classify, start from server contract, validate at boundary, finish with verification.

## Steps

1. **Classify the change** — Is it route contract, request lifecycle, data model, auth/session, or only UI?
2. **Start from the server contract** — Add/update `app/routes.ts` before wiring handlers or UI
3. **Put code in the narrowest owner** — Route-local first, promote only when reuse is real
4. **Server path before browser behavior** — Route should return correct `Response` via `router.fetch(...)` before adding `clientEntry(...)`, animations, or DOM effects
5. **Add middleware deliberately** — Fast-exit middleware early (static files), request-enriching later (sessions, auth). Export typed `AppContext` from root middleware stack
6. **Validate input at the boundary** — Parse `Request`, `FormData`, params, cookies, external payloads before they reach rendering or persistence logic
7. **Hydrate only when necessary** — Prefer server-rendered UI. `clientEntry(...)` + `run(...)` only for real browser interactivity or browser-only APIs
8. **Test the narrowest meaningful layer** — Router tests for route behavior, component tests for interactive/DOM-specific behavior
9. **Finish with verification** — Re-read route flow, confirm auth/authorization boundaries, run smallest relevant test + typecheck

## Quick Reference

```typescript
// 1. Define route
// 2. Write controller returning Response
// 3. Add middleware for cross-cutting concerns
// 4. Validate at boundary
// 5. Only hydrate when needed
// 6. Test router.fetch, then component if interactive
// 7. Typecheck + test loop
```

**Reference**: Full skill at `~/remix/skills/remix/SKILL.md`

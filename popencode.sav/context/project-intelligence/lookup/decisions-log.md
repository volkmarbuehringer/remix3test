<!-- Context: project-intelligence/decisions | Priority: high | Version: 1.0 | Updated: 2025-01-12 -->

# Decisions Log

> Record major architectural and business decisions with full context. This prevents "why was this done?" debates.

## Quick Reference

- **Purpose**: Document decisions so future team members understand context
- **Format**: Each decision as a separate entry
- **Status**: Decided | Pending | Under Review | Deprecated

## Decision Template

```markdown
## [Decision Title]

**Date**: YYYY-MM-DD
**Status**: [Decided/Pending/Under Review/Deprecated]
**Owner**: [Who owns this decision]

### Context
[What situation prompted this decision? What was the problem or opportunity?]

### Decision
[What was decided? Be specific about the choice made.]

### Rationale
[Why this decision? What were the alternatives and why were they rejected?]

### Alternatives Considered
| Alternative | Pros | Cons | Why Rejected? |
|-------------|------|------|---------------|
| [Alt 1] | [Pros] | [Cons] | [Why not chosen] |
| [Alt 2] | [Pros] | [Cons] | [Why not chosen] |

### Impact
**Positive**: [What this enables or improves]
**Negative**: [What trade-offs or limitations this creates]
**Risk**: [What could go wrong]

### Related
- [Links to related decisions, PRs, issues, or documentation]
```

---
## Decision: Consolidate BuildAction Files into Root Controller

**Date**: 2026-05-03
**Status**: Decided
**Owner**: Engineering Team

### Context
The `my_app` project had 5 standalone `BuildAction` files (`home.tsx`, `assets.tsx`, `auth-logout.tsx`, `messages-content.tsx`, `messages-subscribe.tsx`) in `app/actions/`, each handling a single top-level Route leaf. Each file had minimal logic (5-25 lines), duplicated import patterns, and required individual `router.get()`/`router.post()` calls in `router.ts`.

### Decision
Consolidate all top-level Route leaf handlers into `app/actions/controller.tsx` as action keys on the root controller's `actions` object. Use `router.map(routes, rootController)` for a single mapping call. Remove the 5 standalone files.

### Rationale
- Reduced file count by 5, lowering cognitive overhead
- Eliminated 5 individual verb router calls in favor of one `router.map()`
- All top-level Route leaves are now discoverable in one file
- Handlers were small enough that isolation didn't justify file overhead
- The `Controller` type with `satisfies` provides the same type safety as `BuildAction`

### Alternatives Considered
| Alternative | Pros | Cons | Why Rejected? |
|-------------|------|------|---------------|
| Keep standalone BuildAction files | Clear 1:1 file-to-route mapping | 5 extra files, verbose imports in router.ts | Overhead not justified for small handlers |
| Consolidate into one file | Single source of truth for root leaves | File could grow large | Currently 138 lines, well within limit |
| Consolidate with asset server | One import for both assets and controller | Circular import with render.tsx | Solved: controller.tsx exports `assetServer`, render.tsx imports it |

### Impact
- **Positive**: Cleaner router.ts, fewer files, faster context loading
- **Negative**: Root controller file is larger (but still manageable)
- **Risk**: If root controller grows beyond ~200 lines, consider extracting large handlers back to standalone files

### Related
- `project-intelligence/my_app/concepts/architecture.md`
- `development/remix3/guides/controller-creation.md`
- `development/remix3/examples/controller-patterns.md`

---
## Decision: Replace `createHtmlResponse` with `new Response`

**Date**: 2026-05-03
**Status**: Decided
**Owner**: Engineering Team

### Context
Both `my_app` and `bookstore` used `createHtmlResponse(stream, init)` from `remix/response/html` to produce HTML responses. This utility wraps `new Response`, adding a DOCTYPE and Content-Type header. The projects wanted to reduce dependencies and switch to plain Web API `Response` objects.

### Decision
Replace `createHtmlResponse` with `new Response(stream, { ...init, headers })` where headers are built via `new Headers(init?.headers)` with explicit `Content-Type: text/html; charset=UTF-8` set only if not already present.

### Rationale
- Removes dependency on `remix/response/html` utility
- Plain `Response` objects are more explicit and easier to debug
- `new Headers(init?.headers)` pattern enables safe header merging (e.g., `renderFragment` adds `Cache-Control: no-store` without clobbering other headers)
- Consistent with Web API standards

### Alternatives Considered
| Alternative | Pros | Cons | Why Rejected? |
|-------------|------|------|---------------|
| Keep `createHtmlResponse` | Less code per file | Hidden dependency, less explicit | Not worth the abstraction for a header set |
| Manual string concatenation | No external deps | Error-prone, no streaming support | `new Response` + stream is the right pattern |

### Impact
- **Positive**: Fewer imports, more explicit, better header merging
- **Negative**: Slightly more boilerplate per render file
- **Risk**: Must remember to set `Content-Type` header explicitly (enforced by pattern of always wrapping in `new Headers`)

### Related
- `development/remix3/guides/render-utilities.md`
- `my_app/app/actions/render.tsx`
- `bookstore/app/actions/render.tsx`

---
## Decision: Restore `resolveFrame(src, target)` with `x-remix-target`

**Date**: 2026-05-03
**Status**: Decided
**Owner**: Engineering Team

### Context
Earlier versions of `resolveFrame` accepted a `target` parameter that forwarded as the `x-remix-target` header. This was removed in v2 simplification because no server-side code consumed the header. The team later determined the header is needed for targeted frame resolution in the framework's internal routing.

### Decision
Restore the `target` parameter on `resolveFrame(src, target)`. When provided, set it as the `x-remix-target` header on the frame fetch request. Also forward `request.signal` for proper cancellation.

### Rationale
- Framework internals now use `x-remix-target` for frame routing
- Adds no meaningful complexity — the header is set only when `target` is provided
- `signal` forwarding enables proper abort handling on navigation

### Impact
- **Positive**: Enables targeted frame resolution, proper cancellation
- **Negative**: None — the parameter is optional, signature is backward compatible
- **Risk**: None

### Related
- `development/remix3/guides/frame-resolution.md`
- `my_app/app/actions/render.tsx`
- `bookstore/app/actions/render.tsx`

---
## Decision: Co-locate Asset Server to Avoid Circular Imports

**Date**: 2026-05-03
**Status**: Decided
**Owner**: Engineering Team

### Context
Moving `render.tsx` from `app/utils/` to `app/actions/` created a potential circular import: `controller.tsx` imports `render.tsx`, and `render.tsx` needs access to the `assetServer` instance. Two approaches were needed across two projects.

### Decision
**my_app**: Export `assetServer` from `controller.tsx` itself. `render.tsx` imports `assetServer` from `./controller.tsx` while `controller.tsx` imports `render` from `./render.tsx` — a circular dependency. This works via ESM live bindings: `assetServer` is a module-scope `const`, and although `render.tsx`'s import binding is initially `undefined` during module evaluation, by the time any request handler runs `controller.tsx` has finished evaluating and the binding holds the assigned value.

**bookstore**: Extract `assetServer` into a dedicated `app/actions/asset-server.ts` module. Both `controller.tsx` and `render.tsx` import from this shared module — no circular dependency. Prefer this pattern.

### Rationale
- `my_app` co-locates because the asset server config is small and tightly coupled to the controller; the circular dep is tolerated
- `bookstore` uses a separate module because the asset server config is larger and shared with `app/actions/assets.tsx` and `app/middleware/asset-entry.ts`; the extra file avoids the circular dep cleanly

### Alternatives Considered
| Alternative | Pros | Cons | Why Rejected? |
|-------------|------|------|---------------|
| Pass assetServer to render() as param | Clean dependency injection | Every caller must pass it, breaks existing pattern | Too invasive |
| Keep render.tsx in app/utils/ | Avoids the issue | Violates co-location principle | Render is an action concern |

### Impact
- **Positive**: Clean co-location of asset server with controllers
- **Negative**: Two patterns exist (inline export vs shared module)
- **Risk**: Ensure future developers understand which pattern to follow based on asset server complexity

### Related
- `my_app/app/actions/controller.tsx`
- `my_app/app/actions/render.tsx`
- `bookstore/app/actions/asset-server.ts`
- `bookstore/app/actions/controller.tsx`
- `bookstore/app/actions/render.tsx`

---
## Deprecated Decisions

Decisions that were later overturned (for historical context):

| Decision | Date | Replaced By | Why |
|----------|------|-------------|-----|
| [Old decision] | [Date] | [New decision] | [Reason] |

## Onboarding Checklist

- [ ] Understand the philosophy behind major architectural choices
- [ ] Know why certain technologies were chosen over alternatives
- [ ] Understand trade-offs that were made
- [ ] Know where to find decision context when questions arise
- [ ] Understand what decisions are pending and why

## Related Files

- `technical-domain.md` - Technical implementation affected by these decisions
- `business-tech-bridge.md` - How decisions connect business and technical
- `living-notes.md` - Current open questions that may become decisions

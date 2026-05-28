<!-- Context: development/remix3/fetch-router | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Fetch Router (@remix-run/fetch-router)

**Core Idea**: Minimal, composable router built on the Web Fetch API and `route-pattern`. Create a router with `createRouter()`, register typed routes, and dispatch HTTP requests through a middleware chain.

## Quick Routes

| Task | File |
|------|------|
| `createRouter()`, dispatch flow, matcher, defaultHandler | `concepts/router-architecture.md` |
| Type-safe route maps with `route()` | `concepts/route-maps.md` |
| `RequestContext` — request-scoped data, typed keys | `concepts/request-context.md` |
| String patterns, method+pattern objects, verb shorthands | `guides/route-definitions.md` |
| `form()` — GET/POST pattern for HTML forms | `guides/form-routes.md` |
| RESTful `resources()` and singleton `resource()` routes | `guides/resource-routes.md` |
| Controllers, `createAction`, `createController` | `guides/controllers-and-actions.md` |
| Middleware system — global, controller, action levels | `guides/middleware.md` |
| HTTP verb helper methods | `guides/verb-methods.md` |
| `MiddlewareContext`, `RouterTypes`, `AppContext` patterns | `guides/typed-context.md` |

## Source

- Package source: `~/remix/packages/fetch-router/`
- Core: `src/lib/router.ts` — `createRouter`, `createContextKey`, `RequestContext`
- Routes: `src/lib/route-map.ts`, `src/lib/route-helpers/` — `route`, `form`, `resources`, `resource`
- Middleware: `src/lib/middleware.ts` — `Middleware`, `MiddlewareContext`, `NextFunction`

## Related

- `../route-pattern/navigation.md` — Pattern matching and href generation
- `../auth/guides/auth-middleware.md` — Auth middleware for fetch router
- `../auth/guides/session-middleware.md` — Session middleware for fetch router

<!-- Context: development/remix3/guides/starter-scaffold | Priority: high | Version: 1.0 | Updated: 2026-05-05 -->

# Guide: Starter Project Scaffold

**Core Idea**: The `remix new <dir>` scaffold generates a minimal app with 5 files that connect routes → router → controller → render → server. This is the default starting point for all Remix 3 projects.

## File Wiring

```
app/routes.ts           # URL contract (route definitions)
app/router.ts           # Wires route maps → controllers
app/actions/controller.tsx  # Route action handlers + assetServer export
app/actions/render.tsx      # SSR renderToStream helper
app/ui/layout.tsx / document.tsx  # HTML shell wrappers
server.ts               # Node HTTP server with createRequestListener
```

## Data Flow

```
Request → server.ts → router.fetch(request)
  → router.ts maps routes → controller actions
    → controller calls render(<Page />, request)
      → render.tsx calls renderToStream() with:
          resolveClientEntry → assetServer.getHref()
          resolveFrame → router.fetch(sub-request)
      → returns new Response(stream, { headers })
```

## Key Decisions

| Decision | Template Default | Why |
|----------|-----------------|-----|
| **Route registration** | `router.map(routes, controller)` | Single call for all root leaves |
| **Asset server** | Inline in controller.tsx | Simplest start; extract to own module if circular imports arise |
| **Server** | `remix/node-fetch-server` with `node:http` | Lightest Node adapter; swap to `remix/node-serve` for prod |
| **UI shell** | `Document` + `Layout` wrappers | Separates HTML boilerplate from page content |

## Growing the Scaffold

1. **Add nested routes** → Create `app/actions/{key}/controller.tsx` + `router.map(routes.{key}, controller)` in router.ts
2. **Add middleware** → Add to controller's `middleware` array or root `createRouter({ middleware })`
3. **Add data layer** → Create `app/data/` for tables, queries, migrations
4. **Add auth** → Add `app/middleware/` with session + auth middleware

## Reference

- Template source: `~/remix/template/`
- App example: `my_app/`
- Bookstore example: `bookstore/`
- Controller architecture: `../routing/concepts/controller-architecture.md`

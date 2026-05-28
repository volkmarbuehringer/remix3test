---
title: Architecture
description: Demo server architecture — router, SSR, HTTP server, client entry
category: project-intelligence
type: concept
source: config/router.tsx, config/render.tsx, config/routes.ts, server.ts, app/assets/entry.tsx
---

# Architecture

## Core Concept

The demo uses Remix 3's fetch-based router (`remix/fetch-router`) with SSR rendering (`remix/ui/server`) served via Node HTTP, and a client entry for frame hydration.

## Key Points

- **Router** (`config/router.tsx`): `createRouter` from `remix/fetch-router` with optional `logger()` middleware (dev only) and `staticFiles()` for public assets. Routes are mapped via `router.map()`.
- **Route definitions** (`config/routes.ts`): Declared with `route()` and `get()` from `remix/routes`. Four groups: `api` → `/api/...`, `examples` → `/examples/:slug/...`, `themeBuilder` → `/theme-builder`, `explorer` → `/*` (auto-generated from `PAGE_LIST`).
- **SSR rendering** (`config/render.tsx`): `renderToStream` from `remix/ui/server` creates a HTML stream. Frame resolution uses `resolveFrame` which follows redirects up to 10 hops via `router.fetch`.
- **HTTP server** (`server.ts`): Node `http.createServer` with `createRequestListener` from `remix/node-fetch-server`. Default port 44100. Graceful SIGINT/SIGTERM shutdown.
- **Client entry** (`app/assets/entry.tsx`): `run()` from `remix/ui` loads modules dynamically and resolves frames via `fetch` with `X-Remix-Frame` header.

## Quick Architecture

```
server.ts
  → createRequestListener → router.fetch(request)
    → config/router.tsx (createRouter + middleware)
      → config/routes.ts (route map)
        → app/*/controller.tsx (createController actions)
          → config/render.tsx (renderToStream + resolveFrame)
```

## References

- `config/router.tsx` — Router setup and middleware chain
- `config/render.tsx` — SSR render function and frame redirect following
- `config/routes.ts` — Route definitions for all 4 groups
- `server.ts` — HTTP server entry point
- `app/assets/entry.tsx` — Client-side frame hydration

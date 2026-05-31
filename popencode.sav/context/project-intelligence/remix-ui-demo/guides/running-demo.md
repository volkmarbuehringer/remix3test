---
title: Running the Demo
description: Commands to run the demo for development and production
category: project-intelligence
type: guide
source: package.json, README.md
---

# Running the Demo

## Core Concept

The demo needs both a server (SSR + API) and browser assets (client JS). The dev workflow runs them in parallel; the production workflow builds and starts sequentially.

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Parallel `dev:server` + `dev:browser` via `pnpm run --parallel` |
| `pnpm start` | Build browser assets then start server (`build:browser && tsx server.ts`) |
| `pnpm build:browser` | Build client JS bundle via esbuild |
| `pnpm screenshot` | Playwright screenshot workflow for review |
| `pnpm prerender` | Build browser assets then prerender static HTML |
| `pnpm prerender:serve` | Serve prerendered site via http-server on port 3000 |

## Dev Server

```sh
cd packages/ui/demo
pnpm dev
# Server on http://localhost:44100
# Browser assets rebuild on change (--watch)
```

## Production

```sh
pnpm start
# Builds browser assets + starts production server
```

## Screenshot Workflow

```sh
pnpm screenshot
# Starts server if needed, captures pages, saves to .artifacts/screenshots/
```

## References

- `package.json` — Scripts: dev, start, build:browser, screenshot, prerender
- `README.md` — Setup instructions and API overview
- `server.ts` — HTTP server entry on port 44100

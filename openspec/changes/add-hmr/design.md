## Context

See `proposal.md` — the motivation and scope are covered there. Current dev uses `node --watch` which does a hard process restart on every change.

## Goals / Non-Goals

**Goals:**
- Wire `node-hmr` as the dev server supervisor with fetch proxy for restart-tolerant request handling
- Enable `ui-hmr` transforms on server components (via Node module hook) and browser components (via asset server module hook)
- Connect the asset server to the browser HMR channel so changes push to connected clients

**Non-Goals:**
- Production changes — HMR is dev-only, the production `start` script stays unchanged
- Full-page HMR for non-component changes (data loaders, routes) — those restart the child process
- Performance optimization of the build pipeline

## Decisions

### Architecture: Proxy on public port, child on internal port

The public port (44100) hosts the proxy. The child runs on port + 1. The proxy buffers requests during restarts.

Rationale: This is the established pattern from the bookstore demo. It keeps `server.ts` deployable as-is in production (just listens on `PORT` directly).

Alternatives considered: using `http-proxy` or in-process request queueing. The fetch-proxy approach is simpler and already part of the `remix` package.

### Browser HMR channel: Hosted by child via node-hmr runtime

The `browserHmrChannel: true` option on `run()` makes the supervisor host the EventSource server. The asset server's `hmr` option connects to it.

Rationale: The supervisor survives child restarts, so browser connections stay alive even when the server restarts. The child uses `remix/node-hmr/runtime` APIs (`createBrowserHmrChannel`, `emitServerReady`) to coordinate.

### Module hook registration order

`--import remix/node-tsx` before `--import remix/ui-hmr/node`. The `ui-hmr` hook depends on `node-tsx` being active first.

## Risks / Trade-offs

- [Port conflict] → The child port (`originPort + 1`) could conflict. The env `PORT` controls the public port; child always gets +1. Document this in the dev script.
- [HMR not available on first page load] → The browser channel might not be connected yet. The first load works via normal SSR; HMR kicks in on subsequent changes.
- [Dev-only complexity] → `dev.ts` and production `server.ts` diverge slightly. The `emitServerReady()` call in server.ts is a no-op when `NODE_HMR` env is unset (i.e. production).

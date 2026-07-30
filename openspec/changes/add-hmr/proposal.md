## Why

The current dev workflow (`node --watch server.ts`) restarts the entire process on every file change. This loses in-memory state (DB connections, sessions), takes 1-2s per restart, and causes a full page reload in the browser. HMR delivers component updates without restart — implementations swap in-place, component state survives, and browser refreshes are targeted rather than full-page.

## What Changes

- **New `dev.ts`** — HMR supervisor wrapping `server.ts` with `node-hmr`, fetch proxy for zero-downtime request handling, and browser HMR channel
- **Modified `app/assets.ts`** — enable browser HMR via `hmr` option and `uiHmr` module hook for browser component transforms
- **Modified `server.ts`** — add `emitServerReady()` call after `server.listen()` so HMR supervisor knows when the child is ready
- **Modified `package.json`** — change `dev` script from `node --watch server.ts` to `node dev.ts`

## Capabilities

### New Capabilities

- `dev-hmr`: Development workflow with hot module replacement — `node-hmr` process supervision, `ui-hmr` component transforms (server + browser), asset server HMR integration, and fetch proxy for restart-tolerant request handling

### Modified Capabilities

(none — this is a dev-tooling change, no production behavior changes)

## Impact

| File | Change |
|------|--------|
| `dev.ts` | **New** — HMR supervisor entry point |
| `app/assets.ts` | Add `hmr` option + `uiHmr()` module hook |
| `server.ts` | Add `emitServerReady()` after listen |
| `package.json` | Switch dev script to `dev.ts` |

No new npm dependencies — `remix/fetch-proxy`, `remix/node-hmr`, `remix/ui-hmr` are all subpath exports of the existing `remix` package.

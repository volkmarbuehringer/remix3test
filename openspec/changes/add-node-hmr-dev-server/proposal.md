## Why

`remix` (installed from `preview/main` at commit `e52c10054`) now ships native HMR support via two new packages (`@remix-run/node-hmr`, `@remix-run/ui-hmr`). The current app has no HMR: `npm run dev` relies on `node --watch`, which fully restarts the server and reloads the page on every change. Adopting the new `npm run hmr` mode gives per-module updates with state-preserving reconciliation, which is the intended Remix 3 development loop.

## What Changes

- Add an `hmr` script (`node hmr.ts`) alongside the existing `dev`/`start` scripts.
- Add `hmr.ts` at the repo root: a proxy server that spawns the real `server.ts` as a child on a distinct port, waits for it to signal readiness, and forwards requests. The app's database init, env validation, TLS, and IP handling all run unchanged inside the child.
- Update `server.ts` to emit a server-ready signal to the runner when run under HMR (`process.env.REMIX_NODE_HMR`).
- Configure `app/assets.ts` for HMR: enable `watch` in development and activate the browser HMR channel + `uiHmr()` loader script only when `REMIX_NODE_HMR` is set. Production asset behavior (`watch: false`) is unchanged.
- Add an `import.meta.hot` handler in `app/assets/entry.tsx` that reloads the top frame on a `server:update` event, so salvaged state is preserved while server-rendered markup refreshes.
- Extend `tsconfig.json` types with `remix/assets/types/hmr` for `import.meta.hot` typing.
- `npm run dev` keeps working as today; HMR is strictly opt-in and additive.

## Capabilities

### New Capabilities
- `dev-hmr-server`: The HMR development server — proxy/runner wiring (`hmr.ts`), the `hmr` npm script, server-ready signaling, the development-only asset pipeline mode (watch, browser HMR channel, `uiHmr()` loader), and the client-side `server:update` top-frame reload behavior.

### Modified Capabilities
<!-- No existing capability changes: production runtime behavior is untouched. -->

## Impact

- `package.json` (scripts only)
- `hmr.ts` (new)
- `server.ts` (conditional `emitServerReady`)
- `app/assets.ts` (conditional HMR options)
- `app/assets/entry.tsx` (client-side `import.meta.hot` block)
- `tsconfig.json` (types)
- Developer workflow only: no production request path, database, auth, or IP-trust behavior changes.
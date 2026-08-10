## 1. HMR runner script and proxy

- [x] 1.1 Add `"hmr": "NODE_ENV=development node --env-file-if-exists=.env --import remix/node-tsx hmr.ts"` to `package.json` scripts (keeping `dev`/`start`/`test` unchanged).
- [x] 1.2 Create `hmr.ts` at the repo root copying `template/hmr.ts`: proxy port default 44100, event channel `HMR_PORT` (default +1), child app `APP_PORT` (default +2), `run('server.ts', ...)` with `nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/ui-hmr/node']`, `createHmrReadyFetch(createFetchProxy(...xForwardedHeaders: true))`, loopback bind, SIGINT/SIGTERM shutdown.

## 2. Server readiness under HMR

- [x] 2.1 In `server.ts` listen callback, when `process.env.REMIX_NODE_HMR`, dynamically import `remix/node-hmr/runtime` and call `emitServerReady()`; keep DB init, `REQUIRED_ENV`, TLS branch, and `X-Client-Ip` handling untouched.
- [x] 2.2 Adjust the listen log to print `hmrProxyPort ?? port` when running under HMR (optional parity with template).

## 3. Asset pipeline HMR mode

- [x] 3.1 In `app/assets.ts`, add `import { uiHmr } from 'remix/ui-hmr/assets'` and `const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)`.
- [x] 3.2 Change `watch: false` to `watch: isDevelopment`; add `hmr: isHmr ? async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel() : undefined`.
- [x] 3.3 Extend `scripts` with `loaders: isHmr ? [uiHmr()] : undefined`, preserving the existing `define` of `process.env.NODE_ENV` and the app-specific `fileMap`/`allowFiles`/`denyFiles`/`target`/`minify`.

## 4. Client-side server:update reload

- [x] 4.1 In `app/assets/entry.tsx`, after `const app = run({...})`, add `if (import.meta.hot) { import.meta.hot.on('server:update', async () => { await app.ready(); await app.frames.top.reload() }) }` with a console.error wrapper on failure.

## 5. Types and verification

- [x] 5.1 Update `tsconfig.json` `types` to `["node", "remix/assets/types/hmr"]`.
- [x] 5.2 Run `npm run typecheck`, `npm test`, and `npm run lint`; all must pass unchanged (HMR is dev-gated, `NODE_ENV=test`/production unaffected).
- [x] 5.3 Manual smoke: `npm run hmr`; edit a server module and a browser module; confirm module update + top-frame reload; confirm `npm run dev` still works.
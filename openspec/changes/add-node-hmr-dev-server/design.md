## Context

The app is a `remix new`-style scaffold whose `remix` dependency resolves to `preview/main` (installed build `e52c10054`), which contains the upstream HMR merge (Add HMR support #11515). HMR is opt-in: it activates only when `REMIX_NODE_HMR` is set, which the node-hmr runner injects into the child process.

Current dev flow: `npm run dev` → `node --watch` full-restart server + browser reload on change. The app adds custom server concerns on top of the scaffold: database init at `server.ts` top level, `REQUIRED_ENV` validation, HTTPS in production, and a trusted socket-IP model (`X-Client-Ip` + `trustProxy: false`). All of these must keep working — under HMR they run inside the spawned child.

Browsed upstream references: `~/remix/template/hmr.ts`, `template/server.ts`, `template/app/assets.ts`, `template/app/assets/entry.ts`, `template/tsconfig.json`, `demos/bookstore/hmr.ts`, plus `remix/node-hmr` (runner + runtime API) and `remix/ui-hmr/assets` (`uiHmr()`).

## Goals / Non-Goals

**Goals:**
- Provide `npm run hmr` with per-module updates + state-preserving top-frame reload.
- Keep the app's server responsibilities (DB, env checks, TLS, IP trust) untouched inside the HMR child.
- Keep `npm run dev` and `npm run start` behavior byte-for-byte unchanged.

**Non-Goals:**
- No change to the production request path, asset output, or IP-trust model.
- No upstream-package fork/version pin for the HMR feature.
- No change to test tooling (`NODE_ENV=test` never enters HMR mode).

## Decisions

**D1 — Mirror the upstream template shape rather than inventing an abstraction.**
`hmr.ts`, the `assets.ts` `isHmr` block, the entry `import.meta.hot` block, and the `hmr` script are copied from `template/` (and `demos/bookstore/hmr.ts`), adapted only where the app diverges (`.tsx` entry, `.env` loading). Rationale: upstream is the source of truth; hand-rolling a second proxy design would diverge and rot. Alternative considered: a bespoke `dev.ts` runner — rejected, it would duplicate node-hmr's `run()`.

**D2 — Run the existing `server.ts` as the HMR child, unchanged except a readiness signal.**
The runner spawns `server.ts` on an app port; DB init, `REQUIRED_ENV`, HTTPS/production branch, and `X-Client-Ip` socket handling all execute inside the child just as in `npm run start`/`dev`. Only addition: `emitServerReady()` guarded by `process.env.REMIX_NODE_HMR` in the `listen` callback (mirrors `template/server.ts`). Alternative considered: a separate minimal child entry — rejected, two entry points would drift.

**D3 — Pass env through the runner (`...process.env`) and load `.env` at the `hmr` script boundary.**
Ports/DB creds reach the child via the runner's env spread. The `hmr` npm script keeps the app's `--env-file-if-exists=.env` convention so `SESSION_SECRET`/`DATABASE_URL` are present before the proxy starts. Alternative considered: loading `.env` inside `hmr.ts` — rejected, `node --env-file` is the established app convention.

**D4 — Port layout from upstream defaults, all env-configurable.**
Proxy `:44100`, browser-HMR event channel `:44101`, child app `:44102` (`PORT`/`HMR_PORT`/`APP_PORT`). The proxy binds `127.0.0.1` only. This satisfies spec "Configurable ports".

**D5 — IP trust model stays valid under HMR.**
The two-tier model keys on the socket address of the directly-bound listener; under HMR the child binds a second localhost port and the proxy hops are all loopback, identical to today's localhost-bound `dev` behavior. No spec/skill change needed. Note: dev traffic was already 127.0.0.1 both before and after this change.

**D6 — `import.meta.hot` typing via `remix/assets/types/hmr`.**
`tsconfig.json` `types` gains `remix/assets/types/hmr` (upstream template change), giving typed `import.meta.hot.on('server:update', ...)` without `any` casts. This is required for `strict` typecheck to pass.

## Risks / Trade-offs

- **Feature is young (pre-release churn):** upstream just shipped follow-up fixes around Windows test timeouts and skipping HMR e2e in Bun (`#11676`–`#11678`). → Mitigation: HMR stays opt-in; `npm run dev` remains the documented fallback; no dependency pin forces adoption.
- **Runner restart drops in-flight server state:** DB pools/sessions are recreated in the child on restart. → Mitigation: same as today's `node --watch`; nothing new.
- **Extra ports/processes during dev:** `hmr.ts` adds a proxy process and two extra ports. → Mitigation: configurable ports (D4); bound to loopback only.
- **Deterministic `emitServerReady`:** readiness must fire inside the `listen` callback after handlers are set. → Mitigation: guard with `process.env.REMIX_NODE_HMR`; in production the branch never compiles in behavior (additive import).

## Migration Plan

1. Add `hmr` script + `hmr.ts`, server readiness signal, `assets.ts` HMR options, entry `import.meta.hot` block, tsconfig types (specs/tasks).
2. Verify: `npm run typecheck`, `npm test`, `npm run lint` — all must stay green (HMR is dev-gated, `NODE_ENV=test`/production unaffected).
3. Manual smoke: `npm run hmr`, edit a server module and a browser module, confirm per-module update + top-frame reload; confirm `npm run dev` still works for fallback.
4. Rollback: delete `hmr.ts`, revert the script and the three gated blocks — `dev`/`start` never depended on them.

## Open Questions

- Should `npm run hmr` eventually replace `npm run dev` as the documented default command? Deferred: both scripts ship now; switching the mental default is a workflow decision, not a spec/approach change.
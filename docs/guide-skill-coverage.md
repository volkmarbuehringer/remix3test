# Remix 3 Guide → Skill Coverage

**Purpose.** Map each installed guide chapter to the learned skill that owns it, and record known gaps so they are not rediscovered by asking "is X covered?". Vendor guides stay canonical; this registry only tracks **who points at them**.

**Anchor:** installed `remix 3.0.0-rc.3` (`node_modules/remix/guides/NN-*.md`). Line refs are to that build.

**Legend:** *state* = authored | unfinished (chapter says so at its top). *coverage* = owned (dedicated pointer skill) | good | partial | none.

| # | Guide | State | Owner skill(s) | Coverage | Known gaps (guide lines) |
| --- | --- | --- | --- | --- | --- |
| 01 | start-here | authored | vendor `remix` | good | dev port 44100 (L61); single `remix` dep (L42-53); `npx remix@next new` (L32); `redirect(url, 303)` shorthand (L603) |
| 02 | routing-and-controllers | authored | `remix-controllers`, `remix-routepattern-opaque-access`, `remix3-typesafe-url-audit` | partial — `remix-controllers/references/route-contract-and-controllers.md` | `resources()/resource()` + `only/param` (L132-149); pattern grammar (L42-49); controller ownership + missing-action-throws (L273-305); controller middleware not in nested maps (L303); `context.has`/`context.router` (L184-187); `context.headers` request-only (L269); `head/options/patch` (L81); bare-string method (L87) |
| 03 | request-handling | authored | `remix-controllers` | partial — `remix-controllers/references/request-middleware.md` | `createRequestListener` `host/protocol/onError` + `createRequest/sendResponse` (L76-110); `compression()` negotiation + ordering (L192,259); `logger()` (L260); middleware scopes/ordering (L162-195); `RouterContext` augmentation (L220-244); `request.body`/`signal` (L39) |
| 04 | rendering-ui | authored | **`remix3-rendering-ui`** | owned | component context/`handle.id`/`TypedEventTarget`; document shell + asset entry; first-party UI blocks — pointer refs added |
| 05 | interactivity | authored | `remix3-client-entries` | good — `references/interactivity-runtime.md` | `createRoot` (L169-195); `run()` ready/flush/dispose (L156-161); custom event mixin (L822-896); `handle.update()` signal + handler signal (L263-277,513-519); optimistic UI (L806-820); enhanced form fetch+navigate (L742-804); navigate/link/attrs (L690-718,431) |
| 06 | streaming-ui-with-frames | authored | `remix3-frame-cliententry` | good — `references/frame-failures-and-rendering.md` | failure/cancellation contract (L140-142,346-358); frame HTML unsanitized (L209-213); `renderToString`/`renderWith` (L144-158); `data-rmx-src` same-origin (L335-341); native validation before intercept (L262-263); fresh props after reload (L242-244) |
| 07 | animation | authored | **`remix3-animation`** | owned | presence/layout mixins, springs/tweens, reduced-motion, interruptibility — pointer refs added |
| 08 | data-and-validation | unfinished | `remix3-data-table`, `database-gotchas` | partial | `table()`/relations (L32); lifecycle hooks (L40); `db.transaction()` (L44); `query()`/`db.query()` (L36); adapters SQLite/MySQL (L48); non-form boundaries (L16); data-schema breadth (L20,24); `f.fields/f.file/f.files` + `databaseContext` (L28,56) |
| 09 | forms-and-mutations | unfinished | `remix-forms`, `form-error-handling-remix3` | good | optimistic/pending/conflict state (L46-48); named submit intents (L34-36); `formData()` ordering (L22-24); repeated fields/checkbox/file (L24,28) |
| 10 | auth-sessions-security | unfinished | `security-gotchas` | partial | credentials provider (L31-33); OAuth/OIDC (L35-37); cookie config + secret rotation (L19-21); session `regenerateId`/`destroy` + storage comparison (L23-29); `auth({schemes})` (L39-41); `requireAuth` `onFailure` (L43-45); tenant/state-transition authz (L47-49); CSRF/COP/CORS detail (L51-61) |
| 11 | files-and-assets | unfinished | `remix-file-uploads`, `remix3-build-and-tooling` | partial | `createFileResponse`/`LazyFile` (L98); `defineFileTransform` + `createFsFileCache` (L58-78); CSS `@import`/`url()` rewrite (L41); barrel rewrite + `sideEffects:false` (L55); `getHref`/`getPreloads` (L45); file-storage backend (L90); `assetServer.fetch` action (L35) |
| 12 | errors-and-cancellation | unfinished | — | weak | `renderToStream({onError,signal})` (L28); browser `run()` error events (L36); `createRequestListener({onError})` (L24); `request.signal.reason` (L40); server `resolveFrame` policy (L32); route 404 vs router not-found (L20) |
| 13 | testing | authored | **`remix3-testing`** | owned | state isolation + `t.serve` e2e — pointer ref added |
| 14 | cli-and-tooling | unfinished | `remix3-build-and-tooling` | partial | `remix routes` output modes + `[missing]` (L20); `doctor --json/--strict` + `--fix` scope (L24,28); `remix/terminal` (L52); `runRemix` (L48); node-tsx limits (L44); `remix new` flags (L16); help/--no-color (L36) |
| 15 | production | unfinished | — | weak | startup env/secret validation (L21); graceful shutdown (L29); `compression()` semantics (L41); error-reporting matrix (L49); process-safe storage (L33); cache policy/Vary/ETag (L37); health/metrics/traces + checklist (L53,57); `request.signal` (L45) |

## Unfinished chapters — re-audit on authoring

08, 09, 10, 11, 12, 14, 15 all say "This chapter is unfinished." Their APIs will move, so do not build full API skills from them; treat the gap column as a watch list and convert entries into pointer refs once the vendor authors the chapter.

## How to use

- Before building on a guide section, find its row here; open the owner skill's matching reference, else the guide itself.
- When adding a learned delta, add or update the owning skill and refresh this row.
- When the vendor authors an unfinished chapter, re-audit it and convert the gaps into pointer refs.

## Maintenance rule

Update this file when: a guide chapter is added/authored/renamed; a new learned delta lands; a learned skill is added or renamed. Keep vendor guides authoritative — do not copy their API into skills.

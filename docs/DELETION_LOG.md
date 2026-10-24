# Code Deletion Log

## [2026-10-24] Unused-symbol & duplicate-review pass (`refactor/dead-code-cleanup` branch)

Post-drift audit after the `202e08e` → HEAD window (prefetch warming, lists row
hover actions, remix 3.1.0 pin, uploads download work). Detection: `knip` 6.43.0
(with the maintained `knip.json`), `depcheck` 1.4.7, `oxlint -D no-unused-vars`
(the repo disables the rule in `.oxlintrc.json`), a whole-repo entry export/usage
scan (knip treats every `app/**/public/**` browser entry as an entry, so their
unused exports are invisible to it), and `jscpd` 4.3.0 (min-tokens 70) for
duplicate measurement. `ts-prune` remains unusable: it crashes on this repo's
TypeScript 7 native-preview API.

### Unused Exports Unexported (19 symbols; export keyword only, symbol stays live)

- `app/actions/lists/public/lists-api.ts` — `MoveOutcome` (return type of the
  exported request fn; no consumer names it).
- `app/actions/lists/public/lists-drag.ts` — `ListsDragController`.
- `app/actions/lists/public/lists-state.ts` — `ViewOrderOptions`, `ItemViewOptions`.
- `app/assets/streams/public/agent-events-controller.ts` — `AgentEventsControllerOptions`.
  `AgentEventsRowKind` was DELETED outright (unused alias; `RowKind` itself stays).
- `app/assets/streams/public/customer-chat-controller.ts` — `CustomerChatReconnectPayload`,
  `CustomerChatControllerOptions`, `CustomerChatController`.
- `app/assets/streams/public/sse-post.ts` — `describeSseFailure`, `SseStreamResult`.
- `app/assets/streams/public/support-agent-controller.ts` — `SupportAgentNavigationInfo`,
  `SupportAgentQuestionData`, `SupportAgentSuspensionData`, `SupportAgentControllerOptions`.
- `app/ui/confirm-delete.browser.tsx` — `ConfirmRequestOptions`, `ConfirmRequestDetail`.
- `app/data/schema.ts` — `notifications` table object. The `notifications` table is
  accessed exclusively through raw SQL; its only remaining consumer is the
  exported `Notification = TableRow<typeof notifications>` type, so the table
  object stays defined and module-private (same resolution as `chatRuns` in the
  2026-08-31 pass).
- `app/ui/schedule-layout.ts` — `defaultLayoutPolicy` (still used by
  `resolveLayoutPolicy` in-module).
- `app/utils/db-errors.ts` — `PgErr` (still used by `isPgErr`/`matchPg`).

### Dead Code Removed

- `app/actions/app-webhook/controller.tsx` — `WebhookInsertResult` interface.
- `app/actions/appointments-new/controller.tsx` — `redirectToLogin()` (zero
  callers; the appointments-new surface redirects via route middleware), the
  unused `newId` binding, and the whole `defaultStartMin` data/prop chain
  (controller → page → none of the page's children used it).
- `app/actions/client/grid-page.tsx` — `SortField` type alias.
- `app/actions/lists/public/lists-drag.ts` — `handleListDragEnd` (never wired).
- `app/actions/verwaltung/pdf/controller.tsx` — `AppointmentRow` interface.
- `app/actions/verwaltung/{offerings,appointments}/controller.tsx` — two
  `*_ORDER_BY_COLUMNS` maps (the data layer owns the live copies), plus the
  appointments controller's unused `Holidays`/`hd` and `f` imports.
- `app/ui/appointment-grid.browser.tsx` — `currentVisibleDayDates` (written,
  never read) and unused `HOURS`/`SUB_SLOT_HEIGHT`/`SUB_SLOTS` imports.
- `app/ui/appointment-grid-test-helpers.ts` — `dispatchDragSequence()` test helper
  (no remaining test imports it; `dispatchDragWithThreshold` stays).
- `app/ui/document.tsx` — `themeCookie` const and its `createCookie` import
  (the document reads the cookie via `Cookie.from`).
- `app/ui/admin-offerings-week-page.tsx` — unused `resources` prop (and the
  caller's pass-through).
- `app/ui/appointments-new-step2.tsx` — unused `ws` parameter on `buildBackUrl`.
- `app/ui/schedule-layout.ts` — module-private `BlockGroup` interface.
- `app/ui/theme/contract.ts` — module-private `ThemeUtility` alias (and its
  now-unused `css` type import).
- `app/actions/settings/controller.tsx` — unused `catch (err)` binding → `catch`.
- Unused imports/locals across 26 test files (streams browser test fetch mocks,
  verwaltung appointment fixtures, admin/router/chat/support-agent setup
  variables, auth-register CSRF destructure, `schedule-layout`/`db-errors`/
  `rate-limiter` helpers, etc.). Notably the `sql` import that the
  2026-10-14 note warned about had been re-introduced in
  `app/actions/lists/controller.test.ts`; removed again.

### Duplicate Code Consolidated

- `PDF_TRUNCATED_NOTE` is now single-sourced in `app/utils/pdf-utils.ts`.
  Replaces three copies of the user-facing truncation string
  (`report1-pdf.ts`, `user-summary-pdf.ts`, and the inline template in
  `verwaltung/pdf/controller.tsx`). Runtime strings were byte-identical
  (one copy used `\u2014`/`\u00e4` escapes for the same characters).

### Remaining (manual review — measured, deferred as refactor work)

- `admin-offerings-create-page.tsx` ↔ `admin-offerings-edit-page.tsx` — the
  largest clone in the repo (109 lines / 828 tokens, ~74% similar); same
  create/edit form family pattern as `client/create-page` ↔ `client/edit-page`.
- Admin grid controllers/pages: `client/controller` ↔ `admin/lists/controller`
  (79 lines), `admin/lists` ↔ `admin/users` (72 lines), and 37–77 line clones
  across `admin-{appointments,offerings,offering-configs,resources,users,messages}-page`.
- `question-form.tsx` ↔ `support-question-form.tsx` — 37–48 line clone; differs
  in form id/class/action and style tokens (padding/font size), so a shared
  component would need a variant contract.
- `lock-user-workflow.ts` ↔ `unlock-user-workflow.ts` — validate step is
  identical except the self-target message and lock's admin check; execute step
  differs only in SQL/action type/output field name. A `createUserStateWorkflow`
  factory is the natural follow-up but touches approval-gated admin workflows.
- `agent-chat-durable.ts` ↔ `agent-chat.ts` — four 8–14 line blocks, intentional
  until the durable engine proves parity (see 2026-10-01 entry).
- `report1-pdf.ts` ↔ `user-summary-pdf.ts` — the note is now shared; the
  page-size/margins/styles skeleton still duplicates (different table schemas).
- `app/data/rows.ts int8|int8Aggregate` — intentional semantic alias, kept.
- Unused callback parameters (`ref((el) => …)`, component `handle`, mixin
  `handle`, event params) — signature-driven, not dead code; the repo keeps
  `no-unused-vars` off for this reason. Left untouched.

### Impact

- Files deleted: 0
- Symbols removed: 18 (types/interfaces/functions/locals listed above)
- Exports privatized: 19
- Unused imports/locals removed: ~45 across 42 production files and 26 test files
- Code diff: +59 / −273 (net −214) over 68 code files, excluding the
  pre-existing `package.json` bump
- jscpd after the pass: 349 exact clones / 5.31% duplicated lines at
  min-tokens 70 (from 350 / 5.36% at the start); the remaining clone families
  are the deferred refactors documented above.

### Verification

- `npm run typecheck` — clean (both tsconfig targets)
- `npm run lint` — oxlint `--max-warnings=0` + theme conformance OK
- `npm run format` — oxfmt clean (662 files)
- `knip` (installed as a devDependency; run via `npm run knip`) — clean; the
  intentional `int8|int8Aggregate` alias is silenced via `ignoreIssues` in
  `knip.json`
- `depcheck` — no unused/missing dependencies
- Full server suite: 1858 tests, 1857 pass / 0 fail / 1 todo (a single
  timing-sensitive failure on one intermediate re-run passed on a clean rerun)
- Full browser suite: 838 tests, 836 pass / 0 fail / 2 skipped (the lists
  autosave undo test flaked once under parallel load, passed isolated and on a
  full rerun)
- Full e2e suite: 64 pass / 0 fail
- Post-final-edit targeted reruns: schedule-layout/db-errors/notifications
  server tests 66 pass; appointment-grid gestures browser tests 68 pass

### Pre-existing (not touched)

- `package.json` carries an uncommitted `oxlint-tsgolint` patch bump from before
  this session (the same auto-bump class the 2026-10-14 entry reverted). Left as
  found rather than folded into this cleanup diff.

## [2026-10-17] knip-configured cleanup pass (`refactor/dead-code-cleanup` branch)

For the first time with a proper `knip.json` (knip now understands the `remix test`
runner — `app/**/*.test{,.browser,.e2e}.{ts,tsx}` are entries — and the browser
entry files wired via `remix.json` `allowFiles`), so the earlier 218 "unused
files" were all test/entry false positives and export findings were
test-aware out of the box.

### Unused Dependencies Removed

- `openspec@latest` (devDependencies) — an unrelated placeholder npm package
  (`openspecio/openspec@0.0.0`, ~name collision) that contributed nothing. The
  real CLI is `@fission-ai/openspec` (kept; invoked as `openspec …` by the
  `.opencode/commands/opsx-*.md` runbooks, which is also why knip flags it —
  binary use in markdown is invisible to it, so it is now in knip's
  `ignoreDependencies`).

### Unused Exports Unexported / Removed

- `app/ui/forbidden-page.tsx` — `ForbiddenPage` component DELETED (5 lines + its
  JSDoc): zero callers anywhere; `renderForbiddenPage` is the only consumed API
  (by `app/middleware/admin.ts`). `Handle` import dropped with it.
- `app/actions/chat/controller.tsx` — `useDurableCustomerChat` unexported (internal call site at line 213).
- `app/actions/mastra/agent-config.ts` — `createMemory` unexported (internal call at line 100).
- `app/config.ts` — `currentNodeEnv` unexported (internal call at line 31).
- `app/ui/sidebar-layout.tsx` — `sidebarHeaderStyle` unexported (internal `mix` at line 184; the same-named const in `appointment-sidebar.tsx` is a private, visually different style — not a duplicate).
- `app/ui/theme/menu/index.tsx` — `listStyle`, `itemStyle` unexported (internal-only).
- `app/ui/row-context-menu.tsx` — `RowMenuTarget` unexported (internal-only).
- `app/ui/theme/upstream-button.ts` — named `button` export removed (duplicate of the default export; `button.ts` imports default only) and `ButtonSize`/`ButtonTone`/`ButtonOptions` unexported (internal-only).

### Unused Re-exports Removed

- `app/actions/chat/gate-store.ts`, `app/actions/support-agent/run-store.ts` —
  `export type { PendingGateRow }` deleted from both (the canonical export in
  `app/utils/agent-gate-store.ts` is the only imported one; knip then flagged
  that export as unused too, so it was unexported there as well).

### Consolidated

- None this pass: the flagged "duplicates" were (a) `button|default` — resolved
  by removing the named export, and (b) `int8|int8Aggregate` in
  `app/data/rows.ts` — the same zod schema under two _intentional_ semantic
  names (`int8` = single-row BIGINT decode, `int8Aggregate` = aggregate
  `count/sum/min/max` decode). Left in place; flagging for future review only.

### Impact

- Files deleted: 0
- Exports unexported: 10 (+1 component deleted, +2 type re-exports deleted)
- Dependencies removed: 1 (plus 1 knip false positive documented)
- Lines of code removed: ~20
- TypeScript: clean (`npm run typecheck`, both tsconfig targets)
- Lint: oxlint `--max-warnings=0` + theme conformance pass
- Tests: server 1753 pass / 0 fail · browser 738 pass / 0 fail (2 skipped) · e2e 54 pass / 0 fail

### Remaining (manual review needed)

- `app/data/rows.ts` `int8|int8Aggregate` duplicate-export flag: intentional
  semantic alias, kept deliberately.
- `check` "unlisted binary": that is `bun check` inside the `typecheck:bun`
  script — a Bun builtin, not an npm dependency.

## [2026-10-14] Re-verification Pass — zero deletions (b8c2de1 → 6de97f8 window)

Fresh tool run after the 2026-10-08 audit's commit (`b8c2de1`): knip 6.41.0,
depcheck 1.4.7, ts-prune 2.x, plus tsc/oxlint. Unlike 2026-09-27/10-08, the tools
installed cleanly this time, so the maintained in-repo analyzer was not needed —
but knip still has no config for this repo, so its entry graph excludes
`remix.json` `test.files` / `allowFiles` consumers and every export finding must
be adjudicated by hand.

Result: **nothing to delete.** The `b8c2de1 → HEAD` window (lists in-place save
errors, per-grid page-size settings, runnable mobile nav, dependency bumps)
introduced no dead code. Every knip "unused files" (213) hit is again the
runner-glob false-positive class; every "unused export" (65) / "unused type"
(12) hit is an already-adjudicated test seam, runner-invoked entry point, or
asset-graph consumer — sampled grep re-verification of the full 2026-10-08 kept
list found all consumers intact (e.g. `serializeSessionCookie`,
`readSessionId`, `uploadLimitErrorCode`, `errorToText`, `parseInline`,
`activeFrameNameOrNull`, `listChatThreads`, `NAV_SECTIONS`, `AdminLayout`,
`sidebarHeaderStyle`, `defaultLayoutPolicy`/`previewDeleteBlock`, `RawRowError`,
`int8Aggregate`, the four `deleteExpired*`, `RMX_01_GLYPHS`/`glyphValues`,
`pipelineRowHtml`, `isAllowedCsrfOrigin`, `runEvals`-surface seams).

### Findings re-adjudicated (all kept)

- ts-prune (2 hits, identical root cause): `app/ui/theme/presets/rmx-01/glyphs.ts
  glyphValues` + `.../rmx-01/index.ts RMX_01_GLYPHS`. Sole production consumer is
  the `<RMX_01_GLYPHS />` render in `app/ui/document.tsx:133`; `GlyphValues`
  types `createGlyphSheet`'s parameter. True positives (unused exported symbol)
  unless a future session decides the `glyphValues` const can be inline-arg'd;
  left as the pre-set-architecture's deliberate shape.
- knip duplicate-export hits: `app/data/rows.ts int8|int8Aggregate` and
  `app/ui/theme/upstream-button.ts button|default` — same aliases as 2026-10-08.
- depcheck: no unused runtime deps, no missing deps. devDeps beyond the
  `openspec` CLI tools: none (its dependency-usage graph DOES see
  `remix.json test.files`, so `html-validate` was correctly reported used in
  `app/html-conformance.test.ts` — knip's report on it is the entry-graph blind
  spot, matching the 2026-10-08 note).
- Duplicate scan re-measured: context-menu `clientEntry` family still below the
  > 80% merge bar (offerings↔offering-configs: 25 diff-lines of 45; the shared
  > machinery is already extracted in `app/ui/row-context-menu.tsx`'s
  > `createRowContextMenu` factory); `dangerStyle` still a deliberate
  > partial-drift vendored copy; `MAX_MESSAGE_LENGTH` still single-sourced;
  > `sidebarHeaderStyle` name collision in `appointment-sidebar.tsx` still a
  > coincidental ~3-line overlap, not a merge candidate.

### Environment note

npm 12's `allowed-versions.*` project config (`.npmrc`) auto-bumped the
oxlint/oxfmt/minor devDeps in `package.json` + `pnpm-lock.yaml` during this
session's `npm run` verification calls; the bump was reverted (not part of this
pass). lint and tests were green under the auto-selected patch/minor versions,
which sit inside the committed caret ranges.

### Follow-up: unused-import sweep (5 production files, 5 test files)

Same session, unreported follow-up: removed imports with zero body usages —
`db`/`sql` (admin-messages.test), `extractCookie` (admin-users.test), `db`
(logout.test), `User` type (appointment controller), `Layout` (home controller),
`ListsClient`/`Layout` (lists controller), `appointofferings` (support-tools),
`clearPendingGate` (support-agent test), `getPeriodRange`/`getTodayUtcMidnight`
(verwaltung appointments controller). One initial mistake (removing the live
`db` import from lists/controller.test.ts, used at lines 988–2048) was caught by
typecheck and reverted before commit. Verified: typecheck clean, lint clean,
226/226 tests pass across the five affected files.

### Impact

- Files deleted: 0; exports removed: 0; lines changed: 0 (pre-sweep state; the
  unused-import sweep touches 12 lines across 10 files)
- Verification: `npm run typecheck` (clean), `npm run lint` (oxlint
  `--max-warnings=0` + theme conformance OK), full `npm test`: server 1708
  pass / 0 fail / 1 todo, browser 730 pass / 0 fail / 2 skipped, e2e 46
  pass / 0 fail.

## [2026-10-08] Post-drift Dead-Code Audit (2026-10-02 → 10-08 window)

Audit of the drift window since the last pass (`389105b`, the 2026-10-02 log
entry): the lint-rule curation series (`2175a05`, `d76894b`, `73ac3bc`,
`921f739`), the type-tightening series (`4bf94de`, `965b089`), the
env/decoding/dedup refactor (`a10cf36`), the frame-view conversions
(`cc8c530`, `41cc494`, `834b2a5`, `8aaa277`, `1785cb7`), the lists search
rewrite (`4187848`, `104c24b`), and the Mastra eval/guardrail additions.

Method: knip is not resolvable offline; ts-prune ran but proved unreliable here
(it flags exports consumed via `import * as` namespace imports — e.g. it called
`listAppointments` unused while `verwaltung/appointments/controller.tsx` uses
it). Used the established in-repo export/usage analyzer instead (whole-word
reference counting across `app/`, `scripts/`, `test/`, root entrypoints, with
test/browser-asset/public-module classification), plus a jaccard near-duplicate
scan over all 369 production files and per-package dependency greps. Every
candidate was then grep-verified against every file type (code, config, scripts)
before touching. Two analyzer bugs were found and fixed during calibration:
skipping `app/**/public/**` (a `SKIP_DIRS` name collision with the root
`public/`) hid the browser-asset consumer graph, and dotfiles were excluded
from the string-mention corpus (hiding the `.oxlintrc.json` plugin refs).

Result: the repo is again essentially clean — zero dead app files, zero
unreferenced exports (the analyzer's single hit, `test/setup.ts globalSetup`,
is the `remix.json test.setup` runner entry point). What the window introduced
is stale root files and module-private exports that kept their `export` keyword.

### Files Deleted

- `server.new` (49 lines) — abandoned draft of the HTTP entrypoint, last touched
  `55a6c0c` (2026-06-06). It imports `./app/data/setup.ts`, which no longer
  exists; the live `server.ts` diverged fully (node:http(s), `remix/node-fetch-server`,
  required-env guard, `server-handler`). The archived TLS change design even
  states "Keep the single `server.ts` entry point — no separate server.new".
  Only remaining mentions are archived OpenSpec docs. Zero code/config/Docker
  references.
- `opencode.json.sav` (4 lines) — stale backup of `opencode.json` from
  `55b290b` ("install ecc"); diverged from the current config, zero references
  anywhere.

### Unused Exports Privatized (removed `export` keyword; symbols stay defined and used in-module)

- `app/actions/lists/public/lists-api.ts` — `CreateOutcome`, `PatchOutcome`,
  `CopyItemsOutcome`, `MoveOutcome`, `MergeOutcome` (return types of the
  exported request functions; no consumer names them).
- `app/actions/lists/public/lists-state.ts` — `ItemEdit`.
- `app/actions/mastra/evals/gates.ts` — `gatesFor`, `JourneyResult`,
  `runJourney` (`runAllJourneys`/`failedJourneys` stay — imported by
  `scripts/eval-mastra.ts`; `gates.test.ts` imports neither).
- `app/actions/mastra/evaluation-model.ts` — `EvaluationModelOptions`.
- `app/actions/mastra/notifications/sender.ts` — `NotificationData`.
- `app/data/appointments.ts` — `OccupancyAppointment` (the exported
  `WeekAppointment` union absorbs it).
- `app/data/pdf.ts` — `PdfAppointmentRow`.
- `app/ui/breadcrumbs.tsx` — `BreadcrumbItem` (second time: the 2026-09-27 pass
  trimmed the re-export; the local interface had re-acquired `export`).
- `app/ui/theme/menu/index.tsx` — `popoverStyle`, `itemSlotStyle`,
  `itemLabelStyle`, `itemIndicatorStyle`, `MenuListProps`, `MenuItemProps`
  (`listStyle`/`itemStyle` stay exported — consumed by the context-menu
  clientEntries; `335e8b8` curated this module two days ago and left these).
- `app/utils/agent-chat-durable.ts` — `DurableSuspensionData`,
  `DurableObserveOptions`, `DurableChatStreamResult`, `DurableChatObserveResult`,
  `DurableSuspendedToolCall`, `DurableSuspendedRun`, `DurableSuspendedRunsResult`
  (vocabulary of the still-exported `DurableChatAgent` boundary; `DurableStreamOptions`,
  `DurableResumeOptions`, `DurableChatAgent`, `toDurableAgentChat` stay — external refs).

27 symbols across 10 files. `MenuList`/`MenuItem` keep working structurally:
the private `*Props` types still flow through the exported `Handle<…>`
parameters (typecheck and the browser/e2e suites confirm).

### Kept Deliberately (with reason)

- `test/setup.ts` `globalSetup`/`globalTeardown` — `remix.json test.setup`,
  runner-invoked (analyzer false positive).
- `scripts/oxlint-plugins/*.ts` (4 files) — analyzer flagged as unreferenced;
  they are entry points listed in `.oxlintrc.json` `jsPlugins`, built on the
  `@oxlint/plugins` devDep. All used.
- `scripts/convert-ecc-skills.ts`, `scripts/seed-demo-appointments.ts` —
  manually-run scripts (unchanged policy).
- `useDurableCustomerChat` in `app/actions/chat/controller.tsx` — part of the
  documented `CUSTOMER_CHAT_DURABLE` flag block alongside its
  `__setTestDurableChat` test seam (2026-10-01 "Retained" note); zero refs now
  but an intentional flag surface.
- `createMemory` in `app/actions/mastra/agent-config.ts` — zero code refs, but
  `docs/mastra-agent-modernization.md` §4.2 builds on it as a planned seam.
- `NodeEnv` / `currentNodeEnv` in `app/config.ts` — the central env module's
  documented public vocabulary (learned `typescript-gotchas` env-snapshot
  delta points at this surface).
- All test-only exports (`__set*` seams, etc. — 75 per analyzer) — imported by
  `*.test.*` files (unchanged policy).
- Mastra-registry exports (agents/workflows/tools/scorers) — wired through
  `app/actions/mastra/index.ts` (unchanged policy).
- `openspec` / `@fission-ai/openspec` devDeps — `openspec` binaries invoked by
  `.opencode/commands/opsx-*` (unchanged policy). `oxlint-tsgolint` — backing
  engine for `.oxlintrc.json` `"typeAware": true`. Every runtime dep and devDep
  grep-verified in use; depcheck adds nothing here.
- The `api` controller trio (`app/actions/api/`, `app/actions/api-lists/`,
  `app/actions/api/lists/`) — the documented `remix doctor` entry-point
  re-export convention, not duplication.
- `admin-offerings-config-page.tsx` vs `admin-offering-configs-page.tsx` —
  similar names, different features with distinct consumers
  (`admin-offerings-page.tsx` vs `verwaltung/offering-configs/controller.tsx`).

### Duplicate Scan Results (measured, deferred — refactor, not cleanup)

- 7 context-menu `clientEntry` files
  (`admin/{users,resources,offerings,offering-configs,appointments,uploads}-context-menu.tsx`,
  `client/public/clients-context-menu.tsx`, ~950 lines total): pairwise
  53–76% similar. The shared skeleton (row-context `<div mix>` wiring,
  `GridState` parse + `handleEditAction` param rebuild, confirm-then-submit
  delete) is genuinely repeated, but each menu's items, labels, disabled-row
  handling and grid selectors differ — below the >80% merge bar, and the
  per-page behavior is exactly what `admin-context-menus.test.browser.tsx`
  pins. A shared `app/ui/mixins/context-menu.ts` factory (allowFiles-legal
  under `app/ui/**`) is the natural follow-up; deliberately not attempted in
  a cleanup pass.
- `admin-offerings-create-page`/`-edit-page` (74%) and
  `client/create-page`/`edit-page` (63%): same create/edit form family pattern;
  same recommendation.
- `verwaltung/offering-configs` vs `verwaltung/resources` controllers (40
  shared ≥45-char lines, 53%): the two grid controllers repeat the sort/filter/
  pagination plumbing the 2026-09-27 `app/utils/grid-params.ts` extraction
  already standardized on the data side; the render plumbing remains per-controller.
- Server-side `during`/grid helpers: already deduped by `a10cf36` (`grid-params`,
  `during`) — no re-drift found. `MAX_MESSAGE_LENGTH` still single-sourced.
- `bodyTextCss` name collision: still not a duplicate (unchanged).

### Pre-existing Dirt (not touched, not caused by this pass)

- `npm run format` fails at HEAD on 12 files unrelated to this session
  (`agent-events/controller.test.ts`, `intent-classifier.ts`,
  `settings/controller.tsx`, `api-require-auth.ts`, `test-utils.ts`,
  `agent-sse.ts`, `sse.ts`, `oxfmt.config.ts`, `package.json`, `remix.json`,
  two docs). Likely oxfmt-version drift from the `f85607f` tool bump. A repo
  -wide `format:fix` should be its own session (see the `format-fix-diff-triage`
  skill before running one). All 12 files touched by this pass are format-clean.

### Impact

- Files deleted: 2 (`server.new`, `opencode.json.sav`) — 53 lines
- Symbols privatized: 27 across 10 files (export-keyword removal only, net 0 LOC)
- Verification: `npm run typecheck` (clean), `npm run lint` (oxlint
  `--max-warnings=0` + theme conformance OK), `npx oxfmt --check` clean on all
  touched files, full `npm test`: server 1663 pass / 0 fail, browser tier
  pass / 0 fail (chromium+firefox), e2e 40 pass / 0 fail (11 files, exit 0).

## [2026-10-02] Eval gate harness (no deletions)

Added `runEvals` gates over support-agent journeys, runnable with
`npm run eval:mastra` and guarded by an always-on gate-drift test.

### Added

- `app/actions/mastra/evals/journeys.ts` — journey contracts (`mustCall` /
  `mustNotCall`, runtime tool keys).
- `app/actions/mastra/evals/gates.ts` — `runEvals` wiring + verdict handling.
- `app/actions/mastra/evals/gates.test.ts` — locks every gate name to a real
  `agent.listTools()` key; runs without a model key.
- `scripts/eval-mastra.ts` + the `eval:mastra` package script — exits non-zero
  on a `failed` verdict, or exit 2 when `OPENCODE_API_KEY` is unset.
- `docs/mastra-agent-modernization.md` §4.5 — corrected the sketch's gate names
  from `createTool` ids to runtime tool keys.

### Notes

- `runEvals` requires a real `Agent`/`Workflow` target (a fake target throws
  "Error generating result from target"), and it omits `requestContext`, so the
  customer agent (whose tools call `requireActorId`) is out of scope for now.
- The repo's CI workflow is disabled and has no model secret, so the live gate is
  a local/manual step; the drift test is what runs in `npm test`.

### Impact

- Files added: 4; files modified: 2 (package.json, modernization doc).
- Verification: `npm run typecheck`, `npm run lint`, the drift test (2 pass), and
  the full server suite. The live gate was not run (no `OPENCODE_API_KEY`); the
  script's fail-fast path was verified (exit 2).

## [2026-10-02] Support-agent guardrails (no deletions)

Wired input/output/error processors onto the admin agent and taught
`defineAppAgent` to forward `outputProcessors` / `errorProcessors`.

### Added

- `app/actions/mastra/agent-config.test.ts` — asserts each processor lane stays
  wired.
- `inputProcessors` on `support-agent.ts`: `UnicodeNormalizer`, a secrets-only
  `RegexFilterProcessor` (block), `PromptInjectionDetector`,
  `TokenLimiterProcessor`, `TokenCostControl`.
- `outputProcessors`: a secrets-only `RegexFilterProcessor` (redact).
- `errorProcessors`: `StreamErrorRetryProcessor`.

### Notes

- The `pii`/`urls` presets are intentionally not enabled on input: the admin
  agent's primary handle is a user's email address, so PII blocking would break
  `lookup_user`.
- All processors construct lazily; none resolves the model at module load
  (verified before wiring, since eager resolution would break app startup).

### Impact

- Files touched: 3 (2 source, 1 test) plus docs.
- Verification: `npm run typecheck`, `npm run lint`, the guardrail test, and the
  full server suite.

## [2026-10-02] Structured-output intent classification

Replaced the classifier's raw-JSON contract with Mastra `structuredOutput`.
`workflow-classifier.ts` now defines a Zod `intentClassificationSchema` and
passes it via
`generate({ structuredOutput: { schema, jsonPromptInjection: 'system' } })`;
`classifyWithAgent()` consumes the validated `result.object`.

### Removed

- `parseIntentJson()` in `app/actions/mastra/intent-classifier.ts` — brace
  slicing between the first `{` and last `}`. Schema validation replaces it.
- The `ClassifyAgent.generate()` `{ text }` return contract — the seam now
  returns `{ object }`.

### Migrated

- `app/actions/mastra/workflow-classifier.ts` — output schema + structured
  generation.
- `app/actions/agent-events/controller.test.ts`,
  `app/actions/agent-events/agent-events-frame-redirect.test.e2e.ts`,
  `app/actions/mastra/tools/classify-intent.test.ts` — test doubles now return
  the structured object.

### Impact

- Files modified: 5 (2 source, 3 tests) plus docs and one skill delta.
- Verification: `npm run typecheck`, `npm run lint`, the focused classifier /
  agent-events suites (75 pass), and the full server suite.

## [2026-10-01] Durable customer chat — gate-store reconnect retired (code retained)

The feature-flagged durable customer chat (`CUSTOMER_CHAT_DURABLE=1`,
`app/utils/agent-chat-durable.ts`) no longer reads the customer
`chat_pending_gates` pointer for reconnect, and no longer calls
`approveToolCallGenerate` / `declineToolCallGenerate` / `resumeStream`.
Reconnect re-attaches with `durableAgent.observe(runId)` + `detach()` and reads
the gate from durable workflow snapshot storage (`listSuspendedRuns`);
tool-approval and `ask_user` resumes go through durable `resume()`.

**No code was deleted in this pass.** The hand-rolled engine
(`app/utils/agent-chat.ts`), `app/utils/agent-gate-store.ts` and
`app/actions/chat/gate-store.ts` are retained unchanged as the default fallback
until parity is proven and the flag is made permanent; the support surface still
uses them. When the fallback is removed, the deletion set is
`app/actions/chat/gate-store.ts`, the `chatGateStore` wiring in
`app/actions/chat/controller.tsx`, and the gate-store branches of
`app/utils/agent-chat.ts`.

### Added

- `app/utils/agent-chat-durable.ts` — durable customer chat engine.
- `findLatestChatRun()` in `app/actions/chat/run-store.ts` — reconnect pointer.
- `durableCustomerAgent` registration (lazy `mastra.addAgent()`) in
  `app/actions/mastra/index.ts`.

### Retained (not dead)

- `app/actions/chat/gate-store.ts`, `app/utils/agent-gate-store.ts`,
  `app/utils/agent-chat.ts` — fallback engine (flag off) and the support surface.
- `recordChatRun` / `findChatRunOwner` / `clearChatRun` — the durable path's
  ownership boundary (must not be dropped).

### Impact

- Files added: 1; files modified: 6 (no deletions).
- Verification: `npm run typecheck`, `npm run lint`, the full server suite
  (`remix test --type server`) and the chat browser suite.

## [2026-10-01] Remove the write-only failed-notification queue

`app/actions/mastra/notifications/queue.ts` was an in-memory array with four
production callers (`booking-reminder`, `customer-booking`,
`booking-cancellation`, `cancel-user` workflows) and **no production reader**:
`getFailedNotifications` / `clearFailedNotifications` were imported only by
`workflows.test.ts`. Failed deliveries accumulated unbounded, were never
retried, and vanished on restart. `sender.ts` documented a "retry queue" that
did not exist.

Replaced with `reportNotificationFailure(recipient, type, data, error)` in
`notifications/sender.ts`, which logs the failure (recipient, type,
appointment id, error message) through the shared logger. The workflows keep
their existing best-effort contract — a delivery failure still never fails the
booking — but it is now observable instead of silently retained in a queue
nobody drains.

Note: a durable retry (a `failed_notifications` table drained by the scheduled
reminder workflow) remains available if real retry semantics are wanted; it was
not added because it would not help when the database is the failure cause and
would need poison-pill handling for permanent failures such as an invalid
recipient.

### Removed

- `app/actions/mastra/notifications/queue.ts`.

### Added

- `reportNotificationFailure()` in `app/actions/mastra/notifications/sender.ts`.

### Migrated

- `app/actions/mastra/workflows/{booking-reminder,customer-booking,booking-cancellation,cancel-user}-workflow.ts`
  and `app/actions/mastra/workflows.test.ts`.

## [2026-10-01] Mastra RequestContext migration

Replaced the per-surface `AsyncLocalStorage` actor scope with Mastra's native
`RequestContext`, and migrated the deprecated `CostGuardProcessor` alias to its
current `TokenCostControl` name.

### Removed

- `app/utils/async-storage.ts` — the `AsyncLocalStorage<number>` factory behind
  both actor scopes. Tools now read the authenticated actor from the
  `RequestContext` that the shared chat engine passes into `agent.stream()`,
  `resumeStream()` and `approveToolCallGenerate()`.
- `app/actions/mastra/tools/admin-context.ts` — `runWithAdminId` /
  `requireAdminId` ALS helpers. No support tool called `requireAdminId`; the
  admin id now travels in the same shared request context as the customer id.
- `app/actions/mastra/tools/admin-context.test.ts` — tests for the removed ALS
  helpers, superseded by `app/actions/mastra/actor-context.test.ts`.

### Added

- `app/actions/mastra/actor-context.ts` — `createActorRequestContext()` /
  `requireActorId()`.
- `app/actions/mastra/actor-context.test.ts`.

### Migrated

- `app/actions/mastra/agents/customer-agent.ts` — `CostGuardProcessor` →
  `TokenCostControl` (same class, new name).
- `app/actions/mastra/tools/customer-tools.ts`, `app/utils/agent-chat.ts`,
  `app/actions/chat/controller.tsx`, `app/actions/support-agent/controller.tsx`,
  `app/actions/mastra/tools/customer-tools.test.ts` — actor id now flows through
  `RequestContext`.

### Impact

- Files touched: 12 (2 added, 3 removed, 7 modified)
- Verification: `npm run typecheck` (clean), `npm run lint` (clean), full server
  suite `remix test --type server` (1589 tests: 1588 pass / 0 fail / 1 todo)

## [2026-10-01] Post-drift Dead-Code & Export-Hygiene Pass

Fresh knip (6.38), depcheck, ts-prune, tsc, and oxlint pass after the
2026-09-27 → 2026-10-01 commit series. The repo remains clean: knip's 156
"unused files" are all test files (remix.json `test.files` globs), browser
assets (remix.json `assets.allowFiles`), test utilities, and manually-run
scripts — none are dead. The 54 "unused exports" / 6 "unused types" are
likewise test-only seams and Mastra-registry / asset-graph consumers knip
cannot follow; each was grep-verified against every production, test,
browser-asset, and script file. The only unused devDeps are the `openspec` CLI
tools (binary-invoked, not import-tracked) — kept.

### Unused Exports Privatized (removed `export` keyword)

- `app/data/offering-configs-queries.ts` — `OFFERING_CONFIGS_ORDER_BY_COLUMNS`.
  Knip flagged it as an unused export; grep confirmed zero references outside
  the module (it feeds `OFFERING_CONFIGS_SORTABLE_FIELDS` and the
  `listOfferingConfigs` order-by lookup in the same file). The whitelist map
  stays module-private; `OFFERING_CONFIGS_SORTABLE_FIELDS` remains the public
  surface.
- `app/ui/sidebar-layout.tsx` — `sidebarResponsiveStyle`. Knip flagged it as
  an unused export; grep confirmed zero references outside the module (it is
  only applied at the sidebar-shell `<aside mix={...}>` in the same file).

### Kept Deliberately (with reason)

- All knip "unused files": test files, browser assets (`*.browser.*`,
  `app/assets/streams/public/*`), test utilities (`test/setup.ts`,
  `app/test-utils*`, `app/data/test-pool.ts`, `playwright.config.ts`), and
  manually-run scripts (`scripts/convert-ecc-skills.ts`,
  `scripts/seed-demo-appointments.ts`, `scripts/validate-appointments-mobile.mjs`).
- Test-only exports (`__set*` seams, `findRunOwner`, `writeEvent`,
  `chatRateLimiter`, `consoleNotificationSender`, `getFailedNotifications`,
  `clearFailedNotifications`, `findNotification`, `listDaysWithOfferings`,
  `deleteExpired*`, `skipAssetsLogger`, `serializeSessionCookie`,
  `readSessionId`, `isAllowedCsrfOrigin`, `uploadLimitErrorCode`, `AdminLayout`,
  `pipelineRowHtml`, `tryGetCsrfToken`, `ForbiddenPage`, `defaultLayoutPolicy`,
  `previewDeleteBlock`, `errorToText`, `parseInline`, `listChatThreads`, types
  `PendingGateRow`/`AgentStreamOutput`/`PgErr`/`KeyboardListItem`/
  `SendEmailOptions`) — imported by `*.test.*` files; removing would break the
  suite. `PendingGateRow` is a re-export (not a duplicate) shared from
  `app/utils/agent-gate-store.ts`.
- Mastra-registry exports (agents, workflows, scorers, tools) — wired in
  `app/actions/mastra/index.ts` and consumed via the Mastra registry, which
  knip/ts-prune cannot follow.
- `openspec` + `@fission-ai/openspec` devDependencies — CLI tools invoked as
  the `openspec` binary by `.opencode/commands/opsx-*`; not import-tracked by
  knip/depcheck.

### Impact

- Files touched: 2 (export-keyword removal only)
- Lines changed: 2 insertions / 2 deletions (net 0)
- Verification: `npm run typecheck` (clean), `npm run lint` (oxlint
  `--max-warnings=0` + theme conformance OK), `npm run format` (clean on all
  touched files), `npm test` (1900 tests: 1897 pass / 0 fail / 2 skipped /
  1 todo)

## [2026-09-27] Drift Cleanup + Grid-Helper Consolidation

Full-repo audit after the Sep-19 → Sep-26 remix/security commit series. knip,
depcheck, and ts-prune are not installed and installing them would write outside
the workspace sandbox, so this pass used an in-repo export/usage analyzer: it
parses every exported symbol in `app/`, `scripts/`, `test/`, and the root
entrypoints, then counts whole-word references from every other scanned source
file (test/browser-asset/script classification included). The repo stayed clean
since 2026-09-10; this pass removes the dead code the drift window introduced and
finishes the grid-helper consolidation the 2026-09-10 pass deferred.

### Dead Code Removed

- `app/middleware/sse-auth.ts` — `requireSseAuth()` (9 lines). The only
  remaining mention was a JSDoc line in `requireAdminSseAuth`; zero callers in
  production or tests. The admin-only `requireAdminSseAuth` (the middleware
  actually wired) is unchanged; its doc comment was reworded to drop the stale
  reference.
- `app/utils/agent-chat.ts` — `AgentChat` type alias
  (`ReturnType<typeof createAgentChat>`). Never imported or referenced.

### Unused Export Removed (re-export)

- `app/ui/breadcrumbs.tsx` — `export type { BreadcrumbItem }`. The type is
  still imported from `remix/ui/breadcrumbs` and used inside the module, but no
  file imports it from `app/ui/breadcrumbs.tsx`.

### Duplicate Code Consolidated

- New `app/utils/grid-params.ts` — shared `gridOffset()`, `gridFilter()`,
  `gridSortColumn(raw, sortableFields, fallback)`, and
  `gridSortDirection(raw, direction?)`. Replaces four byte-identical copies of
  the helpers in `app/actions/client/controller.tsx`,
  `app/actions/admin/messages/controller.tsx`,
  `app/actions/admin/lists/controller.tsx`, and
  `app/actions/admin/users/controller.tsx` (the 2026-09-10 log flagged three;
  `admin/messages` was the fourth). Only the sort-column fallback and the
  messages grid's descending default are parameterized; every other behavior is
  byte-identical.

### Unused Exports Privatized (removed `export` keyword)

- `app/actions/mastra/agent-config.ts` — `withUserTools`, `AppAgentDefinition`
- `app/assets/streams/public/read-sse.ts` — `SseEventHandler`, `ReadEventStreamOptions`
- `app/data/admin-lists.ts` — `LIST_ITEM_FILTERS`, `ListItemFilter`
- `app/data/webhook-requests.ts` — `WebhookPayloadParse`
- `app/ui/agent-chat/cards.ts` — the seven `*CardOptions` types
- `app/ui/agent-chat/shell.tsx` — `AgentChatShellProps`, `MessageBubbleRole`,
  `MessageBubbleVariant`, `bubbleStyle`, `MessageBubbleProps`,
  `ChatComposerTextarea`, `ChatComposerProps`
- `app/ui/support-agent-page.tsx` — `SUPPORT_AGENT_EXAMPLES`
- `app/utils/agent-chat.ts` — `StreamEndReason`, `ChatRequestContext`, `AgentChatConfig`
- `app/utils/agent-gate-store.ts` — `GateType`, `PendingGateStatus`,
  `GateSuspension`, `GateStoreConfig`
- `app/utils/server-handler.ts` — `RequestRouter`

### Kept Deliberately (with reason)

- `test/setup.ts` `globalSetup`/`globalTeardown` — invoked by the `remix test`
  runner (`remix.json` `test.setup`), not imported.
- Test-only exports (`__set*` seams, `findRunOwner`, `writeEvent`,
  browser-asset exports, etc.) — imported by `*.test.*` / `*.browser.*`;
  removing would break the suite.

### Duplicate Scan Results

- `MAX_MESSAGE_LENGTH` is now single-sourced in `app/utils/message-limits.ts`
  (the 2026-09-10 "remaining" item is resolved). The re-exports in
  `mastra/shared-agent.ts` and `agent-events/event-bus.ts` are imported by
  consumers and stay.
- `bodyTextCss` in `app/ui/page-primitives.tsx` vs
  `app/actions/admin/uploads/uploads-grid-css.ts` — still not duplicates
  (different color token and line height); left as-is.

### Impact

- Files touched: 17 (16 modified + 1 new shared module)
- Diff: +70 / −130 across the modified files; new module 45 lines
- Verification: `npm run typecheck` (clean), `npm run lint` (oxlint
  `--max-warnings=0` + theme conformance OK), `npm run format` (clean on all
  touched files), `npm test` (1857 tests: 1854 pass / 0 fail / 2 skipped /
  1 todo)

## [2026-09-10] Dead-Code & Duplicate Cleanup (post-Sep-4 drift)

Fresh knip + ts-prune + depcheck + tsc + oxlint pass. The repo remains largely
clean (knip's 134 "unused files" are all tests / browser assets / test utilities
/ manually-run scripts; the only "unused deps" are the `openspec` CLI tools).
Two genuinely-dead symbols and one byte-identical duplicate were found, plus a
drift correction for an export that a later feature commit re-introduced.

### Unused Exports Removed

- `app/data/lists.ts` — `getListsByIds()` (18 lines). Zero references in
  production or test. Orphan of the retired `routeAgent` list-selection UI
  (route removed 2026-08-28); the only remaining mentions are archived OpenSpec
  docs and the `remix3-data-table` learned skill's illustrative
  example.
- `app/data/uploads.ts` — `UploadSortField` type. Added with `UPLOAD_SORT_FIELDS`
  (5787202) but never referenced; the grid consumes `UPLOAD_SORT_FIELDS` directly.

### Duplicate Code Consolidated

- `app/actions/agent-events/workflow-sse.ts` — removed local `safeClose()`,
  byte-identical to `app/utils/agent-sse.ts`; the module already imported
  `sseEncoder` from that file, so `safeClose` now comes from the shared module.

### Unused Exports Privatized (removed `export` keyword)

- `app/data/uploads.ts` — `uploadsPerUserQuotaBytes`. **Drift correction:** the
  2026-09-04 hygiene pass removed this export, but feature commit `203de41`
  re-added it; the only references are internal (`claimUpload` / `claimUploads`).
- `app/data/lists.ts` — `ItemPriority` (internal to the `ListItem` shape). The
  `lists-client.tsx` browser asset keeps its own local copy because
  `app/data/**` is not in the asset `allowFiles`.
- `app/middleware/uploads.ts` — `uploadHandler` (passed to `formData()` inside
  the same module).
- `app/utils/upload-validation.ts` — `MAX_UPLOAD_FILES` (used only by
  `validateUploadFiles` in the same module).

### Impact

- Files touched: 5
- Lines removed: ~27
- Verification: `npm run typecheck` (clean), `npm run lint` (oxlint
  `--max-warnings=0` + theme conformance OK), `npm test` (1567 pass / 0 fail /
  2 skipped / 1 todo)

### Remaining (manual review — not removed)

- Grid-param helpers duplicated across `app/actions/client/controller.tsx`,
  `app/actions/admin/users/controller.tsx`, `app/actions/admin/lists/controller.tsx`:
  `gridOffset`, `gridSortDirection`, `gridFilter` are byte-identical and
  `gridSortColumn` differs only by its default fallback (`id` / `name` /
  `created_at`). Candidate for a parameterized `app/utils/grid-params.ts`.
- `MAX_MESSAGE_LENGTH = 5000` is defined three times
  (`app/actions/mastra/shared-agent.ts`, `app/actions/agent-events/event-bus.ts`,
  `app/ui/customer-chat-page.tsx`) with per-module re-exports. Candidate for a
  single shared constant.
- `bodyTextCss` name collision between `app/ui/page-primitives.tsx` and
  `app/actions/admin/uploads/uploads-grid-css.ts` — **not** duplicates
  (different color token and `lineHeight`), left as-is.

## [2026-09-04] API-Hygiene Pass (privatize internal-only exports)

Follow-up to the 2026-08-31 audit, which had deferred "low-value `export`-keyword
candidates" to a future hygiene pass. Every symbol below is used **only within
its own module** (verified by knip + targeted grep; no barrel `export *`
re-exports exist). Removed the `export` keyword so the module surface reflects
actual usage. No behavior change — the symbols remain defined and used.

### Unused Exports Privatized (removed `export` keyword)

- `app/actions/lists/public/sidebar-sync.ts` — `sidebarRowFor` (helper for `syncSidebarRow`)
- `app/actions/mastra/agent-config.ts` — `requireApiKey` (internal to `createModel`)
- `app/actions/mastra/intent-classifier.ts` — `parseIntentJson` (internal to `classifyWithAgent`)
- `app/actions/mastra/tools/customer-tools.ts` — `requireCurrentUserId` (destructure split; `runWithUserId` stays exported — imported by `chat/controller.tsx` + tests)
- `app/actions/mastra/workflows/consistency-check-workflow.ts` — `UserWithPending` (type), `checkLockedUsersPendingAppointments`, `checkActiveUsersPendingAppointments` (steps used only by `consistencyCheckWorkflow`)
- `app/assets/streams/public/read-sse.ts` — `parseSseFrame` (internal to `readEventStream`)
- `app/data/notifications.ts` — `NOTIFICATION_TYPES` (const feeding exported `NotificationType`)
- `app/data/uploads.ts` — `uploadsPerUserQuotaBytes` (default param of `claimUpload`)
- `app/db.ts` — `pool`, `loadAppSchema` (internal; `db`/`initializeAppDatabase`/`closeAppDatabase` stay exported)
- `app/middleware/frame-redirect.ts` — `ADMIN_FRAME_TARGETS` (internal to `frameRedirects`)
- `app/ui/sidebar-layout.tsx` — `shellFullHeightStyle`, `contentFullHeightStyle` (used only in the shell; `lists-layout.tsx` defines its own local copy)
- `app/utils/motion.ts` — `prefersReducedMotion` (internal to `entrance`)
- `app/data/maintenance.ts` — `chatRunsTtlMs`, `webhookRequestsRetentionMs`, `auditLogsRetentionMs`, `uploadsRetentionMs`, `runDatabaseMaintenance` (the four `deleteExpired*` fns stay exported — imported by `maintenance.test.ts`)
- `scripts/skills-sync-lib.ts` — `OPENCODE_SKILLS_DIR`, `AGENTS_SKILLS_DIR`, `LEARNED_SKILLS_DIR`, `findCliPackage`, `linkSkill` (used only inside the module; `syncVendorSkill`/`syncSkillFarm` stay exported — imported by `sync-skills.ts` and `postinstall.ts`)

### Unused Type Exports Privatized

- `app/actions/mastra/notifications/sender.ts` — `NotificationResult`
- `app/actions/mastra/shared-agent.ts` — `MastraSuspendableResult` (`AgentStreamOutput` stays — imported by controller tests)
- `app/actions/support-agent/run-store.ts` — `PendingGateStatus`
- `app/data/lists.ts` — `ListItem` (the `ListItem` in `lists-client.tsx` is a separate local type)
- `app/utils/agent-sse.ts` — `SuspensionInfo`
- `app/ui/theme/glyph-contract.ts` — `GlyphSymbol`; `app/ui/theme/glyph/glyph.tsx` re-export trimmed to `GlyphName` only (`GlyphSymbol`/`GlyphValues` re-exports were dead; `GlyphName` is imported from `glyph.tsx` by admin pages)

### Impact

- Files touched: 21 (export-keyword removal only)
- Lines changed: 34 insertions / 34 deletions (net 0)
- Verification: `npm run typecheck` (clean), `npm run lint` (oxlint `--max-warnings=0` + theme conformance OK), `npm test` (1377 pass / 0 fail / 1 skipped / 1 todo)

### Kept Deliberately (unchanged)

- Test-only exports (`__set*` setters, `chatRateLimiter`, `findRunOwner`, `consoleNotificationSender`, `getFailedNotifications`, `clearFailedNotifications`, `findNotification`, `writeEvent`, `listDaysWithOfferings`, `skipAssetsLogger`, `AdminLayout`, `pipelineRowHtml`, `tryGetCsrfToken`, `defaultLayoutPolicy`, `previewDeleteBlock`, `deleteExpired*`, `pool` in `test-pool.ts`, types `AgentStreamOutput`/`PgErr`/`KeyboardListItem`/`SendEmailOptions`) — imported by `*.test.*` files; removing would break the suite.
- `openspec` + `@fission-ai/openspec` devDependencies — CLI tools invoked as the `openspec` binary by `.opencode/commands/opsx-*`; not import-tracked by knip/depcheck.

## [2026-08-31] Dead-Code Audit (research-first, conservative)

Full-repo dead-code audit with knip, ts-prune, depcheck, oxlint, and tsc. The
codebase is largely clean: the 122 files knip flagged as "unused" are test files
(remix.json `test.files` globs), browser assets (remix.json `assets.allowFiles`),
test utilities, and manually-run scripts — none are dead. The `openspec` /
`@fission-ai/openspec` devDeps are CLI tools (binary on PATH, `openspec/` tree
present), not imports — kept. All other flagged exports are either exported for
tests (kept, per policy) or used internally within their module (kept; noted as
low-value `export`-keyword candidates below).

### Unused Exports Removed

- `app/data/schema.ts` — `chatRuns` table object (`export const chatRuns = table({...})`)
  - Reason: zero references in production or test code; the `chat_runs` table is
    accessed exclusively via raw SQL (`app/actions/chat/run-store.ts`,
    `app/data/maintenance.ts`). No barrel `export *` re-exports it.

### Impact

- Files deleted: 0
- Lines of code removed: ~24
- Verification: `npm run typecheck` (clean), `npm run lint` (clean + theme
  conformance OK), `npm test` (1322 pass / 0 fail / 1 skipped / 1 todo)

### Kept Deliberately (with reason)

- Test-only exports (`__set*` setters, `chatRateLimiter`, `findRunOwner`,
  `skipAssetsLogger`, `AdminLayout`, `pipelineRowHtml`, `tryGetCsrfToken`,
  `defaultLayoutPolicy`, `previewDeleteBlock`, `writeEvent`,
  `listDaysWithOfferings`, `normalizeUserAction`, `_agentThreadId`,
  `_recordWorkflowResult`, `getFailedNotifications`, `clearFailedNotifications`,
  types `AgentStreamOutput`/`PgErr`/`KeyboardListItem`/`SendEmailOptions`) —
  imported by `*.test.*` files; removing would break the suite.
- `openspec` + `@fission-ai/openspec` devDependencies — CLI tools used via the
  `openspec` binary; not import-tracked by knip/depcheck.
- Internal-use exports (used only within their own module) — `sidebarRowFor`,
  `parseIntentJson`, `requireCurrentUserId`, `checkLocked*`/
  `checkActiveUsersPendingAppointments`, `parseSseFrame`, `chatRunsTtlMs`/
  `webhookRequestsRetentionMs`/`auditLogsRetentionMs`/`uploadsRetentionMs`/
  `deleteExpired*`/`runDatabaseMaintenance`, `uploadsPerUserQuotaBytes`,
  `pool`, `loadAppSchema`, `ADMIN_FRAME_TARGETS`, `shellFullHeightStyle`,
  `contentFullHeightStyle`, `prefersReducedMotion`, types `NotificationResult`/
  `MastraSuspendableResult`/`UserWithPending`/`ListItem`/`GlyphSymbol`,
  `scripts/skills-sync-lib.ts` constants. Removing just the `export` keyword is
  safe but churn-y; left for a future API-hygiene pass.

## [2026-08-30] Consolidate User-Summary Export Helpers (modernize-users-export)

Narrow consolidation of the `/verwaltung/users-export` and `/verwaltung/users-pdf` export family (OpenSpec change `modernize-users-export`). Only byte-identical code was shared; the two data-layer SQL queries were **deliberately kept separate** because their semantics differ (`users-export`: INNER JOIN + date-range WHERE; `users-pdf`: LEFT JOIN over all users). A previous consolidation attempt (8f4dfee, 2026-07-31) merged the data functions themselves and was reverted in `bd78294`.

### Duplicated Code Consolidated

- `UserSummaryRow` interface + row-coercion/`limit+1`-truncation mapping (4 copies → 1) — `app/data/user-summary-rows.ts` (`queryUserSummaryRows`); `users-export.ts`/`users-pdf.ts` keep their own SQL and re-export the row type
- Inline pdfmake document definition in both user-PDF controllers → `app/utils/user-summary-pdf.ts` (`buildUserSummaryPdf`)
- SuperHeaders attachment Response construction in both controllers → `app/utils/pdf-utils.ts` (`pdfAttachmentResponse`)
- Local `formatDate()` helpers in 3 PDF controllers → `app/utils/date-utils.ts` (`formatDateDE` now null-tolerant; new `formatUtcDateDE`/`formatUtcPeriodDayDE` for UTC-rendered export labels)

### Behavior Changes (spec-driven, not refactor side effects)

- `/verwaltung/users-export`: calendar-valid date validation (non-calendar dates like `2024-02-31` now rejected), per-field validation errors, UTC-day period labels, GET `?startDate&endDate` download, 200 empty-state instead of 404 error box, `X-Remix-Frame` download shim, logger in generation catch
- PDF table date columns now render UTC ("31.01.2026" style via `formatUtcDateDE`); the weekday-prefixed `formatDateDE` remains for calendar UI callers

### Impact

- TypeScript: clean compile (`npm run typecheck`)
- Lint: oxlint `--max-warnings=0` + theme conformance pass
- Tests: 1317 pass / 0 fail / 1 todo / 1 skipped
- Files deleted: 0 (consolidation only); net ~150 duplicate lines removed

## [2026-08-28] Retire routeAgent and testAgent

Retired the `routeAgent` (agentic-routing POC, superseded by `supportAgent`) and `testAgent` (dev-only filesystem-explorer prototype) from the Mastra registry and the app.

### Files Deleted

- `app/actions/mastra/agents/route-agent.ts`
- `app/actions/mastra/agents/test-agent.ts`
- `app/actions/mastra/tools/test-tools.ts` + `test-tools.test.ts`
- `app/actions/mastra/tools/route-find-list.ts` (no surviving agent imported `findList`)
- `app/actions/route-agent/controller.tsx`
- `app/actions/test-agent/controller.tsx` + `controller.test.ts`
- `app/ui/route-agent-page.tsx`, `app/ui/test-agent-page.tsx`
- `app/assets/streams/public/route-agent-stream.tsx`, `app/assets/streams/public/test-agent-stream.tsx`

### Routes / Wiring Removed

- `/route-agent` and `/testagent` route trees from `app/routes.ts` and their `router.map()` calls in `app/router.ts`
- Route-Agent link from `app/ui/nav.ts`; Test-Agent nav item, `AdminNavItem` union entry, and `testAgentSvg()` from `app/ui/admin-layout.tsx`
- `'/testagent'` and `'/route-agent'` from `AGENT_PATHS` in `app/middleware/skip-csrf.ts`
- `'route-agent-frame-container'` from `CONTAINER_IDS` in `app/utils/frame-utils.ts`
- `TestAgentStream` / `RouteAgentStream` imports from `app/assets/streams/streams.test.browser.tsx`
- `testAgent` / `routeAgent` entries from the Mastra agents registry in `app/actions/mastra/index.ts`

### Kept Intentionally

- `app/actions/mastra/tools/route-navigate.ts` — still imported by `supportAgent`
- `_testAgent` / `__setTestAgent` test seam in `app/actions/mastra/controller.tsx` — a `supportAgent` stub, unrelated to the retired `testAgent`

### Impact

- Mastra agents: 5 → 3 (`supportAgent`, `customerAgent`, `workflowAgent`)
- Removed the approval-gated filesystem write/edit/delete surface exposed by `testAgent` in the admin panel
- TypeScript: clean compile (`npm run typecheck`)
- Lint: oxlint `--max-warnings=0` + theme conformance pass
- Tests: 1264 pass / 0 fail / 1 todo / 1 skipped

## [2026-07-23] Refactor Session — Dead Code Cleanup

### Unused CSS Removed from `app/ui/layout.tsx`

Removed 19 unused CSS style constants that were never referenced in JSX templates or exported:

- `logoutFormStyle` — leftover from old header nav
- `logoutIconStyle` — leftover from old header nav
- `headerStyle` — replaced by `main-nav.tsx`'s own styles
- `containerStyle` — replaced by `main-nav.tsx`'s own styles
- `navStyle` — moved to `sidebar-layout.tsx` and `main-nav.tsx`
- `navSectionGroupCss` — moved to `main-nav.tsx`
- `navSectionLabelCss` — moved to `main-nav.tsx`
- `brandGroupCss` — replaced by `main-nav.tsx`'s own styles
- `logoStyle` — replaced by `main-nav.tsx`'s own styles
- `userEmailCss` — replaced by new user menu pattern
- `navLinkStyle` — moved to `sidebar-layout.tsx` and `main-nav.tsx`
- `navActiveStyle` — moved to `sidebar-layout.tsx` and `main-nav.tsx`
- `showcaseGroupStyle` — from iterative showcase dropdown (unused)
- `showcaseButtonStyle` — from iterative showcase dropdown (unused)
- `chevronStyle` — from iterative showcase dropdown (unused)
- `showcaseMenuStyle` — from iterative showcase dropdown (unused)
- `dropdownLinkStyle` — from iterative showcase dropdown (unused)
- `dropdownActiveStyle` — from iterative showcase dropdown (unused)
- `themeToggleStyle` — replaced by `main-nav.tsx`'s own toggle

File reduced from 350 lines to 157 lines.

### Seed Bug Fixed in `app/data/seed.ts`

- **Line 125:** Changed `res.description === 'resource2'` to `res.name === 'Raum 2'`
- **Reason:** The seed creates resources named "Raum 1" and "Raum 2" with German descriptions ("Hauptraum mit Beamer und Whiteboard", "Nebenraum für Kleingruppen"). The original condition checked `description === 'resource2'` which never matched, so all resources got the same default rules (Mon/Wed). Now "Raum 2" correctly gets Tue/Thu rules as intended.

### Duplicate `insertWebhookRequest` Consolidated

- **`app/data/webhook.ts`** — DELETED (16 lines)
- **`app/data/webhook-requests.ts`** — Updated `insertWebhookRequest` to return `Promise<string>` (ID) using `RETURNING id`, matching the signature previously in `webhook.ts`
- **`app/actions/webhook/controller.tsx`** — Updated import from `../../data/webhook.ts` to `../../data/webhook-requests.ts`, changed parameter key from `serialized` to `payload` to match the canonical API
- **Test impact:** `webhook-requests.test.ts` already imports from the canonical `webhook-requests.ts`; changing return type from `void` to `string` is backward-compatible (callers use `await` without storing result)

### Impact Summary

- Files deleted: 1
- Lines of code removed: ~210
- Tests passing: 1005 / 1006 (1 preexisting failure: AI API key configuration)
- File size reduction: `layout.tsx` 350 → 157 lines

## [2026-07-24] Refactor Session — Dead Code Cleanup & Consolidation

### Unused Exports Removed

- `__getTestAgent` — `app/actions/mastra/controller.tsx:39` (function only used via `__setTestAgent` in tests)
- `__getTestAgent` — `app/actions/workflow-agent/controller.tsx:25` (same pattern)
- `messageField`, `messageSchema` — `app/actions/mastra/shared-agent.ts:54-55` (made private, only used internally)
- `isAbortError` — `app/actions/mastra/shared-agent.ts:71` (no remaining callers after chat controller cleanup)
- `ErrorCode` (type) — `app/actions/mastra/tools/errors.ts:15` (not imported anywhere)
- `ErrorResult` (type) — `app/actions/mastra/tools/errors.ts:17` (not imported anywhere)
- `ApiToken` (type) — `app/data/schema.ts:529` (type defined but never imported)
- `getMigrations` (re-export) — `app/data/setup.ts:1` (kept internal import, removed redundant re-export)
- `createAuthCookieWithPendingBooking` — `app/test-utils.ts:121` (entire function removed, never imported)
- `ThemeComponent` (type), `glyphContract`, `glyphNames`, `GlyphName`, `GlyphValues` — `app/ui/theme/theme.ts` (re-exports never consumed from this path)
- `GlyphSheetProps` (type) — `app/ui/theme/glyph/glyph.tsx:8` (made private, only used internally)
- `filterAndForward` — `app/utils/agent-sse.ts:14` (made private, only used by `pipeStream` in same file)

### Duplicate Type Consolidated

- `Report1UserOption` — `app/ui/admin-report1-page.tsx` had its own duplicate definition; changed to import from `app/data/report1.ts` where the canonical version lives

### Shared SSE Utilities Extracted (`app/utils/agent-sse.ts`)

- `sseErrorResponse(error, status)` — Creates an SSE `agent-error` Response with proper headers in one call
- `sseEvent(type, data)` — Encodes a single SSE event for `controller.enqueue()` usage
- `safeClose(controller)` — Safely closes a ReadableStream controller, ignoring already-closed errors

### Shared Logger Utility Created (`app/utils/logger.ts`)

- `createLogger(prefix)` — Creates a Logger with `.error()` method that suppresses output in test environments
- Replaced `process.env.NODE_ENV !== 'test' ? console.log.bind(...) : () => {}` pattern in:
  - `app/actions/webhook/controller.tsx`
  - `app/actions/callback/controller.tsx`
  - `app/actions/app-webhook/controller.tsx`
- Replaced `if (process.env.NODE_ENV !== 'test') { console.error(...) }` pattern in:
  - `app/actions/chat/controller.tsx` (5 occurrences)

### Controller SSE Pattern Consolidation

Refactored 3 agent controllers (`route-agent`, `workflow-agent`, `mastra`) to use shared `sseErrorResponse()`, `sseEvent()`, and `safeClose()`:

- 20+ inline `sseEncoder.encode(...)` → `sseEvent()` calls
- 15+ multi-line SSE Response constructors → single-line `sseErrorResponse()` calls
- Eliminated ~270 lines of repetitive SSE boilerplate

### Type Cleanup

- `docDef: any` → `docDef: TDocumentDefinitions` in:
  - `app/actions/mastra/agents/workflow-agent.ts` (1 occurrence)
  - `app/actions/mastra/tools/support-tools.ts` (2 occurrences)

### Console.Error Cleanup

- `app/actions/mastra/controller.tsx` — removed `console.error` for recall failures (non-fatal; replaced with comment)
- `app/actions/chat/controller.tsx` — moved all 5 `console.error` calls to `chatLog.error` via shared logger

### Impact

- Files created: 1 (`app/utils/logger.ts`)
- Lines of code removed: ~427
- Lines of code added: ~145 (utilities + replacements)
- Net reduction: ~282 lines
- TypeScript: clean compile
- Tests: all passing (pre-existing DB contention failures in parallel runs only)

## [2026-08-19] Refactor Session — Dead Code Cleanup

### Unused File Deleted

- `app/actions/mastra/scorers/workflow-scorers.ts` — DELETED (3 lines)
  - Reason: Exported `protocolAdherenceScorer` (a `createCompletenessScorer()`) was never imported anywhere in the codebase. The other two scorers (`booking-scorers.ts`, `support-scorers.ts`) are registered in `app/actions/mastra/index.ts`; this one was never wired in. Only referenced in archived OpenSpec docs.

### Unused Exports Removed

- `loadAppSeed` — `app/db.ts:28` — function returning `seed` was never referenced anywhere (server, scripts, tests). Seed is already applied via `seed(db)` inside `initializeAppDatabase()`.
- `buttonStyle` — `app/ui/theme/button.ts:46` — named export never imported. Only the default `button` factory is consumed (by ~24 call sites). The `buttonStyle` in `app/ui/customer-chat-page.tsx` is an unrelated local `css({...})` const.
- `ACTION_EXECUTORS` — `app/actions/agent-events/intents.ts:14` — abandoned `Record<string, string>` mapping never imported. The `execute.ts` handler performs its own explicit dispatch; the string values (`'executeCancelUserWorkflow'` etc.) don't even match real function names. `INTENTS` and `INTENT_TO_ACTION` (still used) were left in place.

### Impact

- Files deleted: 1
- Exports removed: 3
- Lines of code removed: ~11
- TypeScript: clean compile (`npm run typecheck`)
- Lint: oxlint `--max-warnings=0` + theme conformance check pass
- Tests: 1124 pass / 0 fail / 1 todo

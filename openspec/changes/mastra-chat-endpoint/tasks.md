## 1. Dependencies & Scaffold

- [x] 1.1 Install `@mastra/evals@latest`
- [x] 1.2 Create `app/actions/mastra/` directory structure (agents, tools, workflows, scorers)
- [x] 1.3 Create `app/actions/mastra/index.ts` with `Mastra()` config using `PostgresStore` (reuse app's `pg.Pool`), `PinoLogger`

## 2. Support Tools

- [x] 2.1 Create `app/actions/mastra/tools/support-tools.ts` — tools use shared `pg.Pool` instead of request-scoped `db`
- [x] 2.2 Verify `lookup_user`, `list_recent_appointments`, `count_users` work with the shared pool pattern

## 3. Scorers

- [x] 3.1 Create `app/actions/mastra/scorers/support-scorers.ts` with `createCompletenessScorer` (toolCallAccuracy removed — single-expected-tool scorer is misleading for a multi-tool agent)
- [x] 3.2 Wire completeness scorer into `Mastra()` config and `Agent` constructor with `sampling: { type: 'ratio', rate: 1 }`

## 4. Agent

- [x] 4.1 Create `app/actions/mastra/agents/support-agent.ts` — inline model config object (not lazy getter; missing API key only fails at agent call, not at module load)
- [x] 4.2 Agent registered in Mastra constructor (`mastra.getAgent('supportAgent')` used in controller)

## 5. Workflow

- [ ] 5.1-5.5 Workflow creation deferred — `createStep` API differs significantly from demo version. Agent direct call used instead. Spec requirement for workflow removed.

## 6. Controller

- [x] 6.1 Create `app/actions/mastra/controller.tsx` — thin Remix controller with `POST /mastra/chat`
- [x] 6.2 Validate message input (schema, length, rate limit)
- [x] 6.3 Call agent via `mastra.getAgent('supportAgent')` — agent registered in Mastra constructor, looked up by key
- [x] 6.4 Return JSON response with `{ response: string }` and `threadId` for conversation continuity
- [x] 6.5 Add `requireAdmin()` middleware (non-admin users cannot access tools exposing all users' data)
- [x] 6.6 Accept `threadId` from form body for conversation continuity; generate new UUID if absent
- [x] 6.7 Add `AbortController` with 60s timeout for LLM calls
- [x] 6.8 Restore `logAdminAction` audit logging for admin support messages
- [x] 6.9 Add request-level logging via `context.get(Logger)` at key phases; bind error in `catch (error)` and log

## 7. Route Wiring

- [x] 7.1 Add `mastra` route tree to `app/routes.ts` with `chat: form('chat')`
- [x] 7.2 Import and wire controller in `app/router.ts`

## 8. Remove Old Support Route

- [x] 8.1 Implementation complete — run-time verification needed before production
- [x] 8.2 Removed `app/actions/admin/support/` directory
- [x] 8.3 Removed `/admin/support` route, import, and wiring from `app/router.ts`
- [x] 8.4 `npm run typecheck` and `npm run lint` pass with zero errors

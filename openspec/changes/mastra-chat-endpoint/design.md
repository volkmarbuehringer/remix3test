## Context

The app has `@mastra/core`, `@mastra/memory`, `@mastra/loggers`, `@mastra/libsql` installed but only uses them in one route (`/admin/support`). That route has documented issues: in-memory LibSQL storage, dual-writes to both Mastra Memory and a custom `chatlog` PostgreSQL table, a lazy singleton agent pattern, and no eval layer. Three other AI routes (`/ai/chat`, `/ai/agent`, `/ai/workflow`) bypass Mastra entirely using custom code (`generateText`, `ToolLoopAgent`, a custom AsyncGenerator workflow engine).

This design creates a new `/mastra/*` route tree that uses Mastra as the framework (not a library called from custom code), backed by `PostgresStore` sharing the app's existing `pg.Pool`. The existing `/admin/support` route and its Mastra config are replaced and removed. `/ai/*` routes remain untouched.

## Goals / Non-Goals

**Goals:**

- Create a new `/mastra/*` route tree with sub-routes for chat, agent, and workflow
- `/mastra/chat` uses Mastra `Agent` with `Memory` backed by `PostgresStore` — single source of truth
- No custom chatlog CRUD, no manual tool call extraction, no in-memory storage
- Agent declared in `Mastra()` constructor, not lazy singleton
- Scorers (`completeness`) on every agent run, stored in PostgreSQL (`toolCallAccuracy` removed — single-expected-tool scorer is misleading for a multi-tool agent)
- Support tools (`lookup_user`, `list_recent_appointments`, `count_users`) reusable across agents
- Same database, same pool as the rest of the app

**Non-Goals:**

- Migrating existing `/ai/*` routes (they stay as-is for a later change)
- Replacing the custom workflow engine (`app/workflows/engine.ts`) — that's a later change
- Building a UI for the Mastra endpoint — the API layer was built first, a chat UI added in follow-up
- Running a standalone Mastra production server process — Mastra primitives live inside Remix. (`npm run dev:mastra` starts the Mastra Studio dev UI only, not a production server.)

## Decisions

### Decision 1: Embedded Mastra (not standalone server)

**Chosen:** Mastra primitives used inside Remix controllers, not as a separate Hono/HTTP server.

**Rationale:** The `/admin/support` route already proves this works — import Mastra, create Agent, call `agent.generate()`. Adding `@mastra/hono` would mean running a second HTTP server inside the Remix process, duplicating auth middleware, and bridging two routing layers for no benefit.

**Alternatives considered:**

- Standalone `mastra dev` server on port 4111 → two processes, auth forwarding complexity, network overhead
- `@mastra/hono` adapter mounted under a Remix catch-all → two routing layers fighting over error handling

### Decision 2: PostgresStore reuses app's `pg.Pool`

**Chosen:** `new PostgresStore({ id: 'mastra', pool })` where `pool` is imported from `app/data/connection.ts`.

**Rationale:** The app already creates a `Pool` with `connectionString`, `max: 20`, `idleTimeoutMillis: 30000`, and error handlers. Creating a second pool wastes connections and duplicates config. When a pool is passed to `PostgresStore`, Mastra doesn't own the lifecycle — `store.close()` won't drain it.

**Consequence:** Mastra's `init()` auto-creates 8+ `mastra_*` tables alongside app tables. This is safe (idempotent `CREATE TABLE IF NOT EXISTS`, all `mastra_` prefix) but operators should be aware.

### Decision 3: Agent + Memory replaces chatlog dual-write

**Chosen:** `agent.generate(message, { memory: { thread, resource } })` is the single persistence point. No calls to `createConversation`, `appendMessage`, or the `chatlog` table.

**Rationale:** The current `/admin/support` controller stores every message twice — once via Mastra Memory (into LibSQL `:memory:`) and once into the PostgreSQL `chatlog` table. With `PostgresStore`, Memory persists to the same database. The `chatlog` table exists only for the old `/ai/*` routes; the new Mastra endpoint doesn't need it.

### Decision 4: Tools self-contained, not db-injected

**Chosen:** Tools import the pool directly or accept it at construction time — not per-request via the controller.

**Rationale:** The current `createSupportTools(db)` takes a `Database` from the request context, which ties tool construction to the request lifecycle. Mastra tools are singletons on the Agent. Tools that need DB access should get it via a shared module-level pool reference, not a request-scoped parameter.

### Decision 5: Scorers on every run (ratio: 1)

**Chosen:** `sampling: { type: 'ratio', rate: 1 }` for `completeness` only. `toolCallAccuracy` removed — a single-expected-tool scorer is misleading for a multi-tool agent where the expected tool depends on the query.

**Rationale:** Low-volume admin support queries (~dozens/day). The storage and eval cost is negligible. At higher volumes, reduce to `rate: 0.1` or switch to `type: 'interval'`.

### Decision 6: Workflow deferred — agent direct call used

**Chosen:** Agent direct call (`agent.generate()`) without a workflow wrapper. Workflow creation is deferred.

**Rationale:** The `createStep` + `createWorkflow` API differs from the demo version at implementation time. The `createStep` API in the current `@mastra/core` release uses different signatures and schema patterns than the demo, making integration risky without deeper framework familiarity. The flat `agent.generate()` with `maxSteps: 10` is sufficient for the support use case (read-only tools, single-turn or threaded conversation). Workflow can be added later when the Mastra workflow API stabilizes or when multi-step orchestration (classify → query → format) is explicitly needed.

**Consequence:** No `mastra_workflow_snapshot` entries for this agent. Step-level observability is limited to what Mastra's internal execution tracing provides.

## Risks / Trade-offs

- **Risk: PostgresStore.init() DDL runs on first use** → Mitigation: It's idempotent. If more control is needed, set `disableInit: true` and run `exportSchemas()` in a migration script.
- **Trade-off: Tools are singletons** — they can't reference request-scoped state (e.g., the current user). The support tools query data across all users; if per-user scoping is needed later, tools would need a `userId` parameter instead of reading from context.
- **Risk: `/mastra/*` routes bypass the audit-log** (the current support agent writes to `audit_log` via `logAdminAction`) → Mitigation: The workflow step that queries the database can call `logAdminAction` directly before returning its result. This keeps the audit trail without coupling the Agent to it.
- **Trade-off: Memory stores messages in PostgreSQL** — at high volume, `mastra_messages` could grow large. Mitigation: `PostgresStore` supports `retention` config for age-based pruning.

## Migration Plan

1. Install `@mastra/evals` (`pnpm add @mastra/evals@latest`)
2. Create `app/actions/mastra/index.ts` — `Mastra()` with `PostgresStore(pool)`, agents, scorers
3. Create `app/actions/mastra/tools/support-tools.ts` — extract from existing `app/actions/admin/support/mastra/tools/support-tools.ts`
4. Create `app/actions/mastra/scorers/support-scorers.ts` — `createToolCallAccuracyScorerCode` + `createCompletenessScorer`
5. Create `app/actions/mastra/agents/support-agent.ts` — `new Agent()` declared upfront
6. (Deferred) Create `app/actions/mastra/workflows/support-workflow.ts` — deferred until `createStep` API stabilizes
7. Create `app/actions/mastra/controller.tsx` — thin Remix controller
8. Add `mastra` route tree to `app/routes.ts`
9. Wire in `app/router.ts`
10. Verify `/mastra/chat` works and matches `/admin/support` behavior
11. Remove `/admin/support` route, controller, and `app/actions/admin/support/mastra/` directory
12. Remove `app/actions/admin/support/controller.tsx` import and router wiring from `app/router.ts`

Rollback: Restore deleted files and router wiring.

## Open Questions

- ~~Should `support-tools.ts` be shared between the old `/admin/support` and new `/mastra/chat`?~~ Resolved: old route is removed, no sharing needed.
- Schema name for Mastra tables — `mastra` schema or `public`? If `mastra`, the pool user needs `CREATE SCHEMA` permission.
- ~~Should the workflow be the primary path, or should the Agent-with-Memory be the primary path with the workflow as an optional layer?~~ **Resolved:** Workflow deferred (Decision 6). Agent direct call is the primary path.

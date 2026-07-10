## Why

The existing `/admin/support` route uses Mastra but with known issues: in-memory storage (data loss on restart), dual-write to a custom `chatlog` table, no eval layer, and a lazy singleton agent pattern. The rest of the AI surface (`/ai/*`) uses custom code that duplicates what Mastra provides natively. This change creates a dedicated `/mastra/*` route tree as the canonical Mastra endpoint, fixing the support agent's issues and establishing a clean pattern for future route migrations.

## What Changes

- **New** `/mastra/chat` route: pure Mastra Agent with Memory, no custom chatlog writes
- **New** `PostgresStore` Mastra config (reuses app's existing `pg.Pool`)
- **New** Agent registration in `Mastra()` constructor (not lazy singleton)
- **New** Scorers: `completeness` on every agent run (`toolCallAccuracy` removed — single-expected-tool scorer is misleading for a multi-tool agent)
- **New** Agent direct call (workflow deferred — `createStep` API differs from demo version at implementation time)
- **Remove** dual persistence: no more writing to both `chatlog` table and Mastra Memory
- **Remove** existing `/admin/support` route after `/mastra/chat` is verified (replaced by `/mastra/chat`)
- **Remove** existing mastra config under `app/actions/admin/support/mastra/` (replaced by `app/actions/mastra/`)
- **Keep** existing `/ai/*` routes — they migrate in a later change

## Capabilities

### New Capabilities

- `mastra-chat`: Pure Mastra chat endpoint at `/mastra/chat` with Agent, Memory (PostgresStore), and scorers. No workflow orchestration (deferred). No custom AI framework code.
- `mastra-support-tools`: Database query tools (`lookup_user`, `list_recent_appointments`, `count_users`) usable by any Mastra agent or workflow step.

### Modified Capabilities

- _(none — existing specs are unchanged)_

## Impact

- **Routes**: New `mastra` route tree in `app/routes.ts`, wired in `app/router.ts`
- **New files**: `app/actions/mastra/{index,controller,storage}.tsx`, `app/actions/mastra/agents/support-agent.ts`, `app/actions/mastra/tools/support-tools.ts`, `app/actions/mastra/scorers/support-scorers.ts`
- **Modified files**: `app/routes.ts`, `app/router.ts`
- **Dependencies**: `@mastra/pg` (already installed), `@mastra/evals` (to add)
- **Database**: New `mastra_*` tables created by `PostgresStore.init()` alongside existing tables — no migration needed
- **Breaking change**: `/admin/support` is replaced by `/mastra/chat` — any links/bookmarks to `/admin/support` need updating
- **Deleted**: `app/actions/admin/support/mastra/` directory and its controller (no longer needed)

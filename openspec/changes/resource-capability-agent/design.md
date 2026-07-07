## Context

Resources represent bookable entities (rooms, equipment, services) in the appointment management system. Each resource has:
- `name` — short name (e.g., "Raum 1")
- `description` — short description (e.g., "Behandlungsraum im EG")
- `capabilities` — NEW, detailed multiline text describing what this resource can do

The existing Mastra integration has a single `supportAgent` for admin operators, wired via `POST /mastra/chat` with 15 read-only tools. The agent uses `@mastra/core/agent` with `@mastra/memory` for thread persistence and `@mastra/pg` for storage.

There is no customer-facing agent, no customer chat route, and no mechanism for matching customer problem descriptions to resource capabilities.

## Goals / Non-Goals

**Goals:**
- Add a new `capabilities TEXT` column to the resources table with a migration
- Add a multiline `<textarea>` labeled "Capabilities" to the admin resource form, below the existing description field
- Add a GIN trigram index on `resources.capabilities` to enable efficient full-text / ILIKE search
- Create a new customer-facing Mastra agent (`customerAgent`) with a tool that searches resource capabilities and returns the best match
- Add a customer chat route at `/chat` (top-level, not under admin) that is accessible to any authenticated user (not just admins)
- The customer agent recommends the best-fitting resource but does NOT book appointments (future workflow)

**Non-Goals:**
- No appointment booking from the agent (out of scope for this change; the agent only recommends)
- No voice/STT/TTS integration
- No RAG or vector embeddings — ILIKE + trigram search is sufficient for this scale
- No multi-language support (German UI, agent responds in German)
- No migration of existing description data (existing `description` values remain as-is, unchanged)

## Decisions

### 1. New `capabilities` column instead of repurposing `description`
The resources table has `name` and `description` with distinct semantics. Creating a new `capabilities TEXT` column keeps the schema clean: `name` → resource name, `description` → short description, `capabilities` → detailed capability text. Migration: `ALTER TABLE resources ADD COLUMN IF NOT EXISTS capabilities TEXT DEFAULT ''`.

### 2. GIN trigram index instead of vector embeddings
At current scale (dozens of resources, not thousands), PostgreSQL's `pg_trgm` extension with a GIN index on `capabilities` provides fast ILIKE queries without adding a vector pipeline. If scale requires, this can be upgraded to `pgvector` embeddings later without changing the agent interface.

### 3. Separate agent instance instead of adding tools to supportAgent
The `supportAgent` is admin-only with read-all permissions. The `customerAgent` needs a narrower scope (only read resource capabilities) and different auth constraints. A separate agent keeps security boundaries clear.

### 4. Top-level `/chat` route not under `/admin`
Customer-facing chat should be outside the admin route tree. New controller at `app/actions/chat/controller.tsx`, new route in `app/routes.ts`, auth middleware requiring only login (not admin).

### 5. Same Mastra() orchestrator instance
The new `customerAgent` registers in the existing `Mastra()` constructor alongside `supportAgent`. No second Mastra instance needed. The agents share the same PostgresStore and logger.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Remix 3 App                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  app/routes.ts                                               │
│  ├── /mastra/chat    → supportAgent (admin-only)            │
│  └── /chat           → customerAgent (auth-only)            │
│                                                              │
│  app/actions/mastra/index.ts  ─── Mastra()                   │
│  ├── agents: { supportAgent, customerAgent }                 │
│  ├── storage: PostgresStore                                  │
│  └── logger: PinoLogger                                      │
│                                                              │
│  app/actions/chat/controller.tsx  (NEW)                      │
│  ├── GET /chat  → renders chat UI                            │
│  └── POST /chat → agent.generate(problem, tools)             │
│                                                              │
│  app/actions/mastra/agents/                                  │
│  ├── support-agent.ts  (existing)                            │
│  └── customer-agent.ts  (NEW)                                │
│      └── tools: searchResourcesByCapability                  │
│                                                              │
│  app/actions/mastra/tools/                                   │
│  ├── support-tools.ts  (existing, 15 tools)                  │
│  └── customer-tools.ts  (NEW, 1 tool)                        │
│      └── searchResourcesByCapability(problem: string)        │
│                                                              │
│  app/ui/                                                     │
│  ├── admin-mastra-chat-page.tsx  (existing)                  │
│  └── customer-chat-page.tsx  (NEW)                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

```
Customer describes problem:
  "I need a quiet room for a therapy session for 2 hours"

       │
       ▼
POST /chat → customerAgent.generate(problem, { maxSteps: 5 })

       │
       ▼
searchResourcesByCapability tool:
  SELECT id, name, description, capabilities FROM resources
  WHERE capabilities ILIKE '%quiet%' AND capabilities ILIKE '%therapy%' ...

       │
       ▼
Agent evaluates results, asks follow-up questions if ambiguous,
or recommends the best resource with reasoning.

       │
       ▼
Response rendered in customer chat UI:
  "Based on your needs, 'Raum 1' would be suitable. It's a quiet room..."
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| ILIKE search misses resources with synonyms (e.g., "silent" vs "quiet") | Add a `pg_trgm` GIN index for fuzzy matching; document that admins should use multiple keywords in capabilities |
| Customer asks the agent to book an appointment | Agent instructions explicitly forbid booking; future workflow will handle this |
| Existing `capabilities` column starts empty for all resources | Admins populate capabilities via the new admin form field; no auto-migration of existing data needed |
| Agent hallucinates resource capabilities not in the actual data | Agent is constrained to only answer from tool results; prompt instructs it to say "no matching resource" if nothing fits |
| Rate limiting needed for customer chat | Reuse the existing `chatRateLimiter` from `app/actions/mastra/controller.tsx` but make it configurable or instantiate a second instance with different window |

## Open Questions

- Should the customer agent respond in German or English? (System language is German, but the agent prompt can set this)
- Should the agent support follow-up refinement? (e.g., "actually I need it quieter" → re-sort results) — yes, via memory/thread continuation
- Should we seed some initial capability descriptions for existing resources?

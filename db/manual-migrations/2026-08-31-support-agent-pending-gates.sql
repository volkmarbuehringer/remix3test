-- Manual migration: support agent pending-gate index (2026-08-31)
--
-- db/schema.sql is a fresh-database bootstrap and never alters existing
-- tables, so this statement must be applied once to an existing database:
--
--   psql "$DATABASE_URL" -f db/manual-migrations/2026-08-31-support-agent-pending-gates.sql
--
-- Contents (matching the fresh-database definition in db/schema.sql):
--   Durable per-admin pointer to the support agent's currently pending gate
--   (a tool decision or an ask_user question), so reconnect can re-surface it
--   after a reload, browser change, or server restart.

BEGIN;

CREATE TABLE IF NOT EXISTS support_agent_pending_gates (
  admin_user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'suspended')),
  tool_call_id TEXT,
  tool_name TEXT,
  args JSONB,
  gate_type TEXT NOT NULL DEFAULT 'tool_decision' CHECK (gate_type IN ('tool_decision', 'question')),
  suspend_payload JSONB,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS support_agent_pending_gates_run_id_idx ON support_agent_pending_gates (run_id);

COMMIT;

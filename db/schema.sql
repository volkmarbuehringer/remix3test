-- Idempotent fresh-database bootstrap. DDL applies only to new/empty databases;
-- existing tables are never altered. Schema changes to existing DBs require
-- manual ALTER / DROP statements.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  verification_token TEXT,
  verification_expires BIGINT,
  password_reset_token TEXT,
  password_reset_expires BIGINT,
  token_version INTEGER NOT NULL DEFAULT 1,
  disabled_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS users_name_trgm_idx ON users USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_email_trgm_idx ON users USING GIN (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_password_reset_token_idx ON users (password_reset_token);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages (sender_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Viewer',
  status TEXT NOT NULL DEFAULT 'Active',
  registered BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS lists (
  id SERIAL PRIMARY KEY,
  list JSONB NOT NULL DEFAULT '[]',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- Add the title column and backfill from description only when the column is
-- newly added. On every subsequent boot the column already exists (CREATE TABLE
-- defines it for fresh DBs), so the UPDATE is skipped and an intentionally
-- cleared title ('') is never overwritten again.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lists' AND column_name = 'title'
  ) THEN
    ALTER TABLE lists ADD COLUMN title TEXT NOT NULL DEFAULT '';
    UPDATE lists SET title = description WHERE title = '' OR title IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lists_desc ON lists USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lists_title ON lists USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS lists_user_id_idx ON lists (user_id);
CREATE INDEX IF NOT EXISTS lists_created_at_id_idx ON lists (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS lists_user_created_at_id_idx ON lists (user_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Unbenannt',
  description TEXT NOT NULL,
  capabilities TEXT DEFAULT '',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resources_capabilities_trgm ON resources USING GIN (capabilities gin_trgm_ops);
CREATE INDEX IF NOT EXISTS resources_name_trgm_idx ON resources USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS resources_description_trgm_idx ON resources USING GIN (description gin_trgm_ops);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  date BIGINT NOT NULL,
  during int4range NOT NULL,
  start_min INTEGER GENERATED ALWAYS AS (lower(during)) STORED,
  end_min INTEGER GENERATED ALWAYS AS (upper(during)) STORED,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  -- Minutes-of-day bounds mirror the app-layer validation; the raw-SQL write
  -- paths bypass the data-table validators, so the database is the backstop.
  CONSTRAINT during_bounds CHECK (
    lower(during) >= 0 AND upper(during) <= 1440 AND lower(during) < upper(during)
  ),
  CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (
    resource_id WITH =,
    date WITH =,
    during WITH &&
  )
);

CREATE INDEX IF NOT EXISTS appointments_user_date_idx ON appointments (user_id, date);
CREATE INDEX IF NOT EXISTS appointments_resource_date_idx ON appointments (resource_id, date);
CREATE INDEX IF NOT EXISTS appointments_date_idx ON appointments (date);
CREATE INDEX IF NOT EXISTS appointments_title_trgm_idx ON appointments USING GIN (title gin_trgm_ops);

-- In-app booking notification inbox, scoped to the user who owns the
-- appointment. Type matches the Mastra workflow notification events
-- (confirmation, reminder, cancellation).
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('confirmation', 'reminder', 'cancellation')),
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  read_at BIGINT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_created_at_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS notifications_appointment_id_idx ON notifications (appointment_id);

CREATE TABLE IF NOT EXISTS appointtypes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS appointtypes_user_idx ON appointtypes (user_id);

CREATE TABLE IF NOT EXISTS appointoffering (
  id SERIAL PRIMARY KEY,
  day BIGINT NOT NULL,
  resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  during int4range NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  CONSTRAINT during_bounds CHECK (
    lower(during) >= 0 AND upper(during) <= 1440 AND lower(during) < upper(during)
  ),
  CONSTRAINT no_overlapping_offerings EXCLUDE USING GIST (
    resource_id WITH =,
    day WITH =,
    during WITH &&
  )
);

CREATE INDEX IF NOT EXISTS appointoffering_resource_day_idx ON appointoffering (resource_id, day);
CREATE INDEX IF NOT EXISTS appointoffering_day_idx ON appointoffering (day);

CREATE TABLE IF NOT EXISTS offering_configs (
  id SERIAL PRIMARY KEY,
  resource_id INTEGER NOT NULL UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
  rules JSONB NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_admin_idx ON audit_logs (admin_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action_type);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);

CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  size BIGINT NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS uploads_uploaded_by_idx ON uploads (uploaded_by);
CREATE INDEX IF NOT EXISTS uploads_created_at_idx ON uploads (created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL DEFAULT '{}',
  headers JSONB NOT NULL DEFAULT '{}',
  source_ip TEXT NOT NULL DEFAULT '',
  hermes_status TEXT,
  callback_response JSONB,
  callback_received_at BIGINT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS webhook_requests_created_at_idx ON webhook_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_requests_source_ip_idx ON webhook_requests (source_ip);
CREATE INDEX IF NOT EXISTS webhook_requests_callback_received_at_idx ON webhook_requests (callback_received_at);

CREATE TABLE IF NOT EXISTS api_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked_at BIGINT
);

CREATE INDEX IF NOT EXISTS api_tokens_token_hash_idx ON api_tokens (token_hash);
CREATE INDEX IF NOT EXISTS api_tokens_user_id_idx ON api_tokens (user_id);

CREATE TABLE IF NOT EXISTS mastra_workflow_snapshot (
  workflow_name TEXT NOT NULL,
  run_id TEXT NOT NULL,
  "resourceId" TEXT,
  snapshot JSONB NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdAtZ" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAtZ" TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workflow_name, run_id)
);

-- Durable per-admin pointer to the currently active workflow run. One row per
-- admin (upsert): the client loses currentRunId on reload, and the server's
-- workflowRunMap is process-local, so a suspended confirm gate would otherwise
-- be orphaned after a reload, browser change, or server restart. The row is a
-- pointer — the Mastra snapshot remains the source of truth — and is deleted
-- when the run finishes, errors, or is cancelled.
CREATE TABLE IF NOT EXISTS admin_active_runs (
  admin_user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'suspended')),
  step_id TEXT,
  suspend_payload JSONB,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_active_runs_run_id_idx ON admin_active_runs (run_id);

-- Durable ownership mapping for the public /chat agent runs. The Mastra run
-- is the source of truth (PostgresStoreVNext); this row is a run_id -> user
-- pointer so approve/decline/answer can verify ownership and survive a server
-- restart or scale-out without an in-memory stream store. Deleted when the
-- run reaches a terminal state (approve/decline/answer resolution); a TTL
-- bounds growth for runs abandoned while suspended.
CREATE TABLE IF NOT EXISTS chat_runs (
  run_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thread_id TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_runs_user_id_idx ON chat_runs (user_id);
CREATE INDEX IF NOT EXISTS chat_runs_thread_id_idx ON chat_runs (thread_id);

-- Durable per-admin pointer to the support agent's currently pending gate
-- (a tool decision or an ask_user question). One row per admin (upsert): the
-- client loses the run on reload, and the controller holds no in-memory state,
-- so a suspended approval/question would otherwise be orphaned after a reload,
-- a browser change, or a server restart. The row is a pointer — the Mastra run
-- snapshot remains the source of truth — and is deleted when the run finishes,
-- errors, or is cancelled. gate_type distinguishes a tool-decision gate from a
-- question gate so reconnect can re-render the right surface.
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

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
  role TEXT NOT NULL DEFAULT 'customer',
  email_verified INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS chatlog (
  id TEXT PRIMARY KEY,
  conversation JSONB NOT NULL DEFAULT '[]',
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS chatlog_created_at_idx ON chatlog (created_at);
CREATE INDEX IF NOT EXISTS chatlog_user_id_idx ON chatlog (user_id);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  params TEXT NOT NULL DEFAULT '{}',
  steps TEXT NOT NULL DEFAULT '[]',
  result TEXT,
  error TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  parent_run_id TEXT,
  chain_depth INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  completed_at BIGINT
);

CREATE INDEX IF NOT EXISTS workflow_runs_status_idx ON workflow_runs (status);
CREATE INDEX IF NOT EXISTS workflow_runs_created_at_idx ON workflow_runs (created_at);

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
  description TEXT NOT NULL DEFAULT '',
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lists_desc ON lists USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS lists_user_id_idx ON lists (user_id);

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
  token TEXT,
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

CREATE TABLE IF NOT EXISTS login (
  l_id SERIAL PRIMARY KEY,
  l_login TEXT NOT NULL,
  l_aktiv BOOLEAN NOT NULL DEFAULT true,
  l_gesperrt BOOLEAN NOT NULL DEFAULT false,
  l_password TEXT,
  l_tv INTEGER DEFAULT 0,
  l_letzte_login BIGINT
);

CREATE INDEX IF NOT EXISTS login_l_login_idx ON login (l_login);

CREATE TABLE IF NOT EXISTS nutzer (
  n_id SERIAL PRIMARY KEY,
  n_vorname TEXT,
  n_name TEXT,
  n_email TEXT,
  n_verpflichtung BOOLEAN NOT NULL DEFAULT false,
  n_lid INTEGER NOT NULL REFERENCES login(l_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS nutzer_n_email_idx ON nutzer (n_email);
CREATE INDEX IF NOT EXISTS nutzer_n_lid_idx ON nutzer (n_lid);

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

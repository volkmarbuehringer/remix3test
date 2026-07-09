import { pool } from './connection.ts'

export async function migrate(): Promise<void> {
  // Use advisory lock so concurrent worker processes don't race on DDL
  await pool.query(`SELECT pg_advisory_lock(287140921)`)
  try {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL DEFAULT 0
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)`)
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at BIGINT NOT NULL DEFAULT 0
  `)
  let emailVerifiedColumn = await pool.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email_verified'
  `)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 0`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires BIGINT`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires BIGINT`)
  await pool.query(`CREATE INDEX IF NOT EXISTS users_password_reset_token_idx ON users (password_reset_token)`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1`)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at BIGINT`)

  if (emailVerifiedColumn.rows.length === 0) {
    await pool.query(`UPDATE users SET email_verified = 1`)
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chatlog (
      id TEXT PRIMARY KEY,
      conversation JSONB NOT NULL DEFAULT '[]',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS chatlog_created_at_idx ON chatlog (created_at)`)
  await pool.query(`
    ALTER TABLE chatlog ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS chatlog_user_id_idx ON chatlog (user_id)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      params TEXT NOT NULL DEFAULT '{}',
      steps TEXT NOT NULL DEFAULT '[]',
      result TEXT,
      error TEXT,
      created_at BIGINT NOT NULL,
      completed_at BIGINT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      parent_run_id TEXT,
      chain_depth INTEGER NOT NULL DEFAULT 0
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS workflow_runs_status_idx ON workflow_runs (status)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS workflow_runs_created_at_idx ON workflow_runs (created_at)`)
  await pool.query(`ALTER TABLE workflow_runs DROP CONSTRAINT IF EXISTS workflow_runs_created_by_fkey`)
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'workflow_runs_created_by_fkey'
      ) THEN
        ALTER TABLE workflow_runs ADD CONSTRAINT workflow_runs_created_by_fkey
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages (sender_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at)`)
  await pool.query(`ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL`)
  await pool.query(`ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey`)
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_id_fkey'
      ) THEN
        ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Viewer',
      status TEXT NOT NULL DEFAULT 'Active',
      registered BIGINT NOT NULL
    )
  `)

  await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`)
  await pool.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`)
  await pool.query(`CREATE INDEX IF NOT EXISTS users_name_trgm_idx ON users USING GIN (name gin_trgm_ops)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS users_email_trgm_idx ON users USING GIN (email gin_trgm_ops)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lists (
      id SERIAL PRIMARY KEY,
      list JSONB NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_lists_desc ON lists USING GIN (description gin_trgm_ops)`)
  await pool.query(`ALTER TABLE lists ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`)
  await pool.query(`CREATE INDEX IF NOT EXISTS lists_user_id_idx ON lists (user_id)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resources (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Unbenannt',
      description TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `)
  await pool.query(`ALTER TABLE resources ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Unbenannt'`)
  await pool.query(`ALTER TABLE resources ADD COLUMN IF NOT EXISTS capabilities TEXT DEFAULT ''`)
  await pool.query(`DROP INDEX IF EXISTS idx_resources_capabilities_fts`)
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_resources_capabilities_trgm ON resources USING GIN (capabilities gin_trgm_ops)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resource_id INTEGER NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      date BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      during int4range NOT NULL,
      start_min INTEGER GENERATED ALWAYS AS (lower(during)) STORED,
      end_min INTEGER GENERATED ALWAYS AS (upper(during)) STORED,
      CONSTRAINT no_overlapping_seats EXCLUDE USING GIST (
        resource_id WITH =,
        date WITH =,
        during WITH &&
      )
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS appointments_user_date_idx ON appointments (user_id, date)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS appointments_resource_date_idx ON appointments (resource_id, date)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointtypes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS appointtypes_user_idx ON appointtypes (user_id)`)

  await pool.query(`
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
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS appointoffering_resource_day_idx ON appointoffering (resource_id, day)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS appointoffering_day_idx ON appointoffering (day)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS offering_configs (
      id SERIAL PRIMARY KEY,
      resource_id INTEGER NOT NULL UNIQUE REFERENCES resources(id) ON DELETE CASCADE,
      rules JSONB NOT NULL DEFAULT '{}',
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      admin_email TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details JSONB,
      created_at BIGINT NOT NULL
    )
  `)
  await pool.query(`ALTER TABLE audit_logs ALTER COLUMN admin_user_id DROP NOT NULL`)
  await pool.query(`ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_user_id_fkey`)
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_admin_user_id_fkey'
      ) THEN
        ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_admin_user_id_fkey
          FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS audit_logs_admin_idx ON audit_logs (admin_user_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action_type)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS uploads (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      data BYTEA NOT NULL,
      size BIGINT NOT NULL,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at BIGINT NOT NULL
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS uploads_uploaded_by_idx ON uploads (uploaded_by)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS uploads_created_at_idx ON uploads (created_at DESC)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payload JSONB NOT NULL DEFAULT '{}',
      token TEXT NOT NULL,
      headers JSONB NOT NULL DEFAULT '{}',
      source_ip TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL
    )
  `)
  await pool.query(`ALTER TABLE webhook_requests ALTER COLUMN token DROP NOT NULL`)
  await pool.query(`UPDATE webhook_requests SET token = NULL WHERE token IS NOT NULL`)
  await pool.query(`CREATE INDEX IF NOT EXISTS webhook_requests_created_at_idx ON webhook_requests (created_at DESC)`)
  await pool.query(`ALTER TABLE webhook_requests ADD COLUMN IF NOT EXISTS hermes_status TEXT`)
  await pool.query(`ALTER TABLE webhook_requests ADD COLUMN IF NOT EXISTS callback_response JSONB`)
  await pool.query(`ALTER TABLE webhook_requests ADD COLUMN IF NOT EXISTS callback_received_at BIGINT`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL,
      revoked_at BIGINT
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS api_tokens_token_hash_idx ON api_tokens (token_hash)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS login (
      l_id SERIAL PRIMARY KEY,
      l_login TEXT NOT NULL,
      l_aktiv BOOLEAN NOT NULL DEFAULT true,
      l_gesperrt BOOLEAN NOT NULL DEFAULT false,
      l_password TEXT,
      l_tv INTEGER DEFAULT 0,
      l_letzte_login BIGINT
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS login_l_login_idx ON login (l_login)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS nutzer (
      n_id SERIAL PRIMARY KEY,
      n_vorname TEXT,
      n_name TEXT,
      n_email TEXT,
      n_verpflichtung BOOLEAN NOT NULL DEFAULT false,
      n_lid INTEGER NOT NULL REFERENCES login(l_id) ON DELETE CASCADE
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS nutzer_n_email_idx ON nutzer (n_email)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS nutzer_n_lid_idx ON nutzer (n_lid)`)

  console.log('[DB] Tables created/verified')
  } finally {
    await pool.query(`SELECT pg_advisory_unlock(287140921)`)
  }
}

import { pool } from './connection.ts'

export async function migrate(): Promise<void> {
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
      created_by INTEGER REFERENCES users(id),
      parent_run_id TEXT,
      chain_depth INTEGER NOT NULL DEFAULT 0
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS workflow_runs_status_idx ON workflow_runs (status)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS workflow_runs_created_at_idx ON workflow_runs (created_at)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      content TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages (sender_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at)`)

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resources (
      id SERIAL PRIMARY KEY,
      description TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `)

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
      admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      admin_email TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details JSONB,
      created_at BIGINT NOT NULL
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS audit_logs_admin_idx ON audit_logs (admin_user_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action_type)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at)`)

  console.log('[DB] Tables created/verified')
}

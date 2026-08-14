import { createPostgresDatabase } from 'remix/data-table/postgres'
import { type MigrationDescriptor } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { Client, Pool } from 'pg'
import * as path from 'node:path'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required. Set it in .env')
}

const localeUrl =
  databaseUrl + (databaseUrl.includes('?') ? '&' : '?') + 'options=-c%20lc_messages%3Den_US.UTF-8'

// The pool is owned here (not constructed inside the driver) so it can be
// closed on shutdown and given an 'error' listener. pg-pool surfaces
// server-side terminations of idle connections (Postgres restart, test
// database drop) as an 'error' event on the pool; without a listener an
// unhandled 'error' event crashes the process. Operational query failures
// still reject through the query call itself.
const pool = new Pool({
  connectionString: localeUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
})

pool.on('error', (error) => {
  console.error('Database pool connection error:', error.message)
})

export const db = createPostgresDatabase(pool)

export const getMigrations = () =>
  loadMigrations(path.join(import.meta.dirname, '../../db/migrations'))

/**
 * Applies pending migrations on a dedicated `pg.Client` (not a pool slot) with
 * `statement_timeout: 0`, so slow or lock-hungry DDL never hits the pool's
 * 30s statement timeout or holds a pool connection away from app traffic.
 */
export async function migrateAppDatabase(migrations: MigrationDescriptor[]): Promise<void> {
  let client = new Client({ connectionString: localeUrl, statement_timeout: 0 })
  await client.connect()
  try {
    let migrationDb = createPostgresDatabase(client)
    await migrationDb.migrate(migrations)
  } finally {
    await client.end().catch(() => {})
  }
}

let appClosed = false
export async function closeAppDatabase(): Promise<void> {
  if (appClosed) return
  appClosed = true
  await pool.end().catch((err) => console.error('Error closing database pool:', err))
}

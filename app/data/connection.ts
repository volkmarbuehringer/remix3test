import { createDatabase } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table/postgres'
import { createMigrationRunner, type MigrationDescriptor } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { Client } from 'pg'
import * as path from 'node:path'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required. Set it in .env')
}

const localeUrl =
  databaseUrl + (databaseUrl.includes('?') ? '&' : '?') + 'options=-c%20lc_messages%3Den_US.UTF-8'

const adapter = createPostgresDatabaseAdapter({
  connectionString: localeUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
})

export const db = createDatabase(adapter)

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
    let migrationAdapter = createPostgresDatabaseAdapter(client)
    let runner = createMigrationRunner(migrationAdapter, migrations)
    await runner.up()
  } finally {
    await client.end().catch(() => {})
  }
}

let appClosed = false
export async function closeAppDatabase(): Promise<void> {
  if (appClosed) return
  appClosed = true
}

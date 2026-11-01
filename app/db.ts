import * as path from 'node:path'

import { Pool } from 'pg'
import type { MigrationDescriptor } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createPostgresDatabase } from 'remix/data-table/postgres'

import { isTest, requireEnv } from './config.ts'
import { seed } from './data/seed.ts'
import { startDatabaseMaintenance, stopDatabaseMaintenance } from './data/maintenance.ts'

const databaseUrl = requireEnv('DATABASE_URL')

const localeUrl =
  databaseUrl + (databaseUrl.includes('?') ? '&' : '?') + 'options=-c%20lc_messages%3Den_US.UTF-8'

// Caller-owned pool. node-postgres emits 'error' on the pool when an idle
// client's backend connection dies (restart, failover, network drop); without
// a listener that error escapes as an uncaught exception and crashes the
// process. createPostgresDatabase() accepts a queryable, so the pool is built
// here and the handler attached before any connection is made. Ownership note:
// the vendor driver never ends a supplied pool, so closeAppDatabase() must.
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

const migrationsDirectory = path.join(import.meta.dirname, '../db/migrations')

/**
 * The new runner's journal is deliberately distinct from the legacy
 * `data_table_migrations` table left behind by the pre-2026-08 migration
 * runner. Existing databases may still contain an old journal row whose
 * migration file no longer exists; a forward run treats that as an orphaned
 * entry and aborts. A fresh journal starts empty, the idempotent baseline
 * applies as a no-op, and the legacy table is simply ignored.
 */
export const migrationsJournalTable = 'app_migrations'

let cachedMigrations: MigrationDescriptor[] | undefined

/**
 * Applies pending SQL migrations through the `remix/data-table` runner.
 *
 * The runner journals each applied file and checksums its `up.sql`, so an
 * applied migration must never be edited (add a new directory instead). The
 * baseline is idempotent, which lets an existing database adopt the journal on
 * its first boot without manual "mark as applied" surgery. The Postgres driver
 * wraps the run in a database advisory lock, so concurrent cold boots and
 * test workers serialize instead of racing catalog DDL.
 */
async function applyAppMigrations(): Promise<void> {
  cachedMigrations ??= await loadMigrations(migrationsDirectory)
  await db.migrate(cachedMigrations, { journalTable: migrationsJournalTable })
}

export async function initializeAppDatabase(): Promise<void> {
  await applyAppMigrations()
  await seed(db)
  // Skip the background retention sweep under test. Every parallel worker (and
  // the global setup) calls this against the same ephemeral database, so the
  // immediate sweep races suites that deliberately seed rows past a retention
  // window (e.g. app/data/maintenance.test.ts) and deletes them before the test
  // can. The sweep functions are unit-tested directly against explicit windows.
  if (!isTest) {
    startDatabaseMaintenance(db)
  }
}

export async function closeAppDatabase(): Promise<void> {
  stopDatabaseMaintenance()
  await db.close()
  await pool.end()
}

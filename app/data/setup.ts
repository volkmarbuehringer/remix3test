export { db, closeAppDatabase } from './connection.ts'
import { Client } from 'pg'
import { db, getMigrations, migrateAppDatabase } from './connection.ts'
import { seed } from './seed.ts'

export async function initializeAppDatabase(): Promise<void> {
  await migrateAppDatabase(await getMigrations())
  await seed(db)
}

export async function resetTestDatabase(): Promise<void> {
  await dropAndRecreateDatabase()
  await migrateAppDatabase(await getMigrations())
  await seed(db)
}

/**
 * Destructively recreates the configured database from `template0`.
 *
 * The app pool is constructed with the adapter from a concrete `pg.Pool`, so
 * the adapter's config-based `wipe()` is unavailable here. Dropping with
 * `WITH (FORCE)` terminates any remaining app-pool backends; the pool's
 * 'error' listener swallows those terminations and the pool reconnects lazily
 * for the migration and seed that follow.
 */
async function dropAndRecreateDatabase(): Promise<void> {
  let databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL environment variable is required.')
  let url = new URL(databaseUrl)
  let database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  url.pathname = '/postgres'
  let maintenance = new Client({ connectionString: url.toString() })
  await maintenance.connect()
  try {
    await maintenance.query(`drop database if exists ${quoteIdentifier(database)} with (force)`)
    await maintenance.query(`create database ${quoteIdentifier(database)} template template0`)
  } finally {
    await maintenance.end().catch(() => {})
  }
}

function quoteIdentifier(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}

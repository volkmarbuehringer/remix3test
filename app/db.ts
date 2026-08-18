import * as path from 'node:path'
import { readFile } from 'node:fs/promises'

import { createPostgresDatabase } from 'remix/data-table/postgres'

import { seed } from './data/seed.ts'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required. Set it in .env')
}

const localeUrl =
  databaseUrl + (databaseUrl.includes('?') ? '&' : '?') + 'options=-c%20lc_messages%3Den_US.UTF-8'

export const db = createPostgresDatabase({
  connectionString: localeUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
})

export async function loadAppSchema() {
  return await readFile(path.join(import.meta.dirname, '../db/schema.sql'), 'utf8')
}

export function loadAppSeed() {
  return seed
}

const PG_EXTENSION_COLLISION = /duplicate key.*pg_extension/

async function applyAppSchema(): Promise<void> {
  let schema = await loadAppSchema()
  try {
    await db.executeScript(schema)
  } catch (error) {
    // Concurrent cold boot can race CREATE EXTENSION IF NOT EXISTS against
    // pg_extension. The script runs as one implicit transaction, so the loser
    // rolls back completely; retrying is a no-op on the winner's catalog.
    if (error instanceof Error && PG_EXTENSION_COLLISION.test(error.message)) {
      await db.executeScript(schema)
    } else {
      throw error
    }
  }
}

export async function initializeAppDatabase(): Promise<void> {
  await applyAppSchema()
  await seed(db)
}

export async function closeAppDatabase(): Promise<void> {
  await db.close()
}

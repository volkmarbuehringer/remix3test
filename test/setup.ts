import type * as AppModule from '../app/db.ts'
import { PostgresStoreVNext } from '@mastra/pg'
import { Pool } from 'pg'

let originalDatabaseUrl = ''
let adminDatabaseUrl = ''
let testDbName = ''

let appModule: typeof AppModule | undefined
let appClosed = false

const TEST_DB_PREFIX = 'newapp_test_'

// Orphaned test DBs never younger than this survive into the next run's setup
// (a run that is still alive created its DB after this cutoff). `globalTeardown`
// drops the current DB on a normal exit, so anything older is left over from an
// interrupted/crashed run and can be swept.
const STALE_DB_AGE_MS = 30 * 60 * 1000

async function forEachTestDb(action: (name: string) => Promise<void>) {
  let adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 1 })
  try {
    let { rows } = await adminPool.query<{ datname: string }>(
      `SELECT datname FROM pg_database WHERE datname LIKE $1`,
      [`${TEST_DB_PREFIX}%`],
    )
    for (let { datname } of rows) {
      await action(datname)
    }
  } finally {
    await adminPool.end()
  }
}

async function dropTestDb(name: string) {
  let adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 1 })
  try {
    await adminPool.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  } finally {
    await adminPool.end()
  }
}

async function sweepStaleTestDbs() {
  if (!adminDatabaseUrl) return
  let cutoff = Date.now() - STALE_DB_AGE_MS
  await forEachTestDb(async (datname) => {
    let suffix = datname.slice(TEST_DB_PREFIX.length)
    let startedAt = Number(suffix.slice(0, suffix.indexOf('_')))
    if (!Number.isFinite(startedAt) || startedAt < cutoff) {
      await dropTestDb(datname)
    }
  })
}

async function forceDropTestDb() {
  if (!testDbName || !adminDatabaseUrl) return
  await dropTestDb(testDbName)
}

/**
 * Creates Mastra's Postgres tables once, in the setup process.
 *
 * Mastra's PostgresStore auto-initializes its schema on first use. Every test
 * worker shares this database, so concurrent first uses race in the Postgres
 * catalog ("duplicate key value violates unique constraint
 * pg_class_relname_nsp_index") and intermittently fail memory calls such as
 * ensureChatThread's missing-thread recall. Initializing here, before workers
 * fork, makes their auto-init a no-op against an existing schema.
 *
 * The config mirrors app/actions/mastra/storage.ts (same store id and public
 * schema) so the tables match the ones the app's store looks for.
 */
async function initializeMastraStorage() {
  let url = process.env.DATABASE_URL!
  let localeUrl = url + (url.includes('?') ? '&' : '?') + 'options=-c%20lc_messages%3Den_US.UTF-8'
  let pool = new Pool({ connectionString: localeUrl, max: 1 })
  let observabilityPool = new Pool({ connectionString: localeUrl, max: 1 })
  let store = new PostgresStoreVNext({
    id: 'mastra',
    pool,
    observability: { pool: observabilityPool },
  })

  try {
    await store.init()
  } finally {
    await store.close().catch(() => {})
    await pool.end().catch(() => {})
    await observabilityPool.end().catch(() => {})
  }
}

export async function globalSetup() {
  process.loadEnvFile('./.env')
  process.env.NODE_ENV = 'test'

  originalDatabaseUrl = process.env.DATABASE_URL!
  if (!originalDatabaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  testDbName = `newapp_test_${Date.now()}_${process.pid}`

  let parsed = new URL(originalDatabaseUrl)
  parsed.pathname = '/postgres'
  adminDatabaseUrl = parsed.toString()

  // Drop orphaned test DBs from interrupted/crashed runs before creating the
  // fresh one so they never accumulate between runs.
  await sweepStaleTestDbs()

  let adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 1 })
  try {
    await adminPool.query(`CREATE DATABASE "${testDbName}"`)
  } finally {
    await adminPool.end()
  }

  parsed.pathname = `/${testDbName}`
  process.env.DATABASE_URL = parsed.toString()

  appModule = await import('../app/db.ts')
  try {
    // app/db.ts builds the driver from a caller-owned pool (so the pool can
    // attach an 'error' handler), which makes the config-only db.wipe()
    // unavailable. The test database was created fresh above; reset the
    // schema defensively in case this process ever reuses one.
    let testPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    try {
      await testPool.query('DROP SCHEMA IF EXISTS public CASCADE')
      await testPool.query('CREATE SCHEMA public')
    } finally {
      await testPool.end()
    }
    await appModule.initializeAppDatabase()
    await initializeMastraStorage()
  } catch (err) {
    console.error(`Setup failed for "${testDbName}":`, err)
    await appModule.closeAppDatabase().catch(() => {})
    appClosed = true
    await forceDropTestDb().catch(() => {})
    throw err
  }
}

export async function globalTeardown() {
  if (!appClosed) {
    try {
      await Promise.race([
        appModule?.closeAppDatabase().catch(() => {}) ?? Promise.resolve(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('pool.end() timed out after 5s')), 5000),
        ),
      ])
    } catch (err) {
      console.error('Error closing app database pool:', err)
    }
  }

  await forceDropTestDb()
}

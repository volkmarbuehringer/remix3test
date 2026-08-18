import type * as AppModule from '../app/db.ts'
import { Pool } from 'pg'

let originalDatabaseUrl = ''
let adminDatabaseUrl = ''
let testDbName = ''

let appModule: typeof AppModule | undefined
let appClosed = false

async function forceDropTestDb() {
  if (!testDbName || !adminDatabaseUrl) return
  let adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 1 })
  try {
    await adminPool.query(`DROP DATABASE IF EXISTS "${testDbName}" WITH (FORCE)`)
  } finally {
    await adminPool.end()
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
    await appModule.db.wipe()
    await appModule.initializeAppDatabase()
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

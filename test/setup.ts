import { Pool } from 'pg'

let originalDatabaseUrl = ''
let adminDatabaseUrl = ''
let testDbName = ''

export async function globalSetup() {
  process.env.NODE_ENV = 'test'
  process.loadEnvFile('./.env')

  originalDatabaseUrl = process.env.DATABASE_URL!
  if (!originalDatabaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  testDbName = `newapp_test_${Date.now()}_${process.pid}`

  // build the admin URL (postgres maintenance DB) once and reuse it
  let parsed = new URL(originalDatabaseUrl)
  parsed.pathname = '/postgres'
  adminDatabaseUrl = parsed.toString()

  // create the temp database
  let adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 1 })
  try {
    await adminPool.query(`CREATE DATABASE "${testDbName}"`)
  } finally {
    await adminPool.end()
  }

  // point DATABASE_URL to the new temp database
  parsed.pathname = `/${testDbName}`
  process.env.DATABASE_URL = parsed.toString()

  // run migration + seed on the temp database
  // this also creates the app pool from the updated DATABASE_URL
  try {
    let { initializeAppDatabase } = await import('../app/data/setup.ts')
    await initializeAppDatabase()
  } catch (err) {
    // drop the temp database if migration or seed fails
    let cleanupPool = new Pool({ connectionString: adminDatabaseUrl, max: 1 })
    try {
      await cleanupPool.query(`DROP DATABASE IF EXISTS "${testDbName}"`)
    } finally {
      await cleanupPool.end()
    }
    console.error(`Dropped temp database "${testDbName}" after setup failure`)
    throw err
  }
}

export async function globalTeardown() {
  // close the app pool first
  try {
    let { pool } = await import('../app/data/connection.ts')
    await pool.end()
  } catch (err) {
    console.error('Error closing database pool:', err)
  }

  // drop the temp database
  if (testDbName) {
    let adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 1 })
    try {
      await adminPool.query(`DROP DATABASE IF EXISTS "${testDbName}"`)
    } finally {
      await adminPool.end()
    }
  }
}

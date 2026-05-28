process.loadEnvFile('./.env')
import { Pool } from 'pg'
import { createDatabase } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table/postgres'

import { appointofferings, appointments, chatlog, clients, lists, messages, offeringConfigs, resources, users, workflowRuns } from './schema.ts'
import { hashPassword } from '../utils/password-hash.ts'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required. Set it in .env')
}

export const pool = new Pool({
  connectionString: databaseUrl,
})

const adapter = createPostgresDatabaseAdapter(pool)

export const db = createDatabase(adapter)

let initializePromise: Promise<void> | null = null

export async function initializeAppDatabase(): Promise<void> {
  if (!initializePromise) {
    initializePromise = initialize()
  }

  await initializePromise
}

export function closeAppDatabase(): void {
  pool.end().catch(() => {})
}

async function initialize(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at BIGINT NOT NULL
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)`)

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

  console.log('[DB] Tables created/verified')

  // Seed 2 demo users like my_app
  let usersCount = Number(await db.count(users))
  if (usersCount === 0) {
    await db.createMany(users, [
      {
        email: 'admin@newapp.com',
        password_hash: await hashPassword('admin123'),
        name: 'Admin User',
        role: 'admin',
        created_at: new Date('2024-01-15').getTime(),
      },
      {
        email: 'user@newapp.com',
        password_hash: await hashPassword('password123'),
        name: 'John Doe',
        role: 'customer',
        created_at: new Date('2024-03-01').getTime(),
      },
    ])
    console.log('✅ Seeded 2 users: admin@newapp.com / user@newapp.com')
  } else {
    console.log('ℹ️ Skipping seed, users already present')
  }

  // Seed demo messages
  let messagesCount = Number(await db.count(messages))
  if (messagesCount === 0) {
    let adminUser = await db.findOne(users, { where: { email: 'admin@newapp.com' } })
    if (adminUser) {
      await db.createMany(messages, [
        {
          sender_id: adminUser.id,
          content: 'Welcome to the newapp message board!',
          created_at: new Date('2025-01-01').getTime(),
        },
        {
          sender_id: adminUser.id,
          content: 'This is a public message from the admin team.',
          created_at: new Date('2025-01-02').getTime(),
        },
        {
          sender_id: adminUser.id,
          content: 'Stay tuned for more updates!',
          created_at: new Date('2025-01-03').getTime(),
        },
      ])
      console.log('✅ Seeded 3 demo messages')
    }
  } else {
    console.log('ℹ️ Skipping messages seed, messages already present')
  }

  // Seed demo client records (200 rows for the Client Lab)
  let clientsCount = Number(await db.count(clients))
  if (clientsCount === 0) {
    let clientRows = Array.from({ length: 200 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      role: (['Admin', 'Editor', 'Viewer'] as const)[i % 3],
      status: i % 4 === 0 ? 'Inactive' : 'Active',
      registered: Date.now() - i * 86400000 * 3,
    }))
    await db.createMany(clients, clientRows)
    console.log('✅ Seeded 200 clients')
  } else {
    console.log('ℹ️ Skipping client seed, clients already present')
  }

  // Seed resources
  let resourcesCount = Number(await db.count(resources))
  if (resourcesCount === 0) {
    await db.createMany(resources, [
      {
        description: 'resource1',
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        description: 'resource2',
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ])
    console.log('✅ Seeded 2 resources: resource1, resource2')
  } else {
    console.log('ℹ️ Skipping resource seed, resources already present')
  }

  // Seed offering configs for both resources
  let configsCount = Number(await db.count(offeringConfigs))
  if (configsCount === 0) {
    let allResources = await db.query(resources).orderBy('id', 'asc').all()
    for (let res of allResources) {
      let rules: Record<string, [number, number]> =
        res.description === 'resource2'
          ? { tuesday: [540, 1020], thursday: [540, 1080] }
          : { monday: [540, 1020], wednesday: [540, 1200] }
      await pool.query(
        `INSERT INTO offering_configs (resource_id, rules, created_at, updated_at)
         VALUES ($1, $2::jsonb, $3, $3)`,
        [res.id, JSON.stringify(rules), Date.now()],
      )
    }
    console.log(`✅ Seeded ${allResources.length} offering config(s)`)
  } else {
    console.log('ℹ️ Skipping offering config seed, configs already present')
  }

  // Seed demo offerings for the first resource (current week)
  let offeringsCount = Number(await db.count(appointofferings))
  if (offeringsCount === 0) {
    let firstResource = (await db.query(resources).orderBy('id', 'asc').all())[0]
    if (firstResource) {
      // Seed offering for each day of the current week: 8:00–18:00 Mon–Fri
      let now = new Date()
      let dayOfWeek = now.getUTCDay() || 7 // Mon=1 .. Sun=7
      let monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek + 1))
      let mondayMs = monday.getTime()

      for (let i = 0; i < 5; i++) {
        // Mon–Fri
        let dayMs = mondayMs + i * 86_400_000
        await pool.query(
          `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
           VALUES ($1::bigint, $2, int4range(480, 1080, '[)'), $3, $3)`,
          [dayMs, firstResource.id, Date.now()],
        )
      }
      console.log('✅ Seeded 5 demo offerings (Mon–Fri 8:00–18:00)')
    }
  } else {
    console.log('ℹ️ Skipping offering seed, offerings already present')
  }
}

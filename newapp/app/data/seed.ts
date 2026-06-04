import { db, pool } from './connection.ts'
import {
  appointofferings,
  clients,
  messages,
  offeringConfigs,
  resources,
  users,
} from './schema.ts'
import { hashPassword } from '../utils/password-hash.ts'

export async function seed(): Promise<void> {
  // Seed 2 demo users like my_app
  let usersCount = Number(await db.count(users))
  if (usersCount === 0) {
    await db.createMany(users, [
      {
        email: 'admin@newapp.com',
        password_hash: await hashPassword('admin123'),
        name: 'Admin User',
        role: 'admin',
        email_verified: 1,
        created_at: new Date('2024-01-15').getTime(),
      },
      {
        email: 'user@newapp.com',
        password_hash: await hashPassword('password123'),
        name: 'John Doe',
        role: 'customer',
        email_verified: 1,
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

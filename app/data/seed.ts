import { sql } from 'remix/data-table'
import type { Database } from 'remix/data-table'

import { appointofferings, clients, messages, offeringConfigs, resources, users } from './schema.ts'
import { hashPassword } from '../utils/password-hash.ts'
import { isUniqueViolation } from '../utils/db-errors.ts'

export async function seed(db: Database): Promise<void> {
  let usersCount = Number(await db.count(users))
  if (usersCount === 0) {
    let adminPassword = process.env.SEED_ADMIN_PASSWORD
    if (!adminPassword) {
      throw new Error(
        'SEED_ADMIN_PASSWORD environment variable is required for seeding. ' +
          'Set it in .env to a strong password (min 12 chars).',
      )
    }
    let userPassword = process.env.SEED_USER_PASSWORD
    if (!userPassword) {
      throw new Error(
        'SEED_USER_PASSWORD environment variable is required for seeding. ' +
          'Set it in .env to a strong password (min 12 chars).',
      )
    }
    try {
      await db.createMany(users, [
        {
          email: 'admin@newapp.com',
          password_hash: await hashPassword(adminPassword),
          name: 'Admin User',
          role: 'admin',
          email_verified: 1,
          token_version: 1,
          created_at: new Date('2024-01-15').getTime(),
        },
        {
          email: 'user@newapp.com',
          password_hash: await hashPassword(userPassword),
          name: 'John Doe',
          role: 'customer',
          email_verified: 1,
          token_version: 1,
          created_at: new Date('2024-03-01').getTime(),
        },
      ])
      console.log('✅ Seeded 2 default users')
    } catch (error) {
      if (isUniqueViolation(error)) {
        console.log('ℹ️ Skipping seed, users already present')
      } else {
        throw error
      }
    }
  } else {
    console.log('ℹ️ Skipping seed, users already present')
  }

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

  let clientsCount = Number(await db.count(clients))
  if (clientsCount === 0) {
    let clientRows = Array.from({ length: 200 }, (_, i) => {
      let role = (['Admin', 'Editor', 'Viewer'] as const)[i % 3]
      return {
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        ...(role !== undefined ? { role } : {}),
        status: i % 4 === 0 ? 'Inactive' : 'Active',
        registered: Date.now() - i * 86400000 * 3,
      }
    })
    await db.createMany(clients, clientRows)
    console.log('✅ Seeded 200 clients')
  } else {
    console.log('ℹ️ Skipping client seed, clients already present')
  }

  let resourcesCount = Number(await db.count(resources))
  if (resourcesCount === 0) {
    await db.createMany(resources, [
      {
        name: 'Raum 1',
        description: 'Hauptraum mit Beamer und Whiteboard',
        capabilities:
          'Großer Behandlungsraum im Erdgeschoss.\nGeeignet für: Einzeltherapie, Paarberatung, Gruppensitzungen bis 10 Personen.\nAusstattung: Beamer, Whiteboard, WLAN, flexible Bestuhlung.\nBarrierefrei zugänglich über Rampe.',
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        name: 'Raum 2',
        description: 'Nebenraum für Kleingruppen',
        capabilities:
          'Ruhiger Behandlungsraum im Obergeschoss.\nGeeignet für: Einzelgespräche, Kleingruppen bis 4 Personen, Meditationssitzungen.\nAusstattung: Bequeme Sitzmöbel, dimmbare Beleuchtung, Schalldämmung.\nNicht barrierefrei (kein Aufzug).',
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ])
    console.log('✅ Seeded 2 resources: Raum 1, Raum 2')
  } else {
    console.log('ℹ️ Skipping resource seed, resources already present')
  }

  let configsCount = Number(await db.count(offeringConfigs))
  if (configsCount === 0) {
    let allResources = await db.query(resources).orderBy('id', 'asc').all()
    for (let res of allResources) {
      let rules: Record<string, [number, number]> =
        res.name === 'Raum 2'
          ? { tuesday: [540, 1020], thursday: [540, 1080] }
          : { monday: [540, 1020], wednesday: [540, 1200] }
      let now = Date.now()
      await db.exec(sql`
        INSERT INTO offering_configs (resource_id, rules, created_at, updated_at)
        VALUES (${res.id}, ${JSON.stringify(rules)}::jsonb, ${now}, ${now})
      `)
    }
    console.log(`✅ Seeded ${allResources.length} offering config(s)`)
  } else {
    console.log('ℹ️ Skipping offering config seed, configs already present')
  }

  let offeringsCount = Number(await db.count(appointofferings))
  if (offeringsCount === 0) {
    let firstResource = (await db.query(resources).orderBy('id', 'asc').all())[0]
    if (firstResource) {
      let now = new Date()
      let dayOfWeek = now.getUTCDay() || 7
      let monday = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek + 1),
      )
      let mondayMs = monday.getTime()

      for (let i = 0; i < 5; i++) {
        let dayMs = mondayMs + i * 86_400_000
        let now = Date.now()
        await db.exec(sql`
          INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
          VALUES (${dayMs}::bigint, ${firstResource.id}, int4range(480, 1080, '[)'), ${now}, ${now})
        `)
      }
      console.log('✅ Seeded 5 demo offerings (Mon–Fri 8:00–18:00)')
    }
  } else {
    console.log('ℹ️ Skipping offering seed, offerings already present')
  }
}

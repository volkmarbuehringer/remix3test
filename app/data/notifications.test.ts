import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../db.ts'
import {
  createNotification,
  listUserNotifications,
  unreadCount,
  markRead,
  markAllRead,
  findNotification,
} from './notifications.ts'

async function createTestUser(): Promise<number> {
  let result = await db.exec(
    `INSERT INTO users (email, password_hash, name, role, email_verified, created_at, updated_at)
     VALUES ($1, 'x', 'Test User', 'customer', 1, $2, $2) RETURNING id`,
    [`notif-${Date.now()}-${Math.random()}@example.com`, Date.now()],
  )
  return Number(result.rows![0]!.id)
}

async function cleanupUser(userId: number): Promise<void> {
  await db.exec('DELETE FROM users WHERE id = $1', [userId])
}

describe('notifications data access', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('createNotification returns the created row with defaults', async () => {
    let userId = await createTestUser()
    try {
      let row = await createNotification(db, {
        userId,
        type: 'confirmation',
        title: 'Bestätigung',
        body: 'Ihr Termin wurde gebucht.',
      })
      assert.ok(row !== null, 'should return a row')
      assert.equal(row!.user_id, userId)
      assert.equal(row!.type, 'confirmation')
      assert.equal(row!.title, 'Bestätigung')
      assert.equal(row!.read_at, null)
      assert.ok(typeof row!.created_at === 'number')
    } finally {
      await cleanupUser(userId)
    }
  })

  it('listUserNotifications returns newest-first with pagination', async () => {
    let userId = await createTestUser()
    try {
      for (let i = 0; i < 3; i++) {
        await createNotification(db, { userId, type: 'reminder', title: `Reminder ${i}` })
        // Ensure a distinguishable created_at ordering
        await new Promise((r) => setTimeout(r, 2))
      }

      let page1 = await listUserNotifications(db, userId, { pageSize: 2 })
      assert.equal(page1.rows.length, 2)
      assert.equal(page1.hasMore, true)
      assert.ok(Number(page1.rows[0]!.created_at) >= Number(page1.rows[1]!.created_at))

      let page2 = await listUserNotifications(db, userId, { pageSize: 2, offset: 2 })
      assert.equal(page2.rows.length, 1)
      assert.equal(page2.hasMore, false)
      let ids1 = new Set(page1.rows.map((r) => r.id))
      assert.ok(page2.rows.every((r) => !ids1.has(r.id)))
    } finally {
      await cleanupUser(userId)
    }
  })

  it('unreadCount counts only unread notifications', async () => {
    let userId = await createTestUser()
    try {
      assert.equal(await unreadCount(db, userId), 0)
      await createNotification(db, { userId, type: 'cancellation', title: 'Storniert' })
      assert.equal(await unreadCount(db, userId), 1)

      let latest = (await listUserNotifications(db, userId, { pageSize: 1 })).rows[0]!
      let ok = await markRead(db, userId, latest.id)
      assert.equal(ok, true)
      assert.equal(await unreadCount(db, userId), 0)
    } finally {
      await cleanupUser(userId)
    }
  })

  it('markAllRead sets read_at on all unread and zeroes the count', async () => {
    let userId = await createTestUser()
    try {
      await createNotification(db, { userId, type: 'reminder', title: 'A' })
      await createNotification(db, { userId, type: 'cancellation', title: 'B' })
      let updated = await markAllRead(db, userId)
      assert.ok(updated >= 2)
      assert.equal(await unreadCount(db, userId), 0)
    } finally {
      await cleanupUser(userId)
    }
  })

  it('markRead is scoped: cannot mark another user’s notification', async () => {
    let a = await createTestUser()
    let b = await createTestUser()
    try {
      let row = await createNotification(db, { userId: b, type: 'reminder', title: 'Other' })
      assert.ok(row !== null)
      let ok = await markRead(db, a, row!.id)
      assert.equal(ok, false)
      assert.equal(await unreadCount(db, b), 1)
    } finally {
      await cleanupUser(a)
      await cleanupUser(b)
    }
  })

  it('findNotification only returns the owner’s row', async () => {
    let a = await createTestUser()
    let b = await createTestUser()
    try {
      let row = await createNotification(db, { userId: b, type: 'confirmation', title: 'T' })
      assert.ok(row !== null)
      assert.ok((await findNotification(db, row!.id, b)) !== null)
      assert.equal(await findNotification(db, row!.id, a), null)
    } finally {
      await cleanupUser(a)
      await cleanupUser(b)
    }
  })
})

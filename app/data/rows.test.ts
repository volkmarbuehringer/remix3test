import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'
import { sql } from 'remix/data-table'
import { z } from 'zod/v4'

import { db, initializeAppDatabase } from '../db.ts'
import { queryRows, queryRow, int8Aggregate, RawRowError } from './rows.ts'

async function createTestUser(): Promise<number> {
  let result = await db.exec(
    `INSERT INTO users (email, password_hash, name, role, email_verified, created_at, updated_at)
     VALUES ($1, 'x', 'Rows Test', 'customer', 1, $2, $2) RETURNING id`,
    [`rows-${Date.now()}-${Math.random()}@example.com`, Date.now()],
  )
  return Number(result.rows![0].id)
}

async function cleanupUser(userId: number): Promise<void> {
  await db.exec('DELETE FROM users WHERE id = $1', [userId])
}

const userRowSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
})

describe('queryRows / queryRow', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('queryRows returns typed rows for a multi-row query', async () => {
    let a = await createTestUser()
    let b = await createTestUser()
    try {
      let rows = await queryRows(
        db,
        sql`SELECT id, email, name FROM users WHERE id IN (${a}, ${b}) ORDER BY id`,
        userRowSchema,
      )
      assert.equal(rows.length, 2)
      assert.equal(rows[0].id, a)
      assert.equal(rows[1].id, b)
      assert.ok(typeof rows[0].email === 'string')
    } finally {
      await cleanupUser(a)
      await cleanupUser(b)
    }
  })

  it('queryRow returns the single matching row', async () => {
    let userId = await createTestUser()
    try {
      let row = await queryRow(
        db,
        sql`SELECT id, email, name FROM users WHERE id = ${userId}`,
        userRowSchema,
      )
      assert.ok(row !== undefined)
      assert.equal(row!.id, userId)
    } finally {
      await cleanupUser(userId)
    }
  })

  it('queryRow returns undefined when no rows match', async () => {
    let row = await queryRow(
      db,
      sql`SELECT id, email, name FROM users WHERE id = -1`,
      userRowSchema,
    )
    assert.equal(row, undefined)
  })

  it('queryRows throws RawRowError when a row violates the schema', async () => {
    let userId = await createTestUser()
    try {
      let badSchema = z.object({ id: z.string(), email: z.string(), name: z.string() })
      let threw = false
      try {
        await queryRows(db, sql`SELECT id, email, name FROM users WHERE id = ${userId}`, badSchema)
      } catch (error) {
        threw = true
        assert.ok(error instanceof RawRowError)
        assert.ok((error as Error).message.includes('users'))
      }
      assert.equal(threw, true)
    } finally {
      await cleanupUser(userId)
    }
  })

  it('int8Aggregate decodes an int8 aggregate to a number', async () => {
    let userId = await createTestUser()
    try {
      let rows = await queryRows(
        db,
        sql`SELECT COUNT(*) AS count, MIN(created_at) AS min_created FROM users WHERE id = ${userId}`,
        z.object({ count: int8Aggregate, min_created: int8Aggregate }),
      )
      assert.equal(rows.length, 1)
      assert.ok(typeof rows[0].count === 'number')
      assert.equal(rows[0].count, 1)
      assert.ok(typeof rows[0].min_created === 'number')
    } finally {
      await cleanupUser(userId)
    }
  })
})

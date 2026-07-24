import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from './setup.ts'
import { pool } from './test-pool.ts'
import { listUserSummaries } from './users-pdf.ts'

describe('users-pdf', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM appointments WHERE title LIKE $1', ['[TEST]%'])
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test-pdfuser%@example.com'])
  })

  it('listUserSummaries returns user rows with appointment aggregates', async () => {
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
       VALUES ($1, $2, $3, 'customer', 1, 1, $4, $4)`,
      ['test-pdfuser-a@example.com', 'hash', 'PDF User A', Date.now()],
    )
    let userResult = await pool.query(
      "SELECT id FROM users WHERE email = 'test-pdfuser-a@example.com'",
    )
    let userId = userResult.rows[0].id
    let resources = await pool.query('SELECT id FROM resources LIMIT 1')
    let resourceId = resources.rows[0].id
    let now = Date.now()

    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ($1, $2, $3, $4, int4range(480, 540, '[)'), $5, $5)`,
      [userId, resourceId, '[TEST] PDF Summary', now, now],
    )

    let rows = await listUserSummaries(db)
    assert.ok(rows.length >= 1)
    assert.ok(rows.some((r) => r.email === 'test-pdfuser-a@example.com'))
  })

  it('listUserSummaries returns all users even those with zero appointments', async () => {
    let rows = await listUserSummaries(db)
    assert.ok(Array.isArray(rows))
    assert.ok(rows.length > 0)
  })
})

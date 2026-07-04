import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase, pool } from './setup.ts'
import { listUserSummariesByDateRange } from './users-export.ts'

describe('users-export', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM appointments WHERE title LIKE $1', ['[TEST]%'])
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test-userexport%@example.com'])
  })

  it('listUserSummariesByDateRange returns matching users within range', async () => {
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
       VALUES ($1, $2, $3, 'customer', 1, 1, $4, $4)`,
      ['test-userexport-a@example.com', 'hash', 'Export A', Date.now()],
    )
    let userResult = await pool.query(
      "SELECT id FROM users WHERE email = 'test-userexport-a@example.com'",
    )
    let userId = userResult.rows[0].id
    let resources = await pool.query('SELECT id FROM resources LIMIT 1')
    let resourceId = resources.rows[0].id
    let apptDate = Date.now() + 100000
    let now = Date.now()

    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ($1, $2, $3, $4, int4range(480, 540, '[)'), $5, $5)`,
      [userId, resourceId, '[TEST] Export Appt', apptDate, now],
    )

    let rows = await listUserSummariesByDateRange(db, 0, apptDate + 1)
    assert.ok(rows.length >= 1)
    assert.ok(rows.some((r) => r.email === 'test-userexport-a@example.com'))
  })

  it('listUserSummariesByDateRange returns empty for range with no appointments', async () => {
    let rows = await listUserSummariesByDateRange(db, 1, 2)
    assert.equal(rows.length, 0)
  })
})

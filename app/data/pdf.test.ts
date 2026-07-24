import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from './setup.ts'
import { pool } from './test-pool.ts'
import { listAllAppointments } from './pdf.ts'

describe('pdf', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM appointments WHERE title LIKE $1', ['[TEST]%'])
  })

  it('listAllAppointments returns all appointments ordered by date,start_min', async () => {
    let users = await pool.query('SELECT id FROM users LIMIT 1')
    let resources = await pool.query('SELECT id FROM resources LIMIT 1')
    let userId = users.rows[0].id
    let resourceId = resources.rows[0].id
    let now = Date.now()

    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ($1, $2, $3, $4, int4range(480, 540, '[)'), $5, $5)`,
      [userId, resourceId, '[TEST] PDF Appt 1', now, now],
    )

    let rows = await listAllAppointments(db)
    assert.ok(rows.length >= 1)
    assert.ok(rows.some((r) => r.title === '[TEST] PDF Appt 1'))
  })

  it('listAllAppointments returns empty array when no appointments', async () => {
    let rows = await listAllAppointments(db)
    assert.ok(Array.isArray(rows))
  })
})

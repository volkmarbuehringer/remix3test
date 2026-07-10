import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase, pool } from './setup.ts'
import { listUserEmails, createAppointmentFromType } from './appointment.ts'

describe('appointment', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM appointments WHERE title LIKE $1', ['[TEST]%'])
    await pool.query('DELETE FROM appointtypes WHERE title LIKE $1', ['[TEST]%'])
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test-appt%@example.com'])
  })

  it('listUserEmails returns emails for given user ids', async () => {
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
       VALUES ($1, $2, $3, 'customer', 1, 1, $4, $4)`,
      ['test-appt-a@example.com', 'hash', 'Appt A', Date.now()],
    )
    let result = await pool.query("SELECT id FROM users WHERE email = 'test-appt-a@example.com'")
    let userId = result.rows[0].id

    let rows = await listUserEmails(db, [userId])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].email, 'test-appt-a@example.com')
  })

  it('listUserEmails returns empty array for nonexistent ids', async () => {
    let rows = await listUserEmails(db, [-1])
    assert.equal(rows.length, 0)
  })

  it('createAppointmentFromType creates appointment from appointtype', async () => {
    let userResult = await pool.query(
      "SELECT id FROM users WHERE email = 'test-appt-a@example.com'",
    )
    let userId: number
    if (userResult.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
         VALUES ($1, $2, $3, 'customer', 1, 1, $4, $4)`,
        ['test-appt-a@example.com', 'hash', 'Appt A', Date.now()],
      )
      let r = await pool.query("SELECT id FROM users WHERE email = 'test-appt-a@example.com'")
      userId = r.rows[0].id
    } else {
      userId = userResult.rows[0].id
    }

    let now = Date.now()
    await pool.query(
      `INSERT INTO appointtypes (user_id, title, created_at, updated_at)
       VALUES ($1, '[TEST] Type', $2, $2)`,
      [userId, now],
    )
    let typeResult = await pool.query("SELECT id FROM appointtypes WHERE title = '[TEST] Type'")
    let typeId = typeResult.rows[0].id
    let resources = await pool.query('SELECT id FROM resources LIMIT 1')
    let resourceId = resources.rows[0].id

    let apptId = await createAppointmentFromType(db, {
      date: now + 86400000,
      startMin: 480,
      now,
      typeId,
      userId,
      resourceId,
    })
    assert.ok(typeof apptId === 'number', 'should return new appointment id')
  })

  it('createAppointmentFromType returns undefined for nonexistent type', async () => {
    let result = await createAppointmentFromType(db, {
      date: Date.now() + 86400000,
      startMin: 480,
      now: Date.now(),
      typeId: -1,
      userId: 1,
      resourceId: 1,
    })
    assert.equal(result, undefined)
  })
})

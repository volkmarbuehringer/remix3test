import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from '../db.ts'
import { pool } from './test-pool.ts'
import {
  listResources,
  listAppointmentsNew,
  checkResourceExists,
  getAppointmentForDelete,
  createAppointmentRecord,
  getAppointmentRow,
  deleteAppointmentRecord,
} from './appointments.ts'

describe('appointments-new-queries', () => {
  let testUserId: number
  let testResourceId: number
  let apptDate: number

  before(async () => {
    await initializeAppDatabase()
    let userResult = await pool.query("SELECT id FROM users WHERE email = 'admin@newapp.com'")
    testUserId = userResult.rows[0].id
    let resourceResult = await pool.query('SELECT id FROM resources LIMIT 1')
    testResourceId = resourceResult.rows[0].id
    apptDate = Date.now() + 365 * 86_400_000
  })

  afterEach(async () => {
    await pool.query('DELETE FROM appointments WHERE title LIKE $1', ['[TEST]%'])
  })

  it('listResources returns resource rows ordered by name', async () => {
    let rows = await listResources(db)
    assert.ok(rows.length >= 1)
    assert.ok(rows.some((r) => Number(r.id) === testResourceId))
  })

  it('checkResourceExists returns true for existing resource', async () => {
    let exists = await checkResourceExists(db, testResourceId)
    assert.equal(exists, true)
  })

  it('checkResourceExists returns false for nonexistent resource', async () => {
    let exists = await checkResourceExists(db, -1)
    assert.equal(exists, false)
  })

  it('createAppointmentRecord and getAppointmentRow roundtrip', async () => {
    let id = await createAppointmentRecord(db, {
      userId: testUserId,
      resourceId: testResourceId,
      title: '[TEST] New Appt',
      dayMs: apptDate,
      during: '[480,540)',
      now: Date.now(),
    })
    assert.ok(typeof id === 'number')

    let row = await getAppointmentRow(db, String(id), testUserId)
    assert.ok(row !== undefined)
    assert.equal(row!.start_min, 480)
  })

  it('getAppointmentRow returns undefined for nonexistent id', async () => {
    let row = await getAppointmentRow(db, '-1', testUserId)
    assert.equal(row, undefined)
  })

  it('getAppointmentRow returns undefined for wrong user', async () => {
    let id = await createAppointmentRecord(db, {
      userId: testUserId,
      resourceId: testResourceId,
      title: '[TEST] Wrong User',
      dayMs: apptDate,
      during: '[480,540)',
      now: Date.now(),
    })
    let row = await getAppointmentRow(db, String(id), -1)
    assert.equal(row, undefined)
  })

  it('getAppointmentForDelete returns appointment for valid id+user', async () => {
    let id = await createAppointmentRecord(db, {
      userId: testUserId,
      resourceId: testResourceId,
      title: '[TEST] For Delete',
      dayMs: apptDate,
      during: '[480,540)',
      now: Date.now(),
    })
    let appt = await getAppointmentForDelete(db, String(id), testUserId)
    assert.ok(appt !== undefined)
    assert.equal(appt!.title, '[TEST] For Delete')
  })

  it('getAppointmentForDelete returns undefined for wrong user', async () => {
    let id = await createAppointmentRecord(db, {
      userId: testUserId,
      resourceId: testResourceId,
      title: '[TEST] Delete Wrong User',
      dayMs: apptDate,
      during: '[480,540)',
      now: Date.now(),
    })
    let appt = await getAppointmentForDelete(db, String(id), -1)
    assert.equal(appt, undefined)
  })

  it('deleteAppointmentRecord deletes owned appointment', async () => {
    let id = await createAppointmentRecord(db, {
      userId: testUserId,
      resourceId: testResourceId,
      title: '[TEST] To Delete',
      dayMs: apptDate,
      during: '[480,540)',
      now: Date.now(),
    })
    let deleted = await deleteAppointmentRecord(db, String(id), testUserId)
    assert.equal(deleted, true)

    let row = await getAppointmentRow(db, String(id), testUserId)
    assert.equal(row, undefined)
  })

  it('deleteAppointmentRecord returns false for unowned appointment', async () => {
    let id = await createAppointmentRecord(db, {
      userId: testUserId,
      resourceId: testResourceId,
      title: '[TEST] Delete Unauthorized',
      dayMs: apptDate,
      during: '[480,540)',
      now: Date.now(),
    })
    let deleted = await deleteAppointmentRecord(db, String(id), -1)
    assert.equal(deleted, false)
  })

  it('deleteAppointmentRecord returns false for nonexistent appointment', async () => {
    let deleted = await deleteAppointmentRecord(db, '-1', testUserId)
    assert.equal(deleted, false)
  })

  it('listAppointmentsNew returns paginated results for user', async () => {
    for (let i = 0; i < 3; i++) {
      await createAppointmentRecord(db, {
        userId: testUserId,
        resourceId: testResourceId,
        title: `[TEST] New Appt ${i}`,
        dayMs: apptDate,
        during: `[${480 + i * 60},${540 + i * 60})`,
        now: Date.now(),
      })
    }

    let result = await listAppointmentsNew(db, {
      userId: testUserId,
      offset: 0,
      pageSize: 10,
      column: 'a.id',
      direction: 'asc',
    })
    assert.ok(result.rows.length >= 3)
  })

  it('listAppointmentsNew returns empty for user with no appointments', async () => {
    let result = await listAppointmentsNew(db, {
      userId: -1,
      offset: 0,
      pageSize: 10,
      column: 'a.id',
      direction: 'asc',
    })
    assert.equal(result.rows.length, 0)
    assert.equal(result.hasMore, false)
  })

  it('listAppointmentsNew respects status=expired filter', async () => {
    let pastDate = Date.now() - 365 * 86_400_000
    await createAppointmentRecord(db, {
      userId: testUserId,
      resourceId: testResourceId,
      title: '[TEST] Past Appt',
      dayMs: pastDate,
      during: '[480,540)',
      now: Date.now(),
    })

    let result = await listAppointmentsNew(db, {
      userId: testUserId,
      offset: 0,
      pageSize: 10,
      column: 'a.id',
      direction: 'asc',
      status: 'expired',
    })
    assert.ok(result.rows.length >= 1)
    assert.ok(result.rows.some((r) => r.title === '[TEST] Past Appt'))
  })
})

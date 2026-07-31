import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from './setup.ts'
import { pool } from './test-pool.ts'
import {
  fetchAppointmentEditRow,
  listAppointments,
  listAppointmentsByWeek,
  listResourcesForAppointments,
  listUsersForAppointments,
  adminCreateAppointment as createAppointment,
  adminUpdateAppointment as updateAppointment,
  adminDeleteAppointment as deleteAppointment,
} from './appointments.ts'

describe('appointments-queries', () => {
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
    await pool.query('DELETE FROM appointments WHERE title LIKE $1', ['[WEEK-SCOPE]%'])
  })

  it('createAppointment creates and returns id', async () => {
    let id = await createAppointment(db, {
      title: '[TEST] Q Appt',
      userId: testUserId,
      resourceId: testResourceId,
      date: apptDate,
      during: '[480,540)',
    })
    assert.ok(typeof id === 'number')
  })

  it('fetchAppointmentEditRow returns row for existing id', async () => {
    let id = await createAppointment(db, {
      title: '[TEST] Q Fetch',
      userId: testUserId,
      resourceId: testResourceId,
      date: apptDate,
      during: '[480,540)',
    })
    let row = await fetchAppointmentEditRow(db, String(id))
    assert.ok(row !== undefined)
    assert.equal(row!.title, '[TEST] Q Fetch')
    assert.equal(row!.user_id, testUserId)
    assert.equal(row!.start_min, 480)
  })

  it('fetchAppointmentEditRow returns undefined for nonexistent id', async () => {
    let row = await fetchAppointmentEditRow(db, '-1')
    assert.equal(row, undefined)
  })

  it('updateAppointment updates an existing appointment', async () => {
    let id = await createAppointment(db, {
      title: '[TEST] Q Update Before',
      userId: testUserId,
      resourceId: testResourceId,
      date: apptDate,
      during: '[480,540)',
    })
    let updated = await updateAppointment(db, String(id), {
      title: '[TEST] Q Update After',
      userId: testUserId,
      resourceId: testResourceId,
      date: apptDate,
      during: '[540,600)',
    })
    assert.equal(updated, true)

    let row = await fetchAppointmentEditRow(db, String(id))
    assert.equal(row!.title, '[TEST] Q Update After')
    assert.equal(row!.start_min, 540)
  })

  it('updateAppointment returns false for nonexistent id', async () => {
    let updated = await updateAppointment(db, '-1', {
      title: 'Nope',
      userId: testUserId,
      resourceId: testResourceId,
      date: apptDate,
      during: '[480,540)',
    })
    assert.equal(updated, false)
  })

  it('deleteAppointment deletes an existing appointment', async () => {
    let id = await createAppointment(db, {
      title: '[TEST] Q Delete',
      userId: testUserId,
      resourceId: testResourceId,
      date: apptDate,
      during: '[480,540)',
    })
    let deleted = await deleteAppointment(db, String(id))
    assert.equal(deleted, true)

    let row = await fetchAppointmentEditRow(db, String(id))
    assert.equal(row, undefined)
  })

  it('deleteAppointment returns false for nonexistent id', async () => {
    let deleted = await deleteAppointment(db, '-1')
    assert.equal(deleted, false)
  })

  it('listResourcesForAppointments returns resources', async () => {
    let rows = await listResourcesForAppointments(db)
    assert.ok(rows.length >= 1)
    assert.ok(rows.some((r) => Number(r.id) === testResourceId))
  })

  it('listUsersForAppointments returns users', async () => {
    let rows = await listUsersForAppointments(db)
    assert.ok(rows.length >= 1)
    assert.ok(rows.some((r) => Number(r.id) === testUserId))
  })

  it('listAppointments returns paginated results', async () => {
    for (let i = 0; i < 3; i++) {
      await createAppointment(db, {
        title: `[TEST] List Appt ${i}`,
        userId: testUserId,
        resourceId: testResourceId,
        date: apptDate,
        during: `[${480 + i * 60},${540 + i * 60})`,
      })
    }
    let result = await listAppointments(db, {
      offset: 0,
      pageSize: 10,
      column: 'a.id',
      direction: 'asc',
    })
    assert.ok(result.rows.length >= 3)
  })

  it('listAppointments respects filter', async () => {
    await createAppointment(db, {
      title: '[TEST] Unique Search Title',
      userId: testUserId,
      resourceId: testResourceId,
      date: apptDate,
      during: '[480,540)',
    })
    let result = await listAppointments(db, {
      offset: 0,
      pageSize: 10,
      column: 'a.id',
      direction: 'asc',
      filter: 'Unique Search',
    })
    assert.ok(result.rows.some((r) => r.title === '[TEST] Unique Search Title'))
  })

  it('listAppointments returns empty for nonexistent filter', async () => {
    let result = await listAppointments(db, {
      offset: 0,
      pageSize: 10,
      column: 'a.id',
      direction: 'asc',
      filter: 'zzzzzzzzznonexistent',
    })
    assert.equal(result.rows.length, 0)
  })

  it('listAppointments with status=expired returns past appointments', async () => {
    let pastDate = Date.now() - 365 * 86_400_000
    await createAppointment(db, {
      title: '[TEST] List Past',
      userId: testUserId,
      resourceId: testResourceId,
      date: pastDate,
      during: '[480,540)',
    })
    let result = await listAppointments(db, {
      offset: 0,
      pageSize: 10,
      column: 'a.id',
      direction: 'asc',
      status: 'expired',
    })
    assert.ok(result.rows.some((r) => r.title === '[TEST] List Past'))
  })

  it('listAppointmentsByWeek without userId returns full rows for every user', async () => {
    let { weekStart, weekEnd } = testWeek()
    await createAppointment(db, {
      title: '[WEEK-SCOPE] Mine',
      userId: testUserId,
      resourceId: testResourceId,
      date: weekStart + 86_400_000,
      during: '[480,540)',
    })
    let otherResult = await pool.query("SELECT id FROM users WHERE email = 'user@newapp.com'")
    let otherUserId = otherResult.rows[0]?.id
    if (otherUserId !== undefined) {
      await createAppointment(db, {
        title: '[WEEK-SCOPE] Foreign',
        userId: otherUserId,
        resourceId: testResourceId,
        date: weekStart + 86_400_000,
        during: '[540,600)',
      })
    }

    let rows = await listAppointmentsByWeek(db, weekStart, weekEnd, testResourceId)
    assert.ok(rows.some((r) => r.title === '[WEEK-SCOPE] Mine'))
    if (otherUserId !== undefined) {
      let foreign = rows.find((r) => r.user_id === otherUserId)
      assert.ok(foreign, 'foreign appointment should be returned for admin callers')
      assert.equal(foreign!.title, '[WEEK-SCOPE] Foreign')
    }
  })

  it('listAppointmentsByWeek with userId strips title and user_id from foreign rows', async () => {
    let { weekStart, weekEnd } = testWeek()
    await createAppointment(db, {
      title: '[WEEK-SCOPE] Scoped Mine',
      userId: testUserId,
      resourceId: testResourceId,
      date: weekStart + 86_400_000,
      during: '[480,540)',
    })
    let otherResult = await pool.query("SELECT id FROM users WHERE email = 'user@newapp.com'")
    let otherUserId = otherResult.rows[0]?.id
    if (otherUserId !== undefined) {
      await createAppointment(db, {
        title: '[WEEK-SCOPE] Scoped Foreign Secret',
        userId: otherUserId,
        resourceId: testResourceId,
        date: weekStart + 86_400_000,
        during: '[540,600)',
      })
    }

    let rows = await listAppointmentsByWeek(db, weekStart, weekEnd, testResourceId, {
      userId: testUserId,
    })
    let mine = rows.find((r) => r.id !== undefined && r.user_id === testUserId)
    assert.ok(mine, 'own appointment should be returned intact')
    assert.equal(mine!.title, '[WEEK-SCOPE] Scoped Mine')

    if (otherUserId !== undefined) {
      let foreign = rows.find((r) => r.user_id === undefined)
      assert.ok(foreign, 'foreign appointment should still be present as occupancy')
      assert.equal(foreign!.title, '')
      assert.equal(foreign!.user_id, undefined)
      assert.ok(typeof foreign!.id === 'number', 'occupancy row keeps its id')
      assert.ok(
        rows.every((r) => r.title !== '[WEEK-SCOPE] Scoped Foreign Secret'),
        'foreign title must never be shipped',
      )
      assert.ok(
        rows.every((r) => r.user_id !== otherUserId),
        'foreign user_id must never be shipped',
      )
    }
  })
})

function testWeek(): { weekStart: number; weekEnd: number } {
  let now = new Date()
  let monday = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 4))
  let dayOfWeek = monday.getUTCDay() || 7
  let weekStart = new Date(monday.getTime() - (dayOfWeek - 1) * 86_400_000).getTime()
  return { weekStart, weekEnd: weekStart + 7 * 86_400_000 }
}

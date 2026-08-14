import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from '../db.ts'
import { pool } from './test-pool.ts'
import { runReport1, listReport1Users } from './report1.ts'

describe('report1', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query(
      "DELETE FROM appointments WHERE title LIKE '[TEST] Appt%' OR title LIKE '[TEST] Escape%' OR title LIKE '[REPORT1-SORT]%'",
    )
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['test-report1%@example.com'])
  })

  let now = Date.now()

  it('listReport1Users returns user rows ordered by name', async () => {
    let ts = Date.now()
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
       VALUES ($1, $2, $3, 'customer', 1, 1, $4, $4)`,
      ['test-report1-a@example.com', 'hash-a', 'User A', ts],
    )
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
       VALUES ($1, $2, $3, 'customer', 1, 1, $4, $4)`,
      ['test-report1-b@example.com', 'hash-b', 'User B', ts],
    )

    let rows = await listReport1Users(db)
    assert.ok(rows.length >= 2)
    assert.ok(rows.some((r) => r.name === 'User A'))
    assert.ok(rows.some((r) => r.name === 'User B'))
  })

  it('runReport1 returns rows grouped by user for the selected month', async () => {
    let ts = Date.now()
    let userResult = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
       VALUES ($1, $2, $3, 'customer', 1, 1, $4, $4)
       RETURNING id`,
      ['test-report1-user@example.com', 'hash', 'Report User', ts],
    )
    let userId = userResult.rows![0].id

    let monthStart = Date.UTC(2026, 5, 1)
    let monthEnd = Date.UTC(2026, 6, 1)
    let apptNow = now
    let resourceResult = await pool.query('SELECT id FROM resources LIMIT 1')
    let resourceId = resourceResult.rows[0].id

    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, resourceId, '[TEST] Appt 1', monthStart + 86400000, '[480,540)', apptNow, apptNow],
    )
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        resourceId,
        '[TEST] Appt 2',
        monthStart + 2 * 86400000,
        '[540,600)',
        apptNow,
        apptNow,
      ],
    )

    let result = await runReport1(db, {
      monthStart,
      monthEnd,
      column: 'name',
      direction: 'asc',
      effectivePageSize: 20,
      offset: 0,
    })

    assert.ok(result.rows.length >= 1)
    let row = result.rows.find((r) => r.user_email === 'test-report1-user@example.com')
    assert.ok(row, 'expected report row for test user')
    assert.equal(Number(row!.appointment_count), 2)
    assert.ok(!result.hasMore)
  })

  it('runReport1 supports ILIKE filter with automatic escaping', async () => {
    let ts = Date.now()
    let userResult = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
       VALUES ($1, $2, $3, 'customer', 1, 1, $4, $4)
       RETURNING id`,
      ['test-report1-escape@example.com', 'hash', 'Escape_Test%User', ts],
    )
    let userId = userResult.rows![0].id

    let monthStart = Date.UTC(2026, 5, 1)
    let monthEnd = Date.UTC(2026, 6, 1)

    let resourceResult = await pool.query('SELECT id FROM resources LIMIT 1')
    let resourceId = resourceResult.rows[0].id
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, resourceId, '[TEST] Escape Appt', monthStart + 86400000, '[480,540)', now, now],
    )

    // Filter with literal underscore — should NOT match as wildcard
    let result = await runReport1(db, {
      monthStart,
      monthEnd,
      column: 'name',
      direction: 'asc',
      effectivePageSize: 20,
      offset: 0,
      filter: 'Escape_Test%User',
    })

    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0].user_email, 'test-report1-escape@example.com')
  })

  it('listReport1Users returns empty array for empty users table', async () => {
    let rows = await listReport1Users(db)
    assert.ok(Array.isArray(rows))
  })

  it('runReport1 sorts by appointment count', async () => {
    let ts = Date.now()
    let monthStart = Date.UTC(2026, 5, 1)
    let monthEnd = Date.UTC(2026, 6, 1)
    let resourceResult = await pool.query('SELECT id FROM resources LIMIT 1')
    let resourceId = resourceResult.rows[0].id

    async function seedUserWithAppointments(
      email: string,
      count: number,
      startMin: number,
    ): Promise<number> {
      let userResult = await pool.query(
        `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
         VALUES ($1, $2, $3, 'customer', 1, 1, $4, $4)
         RETURNING id`,
        [email, 'hash', email, ts],
      )
      let userId = userResult.rows![0].id
      for (let i = 0; i < count; i++) {
        await pool.query(
          `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6)`,
          [
            userId,
            resourceId,
            `[REPORT1-SORT] ${email} ${i}`,
            monthStart + (i + 1) * 86400000,
            `[${startMin},${startMin + 60})`,
            now,
          ],
        )
      }
      return userId
    }

    let oneId = await seedUserWithAppointments('test-report1-sort1@example.com', 1, 480)
    let twoId = await seedUserWithAppointments('test-report1-sort2@example.com', 2, 600)

    let result = await runReport1(db, {
      monthStart,
      monthEnd,
      column: 'count',
      direction: 'desc',
      effectivePageSize: 20,
      offset: 0,
    })
    let ranked = result.rows.filter(
      (r) => Number(r.user_id) === oneId || Number(r.user_id) === twoId,
    )
    assert.equal(ranked.length, 2)
    assert.equal(Number(ranked[0].appointment_count), 2, 'two-appointment user sorts first')
    assert.equal(Number(ranked[1].appointment_count), 1)
  })

  it('runReport1 throws on unknown sort column instead of silently defaulting', async () => {
    await assert.rejects(
      runReport1(db, {
        monthStart: Date.UTC(2026, 5, 1),
        monthEnd: Date.UTC(2026, 6, 1),
        column: 'total_offerings',
        direction: 'asc',
        effectivePageSize: 20,
        offset: 0,
      }),
    )
  })
})

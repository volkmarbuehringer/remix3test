import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { db, initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { listResources } from '../../data/resources.ts'
import { routes } from '../../routes.ts'

const BASE = 'https://remix.run'
const APPT_URL = `${BASE}${routes.appointmentsNew.index.href()}`

function currentMonday(): number {
  let now = new Date()
  let day = now.getUTCDay()
  let diff = day === 0 ? -6 : 1 - day
  let monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff))
  return monday.getTime()
}

function isoWeekFromMonday(ms: number): { year: number; week: number } {
  let d = new Date(ms)
  d.setUTCDate(d.getUTCDate() + 3)
  let yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  let weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + yearStart.getUTCDay() + 1) / 7,
  )
  return { year: d.getUTCFullYear(), week: weekNum }
}

describe('Appointments New Controller', () => {
  let userCookie: string
  let userCsrfToken: string
  let adminCookie: string
  let adminCsrfToken: string
  let firstResourceId: number
  let futureDateMs: number
  let futureDateStr: string
  let appointmentWeekUrl: string

  before(async () => {
    await initializeAppDatabase()

    let userAuth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!userAuth) throw new Error('user@newapp.com not found in seed')
    userCookie = userAuth.cookie
    userCsrfToken = userAuth.csrfToken

    let adminAuth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!adminAuth) throw new Error('admin@newapp.com not found in seed')
    adminCookie = adminAuth.cookie
    adminCsrfToken = adminAuth.csrfToken

    let allResources = await listResources(db)
    if (allResources.length === 0) throw new Error('No resources found')
    firstResourceId = allResources[0].id

    let mondayMs = currentMonday() + 7 * 86_400_000
    futureDateMs = mondayMs + 14 * 86_400_000
    let d = new Date(futureDateMs)
    let y = d.getUTCFullYear()
    let m = String(d.getUTCMonth() + 1).padStart(2, '0')
    let day = String(d.getUTCDate()).padStart(2, '0')
    futureDateStr = `${y}-${m}-${day}`

    let { year, week } = isoWeekFromMonday(mondayMs)
    appointmentWeekUrl = `${APPT_URL}?year=${year}&week=${week}`
  })

  // ── Auth guards ──

  it('GET /appointments/new redirects to login when not authenticated', async () => {
    let response = await router.fetch(APPT_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.startsWith(routes.auth.login.index.href()))
  })

  it('POST /appointments/new returns 403 without CSRF', async () => {
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        resource_id: String(firstResourceId),
        title: 'Test',
        date: futureDateStr,
        start_min: '480',
      }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 403)
  })

  it('DELETE /appointments/new/999 returns 403 without CSRF', async () => {
    let response = await router.fetch(`${APPT_URL}/999`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams().toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 403)
  })

  // ── Index ──

  it('GET /appointments/new renders the page with authenticated user', async () => {
    let response = await router.fetch(APPT_URL, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Meine Termine'))
  })

  it('GET /appointments/new with filter query renders filtered', async () => {
    let response = await router.fetch(`${APPT_URL}?filter=test&period=all`, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
  })

  it('GET /appointments/new with sort params renders sorted', async () => {
    let response = await router.fetch(`${APPT_URL}?sort=a.title&order=desc`, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
  })

  it('GET /appointments/new with creating=true and step=1 renders wizard step 1', async () => {
    let response = await router.fetch(`${APPT_URL}?creating=true&step=1`, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.length > 0)
  })

  it('GET /appointments/new with creating=true and step=2 and resource_id renders wizard step 2', async () => {
    let response = await router.fetch(
      `${APPT_URL}?creating=true&step=2&resource_id=${firstResourceId}`,
      {
        headers: { Cookie: userCookie },
      },
    )
    assert.equal(response.status, 200)
  })

  it('GET /appointments/new step 2 surfaces the selected resource summary', async () => {
    let response = await router.fetch(
      `${APPT_URL}?creating=true&step=2&resource_id=${firstResourceId}`,
      {
        headers: { Cookie: userCookie },
      },
    )
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Gewählte Ressource'))
    assert.ok(html.includes('Schritt 2 von 2'))
    let allResources = await listResources(db)
    let selected = allResources.find((r) => r.id === firstResourceId)
    if (selected) {
      assert.ok(html.includes(selected.name))
    }
  })

  // ── Create (2-step flow) ──

  it('POST /appointments/new without step redirects to step 1', async () => {
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({ resource_id: String(firstResourceId) }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.includes('creating=true'))
  })

  it('POST /appointments/new step 2 shows error for missing day_start', async () => {
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({
        resource_id: String(firstResourceId),
        day_start: '',
        title: 'Test',
        step: '2',
      }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('Bitte wählen Sie eine Uhrzeit aus'))
  })

  it('POST /appointments/new step 2 works without title', async () => {
    // Clean up stale data from previous test runs
    await pool.query(
      "DELETE FROM appointments WHERE title = '' AND user_id = (SELECT id FROM users WHERE email = 'user@newapp.com') AND start_min = 480",
    )
    let body = new URLSearchParams({
      resource_id: String(firstResourceId),
      day_start: `${futureDateMs}:480`,
      step: '2',
    })
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: body.toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.startsWith(routes.appointmentsNew.index.href()))
    let checkResult = await pool.query(
      "SELECT id FROM appointments WHERE title = '' AND user_id = (SELECT id FROM users WHERE email = 'user@newapp.com') AND start_min = 480",
    )
    assert.equal(checkResult.rows.length, 1)
  })

  it('POST /appointments/new step 2 creates appointment', async () => {
    // Wait to avoid rate limiter collision (windowMs=0 in dev)
    await new Promise((r) => setTimeout(r, 5))
    let body = new URLSearchParams({
      resource_id: String(firstResourceId),
      day_start: `${futureDateMs}:540`,
      title: 'Step 2 Created Appointment',
      step: '2',
    })
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: body.toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.startsWith(routes.appointmentsNew.index.href()))
    assert.ok(!location.includes('editing'))

    let checkResult = await pool.query(
      "SELECT id FROM appointments WHERE title = 'Step 2 Created Appointment' AND user_id = (SELECT id FROM users WHERE email = 'user@newapp.com')",
    )
    assert.equal(checkResult.rows.length, 1)
  })

  it('POST /appointments/new step 2 with validation error returns 400', async () => {
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({
        resource_id: '',
        title: '',
        day_start: `${futureDateMs}:480`,
        step: '2',
      }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 400)
  })

  it('POST /appointments/new step 2 with past date shows error', async () => {
    let pastDayMs = String(new Date('2020-01-01T00:00:00Z').getTime())
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({
        resource_id: String(firstResourceId),
        title: 'Past Date',
        day_start: `${pastDayMs}:480`,
        step: '2',
      }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('Vergangenheit'))
  })

  // ── Destroy ──

  it('DELETE /appointments/new/:id deletes an appointment', async () => {
    let insertResult = await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ((SELECT id FROM users WHERE email = 'user@newapp.com'), $1, 'To Delete', $2, '[840,900)', $3, $3)
       RETURNING id`,
      [firstResourceId, futureDateMs, Date.now()],
    )
    let appointmentId = insertResult.rows[0].id as number

    let response = await router.fetch(`${APPT_URL}/${appointmentId}`, {
      method: 'DELETE',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams().toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.startsWith(routes.appointmentsNew.index.href()))

    let checkResult = await pool.query('SELECT id FROM appointments WHERE id = $1', [appointmentId])
    assert.equal(checkResult.rows.length, 0)
  })

  it('DELETE /appointments/new/:id clears filter, period, offset, and status on successful delete', async () => {
    let dayMs = new Date('2026-09-15T00:00:00Z').getTime()
    let insertResult = await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ((SELECT id FROM users WHERE email = 'user@newapp.com'), $1, 'Grid State Delete', $2, '[900,960)', $3, $3)
       RETURNING id`,
      [firstResourceId, dayMs, Date.now()],
    )
    let deleteId = insertResult.rows[0].id as number

    let body = new URLSearchParams({
      _sort: 'a.title',
      _order: 'desc',
      _filter: 'shouldbecleared',
      _period: 'this-week',
      _status: 'expired',
    })
    let response = await router.fetch(`${APPT_URL}/${deleteId}`, {
      method: 'DELETE',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: body.toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302, 'delete should redirect')
    let location = response.headers.get('Location') ?? ''
    assert.ok(!location.includes('filter='), 'should NOT preserve filter param')
    assert.ok(!location.includes('period='), 'should NOT preserve period param')
    assert.ok(!location.includes('offset='), 'should NOT preserve offset param')
    assert.ok(!location.includes('status='), 'should NOT preserve status param')
    assert.ok(location.includes('sort=a.title'), 'should preserve sort param')
    assert.ok(location.includes('order=desc'), 'should preserve order param')
  })

  it('DELETE /appointments/new/:id rejects deletion when appointment starts within 24h and outside grace period', async () => {
    let now = new Date()
    let todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    let currentMin = now.getUTCHours() * 60 + now.getUTCMinutes()
    let nearFutureMin = currentMin + 70
    // Use a unique resource to avoid exclusion constraint conflicts
    let uniqueResourceId = firstResourceId + 100
    let resourceNow = Date.now()
    await pool.query(
      'INSERT INTO resources (id, name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
      [uniqueResourceId, '24h Delete Test', 'Temporary', resourceNow, resourceNow],
    )

    // Use created_at 30 minutes ago so grace period doesn't apply
    let oldCreatedAt = Date.now() - 30 * 60 * 1000
    let insertResult = await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ((SELECT id FROM users WHERE email = 'user@newapp.com'), $1, 'Near Future Delete', $2, $3, $4, $4)
       RETURNING id`,
      [uniqueResourceId, todayMidnight, `[${nearFutureMin},${nearFutureMin + 60})`, oldCreatedAt],
    )
    let appointmentId = insertResult.rows[0].id as number

    let response = await router.fetch(`${APPT_URL}/${appointmentId}`, {
      method: 'DELETE',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams().toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.includes('24+Stunden') || location.includes('24%20Stunden'))
  })

  it('DELETE /appointments/new/:id allows deletion within 10-minute grace period', async () => {
    let now = new Date()
    let todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    let currentMin = now.getUTCHours() * 60 + now.getUTCMinutes()
    let nearFutureMin = currentMin + 75
    let uniqueResourceId = firstResourceId + 200
    let resourceNow = Date.now()
    await pool.query(
      'INSERT INTO resources (id, name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
      [uniqueResourceId, 'Grace Period Test', 'Temporary', resourceNow, resourceNow],
    )

    let insertResult = await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ((SELECT id FROM users WHERE email = 'user@newapp.com'), $1, 'Grace Period Delete', $2, $3, $4, $4)
       RETURNING id`,
      [uniqueResourceId, todayMidnight, `[${nearFutureMin},${nearFutureMin + 60})`, Date.now()],
    )
    let appointmentId = insertResult.rows[0].id as number

    let response = await router.fetch(`${APPT_URL}/${appointmentId}`, {
      method: 'DELETE',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams().toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302, 'should succeed due to grace period')
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.startsWith(routes.appointmentsNew.index.href()))

    let checkResult = await pool.query('SELECT id FROM appointments WHERE id = $1', [appointmentId])
    assert.equal(checkResult.rows.length, 0)
  })

  it('DELETE /appointments/new/:id allows admin to delete within 24h (no grace period)', async () => {
    let now = new Date()
    let todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    let currentMin = now.getUTCHours() * 60 + now.getUTCMinutes()
    let nearFutureMin = currentMin + 80
    let uniqueResourceId = firstResourceId + 201
    let resourceNow = Date.now()
    await pool.query(
      'INSERT INTO resources (id, name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
      [uniqueResourceId, 'Admin Override Test', 'Temporary', resourceNow, resourceNow],
    )

    // Insert with a created_at 30 minutes ago (outside grace period)
    let oldCreatedAt = Date.now() - 30 * 60 * 1000
    let insertResult = await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ((SELECT id FROM users WHERE email = 'admin@newapp.com'), $1, 'Admin Override Delete', $2, $3, $4, $4)
       RETURNING id`,
      [uniqueResourceId, todayMidnight, `[${nearFutureMin},${nearFutureMin + 60})`, oldCreatedAt],
    )
    let appointmentId = insertResult.rows[0].id as number

    let response = await router.fetch(`${APPT_URL}/${appointmentId}`, {
      method: 'DELETE',
      headers: {
        Cookie: adminCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': adminCsrfToken,
      },
      body: new URLSearchParams().toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302, 'admin should bypass 24h restriction')
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.startsWith(routes.appointmentsNew.index.href()))

    let checkResult = await pool.query('SELECT id FROM appointments WHERE id = $1', [appointmentId])
    assert.equal(checkResult.rows.length, 0)
  })

  it('DELETE /appointments/new/:id for non-existent appointment shows error', async () => {
    let response = await router.fetch(`${APPT_URL}/999999999`, {
      method: 'DELETE',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams().toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(
      location.includes('Eintrag+nicht+gefunden') ||
        location.includes('Eintrag%20nicht%20gefunden'),
    )
  })

  it('DELETE /appointments/new/:id returns 403 when not authenticated (CSRF before auth)', async () => {
    let response = await router.fetch(`${APPT_URL}/1`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams().toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 403)
  })

  // ── Grid state preservation on create ──

  it('POST /appointments/new clears filter, period, offset, and status on successful create', async () => {
    await new Promise((r) => setTimeout(r, 5))
    let body = new URLSearchParams({
      resource_id: String(firstResourceId),
      day_start: `${futureDateMs + 1}:600`,
      title: 'Grid State Create Test',
      step: '2',
      _sort: 'a.title',
      _order: 'desc',
      _filter: 'shouldbecleared',
      _period: 'this-week',
      _status: 'expired',
    })
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: body.toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302, 'create should redirect')
    let location = response.headers.get('Location') ?? ''
    assert.ok(!location.includes('filter='), 'should NOT preserve filter param')
    assert.ok(!location.includes('period='), 'should NOT preserve period param')
    assert.ok(!location.includes('offset='), 'should NOT preserve offset param')
    assert.ok(!location.includes('status='), 'should NOT preserve status param')
    assert.ok(location.includes('sort=a.title'), 'should preserve sort param')
    assert.ok(location.includes('order=desc'), 'should preserve order param')
  })

  // ── Status filter ──

  it('GET /appointments/new defaults to pending (future appointments)', async () => {
    let futureDate = futureDateStr
    let response = await router.fetch(APPT_URL, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    // Ausstehend button should be active by default
    assert.ok(html.includes('Ausstehend'))
  })

  it('GET /appointments/new with status=pending shows future appointments', async () => {
    let response = await router.fetch(`${APPT_URL}?status=pending`, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Meine Termine'))
  })

  it('GET /appointments/new with status=expired shows past appointments', async () => {
    // Insert a past appointment directly (POST blocks past dates)
    let pastDayMs = new Date('2020-06-01T00:00:00Z').getTime()
    let pastResult = await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ((SELECT id FROM users WHERE email = 'user@newapp.com'), $1, 'Past Appointment For Status Test', $2, '[480,540)', $3, $3)
       RETURNING id`,
      [firstResourceId, pastDayMs, Date.now()],
    )
    let pastId = pastResult.rows[0].id as number

    let response = await router.fetch(`${APPT_URL}?status=expired`, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Past Appointment For Status Test'))
  })

  it('GET /appointments/new with status=pending filters out past appointments', async () => {
    let response = await router.fetch(`${APPT_URL}?status=pending`, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(!html.includes('Past Appointment For Status Test'))
  })

  it('GET /appointments/new with deleting param shows delete confirmation', async () => {
    // Use a date far in the future to avoid exclusion conflicts
    let deleteDate = futureDateMs + 365 * 86_400_000
    let insertResult = await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ((SELECT id FROM users WHERE email = 'user@newapp.com'), $1, 'To Confirm Delete', $2, '[600,660)', $3, $3)
       RETURNING id`,
      [firstResourceId, deleteDate, Date.now()],
    )
    let deleteId = (insertResult.rows[0] as { id: number }).id

    let response = await router.fetch(`${APPT_URL}?deleting=${deleteId}`, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Termin löschen'))
    assert.ok(html.includes('To Confirm Delete'))
  })
})

import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../router.ts'
import { pool, db, initializeAppDatabase } from '../../data/setup.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { listResources } from '../../data/resources.ts'
import { routes } from '../../routes.ts'

const BASE = 'https://remix.run'
const APPT_URL = `${BASE}${routes.appointmentsNew.index.href()}`

const createdAppointmentIds: number[] = []

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
  let weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + yearStart.getUTCDay() + 1) / 7)
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

  after(async () => {
    for (let id of createdAppointmentIds) {
      await pool.query('DELETE FROM appointments WHERE id = $1', [id])
    }
    createdAppointmentIds.length = 0
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
      body: new URLSearchParams({ resource_id: String(firstResourceId), title: 'Test', date: futureDateStr, start_min: '480' }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 403)
  })

  it('PUT /appointments/new/999 returns 403 without CSRF', async () => {
    let response = await router.fetch(`${APPT_URL}/999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ resource_id: String(firstResourceId), title: 'Test', date: futureDateStr, start_min: '480' }).toString(),
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
    let response = await router.fetch(`${APPT_URL}?creating=true&step=2&resource_id=${firstResourceId}`, {
      headers: { Cookie: userCookie },
    })
    assert.equal(response.status, 200)
  })

  // ── Create (3-step wizard) ──

  it('POST /appointments/new wizard step 1 shows error for missing resource_id', async () => {
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({ resource_id: '', step: '1' }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('Bitte wählen Sie eine Ressource aus'))
  })

  it('POST /appointments/new wizard step 1 advances to step 2', async () => {
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({ resource_id: String(firstResourceId), step: '1' }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.includes('step=2'))
    assert.ok(location.includes('resource_id=' + firstResourceId))
  })

  it('POST /appointments/new wizard step 2 shows error for missing day', async () => {
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({ resource_id: String(firstResourceId), day: '', step: '2' }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('Bitte wählen Sie einen Tag aus'))
  })

  it('POST /appointments/new wizard step 2 advances to step 3', async () => {
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({ resource_id: String(firstResourceId), day: futureDateStr, step: '2' }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.includes('step=3'))
  })

  it('POST /appointments/new wizard final step creates appointment', async () => {
    let body = new URLSearchParams({
      resource_id: String(firstResourceId),
      title: 'Wizard Created Appointment',
      date: futureDateStr,
      start_min: '480',
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
    let match = location.match(/editing=(\d+)/)
    assert.ok(match)
    let newId = parseInt(match[1], 10)
    createdAppointmentIds.push(newId)

    let checkResult = await pool.query('SELECT title FROM appointments WHERE id = $1', [newId])
    assert.equal(checkResult.rows.length, 1)
    assert.equal((checkResult.rows[0] as { title: string }).title, 'Wizard Created Appointment')
  })

  it('POST /appointments/new with validation error shows field errors', async () => {
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({ resource_id: '', title: '', date: 'invalid', start_min: '' }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('ist erforderlich') || html.includes('erforderlich'))
  })

  it('POST /appointments/new with past date shows error', async () => {
    let pastDate = '2020-01-01'
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({ resource_id: String(firstResourceId), title: 'Past Date', date: pastDate, start_min: '480' }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('Vergangenheit'))
  })

  // ── Update ──

  it('PUT /appointments/new/:id updates an existing appointment', async () => {
    let createBody = new URLSearchParams({
      resource_id: String(firstResourceId),
      title: 'To Update',
      date: futureDateStr,
      start_min: '720',
    })
    let createResponse = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: createBody.toString(),
      redirect: 'manual',
    })
    assert.equal(createResponse.status, 302)
    let createLocation = createResponse.headers.get('Location') ?? ''
    let match = createLocation.match(/editing=(\d+)/)
    assert.ok(match, 'create should return editing param')
    let appointmentId = parseInt(match![1], 10)
    createdAppointmentIds.push(appointmentId)

    let updateBody = new URLSearchParams({
      resource_id: String(firstResourceId),
      title: 'Updated Title',
      date: futureDateStr,
      start_min: '720',
    })
    let response = await router.fetch(`${APPT_URL}/${appointmentId}`, {
      method: 'PUT',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: updateBody.toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.startsWith(routes.appointmentsNew.index.href()))

    let checkResult = await pool.query('SELECT title FROM appointments WHERE id = $1', [appointmentId])
    assert.equal((checkResult.rows[0] as { title: string }).title, 'Updated Title')
  })

  it('PUT /appointments/new/:id with validation error shows field errors', async () => {
    let response = await router.fetch(`${APPT_URL}/1`, {
      method: 'PUT',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({ resource_id: '', title: '', date: '', start_min: '' }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 400)
  })

  it('PUT /appointments/new/:id with past date shows error', async () => {
    let response = await router.fetch(`${APPT_URL}/1`, {
      method: 'PUT',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({ resource_id: String(firstResourceId), title: 'Past Update', date: '2020-01-01', start_min: '480' }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('Vergangenheit'))
  })

  it('PUT /appointments/new/:id for non-existent appointment shows error', async () => {
    let response = await router.fetch(`${APPT_URL}/999999999`, {
      method: 'PUT',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: new URLSearchParams({ resource_id: String(firstResourceId), title: 'Not Found', date: futureDateStr, start_min: '480' }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('nicht gefunden'))
  })

  // ── Destroy ──

  it('DELETE /appointments/new/:id deletes an appointment', async () => {
    let createBody = new URLSearchParams({
      resource_id: String(firstResourceId),
      title: 'To Delete',
      date: futureDateStr,
      start_min: '840',
    })
    let createResponse = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        Cookie: userCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': userCsrfToken,
      },
      body: createBody.toString(),
      redirect: 'manual',
    })
    assert.equal(createResponse.status, 302)
    let createLocation = createResponse.headers.get('Location') ?? ''
    let match = createLocation.match(/editing=(\d+)/)
    assert.ok(match, 'create should return editing param')
    let appointmentId = parseInt(match![1], 10)

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
    assert.ok(location.includes('Eintrag+nicht+gefunden') || location.includes('Eintrag%20nicht%20gefunden'))
  })

  // ── Update auth guard ──

  it('PUT /appointments/new/:id returns 403 when not authenticated (CSRF before auth)', async () => {
    let response = await router.fetch(`${APPT_URL}/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ resource_id: String(firstResourceId), title: 'Test', date: futureDateStr, start_min: '480' }).toString(),
      redirect: 'manual',
    })
    assert.equal(response.status, 403)
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
    createdAppointmentIds.push(pastId)

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

  // ── Grid state preservation on create ──

  it('POST /appointments/new preserves grid state params', async () => {
    let body = new URLSearchParams({
      resource_id: String(firstResourceId),
      title: 'Grid State Test',
      date: futureDateStr,
      start_min: '960',
      _sort: 'a.date',
      _order: 'desc',
      _filter: 'gridtest',
      _offset: '0',
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
    assert.ok(location.includes('sort=a.date') || location.includes('sort='))
    let match = location.match(/editing=(\d+)/)
    if (match) createdAppointmentIds.push(parseInt(match[1], 10))
  })
})

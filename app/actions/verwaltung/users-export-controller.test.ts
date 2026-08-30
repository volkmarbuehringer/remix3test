import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { pool } from '../../data/test-pool.ts'
import { BASE, setupTestEnvironment, teardownTestEnvironment } from './controller.test-utils.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'

const EXPORT_URL = `${BASE}/verwaltung/users-export`

describe('Verwaltung Users Export Controller', () => {
  let adminCookie: string
  let csrfSessionCookie: string
  let adminCsrfToken: string
  let userCookie: string
  let resourceId: number
  let userId: number
  let createdUserEmails: string[] = []

  before(async () => {
    let env = await setupTestEnvironment()
    adminCookie = env.adminCookie
    userCookie = env.userCookie
    resourceId = env.resourceId
    userId = env.userId

    let adminAuth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(adminAuth?.cookie && adminAuth.csrfToken, 'failed to create csrf-enabled admin session')
    csrfSessionCookie = adminAuth.cookie
    adminCsrfToken = adminAuth.csrfToken
  })

  after(async () => {
    await teardownTestEnvironment(resourceId, resourceId, [])
    await pool.query('DELETE FROM appointments WHERE title LIKE $1', ['[TEST-EXPORT]%'])
    for (let email of createdUserEmails) {
      try {
        await pool.query('DELETE FROM users WHERE email = $1', [email])
      } catch {
        /* ignore cleanup errors */
      }
    }
  })

  async function createExportUser(): Promise<number> {
    let email = `export-ctrl-${Date.now()}-${Math.random()}@example.com`
    createdUserEmails.push(email)
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
       VALUES ($1, $2, $3, 'customer', 1, 1, $4, $4)`,
      [email, 'hash', 'Export Ctrl Test', Date.now()],
    )
    let result = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    return result.rows[0].id as number
  }

  function isoDay(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10)
  }

  it('renders the form page for a GET without params', async () => {
    let response = await router.fetch(EXPORT_URL, { headers: { Cookie: adminCookie } })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('name="startDate"'), 'form should render the start date input')
    assert.ok(html.includes('name="endDate"'), 'form should render the end date input')
    assert.ok(
      html.includes('data-rmx-document'),
      'form should submit as a native document navigation',
    )
  })

  it('redirects unauthenticated users to login', async () => {
    let response = await router.fetch(EXPORT_URL)
    assert.equal(response.status, 302)
  })

  it('returns 403 for a non-admin user', async () => {
    let response = await router.fetch(EXPORT_URL, { headers: { Cookie: userCookie } })
    assert.equal(response.status, 403)
  })

  it('downloads a PDF via GET with a valid range', async () => {
    let userIdLocal = await createExportUser()
    let apptDate = Date.now() + 3_600_000
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ($1, $2, $3, $4, int4range(480, 540, '[)'), $5, $5)`,
      [userIdLocal, resourceId, '[TEST-EXPORT] Get Download', apptDate, Date.now()],
    )

    let startDate = isoDay(apptDate - 86_400_000)
    let endDate = isoDay(apptDate + 86_400_000)
    let response = await router.fetch(`${EXPORT_URL}?startDate=${startDate}&endDate=${endDate}`, {
      headers: { Cookie: adminCookie },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/pdf')
    let disposition = response.headers.get('Content-Disposition') ?? ''
    assert.ok(disposition.includes('attachment'), 'should be an attachment')
    assert.ok(
      disposition.includes(`benutzer-export-${startDate}_${endDate}.pdf`),
      `disposition should contain the filename, got: ${disposition}`,
    )
    let bytes = new Uint8Array(await response.arrayBuffer())
    assert.ok(bytes.length > 0)
    assert.ok(
      String.fromCharCode(...bytes.subarray(0, 4)) === '%PDF',
      'response body should be a PDF',
    )
  })

  it('rejects non-calendar dates with a per-field error (400)', async () => {
    let response = await router.fetch(`${EXPORT_URL}?startDate=2024-02-31&endDate=2024-03-31`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('2024-02-31'), 'submitted value should be preserved')
    assert.ok(html.includes('Startdatum'), 'should show a start-date field error')
  })

  it('rejects an end date before the start date (400)', async () => {
    let response = await router.fetch(`${EXPORT_URL}?startDate=2026-06-10&endDate=2026-06-01`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 400)
    let html = await response.text()
    assert.ok(html.includes('muss nach dem Startdatum'), 'should show the range error')
  })

  it('renders a neutral empty state (200) for a range without users', async () => {
    let response = await router.fetch(`${EXPORT_URL}?startDate=1970-01-01&endDate=1970-01-02`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Keine Benutzer mit Terminen'), 'should show the empty-state notice')
  })

  it('redirects framed download requests to the marker URL (302)', async () => {
    let response = await router.fetch(`${EXPORT_URL}?startDate=2026-06-01&endDate=2026-06-30`, {
      headers: { Cookie: adminCookie, 'X-Remix-Frame': 'true' },
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.includes('/verwaltung/users-export'), 'location should be the same URL')
    assert.ok(location.includes('startDate=2026-06-01'), 'location should keep the params')
    assert.ok(location.includes('frameDownload=1'), 'location should carry the marker param')
  })

  it('renders HTML for the framed marker URL so the redirect chain terminates', async () => {
    let response = await router.fetch(
      `${EXPORT_URL}?startDate=2026-06-01&endDate=2026-06-30&frameDownload=1`,
      { headers: { Cookie: adminCookie, 'X-Remix-Frame': 'true' } },
    )
    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('name="startDate"'), 'should render the form page as HTML')
    assert.ok(html.includes('2026-06-01'), 'form values should be preserved')
  })

  it('redirects framed POST downloads to the marker URL (302)', async () => {
    let body = new URLSearchParams({
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      _csrf: adminCsrfToken,
    })
    let response = await router.fetch(EXPORT_URL, {
      method: 'POST',
      headers: {
        Cookie: csrfSessionCookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Remix-Frame': 'true',
      },
      body: body.toString(),
    })
    assert.equal(response.status, 302)
    let location = response.headers.get('Location') ?? ''
    assert.ok(location.includes('startDate=2026-06-01'), 'location should keep the params')
    assert.ok(location.includes('frameDownload=1'), 'location should carry the marker param')
  })

  it('downloads a PDF via POST with a CSRF token', async () => {
    let userIdLocal = await createExportUser()
    let apptDate = Date.now() + 3_600_000
    await pool.query(
      `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
       VALUES ($1, $2, $3, $4, int4range(480, 540, '[)'), $5, $5)`,
      [userIdLocal, resourceId, '[TEST-EXPORT] Post Download', apptDate, Date.now()],
    )

    let body = new URLSearchParams({
      startDate: isoDay(apptDate - 86_400_000),
      endDate: isoDay(apptDate + 86_400_000),
      _csrf: adminCsrfToken,
    })
    let response = await router.fetch(EXPORT_URL, {
      method: 'POST',
      headers: { Cookie: csrfSessionCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/pdf')
  })

  it('rejects a POST without a CSRF token', async () => {
    let body = new URLSearchParams({ startDate: '2026-06-01', endDate: '2026-06-30' })
    let response = await router.fetch(EXPORT_URL, {
      method: 'POST',
      headers: { Cookie: adminCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    assert.equal(response.status, 403, 'POST without CSRF token should be rejected')
  })
})

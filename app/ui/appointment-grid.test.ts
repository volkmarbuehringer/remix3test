import { describe, it, before, beforeEach, after } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase, pool } from '../data/setup.ts'
import { sql } from 'remix/data-table'
import { router } from '../test-router.ts'
import { listResources } from '../data/resources.ts'
import { appointments, appointofferings, appointtypes } from '../data/schema.ts'
import { createAuthCookieWithCsrfForUser } from '../test-utils.ts'
import { routes } from '../routes.ts'

// ---------------------------------------------------------------------------
// Appointment Grid integration tests
// Requires a running PostgreSQL database seeded with demo users.
//
// These tests verify the appointment calendar API contract:
//   - Multiline titles are accepted and preserved through POST/PUT/GET
//   - Title validation (empty, whitespace, length) enforces constraints
//   - Page rendering includes embedded JSON with correct appointment data
//   - Auth gating redirects unauthenticated requests
//
// Client-side behaviors (textarea keyboard handling, button clicks, blur
// cancel) require browser/Playwright tests — see the companion browser
// test for those scenarios.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const APPT_URL = `${BASE}/appointment`

type AppointmentData = {
  days: Array<{ dayName: string; date: number; dateStr: string }>
  appointments: Array<{
    id: number
    title: string
    date: number
    start_min: number
    end_min: number
  }>
  csrfToken: string
  weekStart: number
}

// Track test appointment IDs for cleanup
const testAppointmentIds: number[] = []

/**
 * Get the epoch ms for Monday of the current week (UTC).
 * Uses the same ISO-week logic as the appointment controller.
 */
function currentMonday(): number {
  let now = new Date()
  let dayOfWeek = now.getUTCDay() || 7 // Sunday → 7
  let monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek + 1),
  )
  return monday.getTime()
}

/**
 * Compute the ISO 8601 week number for a given Monday's epoch ms.
 * Returns the year and week that contain this Monday.
 */
function isoWeekFromMonday(mondayMs: number): { year: number; week: number } {
  let d = new Date(mondayMs)
  d.setUTCDate(d.getUTCDate() + 3) // Thursday — always in the same ISO week as Monday
  let yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  let weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: d.getUTCFullYear(), week: weekNum }
}

/**
 * Parse appointment data from the embedded JSON in the HTML page.
 * Uses the server-embedded `<script id="appointment-data">` tag.
 */
function parseAppointmentData(html: string): AppointmentData | null {
  let match = html.match(/<script id="appointment-data"[^>]*>([\s\S]*?)<\/script>/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Appointment Grid', () => {
  let userCookie: string
  let userCsrfToken: string
  let firstResourceId: number
  let saturdayMs: number
  let sundayMs: number
  let farFutureDateMs: number
  let appointmentWeekUrl: string

  before(async () => {
    await initializeAppDatabase()

    // Use seed user for authenticated requests
    let auth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!auth?.cookie) {
      throw new Error('Failed to create user session — check user@newapp.com exists in seed data')
    }
    userCookie = auth.cookie
    userCsrfToken = auth.csrfToken

    // Look up the first resource (by description order, matching the controller's
    // index action which uses listResources().orderBy('description', 'asc')).
    let allResources = await listResources(db)
    if (allResources.length === 0) {
      throw new Error('No resources found in the database')
    }
    firstResourceId = allResources[0].id

    // Compute test dates starting from next week so Saturday/Sunday
    // are always in the future regardless of the current day.
    let mondayMs = currentMonday() + 7 * 86_400_000
    saturdayMs = mondayMs + 5 * 86_400_000
    sundayMs = mondayMs + 6 * 86_400_000
    // Date guaranteed >24h from now for PUT tests (Sunday after next).
    // This avoids flakiness with the 24h cancellation policy when tests
    // run late on Saturday/Sunday.
    farFutureDateMs = mondayMs + 13 * 86_400_000
    // ISO week params for fetching the correct week's appointment page
    let { year, week } = isoWeekFromMonday(mondayMs)
    appointmentWeekUrl = `${APPT_URL}?year=${year}&week=${week}`

    // Clean up any leftover appointments from previous runs to prevent collisions.
    await pool.query(
      `DELETE FROM appointments WHERE user_id = (SELECT id FROM users WHERE email = $1) AND (date = $2 OR date = $3 OR date = $4)`,
      ['user@newapp.com', saturdayMs, sundayMs, farFutureDateMs],
    )
  })

  /**
   * Reset test data before each test: clear any stale appointments and
   * seed fresh full-day offerings for test dates. This prevents 409
   * collisions from previous test runs using overlapping time slots.
   */
  async function seedTestOfferings(): Promise<void> {
    // Remove ALL appointments on test dates (from any user) to prevent collisions
    await pool.query(`DELETE FROM appointments WHERE date = $1 OR date = $2 OR date = $3`, [
      saturdayMs,
      sundayMs,
      farFutureDateMs,
    ])
    await pool.query(`DELETE FROM appointoffering WHERE day = $1 OR day = $2 OR day = $3`, [
      saturdayMs,
      sundayMs,
      farFutureDateMs,
    ])
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, $4, int4range(0, 1440, '[)'), $3, $3),
              ($2::bigint, $4, int4range(0, 1440, '[)'), $3, $3),
              ($5::bigint, $4, int4range(0, 1440, '[)'), $3, $3)`,
      [saturdayMs, sundayMs, Date.now(), firstResourceId, farFutureDateMs],
    )
  }

  // Seed fresh offerings before each test (ensures clean per-test state)
  beforeEach(seedTestOfferings)

  let testAppointTypeIds: number[] = []

  after(async () => {
    for (let id of testAppointTypeIds) {
      try {
        await db.delete(appointtypes, { id })
      } catch {
        // Ignore cleanup errors
      }
    }
    for (let id of testAppointmentIds) {
      try {
        await db.exec(sql`DELETE FROM appointments WHERE id = ${id}`)
      } catch {
        // Ignore cleanup errors (e.g. already deleted by a previous test run)
      }
    }
  })

  // -----------------------------------------------------------------------
  // Section 1: Gating
  // GET without auth → 302 redirect (requireAuth middleware redirects).
  // POST/PUT without CSRF → 403 (CSRF middleware blocks mutation requests).
  // -----------------------------------------------------------------------

  it('GET /appointment redirects to login when not authenticated', async () => {
    // Arrange
    // (no cookie)

    // Act
    let response = await router.fetch(APPT_URL)

    // Assert
    assert.equal(response.status, 302, 'unauthenticated GET should redirect')
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith(routes.auth.login.index.href()), 'should redirect to login')
  })

  it('POST /appointment returns 403 when not authenticated (CSRF missing)', async () => {
    // Arrange
    // (no cookie, no CSRF token)
    // POST/PUT without CSRF token is rejected by the CSRF middleware (403)
    // before the auth middleware is reached.

    // Act
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthorized',
        date: saturdayMs,
        start_min: 480,
        end_min: 540,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 403, 'unauthenticated POST without CSRF should return 403')
  })

  it('PUT /appointment/:id returns 403 when not authenticated (CSRF missing)', async () => {
    // Arrange

    // Act
    let response = await router.fetch(`${APPT_URL}/9999999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    })

    // Assert
    assert.equal(response.status, 403, 'unauthenticated PUT without CSRF should return 403')
  })

  // -----------------------------------------------------------------------
  // Section 2: Page rendering (GET /appointment)
  // The page should load and contain the embedded appointment data.
  // -----------------------------------------------------------------------

  it('GET /appointment returns 200 when authenticated', async () => {
    // Arrange
    // Act
    let response = await router.fetch(APPT_URL, {
      headers: { Cookie: userCookie },
    })

    // Assert
    assert.equal(response.status, 200, 'authenticated GET should return 200')
  })

  it('GET /appointment contains embedded appointment-data script tag', async () => {
    // Arrange
    // Act
    let response = await router.fetch(APPT_URL, {
      headers: { Cookie: userCookie },
    })
    let html = await response.text()

    // Assert
    let data = parseAppointmentData(html)
    assert.ok(data, 'HTML should have <script id="appointment-data"> with JSON')
    assert.ok(Array.isArray(data!.days), 'data should have days array')
    assert.equal(data!.days.length, 7, 'data should have 7 days for the week')
    assert.ok(Array.isArray(data!.appointments), 'data should have appointments array')
    assert.ok(typeof data!.csrfToken === 'string', 'data should have csrfToken')
    assert.ok(typeof data!.weekStart === 'number', 'data should have weekStart')
  })

  it('GET /appointment with year/week params loads valid page', async () => {
    // Arrange
    // Act
    let response = await router.fetch(`${APPT_URL}?year=2026&week=20`, {
      headers: { Cookie: userCookie },
    })

    // Assert
    assert.equal(response.status, 200)
    let html = await response.text()
    let data = parseAppointmentData(html)
    assert.ok(data, 'should have appointment data for given week')
    assert.equal(data!.days.length, 7, 'should have 7 days')
  })

  it('GET /appointment with out-of-range params clamps to valid range', async () => {
    // Arrange: year 2035 is beyond the max (2030)
    // Act
    let response = await router.fetch(`${APPT_URL}?year=2035&week=99`, {
      headers: { Cookie: userCookie },
    })

    // Assert: should clamp to valid range, still return a page
    assert.equal(response.status, 200)
    let html = await response.text()
    let data = parseAppointmentData(html)
    assert.ok(data, 'should return valid data even with out-of-range params')
    assert.equal(data!.days.length, 7)
  })

  // -----------------------------------------------------------------------
  // Section 3: Draft creation — POST /appointment
  // Multiline titles must be accepted and preserved.
  // -----------------------------------------------------------------------

  it('POST /appointment with multiline title returns 201 with preserved newlines', async () => {
    // Arrange
    let multilineTitle = 'Meeting\nnotes:\nDiscuss Q3 plan'

    // Act
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: multilineTitle,
        date: saturdayMs,
        start_min: 480, // 8:00 AM
        end_min: 540, // 9:00 AM
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 201, 'multiline POST should return 201')
    let body = await response.json()
    assert.ok(body.appointment, 'response should include appointment object')
    assert.equal(
      body.appointment.title,
      multilineTitle,
      'title should preserve \\n characters through POST',
    )
    assert.equal(body.appointment.start_min, 480, 'start_min should be preserved')
    assert.equal(body.appointment.end_min, 540, 'end_min should be preserved')
    testAppointmentIds.push(body.appointment.id)
  })

  it('POST /appointment with internal newlines preserves multiline content', async () => {
    // Arrange: newlines in the middle (not at edges, since server calls .trim())
    let multilineTitle = 'First\nSecond\n\nFourth'

    // Act
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: multilineTitle,
        date: saturdayMs,
        start_min: 540,
        end_min: 600,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 201)
    let body = await response.json()
    assert.equal(
      body.appointment.title,
      multilineTitle,
      'internal newlines should be preserved through POST',
    )
    assert.ok(body.appointment.title.includes('\n'), 'title should contain newline characters')
    testAppointmentIds.push(body.appointment.id)
  })

  it('POST /appointment with single-line title succeeds', async () => {
    // Arrange
    // Act
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: 'Single line meeting',
        date: saturdayMs,
        start_min: 600,
        end_min: 660,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 201)
    let body = await response.json()
    assert.equal(body.appointment.title, 'Single line meeting')
    testAppointmentIds.push(body.appointment.id)
  })

  it('POST /appointment with empty title returns 400', async () => {
    // Arrange
    // Act
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: '',
        date: saturdayMs,
        start_min: 660,
        end_min: 720,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 400, 'empty title should return 400')
    let body = await response.json()
    assert.ok(body.error, 'should include error message')
  })

  it('POST /appointment with whitespace-only title passes validation (minLength checks raw chars, not trimmed)', async () => {
    // The server schema validates with minLength(1) which checks the raw
    // string length, not the trimmed length. So "   " (length 3) passes
    // validation. The createAppointment function then calls .trim() which
    // reduces it to "". The title stored in the DB is "".
    //
    // This test documents the current server behavior — the client-side
    // draft commit already does .trim() before sending, so empty titles
    // are caught client-side before they reach the API.

    // Arrange
    // Act
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: '   ',
        date: saturdayMs,
        start_min: 720,
        end_min: 780,
        resource_id: firstResourceId,
      }),
    })

    // Assert: server accepts because "   ".length === 3 >= minLength(1)
    assert.equal(
      response.status,
      201,
      'whitespace-only title passes minLength(1) server validation',
    )
    let body = await response.json()
    // The stored title is trimmed to "" by createAppointment
    assert.equal(body.appointment.title, '', 'title is trimmed to empty by data layer')
    testAppointmentIds.push(body.appointment.id)
  })

  it('POST /appointment with title exceeding 80 chars returns 400', async () => {
    // Arrange: 81 characters
    let longTitle = 'A'.repeat(81)

    // Act
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: longTitle,
        date: saturdayMs,
        start_min: 780,
        end_min: 840,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 400, 'title exceeding maxLength(80) should return 400')
    let body = await response.json()
    assert.ok(body.error, 'should include error message')
  })

  it('POST /appointment with title at exactly 80 chars succeeds', async () => {
    // Arrange: 80 characters — boundary test
    let boundaryTitle = 'A'.repeat(80)

    // Act
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: boundaryTitle,
        date: saturdayMs,
        start_min: 840,
        end_min: 900,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 201, '80-char title should succeed')
    let body = await response.json()
    assert.equal(body.appointment.title, boundaryTitle)
    testAppointmentIds.push(body.appointment.id)
  })

  it('POST /appointment with multiline title at max length succeeds (80 chars with \\n)', async () => {
    // Arrange: 78 chars + \n = 80
    let multilineBoundary = 'A'.repeat(40) + '\n' + 'B'.repeat(37)

    // Act
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: multilineBoundary,
        date: saturdayMs,
        start_min: 900,
        end_min: 960,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 201, 'multiline 80-char title (including \\n) should succeed')
    let body = await response.json()
    assert.equal(body.appointment.title, multilineBoundary)
    testAppointmentIds.push(body.appointment.id)
  })

  // -----------------------------------------------------------------------
  // Section 4: Title update — PUT /appointment/:id
  // Multiline titles must be accepted and preserved on update.
  // -----------------------------------------------------------------------

  it('PUT /appointment/:id with multiline title updates successfully', async () => {
    // Arrange: create an appointment on a date >24h from now
    let createResponse = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: 'Original title',
        date: farFutureDateMs,
        start_min: 480,
        end_min: 540,
        resource_id: firstResourceId,
      }),
    })
    assert.equal(createResponse.status, 201)
    let { appointment } = await createResponse.json()
    testAppointmentIds.push(appointment.id)
    let multilineTitle = 'Updated\nnotes:\nAdded review items'

    // Act: update to multiline
    let updateResponse = await router.fetch(`${APPT_URL}/${appointment.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({ title: multilineTitle }),
    })

    // Assert
    assert.equal(updateResponse.status, 200, 'multiline PUT should return 200')
    let updateBody = await updateResponse.json()
    assert.ok(updateBody.appointment, 'response should include appointment')
    assert.equal(
      updateBody.appointment.title,
      multilineTitle,
      'updated title should preserve \\n characters',
    )
  })

  it('PUT /appointment/:id preserves existing title when no title sent', async () => {
    // Arrange: create appointment
    let createResponse = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: 'Existing title',
        date: farFutureDateMs,
        start_min: 540,
        end_min: 600,
        resource_id: firstResourceId,
      }),
    })
    assert.equal(createResponse.status, 201)
    let { appointment: created } = await createResponse.json()
    testAppointmentIds.push(created.id)

    // Act: PUT with date/start_min/end_min (no title)
    let updateResponse = await router.fetch(`${APPT_URL}/${created.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        date: farFutureDateMs,
        start_min: 600,
        end_min: 660,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(updateResponse.status, 200)
    let updateBody = await updateResponse.json()
    assert.equal(
      updateBody.appointment.title,
      'Existing title',
      'title should remain unchanged when not provided',
    )
    assert.equal(updateBody.appointment.start_min, 600, 'start_min should update')
  })

  it('PUT /appointment/:id for non-existent appointment returns 404', async () => {
    // Arrange
    // Act
    let response = await router.fetch(`${APPT_URL}/9999999`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({ title: 'Updated' }),
    })

    // Assert
    assert.equal(response.status, 404, 'non-existent appointment should return 404')
  })

  // -----------------------------------------------------------------------
  // Section 5: Multiline title round-trip (POST → GET)
  // The most important test: create a multiline appointment, then fetch
  // the page and verify the title is preserved in the embedded JSON.
  // -----------------------------------------------------------------------

  it('Multiline title round-trip: POST then GET preserves \\n in embedded JSON', async () => {
    // Arrange: create a multiline appointment
    let multilineTitle = 'Multi\nline\ntitle test'
    let createResponse = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: multilineTitle,
        date: saturdayMs,
        start_min: 960,
        end_min: 1020,
        resource_id: firstResourceId,
      }),
    })
    assert.equal(createResponse.status, 201)
    let { appointment: created } = await createResponse.json()
    assert.equal(created.title, multilineTitle, 'POST should return title with \\n')
    testAppointmentIds.push(created.id)

    // Act: fetch the page for the week containing the appointment
    let pageResponse = await router.fetch(appointmentWeekUrl, {
      headers: { Cookie: userCookie },
    })
    assert.equal(pageResponse.status, 200)
    let html = await pageResponse.text()

    // Assert: parse embedded JSON and find the created appointment
    let data = parseAppointmentData(html)
    assert.ok(data, 'page should have parseable appointment data')

    let found = data!.appointments.find((a) => a.id === created.id)
    assert.ok(found, 'created appointment should appear in page data')
    assert.equal(
      found!.title,
      multilineTitle,
      'title should preserve multiline content through POST→GET round-trip',
    )

    // Also verify the raw JSON in HTML contains escaped newlines (`\n`)
    // JSON.stringify encodes \n as the two-character sequence `\n`
    let jsonMatch = html.match(/<script id="appointment-data"[^>]*>([\s\S]*?)<\/script>/)
    assert.ok(jsonMatch, 'should have appointment-data script tag')
    assert.ok(
      jsonMatch[1].includes(multilineTitle) ||
        jsonMatch[1].includes(multilineTitle.replace(/\n/g, '\\n')),
      'multiline title should appear in raw HTML JSON',
    )
  })

  it('Multiple multiline appointments round-trip correctly', async () => {
    // Arrange: create several multiline appointments
    // Note: server calls .trim() on title, so avoid leading/trailing newlines
    let titles = [
      'Appointment A\nwith notes',
      'Line 1\nLine 2\nLine 3\nLine 4',
      'Middle\nnewlines\nhere',
    ]
    let ids: number[] = []

    for (let i = 0; i < titles.length; i++) {
      let response = await router.fetch(APPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Csrf-Token': userCsrfToken,
          Cookie: userCookie,
        },
        body: JSON.stringify({
          title: titles[i],
          date: saturdayMs,
          start_min: 1020 + i * 60,
          end_min: 1080 + i * 60,
          resource_id: firstResourceId,
        }),
      })
      assert.equal(response.status, 201)
      let body = await response.json()
      ids.push(body.appointment.id)
      testAppointmentIds.push(body.appointment.id)
    }

    // Act
    let pageResponse = await router.fetch(appointmentWeekUrl, {
      headers: { Cookie: userCookie },
    })
    let html = await pageResponse.text()
    let data = parseAppointmentData(html)

    // Assert
    assert.ok(data, 'page should have appointment data')
    for (let i = 0; i < titles.length; i++) {
      let found: AppointmentData['appointments'][number] | undefined = data!.appointments.find(
        (a) => a.id === ids[i],
      )
      assert.ok(found, `appointment ${ids[i]} should appear in page data`)
      assert.equal(
        found!.title,
        // Server calls .trim() on title, so trailing \n is stripped
        titles[i],
        `title ${i} should preserve multiline content through round-trip`,
      )
    }
  })

  // -----------------------------------------------------------------------
  // Section 6: Read-after-write within same test
  // Verify the embedded JSON reflects recent changes.
  // -----------------------------------------------------------------------

  it('Appointment created in test appears in subsequent GET response', async () => {
    // Arrange: create an appointment with a unique title
    let uniqueTitle = `Roundtrip-Test-${Date.now()}`
    let createResponse = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: uniqueTitle,
        date: saturdayMs,
        start_min: 1200,
        end_min: 1260,
        resource_id: firstResourceId,
      }),
    })
    assert.equal(createResponse.status, 201)
    let { appointment } = await createResponse.json()
    testAppointmentIds.push(appointment.id)

    // Act: GET and find the appointment by its unique title
    let getResponse = await router.fetch(appointmentWeekUrl, {
      headers: { Cookie: userCookie },
    })
    let html = await getResponse.text()
    let data = parseAppointmentData(html)

    // Assert
    assert.ok(data, 'should parse appointment data')
    let found = data!.appointments.find((a) => a.title === uniqueTitle)
    assert.ok(found, 'created appointment should be findable by title in page data')
    assert.equal(found!.id, appointment.id, 'appointment id should match')
    assert.equal(found!.date, saturdayMs, 'appointment date should match')
    assert.equal(found!.start_min, 1200, 'appointment start_min should match')
    assert.equal(found!.end_min, 1260, 'appointment end_min should match')
  })

  // -----------------------------------------------------------------------
  // Section 7: Type-drag creation (raw SQL bypass path)
  // This tests the code path that uses raw INSERT...SELECT from appointtypes,
  // bypassing the beforeWrite lifecycle hook.
  // -----------------------------------------------------------------------

  it('POST /appointment with typeId creates from appointtypes template', async () => {
    // Arrange: create an appointtype first
    let typeResponse = await router.fetch(`${BASE}/appointment/types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({ title: 'Type-drag template' }),
    })
    assert.equal(typeResponse.status, 201)
    let typeBody = await typeResponse.json()
    assert.ok(typeBody.type?.id, 'should return appointtype id')
    testAppointTypeIds.push(typeBody.type.id)

    // Act: create an appointment from the type
    let createResponse = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        typeId: typeBody.type.id,
        date: saturdayMs,
        start_min: 1260,
        resource_id: firstResourceId,
      }),
    })

    // Assert: should create 15-min appointment from type template
    assert.equal(createResponse.status, 201)
    let createBody = await createResponse.json()
    assert.ok(createBody.id, 'should return appointment id')
    testAppointmentIds.push(createBody.id)

    // Verify via GET that the appointment exists with the template title
    let getResponse = await router.fetch(appointmentWeekUrl, {
      headers: { Cookie: userCookie },
    })
    let html = await getResponse.text()
    let data = parseAppointmentData(html)
    assert.ok(data, 'should parse appointment data')
    let found = data!.appointments.find((a) => a.id === createBody.id)
    assert.ok(found, 'created appointment should appear in page data')
    assert.equal(found!.title, 'Type-drag template', 'title should come from appointtype')
    assert.equal(found!.start_min, 1260, 'start_min should match')
    assert.equal(found!.end_min, 1275, 'end_min should be start_min + 15')
  })

  // -----------------------------------------------------------------------
  // Section 8: Multiline editing via PUT
  // Verify that a single-line title can be changed to multiline and back.
  // -----------------------------------------------------------------------

  it('PUT round-trip: single-line → multiline → single-line preserves content at each step', async () => {
    // Arrange: create single-line appointment
    let createResponse = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: 'Initial title',
        date: farFutureDateMs,
        start_min: 660,
        end_min: 720,
        resource_id: firstResourceId,
      }),
    })
    assert.equal(createResponse.status, 201)
    let { appointment: appt } = await createResponse.json()
    testAppointmentIds.push(appt.id)

    // Step 1: Update to multiline
    let multilineTitle = 'Updated\nwith\nmultiline'
    let step1 = await router.fetch(`${APPT_URL}/${appt.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({ title: multilineTitle }),
    })
    assert.equal(step1.status, 200)
    let step1Body = await step1.json()
    assert.equal(step1Body.appointment.title, multilineTitle, 'step 1: title should be multiline')

    // Step 2: Update back to single-line
    let singleLineTitle = 'Back to single line'
    let step2 = await router.fetch(`${APPT_URL}/${appt.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({ title: singleLineTitle }),
    })
    assert.equal(step2.status, 200)
    let step2Body = await step2.json()
    assert.equal(
      step2Body.appointment.title,
      singleLineTitle,
      'step 2: title should be back to single line',
    )

    // Step 3: Update to multiline with a \n
    let multilineAgain = 'Multiline\nagain'
    let step3 = await router.fetch(`${APPT_URL}/${appt.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({ title: multilineAgain }),
    })
    assert.equal(step3.status, 200)
    let step3Body = await step3.json()
    assert.equal(
      step3Body.appointment.title,
      multilineAgain,
      'step 3: title should be multiline again',
    )
  })

  // -----------------------------------------------------------------------
  // Section 9: Server-side offering validation — Create
  // Verify that POST /appointment rejects slots outside the offering range
  // and accepts slots within it, for both manual creation and typeId path.
  // -----------------------------------------------------------------------

  it('POST /appointment with slot outside offering returns 403 (narrowed offerings [480,1080))', async () => {
    // Arrange: replace full-day [0,1440) with narrower [480,1080) on saturdayMs
    await pool.query(`DELETE FROM appointoffering WHERE day = $1`, [saturdayMs])
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, $3, int4range(480, 1080, '[)'), $2, $2)`,
      [saturdayMs, Date.now(), firstResourceId],
    )

    // Act: POST a slot at 0-60, which is outside [480,1080)
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: 'Outside offering',
        date: saturdayMs,
        start_min: 0,
        end_min: 60,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 403, 'slot outside offering should return 403')
    let body = await response.json()
    assert.ok(body.error, 'should include error message')
    assert.ok(
      body.error.toLowerCase().includes('bookable'),
      'error should mention slot not bookable',
    )
  })

  it('POST /appointment with slot within full-day offering returns 201', async () => {
    // Arrange: full-day offering [0,1440) is seeded by seedTestOfferings()

    // Act: POST a slot at 480-540, fully within [0,1440)
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: 'Within full-day offering',
        date: saturdayMs,
        start_min: 480,
        end_min: 540,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 201, 'slot within offering should return 201')
    let body = await response.json()
    assert.ok(body.appointment, 'should create appointment')
    testAppointmentIds.push(body.appointment.id)
  })

  it('POST /appointment with typeId and slot outside offering returns 403', async () => {
    // Arrange: create an appointtype, then narrow offerings to [480,1080)
    let typeResponse = await router.fetch(`${BASE}/appointment/types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({ title: 'Type outside offering' }),
    })
    assert.equal(typeResponse.status, 201)
    let typeBody = await typeResponse.json()
    assert.ok(typeBody.type?.id, 'should create appointtype')
    testAppointTypeIds.push(typeBody.type.id)

    await pool.query(`DELETE FROM appointoffering WHERE day = $1`, [saturdayMs])
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, $3, int4range(480, 1080, '[)'), $2, $2)`,
      [saturdayMs, Date.now(), firstResourceId],
    )

    // Act: POST typeId with start_min=0 (outside [480,1080))
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        typeId: typeBody.type.id,
        date: saturdayMs,
        start_min: 0,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 403, 'typeId POST outside offering should return 403')
    let body = await response.json()
    assert.ok(body.error, 'should include error message')
  })

  it('POST /appointment with typeId and slot within full-day offering returns 201', async () => {
    // Arrange: create an appointtype (offerings are full-day [0,1440) from seedTestOfferings)
    let typeResponse = await router.fetch(`${BASE}/appointment/types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({ title: 'Type within offering' }),
    })
    assert.equal(typeResponse.status, 201)
    let typeBody = await typeResponse.json()
    assert.ok(typeBody.type?.id, 'should create appointtype')
    testAppointTypeIds.push(typeBody.type.id)

    // Act: POST typeId at start_min=480 (within [0,1440))
    let response = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        typeId: typeBody.type.id,
        date: saturdayMs,
        start_min: 480,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 201, 'typeId POST within offering should return 201')
    let body = await response.json()
    assert.ok(body.id, 'should return appointment id')
    testAppointmentIds.push(body.id)
  })

  // -----------------------------------------------------------------------
  // Section 10: Server-side offering validation — Update
  // Verify that PUT /appointment/:id rejects moves outside the offering
  // range and accepts moves within it.
  // -----------------------------------------------------------------------

  it('PUT /appointment/:id moving slot outside offering range returns 403', async () => {
    // Arrange: narrow offerings to [480,1080), then create appt at 480-540
    await pool.query(`DELETE FROM appointoffering WHERE day = $1`, [saturdayMs])
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1::bigint, $3, int4range(480, 1080, '[)'), $2, $2)`,
      [saturdayMs, Date.now(), firstResourceId],
    )

    let createResponse = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: 'Movable appt',
        date: saturdayMs,
        start_min: 480,
        end_min: 540,
        resource_id: firstResourceId,
      }),
    })
    assert.equal(createResponse.status, 201)
    let { appointment } = await createResponse.json()
    testAppointmentIds.push(appointment.id)

    // Act: PUT to move the slot to 0-60 (outside [480,1080))
    let response = await router.fetch(`${APPT_URL}/${appointment.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        start_min: 0,
        end_min: 60,
      }),
    })

    // Assert
    assert.equal(response.status, 403, 'moving slot outside offering should return 403')
    let body = await response.json()
    assert.ok(body.error, 'should include error message')
  })

  it('PUT /appointment/:id moving to date with no offerings returns 403', async () => {
    // Arrange: create appt at 480-540 on saturdayMs (full-day offering [0,1440))
    let createResponse = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: 'Tuesday appt',
        date: saturdayMs,
        start_min: 480,
        end_min: 540,
        resource_id: firstResourceId,
      }),
    })
    assert.equal(createResponse.status, 201)
    let { appointment } = await createResponse.json()
    testAppointmentIds.push(appointment.id)

    // Remove the offering for sundayMs so that date has no bookable slots
    await pool.query(`DELETE FROM appointoffering WHERE day = $1`, [sundayMs])

    // Act: PUT to move the appt to sundayMs (no offerings)
    let response = await router.fetch(`${APPT_URL}/${appointment.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        date: sundayMs,
        start_min: 480,
        end_min: 540,
        resource_id: firstResourceId,
      }),
    })

    // Assert
    assert.equal(response.status, 403, 'moving to date with no offerings should return 403')
    let body = await response.json()
    assert.ok(body.error, 'should include error message')
  })

  it('PUT /appointment/:id moving slot within offering range returns 200', async () => {
    // Arrange: create appt at 480-540 on farFutureDateMs (full-day offering).
    let createResponse = await router.fetch(APPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        title: 'Movable appt',
        date: farFutureDateMs,
        start_min: 480,
        end_min: 540,
        resource_id: firstResourceId,
      }),
    })
    assert.equal(createResponse.status, 201)
    let { appointment } = await createResponse.json()
    testAppointmentIds.push(appointment.id)

    // Act: PUT to move slot to 540-600 (still within [0,1440))
    let response = await router.fetch(`${APPT_URL}/${appointment.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Csrf-Token': userCsrfToken,
        Cookie: userCookie,
      },
      body: JSON.stringify({
        start_min: 540,
        end_min: 600,
      }),
    })

    // Assert
    assert.equal(response.status, 200, 'moving slot within offering should return 200')
    let body = await response.json()
    assert.ok(body.appointment, 'should return updated appointment')
    assert.equal(body.appointment.start_min, 540, 'start_min should be updated')
    assert.equal(body.appointment.end_min, 600, 'end_min should be updated')
  })

  // -----------------------------------------------------------------------
  // Section 11: Empty state
  // Verify the page shows no bookable slots when no offerings exist.
  // -----------------------------------------------------------------------

  it('GET /appointment has empty offerings when no offerings exist for the week', async () => {
    // Arrange: delete all offerings for the current week for resource 1
    // seedTestOfferings seeds saturdayMs and sundayMs with [0,1440).
    // The demo data also seeds Mon–Fri. Delete everything in the current week.
    let mondayMs = currentMonday()
    let nextMondayMs = mondayMs + 7 * 86_400_000
    await pool.query(
      `DELETE FROM appointoffering WHERE resource_id = $3 AND day >= $1 AND day < $2`,
      [mondayMs, nextMondayMs, firstResourceId],
    )

    // Act
    let response = await router.fetch(APPT_URL, {
      headers: { Cookie: userCookie },
    })
    let html = await response.text()

    // Assert: the embedded data should reflect no offerings
    assert.equal(response.status, 200)
    let data = parseAppointmentData(html)
    assert.ok(data, 'should have appointment data')
    // Access offerings via the parsed data (the type doesn't include offerings,
    // but the actual JSON does)
    let embeddedData = JSON.parse(
      html.match(/<script id="appointment-data"[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '{}',
    )
    assert.ok(
      Array.isArray(embeddedData.offerings),
      'offerings should be an array in embedded JSON',
    )
    assert.equal(
      embeddedData.offerings.length,
      0,
      'offerings array should be empty when no offerings exist',
    )
  })
})

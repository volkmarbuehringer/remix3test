import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../router.ts'
import { initializeAppDatabase, pool } from '../data/setup.ts'
import { createAuthCookieWithCsrfForUser } from '../test-utils.ts'

// ---------------------------------------------------------------------------
// Admin Appointments Controller integration tests
//
// Tests the CRUD operations at /admin/appointments through the router:
//   - index (GET)
//   - create (POST)
//   - update (PUT /:id)
//   - destroy (DELETE /:id)
//
// Auth gating: requires both authentication AND admin role.
// Mutation requests require CSRF protection via X-Csrf-Token header.
// Error messages are in German (user-facing).
//
// Past-date guard: appointments with dates before today (UTC) cannot be
// created or updated. Only admins can delete past appointments.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const ADMIN_APPT_URL = `${BASE}/admin/appointments`

// Track IDs created during tests for cleanup
const createdAppointmentIds: number[] = []
// IDs of test-scoped resources and offerings we create for self-contained testing
let testResourceId: number
let testResource2Id: number

describe('Admin Appointments Controller', () => {
  let adminCookie: string
  let adminCsrfToken: string
  let userCookie: string
  let resourceId: number
  let resource2Id: number
  let userId: number
  let offeringDateStr: string // YYYY-MM-DD with a valid offering
  let offeringBoundsStart: number // start of offering range in minutes (e.g., 480 = 08:00)
  let offeringBoundsEnd: number   // end of offering range in minutes (e.g., 1080 = 18:00)
  let _slotCounter = 0
  // Returns a unique 1-hour slot within the offering, so tests don't collide.
  // Each call OUTSIDE a test (e.g., in before/after hooks) should NOT use this.
  function nextSlot(): { startMin: number; endMin: number } {
    let slotWidth = 30
    let startMin = offeringBoundsStart + 60 + _slotCounter * slotWidth
    let maxStart = offeringBoundsEnd - slotWidth
    if (startMin >= maxStart) {
      throw new Error(`nextSlot(): ran out of available slots (offering ${offeringBoundsStart}–${offeringBoundsEnd}, used ${_slotCounter} slots). Move some tests to nextSlot2 or increase offering range.`)
    }
    _slotCounter++
    return { startMin, endMin: startMin + slotWidth }
  }

  before(async () => {
    await initializeAppDatabase()
    let now = Date.now()

    // ── Create a self-contained test resource WITH offerings ──
    let r1 = await pool.query(
      'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
      ['Test Resource - Admin Appointments', now, now],
    )
    resourceId = r1.rows[0].id as number
    testResourceId = resourceId

    // ── Create a second test resource WITHOUT offerings ──
    let r2 = await pool.query(
      'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
      ['Test Resource No Offerings - Admin Appointments', now, now],
    )
    resource2Id = r2.rows[0].id as number
    testResource2Id = resource2Id

    // ── Create a test offering for resourceId: tomorrow 08:00–18:00 ──
    let today = new Date()
    let tomorrow = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + 86_400_000
    await pool.query(
      `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
       VALUES ($1, $2, '[480,1080)', $3, $3)`,
      [tomorrow, resourceId, now],
    )
    offeringBoundsStart = 480
    offeringBoundsEnd = 1080
    offeringDateStr = new Date(tomorrow).toISOString().slice(0, 10)

    // Reset slot counter between test suite runs for isolation
    _slotCounter = 0

    // ── Admin session (for authorized tests) ──
    let adminAuth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!adminAuth?.cookie) {
      throw new Error('Failed to create admin session — check admin@newapp.com exists in seed data')
    }
    adminCookie = adminAuth.cookie
    adminCsrfToken = adminAuth.csrfToken

    // ── Non-admin user session (for 403 tests) ──
    let userAuth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!userAuth?.cookie) {
      throw new Error('Failed to create user session — check user@newapp.com exists in seed data')
    }
    userCookie = userAuth.cookie

    let userResult = await pool.query('SELECT id FROM users WHERE email = $1', ['user@newapp.com'])
    userId = userResult.rows[0]?.id as number
  })

  after(async () => {
    // Clean up only the data tied to our test resources
    for (let id of createdAppointmentIds) {
      try {
        await pool.query('DELETE FROM appointments WHERE id = $1', [id])
      } catch {
        // Ignore cleanup errors
      }
    }
    // Remove test offerings and resources
    try {
      await pool.query('DELETE FROM appointoffering WHERE resource_id = $1 OR resource_id = $2', [testResourceId, testResource2Id])
    } catch { /* ignore */ }
    try {
      await pool.query('DELETE FROM resources WHERE id = $1 OR id = $2', [testResourceId, testResource2Id])
    } catch { /* ignore */ }
  })

  // =========================================================================
  // 1. Authentication & Authorization
  // =========================================================================

  describe('Authentication & Authorization', () => {
    it('GET /admin/appointments redirects to login when not authenticated', async () => {
      // Arrange
      // Act
      let response = await router.fetch(ADMIN_APPT_URL, { redirect: 'manual' })

      // Assert
      assert.equal(response.status, 302, 'unauthenticated GET should redirect')
      let location = response.headers.get('Location')
      assert.ok(location?.startsWith('/login'), 'should redirect to /login')
    })

    it('returns 403 for non-admin users', async () => {
      // Arrange & Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        headers: { Cookie: userCookie },
      })

      // Assert
      assert.equal(response.status, 403, 'non-admin GET should return 403')
    })

    it('POST /admin/appointments without CSRF token returns 403', async () => {
      // Arrange: send POST without any CSRF token
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Test',
        date: '2026-06-01',
        start_min: '480',
        end_min: '540',
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 403, 'POST without CSRF should return 403')
    })

    it('PUT /admin/appointments/:id without CSRF token returns 403', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Test',
        date: '2026-06-01',
        start_min: '480',
        end_min: '540',
      })

      // Act
      let response = await router.fetch(`${ADMIN_APPT_URL}/1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 403, 'PUT without CSRF should return 403')
    })
  })

  // =========================================================================
  // 2. Index / List View
  // =========================================================================

  describe('Index / List view', () => {
    it('returns 200 for admin user', async () => {
      // Arrange & Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        headers: { Cookie: adminCookie },
      })

      // Assert
      assert.equal(response.status, 200, 'admin GET /admin/appointments should return 200')
    })

    it('renders the Appointments heading', async () => {
      // Arrange & Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        headers: { Cookie: adminCookie },
      })
      let html = await response.text()

      // Assert
      assert.ok(html.includes('Appointments'), 'page should render Appointments heading')
    })

    it('includes resource descriptions from seed data', async () => {
      // Arrange & Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        headers: { Cookie: adminCookie },
      })
      let html = await response.text()

      // Assert: the page renders the search form and heading
      assert.ok(html.includes('Appointments'), 'page should render Appointments heading')
      assert.ok(
        html.includes('Suche nach Titel') || html.includes('Suchen'),
        'page should include search form',
      )
    })

    it('shows empty search result message when filter matches nothing', async () => {
      // Arrange & Act: search for a string that won't match any appointment
      let response = await router.fetch(`${ADMIN_APPT_URL}?filter=ZZZZNOMATCHXXXX`, {
        headers: { Cookie: adminCookie },
      })
      let html = await response.text()

      // Assert
      assert.ok(
        html.includes('Keine Termine gefunden'),
        'should show empty search result message',
      )
    })

    it('respects sorting parameters', async () => {
      // Arrange: create two appointments with different titles
      let dayMs1 = new Date('2026-05-01T00:00:00Z').getTime()
      let dayMs2 = new Date('2026-05-02T00:00:00Z').getTime()
      let now = Date.now()

      let r1 = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [userId, resourceId, 'AAAA Earlier', dayMs1, '[480,540)', now],
      )
      let r2 = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [userId, resourceId, 'ZZZZ Later', dayMs2, '[540,600)', now],
      )
      createdAppointmentIds.push(r1.rows[0].id, r2.rows[0].id)

      // Act: sort by title ascending, filter to only our test appointments
      let response = await router.fetch(`${ADMIN_APPT_URL}?sort=a.title&order=asc`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200, 'sort request should return 200')
      let html = await response.text()

      // Assert: sort URL references use the correct column
      assert.ok(html.includes('sort=a.title'), 'sort URL should reference title column')
      // Page should render table with sortable columns
      assert.ok(html.includes('thead'), 'page should have table header')
      // The created appointment should appear in the page
      assert.ok(
        html.includes('AAAA Earlier'),
        'at least AAAA Earlier should appear in rendered results',
      )
    })

    it('respects pagination offset', async () => {
      // Arrange & Act: request with a large offset (beyond available data)
      let response = await router.fetch(`${ADMIN_APPT_URL}?offset=1000`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let html = await response.text()

      // Assert: with offset beyond data, we see the empty state
      assert.ok(
        html.includes('Keine Termine vorhanden') || html.includes('Keine Termine gefunden'),
        'large offset should result in empty table',
      )
    })
  })

  // =========================================================================
  // 3. Offering & Collision Validation
  // =========================================================================

  describe('Offering & Collision Validation', () => {
    it('2.1 create succeeds when slot is within offering hours', async () => {
      // Arrange: use resourceId which has offerings; slot is within offering range
      let { startMin: sm, endMin: em } = nextSlot()
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Valid Offering Create',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'create within offering should redirect')
      let location = response.headers.get('Location') ?? ''
      let match = location.match(/editing=(\d+)/)
      assert.ok(match, 'should redirect with editing param')
      if (match) createdAppointmentIds.push(parseInt(match[1], 10))
    })

    it('2.2 create fails with offering error when slot is outside offering hours', async () => {
      // Arrange: use resource2Id which has NO offerings
      let { startMin: sm, endMin: em } = nextSlot()
      let body = new URLSearchParams({
        resource_id: String(resource2Id),
        user_id: String(userId),
        title: 'Invalid Offering Create',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'create outside offering should redirect with error')
      let location = response.headers.get('Location') ?? ''
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Buchungszeiten'),
        'should include German error about booking hours',
      )
    })

    it('2.3 create fails with collision error when time range overlaps another appointment', async () => {
      // Arrange: create the first appointment via controller
      let { startMin: sm, endMin: em } = nextSlot()
      let dayDate = offeringDateStr
      // Use compact overlapping slots within the allocated 30-min window
      let slotAStart = sm
      let slotAEnd = em
      let slotBStart = sm + 15  // overlaps with A by 15 min

      let bodyA = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Collision Test A',
        date: dayDate,
        start_min: String(slotAStart),
        end_min: String(slotAEnd),
      })

      let responseA = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: bodyA.toString(),
        redirect: 'manual',
      })

      assert.equal(responseA.status, 302, 'first appointment should be created')
      let locationA = responseA.headers.get('Location') ?? ''
      let matchA = locationA.match(/editing=(\d+)/)
      assert.ok(matchA, 'first appointment should get an editing ID')
      createdAppointmentIds.push(parseInt(matchA![1], 10))

      // Act: create a second that overlaps
      let bodyB = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Collision Test B',
        date: dayDate,
        start_min: String(slotBStart),
        end_min: String(slotAEnd),
      })

      let responseB = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: bodyB.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(responseB.status, 302, 'overlapping create should redirect with error')
      let locationB = responseB.headers.get('Location') ?? ''
      assert.ok(locationB.includes('creating=true'), 'should preserve creating param')
      assert.ok(
        decodeURIComponent(locationB.replace(/\+/g, ' ')).includes('überschneidet'),
        'should include German error about overlapping',
      )
    })

    it('2.4 update succeeds when slot stays within offering hours (title-only works)', async () => {
      // Arrange: create an appointment then update only the title
      let { startMin: sm, endMin: em } = nextSlot()
      let createBody = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Update Title Test',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
      })

      let createResponse = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: createBody.toString(),
        redirect: 'manual',
      })

      assert.equal(createResponse.status, 302, 'create should succeed')
      let createLocation = createResponse.headers.get('Location') ?? ''
      let match = createLocation.match(/editing=(\d+)/)
      assert.ok(match, 'should get editing param')
      let testId = parseInt(match![1], 10)
      createdAppointmentIds.push(testId)

      // Act: update only the title, keeping same date/time/resource
      let updateBody = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Updated Title',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
      })

      let updateResponse = await router.fetch(`${ADMIN_APPT_URL}/${testId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: updateBody.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(updateResponse.status, 302, 'update within offering should succeed')
    })

    it('2.5 update fails with offering error when new slot is outside offering hours', async () => {
      // Arrange: create an appointment with a valid offering, then update to a resource without offerings
      let { startMin: sm, endMin: em } = nextSlot()
      let createBody = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Offering Fail Update',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
      })

      let createResponse = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: createBody.toString(),
        redirect: 'manual',
      })

      assert.equal(createResponse.status, 302, 'create should succeed')
      let createLocation = createResponse.headers.get('Location') ?? ''
      let match = createLocation.match(/editing=(\d+)/)
      assert.ok(match, 'should get editing param')
      let testId = parseInt(match![1], 10)
      createdAppointmentIds.push(testId)

      // Act: update to resource2Id which has no offerings
      let updateBody = new URLSearchParams({
        resource_id: String(resource2Id),
        user_id: String(userId),
        title: 'Offering Fail Update',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
      })

      let updateResponse = await router.fetch(`${ADMIN_APPT_URL}/${testId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: updateBody.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(updateResponse.status, 302, 'update outside offering should redirect with error')
      let location = updateResponse.headers.get('Location') ?? ''
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Buchungszeiten'),
        'should include German error about booking hours',
      )
    })

    it('2.6 update fails with collision error when new time range overlaps another appointment', async () => {
      // Arrange: create two non-overlapping appointments directly, then update one to overlap
      let { startMin: sm, endMin: em } = nextSlot()
      let dayDate = offeringDateStr
      let dayMs = new Date(`${dayDate}T00:00:00Z`).getTime()
      let now = Date.now()
      let mid = sm + 15 // midpoint of the 30-min slot

      // Appointment A: [sm, mid) — first half of slot
      let resultA = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, 'Overlap Test A', $3, int4range($4, $5, \'[)\'), $6, $6)
         RETURNING id`,
        [userId, resourceId, dayMs, sm, mid, now],
      )
      let idA = resultA.rows[0].id as number
      createdAppointmentIds.push(idA)

      // Appointment B: [mid, em) — second half of slot, does NOT overlap with A
      let resultB = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, 'Overlap Test B', $3, int4range($4, $5, \'[)\'), $6, $6)
         RETURNING id`,
        [userId, resourceId, dayMs, mid, em, now],
      )
      let idB = resultB.rows[0].id as number
      createdAppointmentIds.push(idB)

      // Act: update B to [sm, mid) which overlaps with A
      let updateBody = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Overlap Test B (moved)',
        date: dayDate,
        start_min: String(sm),
        end_min: String(mid),
      })

      let response = await router.fetch(`${ADMIN_APPT_URL}/${idB}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: updateBody.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'overlapping update should redirect with error')
      let location = response.headers.get('Location') ?? ''
      assert.ok(location.includes('error='), 'should include error parameter')
      assert.ok(
        location.includes('editing='),
        'should include editing param to stay on edit mode',
      )
    })
  })

  // =========================================================================
  // 4. Create (POST /admin/appointments)
  // =========================================================================

  describe('Create', () => {
    it('creates a new appointment and redirects to edit mode', async () => {
      // Arrange
      let { startMin: sm, endMin: em } = nextSlot()
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Test Termin Erstellung',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'successful create should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(location.startsWith('/admin/appointments'), 'should redirect to /admin/appointments')
      assert.ok(location.includes('editing='), 'should redirect with editing param pointing to new appointment')

      // Verify appointment exists in database
      let match = location.match(/editing=(\d+)/)
      assert.ok(match, 'editing param should contain a numeric ID')
      let newId = parseInt(match![1], 10)
      createdAppointmentIds.push(newId)

      let checkResult = await pool.query('SELECT title FROM appointments WHERE id = $1', [newId])
      assert.equal(checkResult.rows.length, 1, 'appointment should exist in database')
      assert.equal(
        (checkResult.rows[0] as { title: string }).title,
        'Test Termin Erstellung',
        'title should match',
      )
    })

    it('returns error redirect with German message for empty title', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: '',
        date: '2026-06-15',
        start_min: '480',
        end_min: '540',
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'validation error should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Titel ist erforderlich'),
        'redirect should include error: Titel ist erforderlich',
      )
    })

    it('returns error redirect for missing resource_id', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: '0',  // invalid — parseInt returns NaN or 0
        user_id: String(userId),
        title: 'Test',
        date: '2026-06-15',
        start_min: '480',
        end_min: '540',
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'validation error should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Ressource ist erforderlich'),
        'redirect should include error: Ressource ist erforderlich',
      )
    })

    it('returns error redirect for missing user_id', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: '0',  // invalid
        title: 'Test',
        date: '2026-06-15',
        start_min: '480',
        end_min: '540',
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'validation error should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Benutzer ist erforderlich'),
        'redirect should include error: Benutzer ist erforderlich',
      )
    })

    it('returns error redirect for invalid date format (not YYYY-MM-DD)', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Test',
        date: '15-06-2026',  // wrong format
        start_min: '480',
        end_min: '540',
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'validation error should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Datum'),
        'redirect should include Datum in error message',
      )
    })

    it('returns error redirect when end time is before start time', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Test',
        date: '2026-06-15',
        start_min: '540',  // 09:00
        end_min: '480',    // 08:00 — before start
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'validation error should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Endzeit muss nach der Startzeit liegen'),
        'redirect should include German end-time validation error',
      )
    })

    it('returns error redirect when end time equals start time', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Test',
        date: '2026-06-15',
        start_min: '480',
        end_min: '480',  // same as start
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'validation error should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Endzeit'),
        'redirect should contain Endzeit error',
      )
    })

    it('returns error redirect for invalid start_min (not divisible by 60)', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Test',
        date: '2026-06-15',
        start_min: '125',  // not divisible by 60, not hourly
        end_min: '540',
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'validation error should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Startzeit'),
        'redirect should include Startzeit in error message',
      )
    })

    it('returns error redirect for start_min out of valid range (negative)', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Test',
        date: '2026-06-15',
        start_min: '-60',
        end_min: '540',
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'validation error should redirect')
    })

    it('handles overlapping time range with German error redirect', async () => {
      // Arrange: create the first appointment to occupy a time slot
      let { startMin: sm, endMin: em } = nextSlot()
      let dayDate = offeringDateStr
      let slotAstart = sm
      let slotAend = em
      let slotBstart = sm + 15  // overlaps with A by 15 min
      let slotBend = em

      let bodyA = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Erster Termin',
        date: dayDate,
        start_min: String(slotAstart),
        end_min: String(slotAend),
      })

      let responseA = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: bodyA.toString(),
        redirect: 'manual',
      })

      assert.equal(responseA.status, 302, 'first appointment should be created')
      let locationA = responseA.headers.get('Location') ?? ''
      let matchA = locationA.match(/editing=(\d+)/)
      assert.ok(matchA, 'first appointment should get an editing ID')
      createdAppointmentIds.push(parseInt(matchA![1], 10))

      // Act: create a second appointment that overlaps with the first
      let bodyB = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Überschneidender Termin',
        date: dayDate,
        start_min: String(slotBstart),
        end_min: String(slotBend),
      })

      let responseB = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: bodyB.toString(),
        redirect: 'manual',
      })

      // Assert: overlapping should redirect with error (exclusion constraint caught)
      assert.equal(responseB.status, 302, 'overlapping should redirect with error')
      let locationB = responseB.headers.get('Location') ?? ''
      assert.ok(locationB.includes('creating=true'), 'should preserve creating param')
      assert.ok(
        locationB.includes('error='),
        'should include error parameter with German message',
      )
    })

    it('rejects creating an appointment with a past date', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Past Date Test',
        date: '2024-01-01',  // definitely in the past
        start_min: '480',
        end_min: '540',
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'past-date create should redirect with error')
      let location = response.headers.get('Location') ?? ''
      assert.ok(location.includes('error='), 'should include error parameter')
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Vergangenheit'),
        'error should mention past (Vergangenheit)',
      )
    })

    it('preserves grid state (sort, order, filter) on successful create', async () => {
      // Arrange
      let { startMin: sm, endMin: em } = nextSlot()
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Grid State Preservation Test',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
        _sort: 'a.title',
        _order: 'desc',
        _filter: 'testsearch',
      })

      // Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'create should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(location.includes('sort=a.title'), 'should preserve sort param')
      assert.ok(location.includes('order=desc'), 'should preserve order param')
      assert.ok(location.includes('filter=testsearch'), 'should preserve filter param')

      let match = location.match(/editing=(\d+)/)
      if (match) createdAppointmentIds.push(parseInt(match[1], 10))
    })
  })

  // =========================================================================
  // 5. Update (PUT /admin/appointments/:id)
  // =========================================================================

  describe('Update', () => {
    let appointmentId: number

    before(async () => {
      // Create a test appointment to update
      let dayMs = new Date('2026-07-01T00:00:00Z').getTime()
      let result = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, 'Zu aktualisierender Termin', $3, '[480,540)', $4, $4)
         RETURNING id`,
        [userId, resourceId, dayMs, Date.now()],
      )
      appointmentId = result.rows[0].id as number
      createdAppointmentIds.push(appointmentId)
    })

    it('updates an existing appointment and redirects to grid', async () => {
      // Arrange
      let { startMin: sm, endMin: em } = nextSlot()
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Aktualisierter Termin',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
      })

      // Act
      let response = await router.fetch(`${ADMIN_APPT_URL}/${appointmentId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'successful update should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(location.startsWith('/admin/appointments'), 'should redirect to /admin/appointments')

      // Verify the appointment was actually updated in the database
      let checkResult = await pool.query('SELECT title FROM appointments WHERE id = $1', [appointmentId])
      assert.equal(checkResult.rows.length, 1, 'appointment should exist')
      assert.equal(
        (checkResult.rows[0] as { title: string }).title,
        'Aktualisierter Termin',
        'title should be updated in database',
      )
    })

    it('rejects updating an appointment to a past date', async () => {
      // Arrange: update to a date that is definitely in the past
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Past Date Update Test',
        date: '2024-02-01',  // definitely in the past
        start_min: '480',
        end_min: '540',
      })

      // Act
      let response = await router.fetch(`${ADMIN_APPT_URL}/${appointmentId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'past-date update should redirect with error')
      let location = response.headers.get('Location') ?? ''
      assert.ok(location.includes('error='), 'should include error parameter')
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Vergangenheit'),
        'error should mention past (Vergangenheit)',
      )
    })

    it('returns error redirect for non-existent appointment ID', async () => {
      // Arrange
      let { startMin: sm, endMin: em } = nextSlot()
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Nicht existent',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
      })

      // Act
      let response = await router.fetch(`${ADMIN_APPT_URL}/9999999`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'non-existent ID should redirect with error')
      let location = response.headers.get('Location') ?? ''
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Eintrag nicht gefunden'),
        'redirect should include error: Eintrag nicht gefunden',
      )
    })

    it('returns error redirect for invalid update data', async () => {
      // Arrange: missing title (empty)
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: '',
        date: '2026-07-01',
        start_min: '480',
        end_min: '540',
      })

      // Act
      let response = await router.fetch(`${ADMIN_APPT_URL}/${appointmentId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'validation error should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Titel ist erforderlich'),
        'redirect should include error: Titel ist erforderlich',
      )
    })

    it('handles overlapping time range on update with error redirect', async () => {
      // Arrange: create two non-overlapping appointments, then update one to overlap with the other
      let dayDate = offeringDateStr
      let dayMs = new Date(`${dayDate}T00:00:00Z`).getTime()
      let now = Date.now()

      // Appointment A: [480, 510) — well before nextSlot() range [540, …)
      let resultA = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, 'Termin A', $3, '[480,510)', $4, $4)
         RETURNING id`,
        [userId, resourceId, dayMs, now],
      )
      let idA = resultA.rows[0].id as number
      createdAppointmentIds.push(idA)

      // Appointment B: [510, 540) — does NOT overlap with A
      let resultB = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, 'Termin B', $3, '[510,540)', $4, $4)
         RETURNING id`,
        [userId, resourceId, dayMs, now],
      )
      let idB = resultB.rows[0].id as number
      createdAppointmentIds.push(idB)

      // Act: update B to [495, 510) which overlaps with A [480,510)
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Termin B (verschoben)',
        date: dayDate,
        start_min: '495',
        end_min: '510',
      })

      let response = await router.fetch(`${ADMIN_APPT_URL}/${idB}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'overlapping update should redirect with error')
      let location = response.headers.get('Location') ?? ''
      assert.ok(location.includes('error='), 'should include error parameter')
      assert.ok(
        location.includes('editing='),
        'should include editing param to stay on edit mode',
      )
    })

    it('preserves grid state on successful update', async () => {
      // Arrange
      let { startMin: sm, endMin: em } = nextSlot()
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Grid State Update',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
        _sort: 'a.date',
        _order: 'asc',
        _filter: 'updatefilter',
      })

      // Act
      let response = await router.fetch(`${ADMIN_APPT_URL}/${appointmentId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'update should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(location.includes('sort=a.date'), 'should preserve sort param')
      assert.ok(location.includes('order=asc'), 'should preserve order param')
      assert.ok(location.includes('filter=updatefilter'), 'should preserve filter param')
    })
  })

  // =========================================================================
  // 6. Delete (DELETE /admin/appointments/:id)
  // =========================================================================

  describe('Delete', () => {
    it('deletes an existing appointment and redirects to grid', async () => {
      // Arrange: create a dedicated appointment to delete
      let dayMs = new Date('2026-08-01T00:00:00Z').getTime()
      let result = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, 'Zu löschender Termin', $3, '[480,540)', $4, $4)
         RETURNING id`,
        [userId, resourceId, dayMs, Date.now()],
      )
      let deleteId = result.rows[0].id as number
      createdAppointmentIds.push(deleteId)

      // Act
      let response = await router.fetch(`${ADMIN_APPT_URL}/${deleteId}`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: new URLSearchParams().toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'successful delete should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(location.startsWith('/admin/appointments'), 'should redirect to /admin/appointments')

      // Verify deletion from database
      let checkResult = await pool.query('SELECT id FROM appointments WHERE id = $1', [deleteId])
      assert.equal(checkResult.rows.length, 0, 'appointment should be deleted from database')
    })

    it('returns error redirect for non-existent appointment ID on delete', async () => {
      // Arrange & Act
      let response = await router.fetch(`${ADMIN_APPT_URL}/9999999`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: new URLSearchParams().toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'non-existent ID should redirect with error')
      let location = response.headers.get('Location') ?? ''
      assert.ok(
        decodeURIComponent(location.replace(/\+/g, ' ')).includes('Eintrag nicht gefunden'),
        'redirect should include error: Eintrag nicht gefunden',
      )
    })

    it('includes grid state parameters in redirect after delete', async () => {
      // Arrange: create an appointment to delete
      let dayMs = new Date('2026-08-20T00:00:00Z').getTime()
      let result = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, 'Delete redirect test', $3, '[480,540)', $4, $4) RETURNING id`,
        [userId, resourceId, dayMs, Date.now()],
      )
      let deleteId = result.rows[0].id as number
      createdAppointmentIds.push(deleteId)

      // Act
      let body = new URLSearchParams({
        _offset: '0',
        _sort: 'a.id',
        _order: 'asc',
      })
      let response = await router.fetch(`${ADMIN_APPT_URL}/${deleteId}`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert: redirect should include grid state params
      assert.equal(response.status, 302, 'delete should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(location.startsWith('/admin/appointments'), 'should redirect to appointments')
      assert.ok(location.includes('sort=a.id'), 'should include sort param')
      assert.ok(location.includes('order=asc'), 'should include order param')
    })

    it('preserves grid state on successful delete', async () => {
      // Arrange: create appointment to delete
      let dayMs = new Date('2026-08-15T00:00:00Z').getTime()
      let result = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, 'Grid State Delete Test', $3, '[480,540)', $4, $4)
         RETURNING id`,
        [userId, resourceId, dayMs, Date.now()],
      )
      let deleteId = result.rows[0].id as number
      createdAppointmentIds.push(deleteId)

      // Act
      let body = new URLSearchParams({
        _offset: '15',
        _sort: 'a.title',
        _order: 'desc',
        _filter: 'deletefilter',
      })

      let response = await router.fetch(`${ADMIN_APPT_URL}/${deleteId}`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      // Assert
      assert.equal(response.status, 302, 'delete should redirect')
      let location = response.headers.get('Location') ?? ''
      assert.ok(location.includes('sort=a.title'), 'should preserve sort param')
      assert.ok(location.includes('order=desc'), 'should preserve order param')
      assert.ok(location.includes('filter=deletefilter'), 'should preserve filter param')
    })
  })

  // =========================================================================
  // 7. Grid state round-trip (create → edit → update cycle)
  // =========================================================================

  describe('Create-Edit-Update Round Trip', () => {
    it('creates, finds in grid, updates, and verifies DB changes', async () => {
      // ── Step 1: Create ──
      let { startMin: sm, endMin: em } = nextSlot()
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Round Trip Termin',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
      })

      let createResponse = await router.fetch(ADMIN_APPT_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
        redirect: 'manual',
      })

      assert.equal(createResponse.status, 302, 'create should succeed')
      let createLocation = createResponse.headers.get('Location') ?? ''
      let match = createLocation.match(/editing=(\d+)/)
      assert.ok(match, 'should have editing param with ID')
      let roundTripId = parseInt(match![1], 10)
      createdAppointmentIds.push(roundTripId)

      // ── Step 2: Verify in grid via GET ──
      let gridResponse = await router.fetch(`${ADMIN_APPT_URL}?sort=a.id&order=desc`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(gridResponse.status, 200, 'grid should load')
      let html = await gridResponse.text()
      assert.ok(html.includes('Round Trip Termin'), 'new appointment should appear in grid')

      // ── Step 3: Update ──
      let updateBody = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Round Trip Aktualisiert',
        date: offeringDateStr,
        start_min: String(sm),
        end_min: String(em),
      })

      let updateResponse = await router.fetch(`${ADMIN_APPT_URL}/${roundTripId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: updateBody.toString(),
        redirect: 'manual',
      })

      assert.equal(updateResponse.status, 302, 'update should succeed')

      // ── Step 4: Verify in database ──
      let checkResult = await pool.query(
        'SELECT title, start_min, end_min FROM appointments WHERE id = $1',
        [roundTripId],
      )
      assert.equal(checkResult.rows.length, 1, 'appointment should exist')
      let row = checkResult.rows[0] as { title: string; start_min: number; end_min: number }
      assert.equal(row.title, 'Round Trip Aktualisiert', 'title should be updated')
    })
  })
})

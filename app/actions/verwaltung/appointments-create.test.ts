import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { pool } from '../../data/test-pool.ts'
import {
  BASE,
  ADMIN_APPT_URL,
  setupTestEnvironment,
  teardownTestEnvironment,
} from './controller.test-utils.ts'

// Track IDs created during tests for cleanup
const createdAppointmentIds: number[] = []
// IDs of test-scoped resources and offerings we create for self-contained testing
let testResourceId: number
let testResource2Id: number

const offeringBoundsStart = 480
const offeringBoundsEnd = 1080
let _slotCounter = 0
// Returns a unique 1-hour slot within the offering, so tests don't collide.
// Each call OUTSIDE a test (e.g., in before/after hooks) should NOT use this.
function nextSlot(): { startMin: number; endMin: number } {
  let slotWidth = 30
  let startMin = offeringBoundsStart + 60 + _slotCounter * slotWidth
  let maxStart = offeringBoundsEnd - slotWidth
  if (startMin >= maxStart) {
    throw new Error(
      `nextSlot(): ran out of available slots (offering ${offeringBoundsStart}–${offeringBoundsEnd}, used ${_slotCounter} slots). Move some tests to nextSlot2 or increase offering range.`,
    )
  }
  _slotCounter++
  return { startMin, endMin: startMin + slotWidth }
}

describe('Admin Appointments Controller', () => {
  let adminCookie: string
  let adminCsrfToken: string
  let userCookie: string
  let resourceId: number
  let resource2Id: number
  let userId: number
  let offeringDateStr: string

  before(async () => {
    let env = await setupTestEnvironment()
    adminCookie = env.adminCookie
    adminCsrfToken = env.adminCsrfToken
    userCookie = env.userCookie
    resourceId = env.resourceId
    resource2Id = env.resource2Id
    userId = env.userId
    offeringDateStr = env.offeringDateStr
    testResourceId = env.resourceId
    testResource2Id = env.resource2Id
    _slotCounter = 0
  })

  after(async () => {
    await teardownTestEnvironment(testResourceId, testResource2Id, createdAppointmentIds)
  })

  // =========================================================================
  // 1. Authentication & Authorization
  // =========================================================================

  describe('Authentication & Authorization', () => {
    it('POST /verwaltung/appointments without CSRF token returns 403', async () => {
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
  })

  // =========================================================================
  // 3. Offering & Collision Validation (create-related tests)
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
      if (match) createdAppointmentIds.push(parseInt(match[1]!, 10))
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
      assert.equal(response.status, 200, 'create outside offering should re-render at 200')
    })

    it('2.3 create fails with collision error when time range overlaps another appointment', async () => {
      // Arrange: create the first appointment via controller
      let { startMin: sm, endMin: em } = nextSlot()
      let dayDate = offeringDateStr
      // Use compact overlapping slots within the allocated 30-min window
      let slotAStart = sm
      let slotAEnd = em
      let slotBStart = sm + 15 // overlaps with A by 15 min

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
      createdAppointmentIds.push(parseInt(matchA![1]!, 10))

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
      assert.equal(responseB.status, 200, 'overlapping create should re-render at 200')
    })
  })

  // =========================================================================
  // 4. Create (POST /verwaltung/appointments)
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
      assert.ok(
        location.startsWith('/verwaltung/appointments'),
        'should redirect to /verwaltung/appointments',
      )
      assert.ok(
        location.includes('editing='),
        'should redirect with editing param pointing to new appointment',
      )

      // Verify appointment exists in database
      let match = location.match(/editing=(\d+)/)
      assert.ok(match, 'editing param should contain a numeric ID')
      let newId = parseInt(match![1]!, 10)
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
      assert.equal(response.status, 200, 'validation error should re-render at 200')
      let text = await response.text()
      assert.ok(text.includes('Neuer Termin'), 'should re-render the create panel')
      assert.ok(text.includes('value="2026-06-15"'), 'should preserve the submitted date value')
    })

    it('returns error redirect for missing resource_id', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: '0', // invalid — parseInt returns NaN or 0
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
      assert.equal(response.status, 200, 'validation error should re-render at 200')
    })

    it('returns error redirect for missing user_id', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: '0', // invalid
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
      assert.equal(response.status, 200, 'validation error should re-render at 200')
    })

    it('returns error redirect for invalid date format (not YYYY-MM-DD)', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Test',
        date: '15-06-2026', // wrong format
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
      assert.equal(response.status, 200, 'validation error should re-render at 200')
    })

    it('returns error redirect when end time is before start time', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Test',
        date: '2026-06-15',
        start_min: '540', // 09:00
        end_min: '480', // 08:00 — before start
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
      assert.equal(response.status, 200, 'validation error should re-render at 200')
    })

    it('returns error redirect when end time equals start time', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Test',
        date: '2026-06-15',
        start_min: '480',
        end_min: '480', // same as start
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
      assert.equal(response.status, 200, 'validation error should re-render at 200')
    })

    it('returns error redirect for invalid start_min (not divisible by 15)', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Test',
        date: '2026-06-15',
        start_min: '125', // not divisible by 60, not hourly
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
      assert.equal(response.status, 200, 'validation error should re-render at 200')
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
      assert.equal(response.status, 200, 'validation error should re-render at 200')
    })

    it('handles overlapping time range with German error', async () => {
      // Arrange: create the first appointment to occupy a time slot
      let { startMin: sm, endMin: em } = nextSlot()
      let dayDate = offeringDateStr
      let slotAstart = sm
      let slotAend = em
      let slotBstart = sm + 15 // overlaps with A by 15 min
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
      createdAppointmentIds.push(parseInt(matchA![1]!, 10))

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

      // Assert: overlapping should re-render at 200 with error (exclusion constraint caught)
      assert.equal(responseB.status, 200, 'overlapping should re-render at 200')
    })

    it('rejects creating an appointment with a past date', async () => {
      // Arrange
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        user_id: String(userId),
        title: 'Past Date Test',
        date: '2024-01-01', // definitely in the past
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
      assert.equal(response.status, 200, 'past-date create should re-render at 200')
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
        _period: 'this-week',
        _status: 'expired',
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
      assert.ok(location.includes('period=this-week'), 'should preserve period param')
      assert.ok(location.includes('status=expired'), 'should preserve status param')

      let match = location.match(/editing=(\d+)/)
      if (match) createdAppointmentIds.push(parseInt(match[1]!, 10))
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
      let roundTripId = parseInt(match![1]!, 10)
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

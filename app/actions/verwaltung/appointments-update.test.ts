import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { pool } from '../../data/test-pool.ts'
import { sessionStorage, sessionCookie } from '../../middleware/session.ts'
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
    it('PUT /verwaltung/appointments/:id without CSRF token returns 403', async () => {
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
  // 3. Offering & Collision Validation (update-related tests)
  // =========================================================================

  describe('Offering & Collision Validation', () => {
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
      assert.equal(updateResponse.status, 200, 'update outside offering should re-render at 200')
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
      assert.equal(response.status, 200, 'overlapping update should re-render at 200')
    })
  })

  // =========================================================================
  // 5. Update (PUT /verwaltung/appointments/:id)
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
      assert.ok(
        location.startsWith('/verwaltung/appointments'),
        'should redirect to /verwaltung/appointments',
      )

      // Verify the appointment was actually updated in the database
      let checkResult = await pool.query('SELECT title FROM appointments WHERE id = $1', [
        appointmentId,
      ])
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
        date: '2024-02-01', // definitely in the past
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
      assert.equal(response.status, 200, 'past-date update should re-render at 200')
    })

    it('redirects with a flash error for a non-existent appointment ID', async () => {
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

      // Assert: no 400/404 — PRG back to the grid with a flash error
      assert.equal(response.status, 302, 'non-existent update should PRG back to the grid')
      let location = response.headers.get('Location') ?? ''
      assert.ok(location.startsWith('/verwaltung/appointments'), 'should redirect to the grid list')

      let rawSid = (await sessionCookie.parse(adminCookie)) as string
      let session = await sessionStorage.read(rawSid)
      let err = session.get('error') as string | undefined
      assert.ok(err?.includes('Eintrag nicht gefunden'), 'flash error should be set')
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
      assert.equal(response.status, 200, 'validation error should re-render at 200')
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
      assert.equal(response.status, 200, 'overlapping update should re-render at 200')
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
        _period: 'this-month',
        _status: 'expired',
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
      assert.ok(location.includes('period=this-month'), 'should preserve period param')
      assert.ok(location.includes('status=expired'), 'should preserve status param')
    })
  })
})

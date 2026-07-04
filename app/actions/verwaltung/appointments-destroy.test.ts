import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { pool } from '../../data/setup.ts'
import { BASE, ADMIN_APPT_URL, setupTestEnvironment, teardownTestEnvironment } from './controller.test-utils.ts'

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
  })

  after(async () => {
    await teardownTestEnvironment(testResourceId, testResource2Id, createdAppointmentIds)
  })

  // =========================================================================
  // 6. Delete (DELETE /verwaltung/appointments/:id)
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
      assert.ok(location.startsWith('/verwaltung/appointments'), 'should redirect to /verwaltung/appointments')

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
      assert.ok(location.startsWith('/verwaltung/appointments'), 'should redirect to appointments')
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
        _period: 'this-week',
        _status: 'expired',
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
      assert.ok(!location.includes('filter='), 'should NOT preserve filter param')
      assert.ok(!location.includes('period='), 'should NOT preserve period param')
      assert.ok(!location.includes('status='), 'should NOT preserve status param')
    })
  })
})

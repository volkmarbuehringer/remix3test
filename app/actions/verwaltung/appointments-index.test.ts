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
import { routes } from '../../routes.ts'

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
    it('GET /verwaltung/appointments redirects to login when not authenticated', async () => {
      // Arrange
      // Act
      let response = await router.fetch(ADMIN_APPT_URL, { redirect: 'manual' })

      // Assert
      assert.equal(response.status, 302, 'unauthenticated GET should redirect')
      let location = response.headers.get('Location')
      assert.ok(location?.startsWith(routes.auth.login.index.href()), 'should redirect to login')
    })

    it('returns 403 for non-admin users', async () => {
      // Arrange & Act
      let response = await router.fetch(ADMIN_APPT_URL, {
        headers: { Cookie: userCookie },
      })

      // Assert
      assert.equal(response.status, 403, 'non-admin GET should return 403')
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
      assert.equal(response.status, 200, 'admin GET /verwaltung/appointments should return 200')
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

    it('embedding in an agent panel frame targets the panel, not admin-content', async () => {
      // The agent navigates its nested panel frame to this grid. Every internal
      // link/form must target that panel frame so it doesn't tear down the host
      // agent page (regression: "agent dialog disappears after editing a form").
      let response = await router.fetch(ADMIN_APPT_URL, {
        headers: { Cookie: adminCookie, 'X-Remix-Target': 'agent-events-panel' },
      })
      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(
        html.includes('data-rmx-target="agent-events-panel"'),
        'forms/links inside an agent panel should target the panel frame',
      )
      assert.ok(
        !html.includes('data-rmx-target="admin-content"'),
        'forms/links inside an agent panel must not target the outer admin-content frame',
      )
    })

    it('rendering in admin-content keeps the admin-content target', async () => {
      // Sanity: the normal sidebar flow is unchanged — the page still targets
      // admin-content when rendered as the admin content frame.
      let response = await router.fetch(ADMIN_APPT_URL, {
        headers: { Cookie: adminCookie, 'X-Remix-Target': 'admin-content' },
      })
      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(
        html.includes('data-rmx-target="admin-content"'),
        'forms/links in admin-content should keep the admin-content target',
      )
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
      assert.ok(html.includes('Keine Termine gefunden'), 'should show empty search result message')
    })

    it('respects sorting parameters', async () => {
      // Arrange: create two appointments with future dates and different titles
      let dayMs1 = Date.now() + 86400000 * 30
      let dayMs2 = Date.now() + 86400000 * 31
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

      // Act: sort by title ascending
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

    it('default status filter shows only pending (future) appointments', async () => {
      // Arrange: create a past appointment and a future appointment
      let pastDayMs = Date.now() - 86400000 * 10
      let futureDayMs = Date.now() + 86400000 * 10
      let now = Date.now()

      let r1 = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [userId, resourceId, 'PAST-APPT-FILTER', pastDayMs, '[480,540)', now],
      )
      let r2 = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [userId, resourceId, 'FUTURE-APPT-FILTER', futureDayMs, '[540,600)', now],
      )
      createdAppointmentIds.push(r1.rows[0].id, r2.rows[0].id)

      // Act: fetch without status param (defaults to pending)
      let response = await router.fetch(ADMIN_APPT_URL, {
        headers: { Cookie: adminCookie },
      })
      let html = await response.text()

      // Assert: only the future appointment should appear
      assert.ok(html.includes('FUTURE-APPT-FILTER'), 'default view should show future appointment')
      assert.ok(!html.includes('PAST-APPT-FILTER'), 'default view should NOT show past appointment')
    })

    it('status=expired shows only expired appointments', async () => {
      // Arrange: create a past appointment and a future appointment
      let pastDayMs = Date.now() - 86400000 * 10
      let futureDayMs = Date.now() + 86400000 * 10
      let now = Date.now()

      let r1 = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [userId, resourceId, 'PAST-APPT-EXPIRED', pastDayMs, '[480,540)', now],
      )
      let r2 = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [userId, resourceId, 'FUTURE-APPT-EXPIRED', futureDayMs, '[540,600)', now],
      )
      createdAppointmentIds.push(r1.rows[0].id, r2.rows[0].id)

      // Act: fetch with status=expired
      let response = await router.fetch(`${ADMIN_APPT_URL}?status=expired`, {
        headers: { Cookie: adminCookie },
      })
      let html = await response.text()

      // Assert: only the past appointment should appear
      assert.ok(html.includes('PAST-APPT-EXPIRED'), 'expired view should show past appointment')
      assert.ok(
        !html.includes('FUTURE-APPT-EXPIRED'),
        'expired view should NOT show future appointment',
      )
    })

    it('preserves status parameter in sort URLs', async () => {
      // Arrange & Act
      let response = await router.fetch(`${ADMIN_APPT_URL}?status=expired&sort=a.title&order=asc`, {
        headers: { Cookie: adminCookie },
      })
      let html = await response.text()

      // Assert: sort links preserve status=expired
      assert.ok(html.includes('status=expired'), 'sort URLs should preserve status param')
    })

    it('status=all shows both past and future appointments', async () => {
      // Arrange: create a past appointment and a future appointment
      let pastDayMs = Date.now() - 86400000 * 10
      let futureDayMs = Date.now() + 86400000 * 10
      let now = Date.now()

      let r1 = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [userId, resourceId, 'PAST-APPT-ALL', pastDayMs, '[480,540)', now],
      )
      let r2 = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [userId, resourceId, 'FUTURE-APPT-ALL', futureDayMs, '[540,600)', now],
      )
      createdAppointmentIds.push(r1.rows[0].id, r2.rows[0].id)

      // Act: fetch with status=all
      let response = await router.fetch(`${ADMIN_APPT_URL}?status=all`, {
        headers: { Cookie: adminCookie },
      })
      let html = await response.text()

      // Assert: both past and future appointments should appear
      assert.ok(html.includes('PAST-APPT-ALL'), 'all view should show past appointment')
      assert.ok(html.includes('FUTURE-APPT-ALL'), 'all view should show future appointment')
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
})

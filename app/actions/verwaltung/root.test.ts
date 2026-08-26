import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { pool } from '../../data/test-pool.ts'
import { BASE, setupTestEnvironment, teardownTestEnvironment } from './controller.test-utils.ts'
import { createAuthCookieWithCsrfForUser, createTestUser } from '../../test-utils.ts'
import { getTodayUtcMidnight } from '../../utils/date-utils.ts'
import { routes } from '../../routes.ts'

const DASHBOARD_URL = `${BASE}/verwaltung`

describe('Verwaltung Dashboard', () => {
  let adminCookie: string
  let nonAdminCookie: string
  let resourceId: number
  let resource2Id: number
  let userId: number

  let createdAppointmentIds: number[] = []
  let createdUserEmails: string[] = []

  before(async () => {
    let env = await setupTestEnvironment()
    adminCookie = env.adminCookie
    resourceId = env.resourceId
    resource2Id = env.resource2Id
    userId = env.userId

    // Use a dedicated, freshly-created non-admin user rather than the shared
    // seeded `user@newapp.com`. Tests share one ephemeral DB and run in
    // parallel; the shared user's session cookie can be invalidated by a
    // concurrent test (token_version bump / disable), turning the expected 403
    // into a login redirect. An isolated user guarantees a deterministic 403.
    let nonAdminEmail = `verwaltung-nonadmin-${Date.now()}-${Math.random()}@example.com`
    createdUserEmails.push(nonAdminEmail)
    let createdUserId = await createTestUser(nonAdminEmail)
    assert.ok(createdUserId, 'failed to create non-admin test user')
    let nonAdmin = await createAuthCookieWithCsrfForUser(nonAdminEmail)
    assert.ok(nonAdmin?.cookie, 'failed to create non-admin session cookie')
    nonAdminCookie = nonAdmin.cookie
  })

  after(async () => {
    await teardownTestEnvironment(resourceId, resource2Id, createdAppointmentIds)
    for (let email of createdUserEmails) {
      try {
        await pool.query('DELETE FROM users WHERE email = $1', [email])
      } catch {
        /* ignore cleanup errors */
      }
    }
  })

  it('returns 200 for an admin user', async () => {
    let response = await router.fetch(DASHBOARD_URL, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
  })

  it('rejects a non-admin user', async () => {
    let response = await router.fetch(DASHBOARD_URL, {
      headers: { Cookie: nonAdminCookie },
    })
    assert.equal(response.status, 403)
  })

  it('renders live counts that reflect inserted appointments', async () => {
    let todayMidnight = getTodayUtcMidnight()
    let now = Date.now()

    // Insert 2 pending (future) and 2 expired (past) appointments directly.
    // Tests share one physical DB and run alongside other suites, so we cannot
    // assert exact global totals. Instead we assert the rendered badge is a
    // count that is at least as large as the rows we just inserted (concurrent
    // activity can only make the totals larger, never smaller).
    let futureDay = todayMidnight + 86_400_000
    let pastDay = todayMidnight - 86_400_000
    // Distinct, non-overlapping slots so insertion never trips the appointment
    // overlap exclusion constraint (same resource + day + overlapping range).
    let pendingSlots = ['[480,540)', '[540,600)']
    let expiredSlots = ['[600,660)', '[660,720)']
    for (let i = 0; i < 2; i++) {
      let pending = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, 'DASH PENDING', $3, $4, $5, $5) RETURNING id`,
        [userId, resourceId, futureDay, pendingSlots[i], now],
      )
      let expired = await pool.query(
        `INSERT INTO appointments (user_id, resource_id, title, date, during, created_at, updated_at)
         VALUES ($1, $2, 'DASH EXPIRED', $3, $4, $5, $5) RETURNING id`,
        [userId, resourceId, pastDay, expiredSlots[i], now],
      )
      createdAppointmentIds.push(pending.rows[0].id, expired.rows[0].id)
    }

    let response = await router.fetch(DASHBOARD_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    function badgeCount(label: string): number {
      let match = html.match(new RegExp(`(\\d[\\d.]*)\\s*${label}`))
      return match ? Number(match[1].replace(/\./g, '')) : NaN
    }

    let renderedPending = badgeCount('ausstehend')
    let renderedExpired = badgeCount('abgelaufen')
    assert.ok(
      !Number.isNaN(renderedPending) && renderedPending >= 2,
      `pending badge should be at least 2, got "${renderedPending}"`,
    )
    assert.ok(
      !Number.isNaN(renderedExpired) && renderedExpired >= 2,
      `expired badge should be at least 2, got "${renderedExpired}"`,
    )
  })

  it('consolidates the export actions into one card with distinct links', async () => {
    let response = await router.fetch(DASHBOARD_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.ok(html.includes('Exporte &amp; Berichte'), 'export card heading should render')
    assert.ok(html.includes('Alle Termine'), 'recent-terms export row should render')
    assert.ok(html.includes('Benutzerübersicht'), 'user-summary export row should render')
    assert.ok(html.includes('Benutzer im Zeitraum'), 'filtered-user export row should render')
  })

  it('renders the quick actions (term search and new appointment)', async () => {
    let response = await router.fetch(DASHBOARD_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    assert.ok(
      html.includes(routes.verwaltung.appointments.index.href()) && html.includes('name="filter"'),
      'term search form should target the appointments grid filter',
    )
    assert.ok(
      html.includes(routes.appointmentsNew.index.href()) && html.includes('Neuer Termin'),
      'new-appointment quick action should render',
    )
  })

  it('renders whole-card navigation links for single-destination cards', async () => {
    let response = await router.fetch(DASHBOARD_URL, {
      headers: { Cookie: adminCookie },
    })
    let html = await response.text()

    for (let href of [
      routes.verwaltung.appointments.index.href(),
      routes.verwaltung.offerings.index.href(),
      routes.verwaltung.resources.index.href(),
      routes.verwaltung.offeringConfigs.index.href(),
      routes.verwaltung.report1.index.href(),
    ]) {
      assert.ok(html.includes(`href="${href}"`), `expected whole-card link for ${href}`)
    }
    assert.ok(html.includes('Öffnen'), 'card action label should render')
  })
})

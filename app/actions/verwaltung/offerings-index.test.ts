import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../router.ts'
import { pool } from '../../data/setup.ts'
import { BASE, setupTestEnvironment, teardownTestEnvironment } from './controller.test-utils.ts'

const ADMIN_OFFERINGS_URL = `${BASE}/verwaltung/offerings`

const createdOfferingIds: number[] = []
let testResourceId: number
let testResource2Id: number

describe('Admin Offerings Controller', () => {
  let adminCookie: string
  let resourceId: number
  let resource2Id: number

  before(async () => {
    let env = await setupTestEnvironment()
    adminCookie = env.adminCookie
    resourceId = env.resourceId
    resource2Id = env.resource2Id
    testResourceId = env.resourceId
    testResource2Id = env.resource2Id
  })

  after(async () => {
    await teardownTestEnvironment(testResourceId, testResource2Id, createdOfferingIds)
  })

  describe('Index / List view', () => {
    it('returns 200 for admin user', async () => {
      let response = await router.fetch(ADMIN_OFFERINGS_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })

    it('default status filter shows only pending (future) offerings', async () => {
      let pastDayMs = Date.now() - 86400000 * 10
      let futureDayMs = Date.now() + 86400000 * 10
      let now = Date.now()

      let r1 = await pool.query(
        `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
         VALUES ($1, $2, '[480,540)', $3, $3) RETURNING id`,
        [pastDayMs, resourceId, now],
      )
      let r2 = await pool.query(
        `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
         VALUES ($1, $2, '[540,600)', $3, $3) RETURNING id`,
        [futureDayMs, resourceId, now],
      )
      createdOfferingIds.push(r1.rows[0].id, r2.rows[0].id)

      let response = await router.fetch(ADMIN_OFFERINGS_URL, {
        headers: { Cookie: adminCookie },
      })
      let html = await response.text()

      let futureDayStr = new Date(futureDayMs).toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
      let pastDayStr = new Date(pastDayMs).toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
      assert.ok(html.includes(futureDayStr), 'default view should show future offering date')
      assert.ok(!html.includes(pastDayStr), 'default view should NOT show past offering date')
    })

    it('status=expired shows only expired offerings', async () => {
      let pastDayMs = Date.now() - 86400000 * 10
      let futureDayMs = Date.now() + 86400000 * 10
      let now = Date.now()

      let r1 = await pool.query(
        `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
         VALUES ($1, $2, '[480,540)', $3, $3) RETURNING id`,
        [pastDayMs, resourceId, now],
      )
      let r2 = await pool.query(
        `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
         VALUES ($1, $2, '[540,600)', $3, $3) RETURNING id`,
        [futureDayMs, resourceId, now],
      )
      createdOfferingIds.push(r1.rows[0].id, r2.rows[0].id)

      let response = await router.fetch(`${ADMIN_OFFERINGS_URL}?status=expired`, {
        headers: { Cookie: adminCookie },
      })
      let html = await response.text()

      let pastDayStr = new Date(pastDayMs).toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
      let futureDayStr = new Date(futureDayMs).toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
      assert.ok(html.includes(pastDayStr), 'expired view should show past offering date')
      assert.ok(!html.includes(futureDayStr), 'expired view should NOT show future offering date')
    })

    it('preserves status parameter in sort URLs', async () => {
      let response = await router.fetch(`${ADMIN_OFFERINGS_URL}?status=expired&sort=ao.day&order=desc`, {
        headers: { Cookie: adminCookie },
      })
      let html = await response.text()
      assert.ok(html.includes('status=expired'), 'sort URLs should preserve status param')
    })
  })
})

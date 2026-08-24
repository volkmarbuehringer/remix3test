import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { pool } from '../../data/test-pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { sessionStorage, sessionCookie } from '../../middleware/session.ts'
import { BASE, setupTestEnvironment, teardownTestEnvironment } from './controller.test-utils.ts'

const ADMIN_OFFERINGS_URL = `${BASE}/verwaltung/offerings`

const createdOfferingIds: number[] = []
let testResourceId: number
let testResource2Id: number

describe('Admin Offerings Controller', () => {
  let adminCookie: string
  let adminCsrfToken: string
  let resourceId: number
  let resource2Id: number

  before(async () => {
    let env = await setupTestEnvironment()
    adminCookie = env.adminCookie
    adminCsrfToken = env.adminCsrfToken
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
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      let pastDayStr = new Date(pastDayMs).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      assert.ok(html.includes(futureDayStr), 'default view should show future offering date')
      assert.ok(
        !html.includes(`title="${pastDayStr}"`),
        'default view should NOT show past offering date in day column',
      )
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
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      let futureDayStr = new Date(futureDayMs).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      assert.ok(html.includes(pastDayStr), 'expired view should show past offering date')
      assert.ok(
        !html.includes(`title="${futureDayStr}"`),
        'expired view should NOT show future offering date in day column',
      )
    })

    it('preserves status parameter in sort URLs', async () => {
      let response = await router.fetch(
        `${ADMIN_OFFERINGS_URL}?status=expired&sort=ao.day&order=desc`,
        {
          headers: { Cookie: adminCookie },
        },
      )
      let html = await response.text()
      assert.ok(html.includes('status=expired'), 'sort URLs should preserve status param')
    })
  })

  describe('Offerings mutations (admin base contract conformance)', () => {
    it('re-renders the create form at 200 with preserved values on validation failure', async () => {
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        day: 'not-a-date',
        start_min: '480',
        end_min: '540',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(ADMIN_OFFERINGS_URL, {
        method: 'POST',
        headers: { Cookie: adminCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      assert.equal(response.status, 200, 'validation failure must re-render at 200, not 400')
      let text = await response.text()
      assert.ok(text.includes('Neues Angebot'), 'should re-render the create panel')
      assert.ok(text.includes('not-a-date'), 'should preserve the submitted day value')
    })

    it('re-renders the edit form at 200 with preserved values on validation failure', async () => {
      let row = await pool.query(
        'SELECT id FROM appointoffering WHERE resource_id = $1 LIMIT 1',
        [resourceId],
      )
      let id = row.rows[0]?.id as number | undefined
      if (!id) throw new Error('expected a seed offering to edit')

      let body = new URLSearchParams({
        resource_id: String(resourceId),
        day: 'not-a-date',
        start_min: '480',
        end_min: '540',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${ADMIN_OFFERINGS_URL}/${id}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 200, 'update validation failure must re-render at 200, not 400')
      let text = await response.text()
      assert.ok(text.includes('Angebot bearbeiten'), 'should re-render the edit panel')
      assert.ok(text.includes('not-a-date'), 'should preserve the submitted day value')
    })

    it('redirects (PRG) with a flash error for a missing offer on destroy (no JSON 404)', async () => {
      let fresh = await createAuthCookieWithCsrfForUser('admin@newapp.com')
      assert.ok(fresh?.cookie, 'fresh admin session must be created')

      let body = new URLSearchParams({
        _csrf: fresh.csrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${ADMIN_OFFERINGS_URL}/999999999`, {
        method: 'DELETE',
        headers: {
          Cookie: fresh.cookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': fresh.csrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302, 'no JSON 404 — PRG back to the grid')
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/offerings'), 'should redirect to the grid list')

      let rawSid = (await sessionCookie.parse(fresh.cookie)) as string
      let session = await sessionStorage.read(rawSid)
      let err = session.get('error') as string | undefined
      assert.ok(err?.includes('Eintrag nicht gefunden'), 'flash error should be set')
    })

    it('redirects (PRG) with a flash error on config-save failure (no JSON 400)', async () => {
      let fresh = await createAuthCookieWithCsrfForUser('admin@newapp.com')
      assert.ok(fresh?.cookie, 'fresh admin session must be created')

      let body = new URLSearchParams({
        _csrf: fresh.csrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${ADMIN_OFFERINGS_URL}/config`, {
        method: 'POST',
        headers: { Cookie: fresh.cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      assert.equal(response.status, 302, 'config parse failure should PRG back to the grid, not JSON 400')
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/offerings'), 'should redirect to the grid list')

      let rawSid = (await sessionCookie.parse(fresh.cookie)) as string
      let session = await sessionStorage.read(rawSid)
      let err = session.get('error') as string | undefined
      assert.ok(err, 'a flash error should be set')
    })

    it('redirects (PRG) with a flash message on week-generate', async () => {
      let fresh = await createAuthCookieWithCsrfForUser('admin@newapp.com')
      assert.ok(fresh?.cookie, 'fresh admin session must be created')
      let body = new URLSearchParams({
        year: String(new Date().getUTCFullYear()),
        week: '1',
        _csrf: fresh.csrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${ADMIN_OFFERINGS_URL}/week`, {
        method: 'POST',
        headers: { Cookie: fresh.cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      assert.equal(response.status, 302, 'week-generate should PRG back to the grid')
      let rawSid = (await sessionCookie.parse(fresh.cookie)) as string
      let session = await sessionStorage.read(rawSid)
      assert.ok(session.get('error') || session.get('success'), 'flash message should be set')
    })

    it('redirects (PRG) with a flash message on delete-past', async () => {
      let fresh = await createAuthCookieWithCsrfForUser('admin@newapp.com')
      assert.ok(fresh?.cookie, 'fresh admin session must be created')
      let body = new URLSearchParams({
        _csrf: fresh.csrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
        _period: '',
        _status: '',
      })
      let response = await router.fetch(`${ADMIN_OFFERINGS_URL}/delete-past`, {
        method: 'POST',
        headers: { Cookie: fresh.cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      assert.equal(response.status, 302, 'delete-past should PRG back to the grid')
      let rawSid = (await sessionCookie.parse(fresh.cookie)) as string
      let session = await sessionStorage.read(rawSid)
      assert.ok(session.get('success'), 'flash success should be set')
    })
  })
})

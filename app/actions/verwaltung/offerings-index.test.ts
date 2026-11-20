import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'
import Holidays from 'date-holidays'

import { router } from '../../test-router.ts'
import { MS_PER_DAY, formatIsoDateUtc, getTodayUtcMidnight } from '../../utils/date-utils.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'
import { readSessionId, sessionStorage } from '../../middleware/session.ts'
import { BASE, setupTestEnvironment, teardownTestEnvironment } from './controller.test-utils.ts'

const ADMIN_OFFERINGS_URL = `${BASE}/verwaltung/offerings`

const createdOfferingIds: number[] = []
let testResourceId: number
let testResource2Id: number

describe('Admin Offerings Controller', () => {
  let adminCookie: string
  let adminCsrfToken: string
  let resourceId: number

  before(async () => {
    let env = await setupTestEnvironment()
    adminCookie = env.adminCookie
    adminCsrfToken = env.adminCsrfToken
    resourceId = env.resourceId
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

    it('status=all shows both past and future offerings', async () => {
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

      let response = await router.fetch(`${ADMIN_OFFERINGS_URL}?status=all`, {
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
      assert.ok(html.includes(pastDayStr), 'all view should show past offering date')
      assert.ok(html.includes(futureDayStr), 'all view should show future offering date')
    })

    it('clicking the active "Alle" status tab does not drop to the default pending view', async () => {
      let futureDayMs = Date.now() + 86400000 * 10
      let pastDayMs = Date.now() - 86400000 * 10
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

      // The active "Alle" tab's generated href (with its status param) must include status=all.
      let response = await router.fetch(`${ADMIN_OFFERINGS_URL}?status=all`, {
        headers: { Cookie: adminCookie },
      })
      let html = await response.text()
      assert.ok(
        html.includes('status%3Dall') || html.includes('status=all'),
        'active "Alle" tab href should keep status=all',
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

    it('renders the row actions as a visible buttongroup', async () => {
      let response = await router.fetch(ADMIN_OFFERINGS_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(html.includes('data-delete-form'), 'delete form must be rendered in the row')
      assert.ok(
        html.includes('aria-label="Konfiguration"') &&
          html.includes('aria-label="Bearbeiten"') &&
          html.includes('aria-label="Löschen"'),
        'all three row actions should be visible with accessible labels',
      )
    })

    it('preserves the active period, status and sort when searching', async () => {
      let response = await router.fetch(
        `${ADMIN_OFFERINGS_URL}?status=all&period=this-week&sort=ao.day&order=desc`,
        { headers: { Cookie: adminCookie } },
      )
      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(
        html.includes('name="period" value="this-week"'),
        'the search form should preserve the active period',
      )
      assert.ok(
        html.includes('name="status" value="all"'),
        'the search form should preserve the active status',
      )
      assert.ok(
        html.includes('name="sort" value="ao.day"'),
        'the search form should preserve the active sort',
      )
    })

    it('disables the future-period filter while the expired status is active', async () => {
      let response = await router.fetch(`${ADMIN_OFFERINGS_URL}?status=expired`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let html = await response.text()
      assert.ok(
        !html.includes('period%3Dthis-week') && !html.includes('period=this-week'),
        'the expired view must not link to a future period',
      )
      assert.ok(
        html.includes('disabled'),
        'the period switcher should be rendered disabled in the expired view',
      )
    })

    it('labels every cell for the stacked mobile card layout', async () => {
      let response = await router.fetch(ADMIN_OFFERINGS_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let html = await response.text()
      for (let label of ['Tag', 'Ressource', 'Zeitraum', 'Aktualisiert', 'Aktionen']) {
        assert.ok(
          html.includes(`data-label="${label}"`),
          `the ${label} cell should carry a data-label for the stacked card view`,
        )
      }
    })
  })

  describe('Offerings mutations (admin base contract conformance)', () => {
    it('re-renders the create form at 400 with preserved values on validation failure', async () => {
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
      assert.equal(response.status, 400, 'validation failure must re-render at 400')
      let text = await response.text()
      assert.ok(text.includes('Neues Angebot'), 'should re-render the create panel')
      assert.ok(text.includes('not-a-date'), 'should preserve the submitted day value')
      assert.ok(
        text.includes('aria-invalid="true"') &&
          text.includes('aria-describedby="oc-day-error"') &&
          text.includes('id="oc-day-error"'),
        'the day control must be linked to its error message (guide 09)',
      )
    })

    it('re-renders the edit form at 400 with preserved values on validation failure', async () => {
      let row = await pool.query('SELECT id FROM appointoffering WHERE resource_id = $1 LIMIT 1', [
        resourceId,
      ])
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
      assert.equal(response.status, 400, 'update validation failure must re-render at 400')
      let text = await response.text()
      assert.ok(text.includes('Angebot bearbeiten'), 'should re-render the edit panel')
      assert.ok(text.includes('not-a-date'), 'should preserve the submitted day value')
      assert.ok(
        text.includes('aria-invalid="true"') &&
          text.includes('aria-describedby="oe-day-error"') &&
          text.includes('id="oe-day-error"'),
        'the day control must be linked to its error message (guide 09)',
      )
    })

    it('rejects a non-calendar create date instead of rolling it over to another day', async () => {
      // 2027-02-31 matches the YYYY-MM-DD shape but is not a real date; the
      // Date parser rolls it over to 2027-03-03 (future), which would silently
      // create the offering on the wrong day. It must fail with a day field
      // error and write nothing.
      let countBefore = await pool.query(
        'SELECT COUNT(*) AS count FROM appointoffering WHERE resource_id = $1',
        [resourceId],
      )
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        day: '2027-02-31',
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
      assert.equal(response.status, 400, 'non-calendar date must re-render at 400, not PRG')
      let text = await response.text()
      assert.ok(text.includes('Neues Angebot'), 'should re-render the create panel')
      assert.ok(text.includes('2027-02-31'), 'should preserve the submitted day value')
      assert.ok(
        text.includes('aria-invalid="true"') &&
          text.includes('aria-describedby="oc-day-error"') &&
          text.includes('id="oc-day-error"'),
        'the day control must be linked to its error message',
      )

      let rolled = await pool.query(
        'SELECT id FROM appointoffering WHERE resource_id = $1 AND day = $2',
        [resourceId, Date.parse('2027-03-03T00:00:00Z')],
      )
      assert.equal(rolled.rows.length, 0, 'no offering may be created on the rolled-over day')
      let countAfter = await pool.query(
        'SELECT COUNT(*) AS count FROM appointoffering WHERE resource_id = $1',
        [resourceId],
      )
      assert.equal(
        Number(countAfter.rows[0].count),
        Number(countBefore.rows[0].count),
        'failed validation must not write any offering',
      )
    })

    it('rejects a non-calendar edit date with a day field error (no misleading past-date error)', async () => {
      // 2026-02-31 rolls over to 2026-03-03 (past), which today surfaces the
      // misleading form-level "Vergangenheit" error instead of a day field error.
      let row = await pool.query('SELECT id FROM appointoffering WHERE resource_id = $1 LIMIT 1', [
        resourceId,
      ])
      let id = row.rows[0]?.id as number | undefined
      if (!id) throw new Error('expected a seed offering to edit')
      let beforeRow = await pool.query('SELECT day, during FROM appointoffering WHERE id = $1', [
        id,
      ])

      let body = new URLSearchParams({
        resource_id: String(resourceId),
        day: '2026-02-31',
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
      assert.equal(response.status, 400, 'non-calendar date must re-render at 400')
      let text = await response.text()
      assert.ok(text.includes('Angebot bearbeiten'), 'should re-render the edit panel')
      assert.ok(text.includes('2026-02-31'), 'should preserve the submitted day value')
      assert.ok(
        text.includes('aria-invalid="true"') &&
          text.includes('aria-describedby="oe-day-error"') &&
          text.includes('id="oe-day-error"'),
        'the day control must be linked to its error message',
      )
      let afterRow = await pool.query('SELECT day, during FROM appointoffering WHERE id = $1', [id])
      assert.deepEqual(
        afterRow.rows[0],
        beforeRow.rows[0],
        'failed validation must not modify the row',
      )
    })

    it('creates an offering for a valid future date and PRGs to it (positive control)', async () => {
      // Pick the next UTC day that is not a DE-RP holiday, mirroring the
      // controller's rule. [1080,1140) avoids the seeded tomorrow [480,1080).
      let hd = new Holidays('DE', 'rp')
      let dayMs = getTodayUtcMidnight() + MS_PER_DAY
      while (hd.isHoliday(new Date(dayMs))) dayMs += MS_PER_DAY
      let day = formatIsoDateUtc(dayMs)

      let body = new URLSearchParams({
        resource_id: String(resourceId),
        day,
        start_min: '1080',
        end_min: '1140',
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
      assert.equal(response.status, 303, 'valid create should PRG back to the grid')
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/offerings'), 'should redirect to the grid list')
      let editing = new URL(location, 'https://remix.run').searchParams.get('editing')
      assert.ok(editing && /^\d+$/.test(editing), 'redirect should open the new row for editing')
      createdOfferingIds.push(Number(editing))

      let written = await pool.query('SELECT day FROM appointoffering WHERE id = $1', [
        Number(editing),
      ])
      assert.equal(
        String(written.rows[0].day),
        String(Date.parse(day + 'T00:00:00Z')),
        'the offering must land on the submitted day, not a shifted one',
      )
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
      assert.equal(response.status, 303, 'no JSON 404 — PRG back to the grid')
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/offerings'), 'should redirect to the grid list')

      let rawSid = await readSessionId(fresh.cookie)
      let session = await sessionStorage.read(rawSid)
      let err = session.get('error') as string | undefined
      assert.ok(err?.includes('Eintrag nicht gefunden'), 'flash error should be set')
    })

    it('redirects (PRG) with a flash error for a non-numeric id on update and destroy', async () => {
      let fresh = await createAuthCookieWithCsrfForUser('admin@newapp.com')
      assert.ok(fresh?.cookie, 'fresh admin session must be created')

      for (let method of ['PUT', 'DELETE'] as const) {
        let response = await router.fetch(`${ADMIN_OFFERINGS_URL}/abc`, {
          method,
          headers: {
            Cookie: fresh.cookie,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Csrf-Token': fresh.csrfToken,
          },
          body: new URLSearchParams({ _csrf: fresh.csrfToken }).toString(),
          redirect: 'manual',
        })
        assert.equal(response.status, 303, method + ' with a non-numeric id should PRG')
        let location = response.headers.get('Location') || ''
        assert.ok(location.startsWith('/verwaltung/offerings'), 'should redirect to the grid list')

        let rawSid = await readSessionId(fresh.cookie)
        let session = await sessionStorage.read(rawSid)
        let err = session.get('error') as string | undefined
        assert.ok(err?.includes('Ungültige ID'), method + ' flash error should be set')
      }
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
      assert.equal(
        response.status,
        303,
        'config parse failure should PRG back to the grid, not JSON 400',
      )
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/offerings'), 'should redirect to the grid list')

      let rawSid = await readSessionId(fresh.cookie)
      let session = await sessionStorage.read(rawSid)
      let err = session.get('error') as string | undefined
      assert.ok(err, 'a flash error should be set')
    })

    it('preserves grid state on config-save success', async () => {
      let fresh = await createAuthCookieWithCsrfForUser('admin@newapp.com')
      assert.ok(fresh?.cookie, 'fresh admin session must be created')
      let body = new URLSearchParams({
        resource_id: String(resourceId),
        _csrf: fresh.csrfToken,
        _offset: '12',
        _sort: 'ao.day',
        _order: 'desc',
        _filter: 'such',
        _period: 'this-week',
        _status: 'pending',
      })
      let response = await router.fetch(`${ADMIN_OFFERINGS_URL}/config`, {
        method: 'POST',
        headers: { Cookie: fresh.cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      assert.equal(response.status, 303, 'config-save success should PRG back to the grid')
      let location = response.headers.get('Location') || ''
      assert.ok(location.includes('offset=12'), 'grid offset should be preserved')
      assert.ok(location.includes('sort=ao.day'), 'grid sort should be preserved')
      assert.ok(location.includes('order=desc'), 'grid order should be preserved')
      assert.ok(location.includes('filter=such'), 'grid filter should be preserved')
      assert.ok(location.includes('period=this-week'), 'grid period should be preserved')
      assert.ok(location.includes('status=pending'), 'grid status should be preserved')
    })

    it('redirects (PRG) with a flash message on week-generate', async () => {
      let fresh = await createAuthCookieWithCsrfForUser('admin@newapp.com')
      assert.ok(fresh?.cookie, 'fresh admin session must be created')
      let body = new URLSearchParams({
        year: String(new Date().getUTCFullYear()),
        week: '1',
        _csrf: fresh.csrfToken,
        _offset: '9',
        _sort: 'r.description',
        _order: 'desc',
        _filter: 'such',
      })
      let response = await router.fetch(`${ADMIN_OFFERINGS_URL}/week`, {
        method: 'POST',
        headers: { Cookie: fresh.cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      assert.equal(response.status, 303, 'week-generate should PRG back to the grid')
      let location = response.headers.get('Location') || ''
      assert.ok(location.includes('offset=9'), 'grid offset should be preserved')
      assert.ok(location.includes('sort=r.description'), 'grid sort should be preserved')
      assert.ok(location.includes('order=desc'), 'grid order should be preserved')
      assert.ok(location.includes('filter=such'), 'grid filter should be preserved')
      let rawSid = await readSessionId(fresh.cookie)
      let session = await sessionStorage.read(rawSid)
      assert.ok(session.get('error') || session.get('success'), 'flash message should be set')
    })

    it('rejects an out-of-range calendar week in week-generate instead of rolling into another year', async () => {
      let fresh = await createAuthCookieWithCsrfForUser('admin@newapp.com')
      assert.ok(fresh?.cookie, 'fresh admin session must be created')

      for (let [year, week] of [
        ['2026', '0'],
        ['2026', '99'],
        ['2025', '53'], // 2025 has only 52 ISO weeks — pins the real boundary
      ] as const) {
        let body = new URLSearchParams({
          year,
          week,
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
        assert.equal(response.status, 303, 'invalid week should PRG back to the grid')

        let rawSid = await readSessionId(fresh.cookie)
        let session = await sessionStorage.read(rawSid)
        let err = session.get('error') as string | undefined
        assert.ok(
          err?.includes('Ungültige Kalenderwoche'),
          `year=${year} week=${week} must be rejected`,
        )
      }
    })

    it('rejects out-of-range and inverted config minutes without changing the stored rules', async () => {
      let fresh = await createAuthCookieWithCsrfForUser('admin@newapp.com')
      assert.ok(fresh?.cookie, 'fresh admin session must be created')

      let now = Date.now()
      let inserted = await pool.query(
        'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
        ['Test Config Minute Validation', now, now],
      )
      let rid = inserted.rows[0].id as number
      let originalRules = { monday: [480, 540] }
      try {
        await pool.query(
          `INSERT INTO offering_configs (resource_id, rules, created_at, updated_at)
           VALUES ($1, $2::jsonb, $3, $3)`,
          [rid, JSON.stringify(originalRules), now],
        )

        for (let [start, end] of [
          ['600', '540'], // inverted
          ['-60', '540'], // negative
          ['480', '1500'], // beyond 24h
          ['600.5', '660'], // non-integer raw input (parseInt would truncate to 600)
          ['480', '660abc'], // trailing junk (parseInt would accept 660)
        ] as const) {
          let body = new URLSearchParams({
            resource_id: String(rid),
            monday_enabled: '1',
            monday_start: start,
            monday_end: end,
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
          assert.equal(response.status, 303, 'invalid minutes should PRG back to the grid')

          let rawSid = await readSessionId(fresh.cookie)
          let session = await sessionStorage.read(rawSid)
          let err = session.get('error') as string | undefined
          assert.ok(err?.includes('Ungültige Zeitangabe'), `${start}-${end} must be rejected`)

          let stored = await pool.query(
            'SELECT rules FROM offering_configs WHERE resource_id = $1',
            [rid],
          )
          assert.deepEqual(stored.rows[0].rules, originalRules, 'stored rules must stay unchanged')
        }
      } finally {
        await pool.query('DELETE FROM offering_configs WHERE resource_id = $1', [rid])
        await pool.query('DELETE FROM resources WHERE id = $1', [rid])
      }
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
      assert.equal(response.status, 303, 'delete-past should PRG back to the grid')
      let rawSid = await readSessionId(fresh.cookie)
      let session = await sessionStorage.read(rawSid)
      assert.ok(session.get('success'), 'flash success should be set')
    })
  })
})

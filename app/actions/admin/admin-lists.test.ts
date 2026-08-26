import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'
import { sessionStorage, sessionCookie } from '../../middleware/session.ts'

const BASE = 'https://remix.run'
const LISTS_URL = BASE + '/admin/lists'

describe('Admin Lists Controller', () => {
  let adminCookie: string
  let adminCsrfToken: string
  let userCookie: string

  before(async () => {
    await initializeAppDatabase()

    let adminAuth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!adminAuth?.cookie) {
      throw new Error('Failed to create admin session')
    }
    adminCookie = adminAuth.cookie
    adminCsrfToken = adminAuth.csrfToken

    let userAuth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!userAuth?.cookie) {
      throw new Error('Failed to create user session')
    }
    userCookie = userAuth.cookie
  })

  afterEach(async () => {
    await pool.query("DELETE FROM lists WHERE description LIKE 'test-admin-%'")
  })

  async function insertList(
    title: string,
    description: string,
    items: Array<{ id: string; label: string }> = [],
  ): Promise<number> {
    let now = Date.now()
    let result = await pool.query(
      'INSERT INTO lists (title, description, list, created_at, updated_at) VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING id',
      [title, description, JSON.stringify(items), now, now],
    )
    return result.rows[0].id as number
  }

  function gridBody(csrf: string, extra: Record<string, string> = {}): URLSearchParams {
    return new URLSearchParams({
      _csrf: csrf,
      _offset: '',
      _sort: '',
      _order: '',
      _filter: '',
      ...extra,
    })
  }

  async function readFlash(): Promise<string | undefined> {
    let rawSid = (await sessionCookie.parse(adminCookie)) as string
    let session = await sessionStorage.read(rawSid)
    return session.get('error') as string | undefined
  }

  describe('index (GET /admin/lists)', () => {
    it('returns 200 for admin users', async () => {
      let response = await router.fetch(LISTS_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('Gespeicherte Listen'))
    })

    it('returns 403 for non-admin users', async () => {
      let response = await router.fetch(LISTS_URL, {
        headers: { Cookie: userCookie },
      })
      assert.equal(response.status, 403)
    })

    it('returns 302 for unauthenticated requests (redirects to login)', async () => {
      let response = await router.fetch(LISTS_URL)
      assert.equal(response.status, 302)
    })

    it('supports sorting by title', async () => {
      let response = await router.fetch(LISTS_URL + '?sort=title&order=asc', {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })

    it('filters rows by the filter param', async () => {
      await insertList('Filter Me', 'test-admin-filter-target')
      let response = await router.fetch(LISTS_URL + '?filter=filter-target', {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('test-admin-filter-target'))
    })

    it('renders the inline edit panel when ?editing is set', async () => {
      let id = await insertList('Edit Row', 'test-admin-edit')
      let response = await router.fetch(LISTS_URL + '?editing=' + id, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('Liste bearbeiten'))
    })
  })

  describe('create (POST /admin/lists)', () => {
    it('re-renders at 200 with inline errors when title is empty', async () => {
      let body = gridBody(adminCsrfToken, { title: '', description: 'test-admin-create' })
      let response = await router.fetch(LISTS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 200, 'validation failure should re-render at 200, not 400')
      let text = await response.text()
      assert.ok(text.includes('Neue Liste'), 'create panel should render on validation error')
    })

    it('creates a list and redirects with grid state and editing', async () => {
      let body = gridBody(adminCsrfToken, {
        title: 'Test List',
        description: 'test-admin-create',
        _offset: '15',
        _sort: 'title',
        _order: 'asc',
        _filter: 'garten',
      })
      let response = await router.fetch(LISTS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/admin/lists'), 'should redirect to the grid list')
      assert.ok(location.includes('editing='), 'create keeps editing=<newId>')
      assert.ok(location.includes('offset=15'), 'grid state offset preserved')
      assert.ok(location.includes('sort=title'), 'grid state sort preserved')
      assert.ok(location.includes('filter=garten'), 'grid state filter preserved')
      let row = await pool.query("SELECT id FROM lists WHERE title = 'Test List'")
      assert.ok(row.rows.length >= 1, 'list row should exist')
    })
  })

  describe('update (PUT /admin/lists/:id)', () => {
    it('re-renders at 200 with inline errors when title is empty', async () => {
      let id = await insertList('Before', 'test-admin-update')
      let body = gridBody(adminCsrfToken, { title: '', description: 'x' })
      let response = await router.fetch(LISTS_URL + '/' + id, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 200, 'validation failure should re-render at 200')
      let text = await response.text()
      assert.ok(text.includes('Liste bearbeiten'), 'edit panel should render on validation error')
    })

    it('updates only title/description and preserves the items array', async () => {
      let id = await insertList('Before', 'test-admin-update', [{ id: 'a', label: 'Widget' }])
      let body = gridBody(adminCsrfToken, { title: 'After', description: 'test-admin-update2' })
      let response = await router.fetch(LISTS_URL + '/' + id, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/admin/lists'))
      let row = await pool.query(
        'SELECT title, description, list, user_id FROM lists WHERE id = $1',
        [id],
      )
      assert.equal(row.rows[0].title, 'After')
      assert.equal(row.rows[0].description, 'test-admin-update2')
      let listVal: unknown = row.rows[0].list
      let items = typeof listVal === 'string' ? JSON.parse(listVal) : listVal
      assert.deepEqual(items, [{ id: 'a', label: 'Widget' }], 'items array must be preserved')
    })

    it('redirects with a flash error when updating a not-found row', async () => {
      let body = gridBody(adminCsrfToken, { title: 'Ghost', description: 'test-admin-ghost' })
      let response = await router.fetch(LISTS_URL + '/9999999', {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/admin/lists'), 'not-found update should redirect to the grid')
      let err = await readFlash()
      assert.ok(err?.includes('Liste nicht gefunden'), 'flash error should be set')
    })
  })

  describe('destroy (DELETE /admin/lists/:id)', () => {
    it('deletes a list and redirects to the grid', async () => {
      let id = await insertList('Delete Me', 'test-admin-delete')
      let body = gridBody(adminCsrfToken)
      let response = await router.fetch(LISTS_URL + '/' + id, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/admin/lists'), 'delete should redirect to the grid')
      let row = await pool.query('SELECT id FROM lists WHERE id = $1', [id])
      assert.equal(row.rows.length, 0, 'list row should be deleted')
    })

    it('redirects with a flash error for a non-existent list', async () => {
      let body = gridBody(adminCsrfToken)
      let response = await router.fetch(LISTS_URL + '/9999999', {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
      let err = await readFlash()
      assert.ok(err?.includes('Liste nicht gefunden'), 'flash error should be set')
    })

    it('redirects with a flash error for an invalid id', async () => {
      let body = gridBody(adminCsrfToken)
      let response = await router.fetch(LISTS_URL + '/abc', {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
      let err = await readFlash()
      assert.ok(err?.includes('Ungültige Listen-ID'), 'flash error should be set')
    })
  })
})

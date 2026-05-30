import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../router.ts'
import { initializeAppDatabase, pool } from '../data/setup.ts'
import { createAuthCookieWithCsrfForUser } from '../test-utils.ts'

const BASE = 'https://remix.run'
const CONFIGS_URL = `${BASE}/admin/offering-configs`

const createdConfigIds: number[] = []
const createdResourceIds: number[] = []

describe('Admin Offering Configs Controller', () => {
  let adminCookie: string
  let adminCsrfToken: string
  let userCookie: string
  let userCsrfToken: string
  let seedResourceId: number

  before(async () => {
    await initializeAppDatabase()

    // Admin session
    let adminAuth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!adminAuth?.cookie) {
      throw new Error('Failed to create admin session')
    }
    adminCookie = adminAuth.cookie
    adminCsrfToken = adminAuth.csrfToken

    // Non-admin user session
    let userAuth = await createAuthCookieWithCsrfForUser('user@newapp.com')
    if (!userAuth?.cookie) {
      throw new Error('Failed to create user session')
    }
    userCookie = userAuth.cookie
    userCsrfToken = userAuth.csrfToken

    // Seed a test resource
    let now = Date.now()
    let result = await pool.query(
      'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
      [`Offering Config Test Resource ${now}`, now, now],
    )
    seedResourceId = result.rows[0].id as number
    createdResourceIds.push(seedResourceId)
  })

  after(async () => {
    for (let id of createdConfigIds) {
      try {
        await pool.query('DELETE FROM offering_configs WHERE id = $1', [id])
      } catch {}
    }
    for (let id of createdResourceIds) {
      try {
        await pool.query('DELETE FROM resources WHERE id = $1', [id])
      } catch {}
    }
  })

  describe('index (GET /admin/offering-configs)', () => {
    it('returns 200 for admin users', async () => {
      let response = await router.fetch(CONFIGS_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('Offering Configs'))
    })

    it('returns 403 for non-admin users', async () => {
      let response = await router.fetch(CONFIGS_URL, {
        headers: { Cookie: userCookie },
      })
      assert.equal(response.status, 403)
    })

    it('returns 302 for unauthenticated requests', async () => {
      let response = await router.fetch(CONFIGS_URL)
      assert.equal(response.status, 302)
    })

    it('supports filtering by resource description', async () => {
      let response = await router.fetch(`${CONFIGS_URL}?filter=resource`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })

    it('supports sorting', async () => {
      let response = await router.fetch(`${CONFIGS_URL}?sort=id&order=asc`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })

    it('supports pagination', async () => {
      let response = await router.fetch(`${CONFIGS_URL}?offset=0`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
    })
  })

  describe('create (POST /admin/offering-configs)', () => {
    it('creates a new offering config with valid data', async () => {
      let body = new URLSearchParams({
        resource_id: String(seedResourceId),
        monday_enabled: '1',
        monday_start: '480',
        monday_end: '1020',
        wednesday_enabled: '1',
        wednesday_start: '540',
        wednesday_end: '1200',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(CONFIGS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/admin/offering-configs?editing='))

      let match = location.match(/editing=(\d+)/)
      if (match) {
        createdConfigIds.push(Number(match[1]))
      }
    })

    it('rejects duplicate resource_id', async () => {
      let body = new URLSearchParams({
        resource_id: String(seedResourceId),
        monday_enabled: '1',
        monday_start: '480',
        monday_end: '1020',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(CONFIGS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400)
      let json = await response.json()
      assert.ok(json.error.includes('already'))
    })

    it('rejects missing resource_id', async () => {
      let body = new URLSearchParams({
        resource_id: '',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(CONFIGS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400)
    })

    it('denies create for non-admin users', async () => {
      let body = new URLSearchParams({
        resource_id: String(seedResourceId),
        monday_enabled: '1',
        monday_start: '480',
        monday_end: '1020',
        _csrf: userCsrfToken,
      })
      let response = await router.fetch(CONFIGS_URL, {
        method: 'POST',
        headers: {
          Cookie: userCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 403)
    })
  })

  describe('update (PUT /admin/offering-configs/:id)', () => {
    let testConfigId: number

    before(async () => {
      let now = Date.now()
      let resResult = await pool.query(
        'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
        [`Offering Config Update Res ${now}`, now, now],
      )
      let resId = resResult.rows[0].id as number
      createdResourceIds.push(resId)

      let cfgResult = await pool.query(
        `INSERT INTO offering_configs (resource_id, rules, created_at, updated_at) VALUES ($1, $2::jsonb, $3, $3) RETURNING id`,
        [resId, JSON.stringify({ monday: [480, 1020] }), now],
      )
      testConfigId = cfgResult.rows[0].id as number
      createdConfigIds.push(testConfigId)
    })

    it('updates an offering config rules', async () => {
      let body = new URLSearchParams({
        resource_id: String(seedResourceId),
        monday_enabled: '1',
        monday_start: '540',
        monday_end: '1080',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/admin/offering-configs/${testConfigId}`, {
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
      assert.ok(location.startsWith('/admin/offering-configs'))
    })

    it('denies update for non-admin users', async () => {
      let body = new URLSearchParams({
        resource_id: String(seedResourceId),
        monday_enabled: '1',
        monday_start: '480',
        monday_end: '1020',
        _csrf: userCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/admin/offering-configs/${testConfigId}`, {
        method: 'PUT',
        headers: {
          Cookie: userCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': userCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 403)
    })
  })

  describe('destroy (DELETE /admin/offering-configs/:id)', () => {
    it('deletes an offering config', async () => {
      let now = Date.now()
      let resResult = await pool.query(
        'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
        [`Offering Config Delete Res ${now}`, now, now],
      )
      let resId = resResult.rows[0].id as number
      createdResourceIds.push(resId)

      let cfgResult = await pool.query(
        `INSERT INTO offering_configs (resource_id, rules, created_at, updated_at) VALUES ($1, $2::jsonb, $3, $3) RETURNING id`,
        [resId, JSON.stringify({ monday: [480, 1020] }), now],
      )
      let id = cfgResult.rows[0].id as number

      let body = new URLSearchParams({
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/admin/offering-configs/${id}`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 302)
    })

    it('returns 404 for non-existent config', async () => {
      let body = new URLSearchParams({
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let response = await router.fetch(`${BASE}/admin/offering-configs/9999999`, {
        method: 'DELETE',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 404)
    })

    it('denies delete for non-admin users', async () => {
      let body = new URLSearchParams({
        _csrf: userCsrfToken,
      })
      let response = await router.fetch(`${BASE}/admin/offering-configs/1`, {
        method: 'DELETE',
        headers: {
          Cookie: userCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': userCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 403)
    })
  })
})

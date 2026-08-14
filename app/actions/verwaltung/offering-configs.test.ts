import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'

const BASE = 'https://remix.run'
const CONFIGS_URL = `${BASE}/verwaltung/offering-configs`

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
  })

  describe('index (GET /verwaltung/offering-configs)', () => {
    it('returns 200 for admin users', async () => {
      let response = await router.fetch(CONFIGS_URL, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('Angebotskonfigurationen'))
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

  describe('create (POST /verwaltung/offering-configs)', () => {
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
      assert.ok(location.startsWith('/verwaltung/offering-configs?editing='))

      let match = location.match(/editing=(\d+)/)
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
      let text = await response.text()
      assert.ok(text.includes('Konfiguration'))
    })

    it('rejects non-existent resource_id', async () => {
      let body = new URLSearchParams({
        resource_id: '9999999',
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
      assert.equal(response.status, 404)
      let text = await response.text()
      assert.ok(text.includes('nicht gefunden'))
    })

    it('rejects start >= end time range', async () => {
      // Create a fresh resource for this test
      let now = Date.now()
      let resResult = await pool.query(
        'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
        [`Offering Config Time Range Res ${now}`, now, now],
      )
      let resId = resResult.rows[0].id as number

      let body = new URLSearchParams({
        resource_id: String(resId),
        monday_enabled: '1',
        monday_start: '600',
        monday_end: '300',
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

    it('rejects time values outside 0-1440 range', async () => {
      let now = Date.now()
      let resResult = await pool.query(
        'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
        [`Offering Config Out Of Range Res ${now}`, now, now],
      )
      let resId = resResult.rows[0].id as number

      let body = new URLSearchParams({
        resource_id: String(resId),
        monday_enabled: '1',
        monday_start: '-1',
        monday_end: '100',
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

  describe('update (PUT /verwaltung/offering-configs/:id)', () => {
    let testConfigId: number

    before(async () => {
      let now = Date.now()
      let resResult = await pool.query(
        'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
        [`Offering Config Update Res ${now}`, now, now],
      )
      let resId = resResult.rows[0].id as number

      let cfgResult = await pool.query(
        `INSERT INTO offering_configs (resource_id, rules, created_at, updated_at) VALUES ($1, $2::jsonb, $3, $3) RETURNING id`,
        [resId, JSON.stringify({ monday: [480, 1020] }), now],
      )
      testConfigId = cfgResult.rows[0].id as number
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
      let response = await router.fetch(`${BASE}/verwaltung/offering-configs/${testConfigId}`, {
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
      assert.ok(location.startsWith('/verwaltung/offering-configs'))
    })

    it('returns 404 when updating non-existent config', async () => {
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
      let response = await router.fetch(`${BASE}/verwaltung/offering-configs/9999999`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': adminCsrfToken,
        },
        body: body.toString(),
      })
      assert.equal(response.status, 404)
      let json = await response.json()
      assert.ok(json.error.includes('not found'))
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
      let response = await router.fetch(`${BASE}/verwaltung/offering-configs/${testConfigId}`, {
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

  describe('destroy (DELETE /verwaltung/offering-configs/:id)', () => {
    it('deletes an offering config', async () => {
      let now = Date.now()
      let resResult = await pool.query(
        'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
        [`Offering Config Delete Res ${now}`, now, now],
      )
      let resId = resResult.rows[0].id as number

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
      let response = await router.fetch(`${BASE}/verwaltung/offering-configs/${id}`, {
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
      let response = await router.fetch(`${BASE}/verwaltung/offering-configs/9999999`, {
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
      let response = await router.fetch(`${BASE}/verwaltung/offering-configs/1`, {
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

  describe('agent mode (X-Agent-Thread) for two-form chain', () => {
    it('creates a resource via seed, then creates an offering config via agent protocol', async () => {
      let now = Date.now()
      let resResult = await pool.query(
        'INSERT INTO resources (name, description, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING id',
        [`Agent Config Res ${now}`, `Agent config test resource ${now}`, now, now],
      )
      let resourceId = resResult.rows[0].id as number

      let configBody = new URLSearchParams({
        resource_id: String(resourceId),
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
      let configRes = await router.fetch(CONFIGS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Agent-Thread': 'test-thread-42',
        },
        body: configBody.toString(),
      })
      assert.equal(configRes.status, 200)
      let json = await configRes.json()
      assert.equal(json.status, 'created')
      assert.equal(json.data.resource_id, resourceId)
      assert.ok(json.data.id > 0, 'Should have a valid config ID')
      assert.ok(json.data.rules.monday, 'Should have monday rules')
      assert.equal(json.data.rules.monday[0], 480)
      assert.equal(json.data.rules.monday[1], 1020)
      assert.equal(json.threadId, 'test-thread-42')

      let configCheck = await pool.query(
        'SELECT id, resource_id FROM offering_configs WHERE resource_id = $1',
        [resourceId],
      )
      assert.equal(configCheck.rows.length, 1)
      assert.equal(configCheck.rows[0].resource_id, resourceId)
    })

    it('returns validation_error for missing resource_id via agent protocol', async () => {
      let body = new URLSearchParams({
        resource_id: '',
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
          'X-Agent-Thread': 'test-thread-validation',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400)
      let json = await response.json()
      assert.equal(json.status, 'validation_error')
      assert.ok(json.issues.length > 0)
      assert.equal(json.threadId, 'test-thread-validation')
    })

    it('returns validation_error for non-existent resource_id via agent protocol', async () => {
      let body = new URLSearchParams({
        resource_id: '9999999',
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
          'X-Agent-Thread': 'test-thread-notfound',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 404)
      let json = await response.json()
      assert.equal(json.status, 'validation_error')
      assert.ok(json.issues.length > 0)
      assert.equal(json.threadId, 'test-thread-notfound')
    })

    it('returns validation_error for duplicate resource via agent protocol', async () => {
      let now = Date.now()
      let resResult = await pool.query(
        'INSERT INTO resources (name, description, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING id',
        [`Agent Dup Res ${now}`, `Agent duplicate test resource ${now}`, now, now],
      )
      let resourceId = resResult.rows[0].id as number

      // First create a config via human flow
      let createBody = new URLSearchParams({
        resource_id: String(resourceId),
        monday_enabled: '1',
        monday_start: '480',
        monday_end: '1020',
        _csrf: adminCsrfToken,
        _offset: '',
        _sort: '',
        _order: '',
        _filter: '',
      })
      let createRes = await router.fetch(CONFIGS_URL, {
        method: 'POST',
        headers: {
          Cookie: adminCookie,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: createBody.toString(),
      })
      assert.equal(createRes.status, 302)

      // Then try agent-mode duplicate
      let dupBody = new URLSearchParams({
        resource_id: String(resourceId),
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
          'X-Agent-Thread': 'test-thread-duplicate',
        },
        body: dupBody.toString(),
      })
      assert.equal(response.status, 400)
      let json = await response.json()
      assert.equal(json.status, 'validation_error')
      assert.ok(json.issues.length > 0)
      assert.equal(json.threadId, 'test-thread-duplicate')
    })

    it('returns validation_error for empty rules via agent protocol', async () => {
      let now = Date.now()
      let resResult = await pool.query(
        'INSERT INTO resources (name, description, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING id',
        [`Agent Empty Rules Res ${now}`, `Agent empty rules test ${now}`, now, now],
      )
      let resourceId = resResult.rows[0].id as number

      let body = new URLSearchParams({
        resource_id: String(resourceId),
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
          'X-Agent-Thread': 'test-thread-empty-rules',
        },
        body: body.toString(),
      })
      assert.equal(response.status, 400)
      let json = await response.json()
      assert.equal(json.status, 'validation_error')
      assert.ok(json.issues.length > 0)
      assert.equal(json.threadId, 'test-thread-empty-rules')
    })
  })
})

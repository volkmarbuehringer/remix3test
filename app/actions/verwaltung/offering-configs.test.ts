import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'
import { createAuthCookieWithCsrfForUser } from '../../../test/utils.ts'

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

  describe('show (GET /verwaltung/offering-configs/:id)', () => {
    it('redirects to the grid for a missing/deleted row (no 404 card)', async () => {
      let response = await router.fetch(`${BASE}/verwaltung/offering-configs/9999999`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 302)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/offering-configs'))
    })

    it('redirects to the grid for a non-numeric id without querying', async () => {
      let response = await router.fetch(`${BASE}/verwaltung/offering-configs/abc`, {
        headers: { Cookie: adminCookie },
        redirect: 'manual',
      })
      assert.equal(response.status, 302)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/offering-configs'))
    })

    it('renders the edit panel for an existing row', async () => {
      let now = Date.now()
      let resResult = await pool.query(
        'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
        [`Offering Config Show Res ${now}`, now, now],
      )
      let resId = resResult.rows[0].id as number
      let cfgResult = await pool.query(
        `INSERT INTO offering_configs (resource_id, rules, created_at, updated_at) VALUES ($1, $2::jsonb, $3, $3) RETURNING id`,
        [resId, JSON.stringify({ monday: [480, 1020] }), now],
      )
      let id = cfgResult.rows[0].id as number

      let response = await router.fetch(`${BASE}/verwaltung/offering-configs/${id}`, {
        headers: { Cookie: adminCookie },
      })
      assert.equal(response.status, 200)
      let text = await response.text()
      assert.ok(text.includes('Konfiguration bearbeiten'))
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
      assert.equal(response.status, 303)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/offering-configs?editing='))

      // The typed `db.create` write must leave a JSONB object behind; a stray
      // JSON.stringify would store a string and break the row schema on read.
      let stored = await pool.query(
        'SELECT jsonb_typeof(rules) AS type, rules FROM offering_configs WHERE resource_id = $1',
        [seedResourceId],
      )
      assert.equal(stored.rows[0]?.type, 'object', 'rules must be stored as a JSON object')
      assert.deepEqual(stored.rows[0]?.rules, { monday: [480, 1020], wednesday: [540, 1200] })
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
      assert.ok(text.includes('bereits eine Konfiguration'))
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
      assert.equal(response.status, 400)
      let text = await response.text()
      assert.ok(text.includes('Ressource nicht gefunden'))
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
      let text = await response.text()
      assert.ok(text.includes('Mindestens ein Tag muss einen Zeitraum haben'))
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
      let text = await response.text()
      assert.ok(text.includes('Mindestens ein Tag muss einen Zeitraum haben'))
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
      let text = await response.text()
      assert.ok(text.includes('Ressource ist erforderlich'))
    })

    it('links the create-panel resource field to its error id', async () => {
      // The panel only renders the form while an unconfigured resource exists,
      // so seed one instead of relying on the shared fixture's leftovers.
      let now = Date.now()
      await pool.query(
        'INSERT INTO resources (name, description, created_at, updated_at) VALUES ($1, $2, $3, $4)',
        [`Offering Config Error Res ${now}`, `Freie Ressource ${now}`, now, now],
      )
      let body = new FormData()
      body.set('_csrf', adminCsrfToken)
      let response = await router.fetch(CONFIGS_URL, {
        method: 'POST',
        headers: { Cookie: adminCookie, 'X-Csrf-Token': adminCsrfToken },
        body,
      })
      assert.equal(response.status, 400)
      let text = await response.text()
      assert.ok(
        text.includes('aria-describedby="oc-c-resource-error"'),
        'create-panel resource select should reference its error id',
      )
      assert.ok(
        text.includes('id="oc-c-resource-error"'),
        'create-panel error element should carry the id',
      )
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
      assert.equal(response.status, 303)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/offering-configs'))

      let stored = await pool.query(
        'SELECT jsonb_typeof(rules) AS type, rules FROM offering_configs WHERE id = $1',
        [testConfigId],
      )
      assert.equal(stored.rows[0]?.type, 'object', 'an update must keep rules a JSON object')
      assert.deepEqual(stored.rows[0]?.rules, { monday: [540, 1080] })
    })

    it('re-renders the edit panel with a linked resource error', async () => {
      let body = new FormData()
      body.set('_csrf', adminCsrfToken)
      let response = await router.fetch(`${BASE}/verwaltung/offering-configs/${testConfigId}`, {
        method: 'PUT',
        headers: {
          Cookie: adminCookie,
          'X-Csrf-Token': adminCsrfToken,
        },
        body,
      })
      assert.equal(response.status, 400)
      let text = await response.text()
      assert.ok(
        text.includes('aria-describedby="oc-resource-error"'),
        'edit-panel resource select should reference its error id',
      )
      assert.ok(
        text.includes('id="oc-resource-error"'),
        'edit-panel error element should carry the id',
      )
    })

    it('redirects when updating non-existent config', async () => {
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
      assert.equal(response.status, 303)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/offering-configs'))
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
      assert.equal(response.status, 303)
    })

    it('redirects for non-existent config', async () => {
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
      assert.equal(response.status, 303)
      let location = response.headers.get('Location') || ''
      assert.ok(location.startsWith('/verwaltung/offering-configs'))
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
      assert.equal(createRes.status, 303)

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

// ---------------------------------------------------------------------------
// Grid/panel UX contracts that the controller owns: what the search matches,
// what the footer reports, which resources the panels offer, and where the
// German validation messages point.
// ---------------------------------------------------------------------------

const UX_TOKEN = 'ux-config-'

describe('Admin Offering Configs UX', () => {
  let adminCookie: string
  let adminCsrfToken: string

  before(async () => {
    await initializeAppDatabase()
    let adminAuth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    if (!adminAuth?.cookie) {
      throw new Error('Failed to create admin session')
    }
    adminCookie = adminAuth.cookie
    adminCsrfToken = adminAuth.csrfToken
  })

  afterEach(async () => {
    await pool.query(
      `DELETE FROM offering_configs WHERE resource_id IN
         (SELECT id FROM resources WHERE name LIKE $1)`,
      [`${UX_TOKEN}%`],
    )
    await pool.query('DELETE FROM resources WHERE name LIKE $1', [`${UX_TOKEN}%`])
  })

  async function seedResource(name: string, description: string): Promise<number> {
    let now = Date.now()
    let result = await pool.query(
      'INSERT INTO resources (name, description, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, description, now, now],
    )
    return result.rows[0].id as number
  }

  async function seedConfig(
    resourceId: number,
    rules: Record<string, [number, number]>,
  ): Promise<number> {
    let now = Date.now()
    let result = await pool.query(
      'INSERT INTO offering_configs (resource_id, rules, created_at, updated_at) VALUES ($1, $2::jsonb, $3, $3) RETURNING id',
      [resourceId, JSON.stringify(rules), now],
    )
    return result.rows[0].id as number
  }

  function getConfigs(query = ''): Promise<Response> {
    return router.fetch(CONFIGS_URL + query, { headers: { Cookie: adminCookie } })
  }

  it('groups the week by weekday and reports the filtered total', async () => {
    let resourceId = await seedResource(`${UX_TOKEN}Gruppenraum`, `Ruhiger Raum ${UX_TOKEN}`)
    await seedConfig(resourceId, {
      // Stored in a JSONB-scrambled order on purpose: the grid must not let the
      // database's key order shuffle the week.
      friday: [480, 1020],
      monday: [480, 1020],
      tuesday: [480, 1020],
      wednesday: [480, 1020],
      thursday: [480, 1020],
      saturday: [540, 780],
    })

    let response = await getConfigs(`?filter=${UX_TOKEN}Gruppenraum`)
    assert.equal(response.status, 200)
    let text = await response.text()

    assert.ok(
      text.includes('Mo\u2013Fr 08:00\u201317:00'),
      'identical weekdays must be grouped into one range',
    )
    assert.ok(text.includes('Sa 09:00\u201313:00'), 'a differing Saturday must stay separate')
    assert.ok(
      text.includes('6 Tage \u00b7 49 Std./Woche'),
      'the cell meta line must report the day count and weekly hours',
    )
    assert.ok(
      text.includes('Zeige 1\u20131 von 1'),
      'the footer must report the filtered total, not only the page range',
    )
  })

  it('matches the search against the resource description as well as its name', async () => {
    let resourceId = await seedResource(
      `${UX_TOKEN}Malraum`,
      `Kreativbereich mit Staffelei ${UX_TOKEN}`,
    )
    await seedConfig(resourceId, { monday: [540, 660] })

    let byDescription = await getConfigs('?filter=Staffelei')
    assert.equal(byDescription.status, 200)
    assert.ok((await byDescription.text()).includes('Kreativbereich mit Staffelei'))

    let byName = await getConfigs(`?filter=${UX_TOKEN}Malraum`)
    assert.ok((await byName.text()).includes('Kreativbereich mit Staffelei'))
  })

  it('disables resources that already have a configuration in the create panel', async () => {
    let configuredId = await seedResource(`${UX_TOKEN}Belegt`, 'Schon konfiguriert')
    await seedConfig(configuredId, { monday: [480, 1020] })
    await seedResource(`${UX_TOKEN}Frei`, 'Noch ohne Konfiguration')

    let response = await getConfigs('?creating=true')
    assert.equal(response.status, 200)
    let text = await response.text()

    assert.ok(
      text.includes('\u2014 bereits konfiguriert'),
      'a configured resource must say why it cannot be picked',
    )
    assert.match(
      text,
      new RegExp(`<option value="${configuredId}"[^>]*disabled`),
      'a configured resource must be disabled, not merely labelled',
    )
    assert.ok(
      text.includes('Ressource auswählen'),
      'the placeholder option must still exist while a free resource exists',
    )
  })

  it('names the weekday whose range is inverted and marks that row', async () => {
    let resourceId = await seedResource(`${UX_TOKEN}Zeiten`, 'Zeiten prüfen')

    let body = new URLSearchParams({
      resource_id: String(resourceId),
      monday_enabled: '1',
      monday_start: '600',
      monday_end: '300',
      _csrf: adminCsrfToken,
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
    assert.ok(
      text.includes('Montag: Das Ende muss nach dem Beginn liegen.'),
      'the error must name the offending weekday',
    )
    assert.ok(
      text.includes('id="oc-c-monday-error"'),
      'the day row must carry the error element the selects describe',
    )
    assert.ok(
      text.includes('aria-describedby="oc-c-monday-error"'),
      'the day selects must be linked to their error',
    )
    assert.equal(
      (await pool.query('SELECT 1 FROM offering_configs WHERE resource_id = $1', [resourceId])).rows
        .length,
      0,
      'a partially invalid week must not be saved',
    )
  })

  it('renders the form-level error inside the panel, not in the grid column', async () => {
    let resourceId = await seedResource(`${UX_TOKEN}KeinTag`, 'Ohne Wochentag')

    let body = new URLSearchParams({
      resource_id: String(resourceId),
      _csrf: adminCsrfToken,
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
    assert.ok(text.includes('Mindestens ein Tag muss einen Zeitraum haben'))
    assert.ok(
      text.includes('data-form-error'),
      'the banner must be focusable for FormErrorFocus, next to the form',
    )
  })

  it('offers every day with an accessible label for start and end', async () => {
    let resourceId = await seedResource(`${UX_TOKEN}Barrierefrei`, 'Label prüfen')
    let configId = await seedConfig(resourceId, { wednesday: [540, 1020] })

    let response = await router.fetch(`${CONFIGS_URL}/${configId}`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()

    for (let [day, label] of [
      ['monday', 'Montag'],
      ['wednesday', 'Mittwoch'],
      ['sunday', 'Sonntag'],
    ] as const) {
      assert.ok(
        text.includes(`aria-label="${label} Beginn"`),
        `${day} start select must be labelled`,
      )
      assert.ok(text.includes(`aria-label="${label} Ende"`), `${day} end select must be labelled`)
    }
  })
})

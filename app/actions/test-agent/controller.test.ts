import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { router } from '../../test-router.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'

const BASE = 'https://remix.run'
const TEST_AGENT_URL = `${BASE}/testagent`

describe('Test Agent controller', () => {
  let adminCookie: string

  before(async () => {
    await initializeAppDatabase()
    let result = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    adminCookie = result?.cookie ?? ''
  })

  it('GET /testagent redirects to login when not authenticated', async () => {
    let response = await router.fetch(TEST_AGENT_URL, { redirect: 'manual' })
    assert.equal(response.status, 302)
  })

  it('GET /testagent returns 200 with HTML when authenticated', async () => {
    let response = await router.fetch(TEST_AGENT_URL, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('Test Agent'), 'page should contain heading')
  })

  it('POST /testagent with empty message returns 400 when authenticated', async () => {
    let body = new FormData()
    body.set('message', '')
    let response = await router.fetch(TEST_AGENT_URL, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body,
    })
    assert.equal(response.status, 400)
    let json = await response.json()
    assert.ok(json.error, 'should return error message')
  })

  it('POST /testagent with valid message returns JSON when authenticated', async () => {
    let body = new FormData()
    body.set('message', 'Hello')
    let response = await router.fetch(TEST_AGENT_URL, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body,
    })
    let contentType = response.headers.get('Content-Type') || ''
    assert.ok(contentType.includes('application/json'), 'response should be JSON')
    if (response.ok) {
      let json = await response.json()
      assert.ok(json.runId || json.error, 'should return runId or error')
    }
  })

  it('GET /testagent/stream/nonexistent redirects when not authenticated', async () => {
    let response = await router.fetch(`${TEST_AGENT_URL}/stream/nonexistent-run-id`, {
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
  })

  it('GET /testagent/stream/nonexistent returns 404 when authenticated', async () => {
    let response = await router.fetch(`${TEST_AGENT_URL}/stream/nonexistent-run-id`, {
      headers: { Cookie: adminCookie },
    })
    assert.equal(response.status, 404)
  })
})

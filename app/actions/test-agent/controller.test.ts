import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'

const BASE = 'https://remix.run'
const TEST_AGENT_URL = `${BASE}/testagent`

describe('Test Agent controller', () => {
  it('GET /testagent returns 200 with HTML', async () => {
    let response = await router.fetch(TEST_AGENT_URL)
    assert.equal(response.status, 200)
    let text = await response.text()
    assert.ok(text.includes('Test Agent'), 'page should contain heading')
  })

  it('POST /testagent with empty message returns 400', async () => {
    let body = new FormData()
    body.set('message', '')
    let response = await router.fetch(TEST_AGENT_URL, {
      method: 'POST',
      body,
    })
    assert.equal(response.status, 400)
    let json = await response.json()
    assert.ok(json.error, 'should return error message')
  })

  it('POST /testagent with valid message returns JSON', async () => {
    let body = new FormData()
    body.set('message', 'Hello')
    let response = await router.fetch(TEST_AGENT_URL, {
      method: 'POST',
      body,
    })
    let contentType = response.headers.get('Content-Type') || ''
    assert.ok(contentType.includes('application/json'), 'response should be JSON')
    if (response.ok) {
      let json = await response.json()
      assert.ok(json.runId || json.error, 'should return runId or error')
    }
  })

  it('GET /testagent/stream/nonexistent returns 404', async () => {
    let response = await router.fetch(`${TEST_AGENT_URL}/stream/nonexistent-run-id`)
    assert.equal(response.status, 404)
  })
})

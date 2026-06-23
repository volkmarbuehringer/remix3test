import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../router.ts'
import { webhookRoute } from '../../routes.ts'
import { pool, initializeAppDatabase } from '../../data/setup.ts'

const BASE = 'https://remix.run'
const TEST_TOKEN = 'test-webhook-token-456'

describe('Webhook controller', () => {
  before(async () => {
    await initializeAppDatabase()
    process.env.WEBHOOK_TOKEN = TEST_TOKEN
  })

  after(async () => {
    await pool.query(`DELETE FROM webhook_requests WHERE token = $1`, [TEST_TOKEN])
    delete process.env.WEBHOOK_TOKEN
  })

  it('inserts payload and returns id', async () => {
    let url = `${BASE}${webhookRoute.href()}`
    let rawBody = JSON.stringify({ event: 'test', data: { foo: 'bar' } })
    let response = await router.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: rawBody,
    })

    assert.equal(response.status, 200)
    let json = await response.json()
    assert.ok(typeof json.id === 'string' && json.id.length > 0, 'should return a UUID string')

    let { rows } = await pool.query('SELECT payload FROM webhook_requests WHERE id = $1', [json.id])
    assert.deepEqual(rows[0].payload, { event: 'test', data: { foo: 'bar' } })
  })

  it('inserts source_ip and headers from request', async () => {
    let url = `${BASE}${webhookRoute.href()}`
    let response = await router.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_TOKEN}`,
        'X-Forwarded-For': '10.0.0.1',
        'X-Custom-Header': 'test-value',
      },
      body: JSON.stringify({ msg: 'hello' }),
    })

    let json = await response.json()
    assert.equal(response.status, 200)

    let { rows } = await pool.query(
      'SELECT source_ip, headers FROM webhook_requests WHERE id = $1',
      [json.id],
    )
    assert.ok(rows[0].source_ip.includes('10.0.0.1'))
    assert.ok(rows[0].headers['x-custom-header'])
  })

  it('returns 401 when Authorization header is missing', async () => {
    let url = `${BASE}${webhookRoute.href()}`
    let response = await router.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'test' }),
    })
    assert.equal(response.status, 401)
  })

  it('returns 401 for non-Bearer Authorization scheme', async () => {
    let url = `${BASE}${webhookRoute.href()}`
    let response = await router.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from('user:pass').toString('base64'),
      },
      body: JSON.stringify({ event: 'test' }),
    })
    assert.equal(response.status, 401)
  })

  it('returns 401 for empty Bearer token', async () => {
    let url = `${BASE}${webhookRoute.href()}`
    let response = await router.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ',
      },
      body: JSON.stringify({ event: 'test' }),
    })
    assert.equal(response.status, 401)
  })

  it('returns 401 for invalid token', async () => {
    let url = `${BASE}${webhookRoute.href()}`
    let response = await router.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wrong-token',
      },
      body: JSON.stringify({ event: 'test' }),
    })
    assert.equal(response.status, 401)
  })

  it('returns 503 when WEBHOOK_TOKEN is not configured', async () => {
    delete process.env.WEBHOOK_TOKEN
    try {
      let url = `${BASE}${webhookRoute.href()}`
      let response = await router.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
        body: JSON.stringify({ event: 'test' }),
      })
      assert.equal(response.status, 503)
    } finally {
      process.env.WEBHOOK_TOKEN = TEST_TOKEN
    }
  })

  it('returns 400 for non-JSON content type', async () => {
    let url = `${BASE}${webhookRoute.href()}`
    let response = await router.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        Authorization: `Bearer ${TEST_TOKEN}`,
      },
      body: 'not json',
    })
    assert.equal(response.status, 400)
  })

  it('returns 413 for oversized payload', async () => {
    let largePayload = 'x'.repeat(300 * 1024)
    let body = JSON.stringify({ data: largePayload })
    let url = `${BASE}${webhookRoute.href()}`
    let response = await router.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_TOKEN}`,
        'Content-Length': String(body.length),
      },
      body,
    })
    assert.equal(response.status, 413)
  })
})

import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'
import { createServer } from 'node:http'

import { router } from '../../router.ts'
import { appWebhookRoute } from '../../routes.ts'
import { pool, initializeAppDatabase } from '../../data/setup.ts'

const BASE = 'https://remix.run'
const TEST_TOKEN = 'test-webhook-token-123'

describe('App-Webhook controller', () => {
  let hermesServer: ReturnType<typeof createServer>

  before(async () => {
    await initializeAppDatabase()
    process.env.WEBHOOK_TOKEN = TEST_TOKEN

    await new Promise<void>((resolve) => {
      hermesServer = createServer((req, res) => {
        res.writeHead(202, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'accepted', delivery_id: 'test-delivery-1' }))
      })
      hermesServer.listen(0, '127.0.0.1', () => {
        let addr = hermesServer.address()
        if (addr && typeof addr === 'object') {
          process.env.HERMES_URL = `http://127.0.0.1:${addr.port}/webhooks/app-webhook`
        }
        resolve()
      })
    })
  })

  after(async () => {
    hermesServer?.close()
    await pool.query(`DELETE FROM webhook_requests WHERE token = $1`, [TEST_TOKEN])
    delete process.env.WEBHOOK_TOKEN
  })

  it('inserts payload, returns id + callbackUrl + payload, and forwards to hermes', async () => {
    let url = `${BASE}${appWebhookRoute.href({ token: TEST_TOKEN })}`
    let rawBody = JSON.stringify({ event: 'test', data: { foo: 'bar' } })
    let response = await router.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
    })

    assert.equal(response.status, 200)
    let json = await response.json()
    assert.ok(typeof json.id === 'string' && json.id.length > 0, 'should return a UUID string')
    assert.equal(json.callbackUrl, 'http://127.0.0.1:44100/callback')
    assert.deepEqual(json.payload, { event: 'test', data: { foo: 'bar' } })

    let { rows } = await pool.query('SELECT hermes_status FROM webhook_requests WHERE id = $1', [json.id])
    assert.equal(rows[0].hermes_status, '202', 'hermes_status should store the HTTP response code')
  })

  it('inserts source_ip and headers from request', async () => {
    let url = `${BASE}${appWebhookRoute.href({ token: TEST_TOKEN })}`
    let response = await router.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.168.1.1',
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
    assert.ok(rows[0].source_ip.includes('192.168.1.1'))
    assert.ok(rows[0].headers['x-custom-header'])
  })

  it('returns 401 for invalid token', async () => {
    let url = `${BASE}${appWebhookRoute.href({ token: 'wrong-token' })}`
    let response = await router.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'test' }),
    })

    assert.equal(response.status, 401)
  })

  it('returns 503 when WEBHOOK_TOKEN is not configured', async () => {
    delete process.env.WEBHOOK_TOKEN
    try {
      let url = `${BASE}${appWebhookRoute.href({ token: TEST_TOKEN })}`
      let response = await router.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'test' }),
      })

      assert.equal(response.status, 503)
    } finally {
      process.env.WEBHOOK_TOKEN = TEST_TOKEN
    }
  })

  it('returns 400 for non-JSON content type', async () => {
    let url = `${BASE}${appWebhookRoute.href({ token: TEST_TOKEN })}`
    let response = await router.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    })

    assert.equal(response.status, 400)
  })

  it('returns 413 for oversized payload', async () => {
    let largePayload = 'x'.repeat(300 * 1024)
    let body = JSON.stringify({ data: largePayload })
    let url = `${BASE}${appWebhookRoute.href({ token: TEST_TOKEN })}`
    let response = await router.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(body.length),
      },
      body,
    })

    assert.equal(response.status, 413)
  })
})

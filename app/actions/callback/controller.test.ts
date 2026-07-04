import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'
import { router } from '../../test-router.ts'
import { callbackRoute } from '../../routes.ts'
import { pool, initializeAppDatabase } from '../../data/setup.ts'
import { connectionIp } from '../../utils/request-ip.ts'
import type { WebhookRequestRow } from '../../data/webhook-requests.ts'

const BASE = 'https://remix.run'
let cleanupIds: string[] = []

async function insertWebhookRow(id: string): Promise<void> {
  await pool.query(
    `INSERT INTO webhook_requests (id, payload, headers, source_ip, created_at)
     VALUES ($1, '{}', '{}', $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [id, '127.0.0.1', Date.now()],
  )
  cleanupIds.push(id)
}

describe('Callback controller', () => {
  before(async () => {
    await initializeAppDatabase()
    // Ensure callback route resolves
    let href = callbackRoute.href()
    assert.equal(href, '/callback')
  })

  after(async () => {
    for (let id of cleanupIds) {
      await pool.query(`DELETE FROM webhook_requests WHERE id = $1`, [id])
    }
    cleanupIds = []
  })

  it('returns 200 and stores callback payload on success', async () => {
    let id = crypto.randomUUID()
    await insertWebhookRow(id)

    let body = { id, status: 'completed', result: { output: 'data' } }
    let request = new Request(`${BASE}/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Ip': '127.0.0.1',
      },
      body: JSON.stringify(body),
    })
    let ip = connectionIp(request)
    assert.equal(ip, '127.0.0.1', 'connectionIp should extract X-Client-Ip')

    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let json = await response.json()
    assert.deepEqual(json, { status: 'ok' })

    let { rows } = await pool.query<WebhookRequestRow>(
      'SELECT callback_response, callback_received_at FROM webhook_requests WHERE id = $1',
      [id],
    )
    assert.ok(rows[0].callback_received_at, 'callback_received_at should be set')
    let stored = typeof rows[0].callback_response === 'string'
      ? JSON.parse(rows[0].callback_response)
      : rows[0].callback_response
    assert.deepEqual(stored, body)
  })

  it('returns 403 for non-localhost request', async () => {
    let id = crypto.randomUUID()
    await insertWebhookRow(id)

    let response = await router.fetch(`${BASE}/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Ip': '203.0.113.1',
      },
      body: JSON.stringify({ id }),
    })

    assert.equal(response.status, 403)
  })

  it('returns 403 when no IP header is present', async () => {
    let response = await router.fetch(`${BASE}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: crypto.randomUUID() }),
    })

    assert.equal(response.status, 403)
  })

  it('returns 400 for non-JSON content type', async () => {
    let response = await router.fetch(`${BASE}/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'X-Client-Ip': '127.0.0.1',
      },
      body: 'not json',
    })

    assert.equal(response.status, 400)
  })

  it('returns 400 for invalid JSON body', async () => {
    let response = await router.fetch(`${BASE}/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Ip': '127.0.0.1',
      },
      body: 'not json',
    })

    assert.equal(response.status, 400)
  })

  it('returns 400 for missing id field', async () => {
    let response = await router.fetch(`${BASE}/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Ip': '127.0.0.1',
      },
      body: JSON.stringify({ status: 'completed' }),
    })

    assert.equal(response.status, 400)
  })

  it('returns 400 for non-string id', async () => {
    let response = await router.fetch(`${BASE}/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Ip': '127.0.0.1',
      },
      body: JSON.stringify({ id: 123 }),
    })

    assert.equal(response.status, 400)
  })

  it('returns 400 for non-UUID string id', async () => {
    let response = await router.fetch(`${BASE}/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Ip': '127.0.0.1',
      },
      body: JSON.stringify({ id: 'callback-test-1' }),
    })

    assert.equal(response.status, 400)
  })

  it('returns 409 for duplicate callback', async () => {
    let id = crypto.randomUUID()
    await insertWebhookRow(id)

    let body = { id, status: 'completed', result: { output: 'data' } }
    let makeRequest = () =>
      new Request(`${BASE}/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Ip': '127.0.0.1',
        },
        body: JSON.stringify(body),
      })

    let first = await router.fetch(makeRequest())
    assert.equal(first.status, 200)

    let second = await router.fetch(makeRequest())
    assert.equal(second.status, 409)
    let text = await second.text()
    assert.ok(text.includes('already received'), 'should mention conflict reason')
  })

  it('returns 404 for non-existent UUID', async () => {
    let response = await router.fetch(`${BASE}/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Ip': '127.0.0.1',
      },
      body: JSON.stringify({ id: crypto.randomUUID() }),
    })

    assert.equal(response.status, 404)
  })

  it('returns 413 for oversized payload', async () => {
    let largePayload = 'x'.repeat(300 * 1024)
    let body = JSON.stringify({ id: crypto.randomUUID(), data: largePayload })
    let response = await router.fetch(`${BASE}/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Ip': '127.0.0.1',
        'Content-Length': String(body.length),
      },
      body,
    })

    assert.equal(response.status, 413)
  })
})

import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from '../db.ts'
import { pool } from './test-pool.ts'
import {
  listWebhookRequests,
  getWebhookRequest,
  updateWebhookRequestPayload,
  getWebhookRequestPayload,
  resetWebhookRequestCallback,
  updateWebhookRequestHermesStatus,
  insertWebhookRequest,
} from './webhook-requests.ts'

const testId = '00000000-0000-0000-0000-000000000001'

describe('webhook-requests', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query("DELETE FROM webhook_requests WHERE source_ip = 'test-source'")
  })

  it('insertWebhookRequest inserts a row without throwing', async () => {
    await insertWebhookRequest(db, {
      payload: JSON.stringify({ key: 'val' }),
      headers: JSON.stringify({ 'content-type': 'application/json' }),
      sourceIp: 'test-source',
      now: Date.now(),
    })
    let result = await pool.query("SELECT id FROM webhook_requests WHERE source_ip = 'test-source'")
    assert.equal(result.rows.length, 1)
  })

  it('getWebhookRequest returns row for existing id', async () => {
    await pool.query(
      `INSERT INTO webhook_requests (id, payload, headers, source_ip, created_at)
       VALUES ($1, $2::jsonb, $3::jsonb, 'test-source', $4)`,
      [testId, JSON.stringify({ a: 1 }), JSON.stringify({ host: 'x' }), Date.now()],
    )
    let row = await getWebhookRequest(db, testId)
    assert.ok(row !== undefined)
    assert.equal(row!.id, testId)
    assert.deepEqual(row!.payload, { a: 1 })
  })

  it('getWebhookRequest returns undefined for non-existent id', async () => {
    let row = await getWebhookRequest(db, '00000000-0000-0000-0000-000000009999')
    assert.equal(row, undefined)
  })

  it('listWebhookRequests returns rows with hasMore flag', async () => {
    await pool.query(
      `INSERT INTO webhook_requests (id, payload, headers, source_ip, created_at)
       VALUES ($1, '{}'::jsonb, '{}'::jsonb, 'test-source', $2)`,
      [testId, Date.now()],
    )
    let result = await listWebhookRequests(db, {
      offset: 0,
      column: 'created_at',
      direction: 'desc',
    })
    assert.ok(result.rows.length >= 1)
    assert.ok(typeof result.hasMore === 'boolean')
    assert.ok(result.rows.some((r) => r.id === testId))
  })

  it('listWebhookRequests returns empty rows for beyond-range offset', async () => {
    let result = await listWebhookRequests(db, {
      offset: 999999,
      column: 'created_at',
      direction: 'desc',
    })
    assert.equal(result.rows.length, 0)
    assert.equal(result.hasMore, false)
  })

  it('updateWebhookRequestPayload returns true for existing row', async () => {
    await pool.query(
      `INSERT INTO webhook_requests (id, payload, headers, source_ip, created_at)
       VALUES ($1, '{}'::jsonb, '{}'::jsonb, 'test-source', $2)`,
      [testId, Date.now()],
    )
    let updated = await updateWebhookRequestPayload(db, testId, JSON.stringify({ updated: true }))
    assert.equal(updated, true)
    let row = await getWebhookRequestPayload(db, testId)
    assert.deepEqual(row!.payload, { updated: true })
  })

  it('updateWebhookRequestPayload returns false for non-existent id', async () => {
    let updated = await updateWebhookRequestPayload(
      db,
      '00000000-0000-0000-0000-000000009999',
      '{}',
    )
    assert.equal(updated, false)
  })

  it('getWebhookRequestPayload returns payload for existing id', async () => {
    await pool.query(
      `INSERT INTO webhook_requests (id, payload, headers, source_ip, created_at)
       VALUES ($1, $2::jsonb, '{}'::jsonb, 'test-source', $3)`,
      [testId, JSON.stringify({ found: true }), Date.now()],
    )
    let result = await getWebhookRequestPayload(db, testId)
    assert.ok(result !== undefined)
    assert.deepEqual(result!.payload, { found: true })
  })

  it('getWebhookRequestPayload returns undefined for non-existent id', async () => {
    let result = await getWebhookRequestPayload(db, '00000000-0000-0000-0000-000000009999')
    assert.equal(result, undefined)
  })

  it('resetWebhookRequestCallback clears callback fields', async () => {
    await pool.query(
      `INSERT INTO webhook_requests (id, payload, headers, source_ip, created_at, callback_response, callback_received_at)
       VALUES ($1, '{}'::jsonb, '{}'::jsonb, 'test-source', $2, $3::jsonb, $4)`,
      [testId, Date.now(), JSON.stringify({ prev: true }), Date.now()],
    )
    await resetWebhookRequestCallback(db, testId)
    let row = await getWebhookRequest(db, testId)
    assert.equal(row!.callback_response, null)
    assert.equal(row!.callback_received_at, null)
  })

  it('updateWebhookRequestHermesStatus updates status', async () => {
    await pool.query(
      `INSERT INTO webhook_requests (id, payload, headers, source_ip, created_at)
       VALUES ($1, '{}'::jsonb, '{}'::jsonb, 'test-source', $2)`,
      [testId, Date.now()],
    )
    await updateWebhookRequestHermesStatus(db, testId, 'completed')
    let row = await getWebhookRequest(db, testId)
    assert.equal(row!.hermes_status, 'completed')
  })

  it('updateWebhookRequestHermesStatus does not throw for non-existent id', async () => {
    await updateWebhookRequestHermesStatus(db, '00000000-0000-0000-0000-000000009999', 'completed')
  })
})

import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from './setup.ts'
import { pool } from './test-pool.ts'
import { updateCallbackResponse, checkWebhookRequestExists } from './callback.ts'

const testId = '00000000-0000-0000-0000-000000000002'

describe('callback', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query("DELETE FROM webhook_requests WHERE source_ip = 'test-callback'")
  })

  it('checkWebhookRequestExists returns true for existing id', async () => {
    await pool.query(
      `INSERT INTO webhook_requests (id, payload, headers, source_ip, created_at)
       VALUES ($1, '{}'::jsonb, '{}'::jsonb, 'test-callback', $2)`,
      [testId, Date.now()],
    )
    let exists = await checkWebhookRequestExists(db, testId)
    assert.equal(exists, true)
  })

  it('checkWebhookRequestExists returns false for non-existent id', async () => {
    let exists = await checkWebhookRequestExists(db, '00000000-0000-0000-0000-000000009999')
    assert.equal(exists, false)
  })

  it('updateCallbackResponse returns true on first call and updates the row', async () => {
    await pool.query(
      `INSERT INTO webhook_requests (id, payload, headers, source_ip, created_at)
       VALUES ($1, '{}'::jsonb, '{}'::jsonb, 'test-callback', $2)`,
      [testId, Date.now()],
    )
    let result = await updateCallbackResponse(db, {
      serialized: JSON.stringify({ status: 'ok' }),
      now: Date.now(),
      id: testId,
    })
    assert.equal(result, true)
    let row = await pool.query(
      'SELECT callback_response, callback_received_at FROM webhook_requests WHERE id = $1',
      [testId],
    )
    assert.ok(row.rows[0].callback_response !== null)
    assert.ok(row.rows[0].callback_received_at !== null)
  })

  it('updateCallbackResponse returns false on second call (callback_received_at IS NULL guard)', async () => {
    await pool.query(
      `INSERT INTO webhook_requests (id, payload, headers, source_ip, created_at)
       VALUES ($1, '{}'::jsonb, '{}'::jsonb, 'test-callback', $2)`,
      [testId, Date.now()],
    )
    await updateCallbackResponse(db, {
      serialized: JSON.stringify({ first: true }),
      now: Date.now(),
      id: testId,
    })
    let result = await updateCallbackResponse(db, {
      serialized: JSON.stringify({ second: true }),
      now: Date.now(),
      id: testId,
    })
    assert.equal(result, false)
  })

  it('updateCallbackResponse returns false for non-existent id', async () => {
    let result = await updateCallbackResponse(db, {
      serialized: JSON.stringify({}),
      now: Date.now(),
      id: '00000000-0000-0000-0000-000000009999',
    })
    assert.equal(result, false)
  })
})

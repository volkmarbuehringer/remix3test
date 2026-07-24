import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from './setup.ts'
import { pool } from './test-pool.ts'
import { insertAppWebhookRequest } from './app-webhook.ts'
import { updateWebhookRequestHermesStatus } from './webhook-requests.ts'

const testId = '00000000-0000-0000-0000-000000000003'

describe('app-webhook', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query("DELETE FROM webhook_requests WHERE source_ip = 'test-app-webhook'")
  })

  it('insertAppWebhookRequest inserts a row and returns its id', async () => {
    let id = await insertAppWebhookRequest(db, {
      serialized: JSON.stringify({ event: 'test' }),
      headers: JSON.stringify({ 'content-type': 'application/json' }),
      sourceIp: 'test-app-webhook',
      now: Date.now(),
    })
    assert.ok(typeof id === 'string')
    assert.ok(id.length > 0)
  })

  it('updateHermesStatus updates the status for an existing row', async () => {
    await pool.query(
      `INSERT INTO webhook_requests (id, payload, headers, source_ip, created_at)
       VALUES ($1, '{}'::jsonb, '{}'::jsonb, 'test-app-webhook', $2)`,
      [testId, Date.now()],
    )
    await updateWebhookRequestHermesStatus(db, testId, 'processed')
    let row = await pool.query('SELECT hermes_status FROM webhook_requests WHERE id = $1', [testId])
    assert.equal(row.rows[0].hermes_status, 'processed')
  })

  it('updateHermesStatus does not throw for non-existent id', async () => {
    await updateWebhookRequestHermesStatus(db, '00000000-0000-0000-0000-000000009999', 'ignored')
  })
})

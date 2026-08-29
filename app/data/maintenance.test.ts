import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from '../db.ts'
import { pool } from './test-pool.ts'
import {
  deleteExpiredChatRuns,
  deleteExpiredWebhookRequests,
  deleteExpiredAuditLogs,
  deleteExpiredUploads,
} from './maintenance.ts'

const HOUR_MS = 60 * 60 * 1000

describe('maintenance', () => {
  let userId: number

  before(async () => {
    await initializeAppDatabase()
    let result = await pool.query("SELECT id FROM users WHERE email = 'admin@newapp.com'")
    userId = result.rows[0].id
  })

  afterEach(async () => {
    await pool.query("DELETE FROM chat_runs WHERE run_id LIKE 'test-maint-%'")
    await pool.query("DELETE FROM webhook_requests WHERE source_ip = 'test-maintenance'")
    await pool.query("DELETE FROM audit_logs WHERE action_type = 'test-maintenance'")
    await pool.query("DELETE FROM uploads WHERE filename LIKE 'test-maint-%'")
  })

  it('deleteExpiredChatRuns deletes rows older than the TTL and keeps fresh rows', async () => {
    await pool.query(
      `INSERT INTO chat_runs (run_id, user_id, thread_id, created_at)
       VALUES ('test-maint-old', $1, 'test-maint-thread-old', $2),
              ('test-maint-new', $1, 'test-maint-thread-new', $3)`,
      [userId, Date.now() - 48 * HOUR_MS, Date.now()],
    )
    let deleted = await deleteExpiredChatRuns(db, 24 * HOUR_MS)
    assert.ok(deleted >= 1)
    let remaining = await pool.query(
      "SELECT run_id FROM chat_runs WHERE run_id LIKE 'test-maint-%'",
    )
    assert.deepEqual(
      remaining.rows.map((r: { run_id: string }) => r.run_id),
      ['test-maint-new'],
    )
  })

  it('deleteExpiredWebhookRequests deletes rows older than the retention window', async () => {
    await pool.query(
      `INSERT INTO webhook_requests (payload, headers, source_ip, created_at)
       VALUES ('{}'::jsonb, '{}'::jsonb, 'test-maintenance', $1)`,
      [Date.now() - 31 * 24 * HOUR_MS],
    )
    let deleted = await deleteExpiredWebhookRequests(db, 30 * 24 * HOUR_MS)
    assert.ok(deleted >= 1)
    let remaining = await pool.query(
      "SELECT id FROM webhook_requests WHERE source_ip = 'test-maintenance'",
    )
    assert.equal(remaining.rows.length, 0)
  })

  it('deleteExpiredAuditLogs deletes rows older than the retention window', async () => {
    await pool.query(
      `INSERT INTO audit_logs (admin_user_id, admin_email, action_type, target_type, created_at)
       VALUES ($1, 'test-maint@example.com', 'test-maintenance', 'test', $2)`,
      [userId, Date.now() - 91 * 24 * HOUR_MS],
    )
    let deleted = await deleteExpiredAuditLogs(db, 90 * 24 * HOUR_MS)
    assert.ok(deleted >= 1)
    let remaining = await pool.query(
      "SELECT id FROM audit_logs WHERE action_type = 'test-maintenance'",
    )
    assert.equal(remaining.rows.length, 0)
  })

  it('deleteExpiredUploads deletes rows older than the retention window', async () => {
    await pool.query(
      `INSERT INTO uploads (filename, mime_type, data, size, created_at)
       VALUES ('test-maint-old.txt', 'text/plain', 'x', 1, $1)`,
      [Date.now() - 91 * 24 * HOUR_MS],
    )
    let deleted = await deleteExpiredUploads(db, 90 * 24 * HOUR_MS)
    assert.ok(deleted >= 1)
    let remaining = await pool.query("SELECT id FROM uploads WHERE filename LIKE 'test-maint-%'")
    assert.equal(remaining.rows.length, 0)
  })
})

import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase, pool } from './setup.ts'
import { logAdminAction } from './audit-log.ts'

describe('audit-log', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  afterEach(async () => {
    await pool.query('DELETE FROM audit_logs WHERE action_type LIKE $1', ['test-%'])
  })

  it('logAdminAction inserts audit log entry', async () => {
    let userResult = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@newapp.com'",
    )
    let adminId = userResult.rows[0].id

    await logAdminAction(db, {
      admin_user_id: adminId,
      admin_email: 'admin@newapp.com',
      action_type: 'test-create',
      target_type: 'user',
      target_id: 42,
      details: { reason: 'testing' },
    })

    let rows = await pool.query(
      "SELECT * FROM audit_logs WHERE action_type = 'test-create'",
    )
    assert.equal(rows.rows.length, 1)
    assert.equal(rows.rows[0].admin_email, 'admin@newapp.com')
    assert.equal(rows.rows[0].target_id, '42')
  })

  it('logAdminAction handles null target_id and details', async () => {
    let userResult = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@newapp.com'",
    )
    let adminId = userResult.rows[0].id

    await logAdminAction(db, {
      admin_user_id: adminId,
      admin_email: 'admin@newapp.com',
      action_type: 'test-null-fields',
      target_type: 'system',
    })

    let rows = await pool.query(
      "SELECT * FROM audit_logs WHERE action_type = 'test-null-fields'",
    )
    assert.equal(rows.rows.length, 1)
  })

  it('logAdminAction handles string target_id', async () => {
    let userResult = await pool.query(
      "SELECT id FROM users WHERE email = 'admin@newapp.com'",
    )
    let adminId = userResult.rows[0].id

    await logAdminAction(db, {
      admin_user_id: adminId,
      admin_email: 'admin@newapp.com',
      action_type: 'test-string-target',
      target_type: 'appointment',
      target_id: 'abc-123',
    })

    let rows = await pool.query(
      "SELECT * FROM audit_logs WHERE action_type = 'test-string-target'",
    )
    assert.equal(rows.rows.length, 1)
    assert.equal(rows.rows[0].target_id, 'abc-123')
  })

  it('logAdminAction does not throw when db fails (swallows error in test)', async () => {
    await logAdminAction(db, {
      admin_user_id: null as any,
      admin_email: 'missing@example.com',
      action_type: 'test-ignore-me',
      target_type: 'user',
    })
  })
})

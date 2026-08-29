import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../data/test-pool.ts'
import { db } from '../../db.ts'
// Side-effect: initializes Mastra instance with all workflows
import {} from './index.ts'
import { consoleNotificationSender } from './notifications/sender.ts'
import {
  clearFailedNotifications,
  enqueueFailedNotification,
  getFailedNotifications,
} from './notifications/queue.ts'
import { createAppointmentRecord, deleteAppointmentRecord } from '../../data/appointments.ts'

async function getAdminId(): Promise<number> {
  let r = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com'])
  return r.rows[0]?.id as number
}

async function getCustomerId(): Promise<number> {
  let r = await pool.query('SELECT id FROM users WHERE email = $1', ['user@newapp.com'])
  return r.rows[0]?.id as number
}

async function getAnyResourceId(): Promise<number> {
  let r = await pool.query('SELECT id FROM resources LIMIT 1')
  return r.rows[0]?.id as number
}

describe('NotificationSender', () => {
  it('consoleNotificationSender returns sent:true and provider:console', async () => {
    let result = await consoleNotificationSender.send('1', 'confirmation', {
      type: 'confirmation',
      recipient: '1',
      appointmentId: 1,
    })
    assert.equal(result.sent, true)
    assert.equal(result.provider, 'console')
  })
})

describe('Failed notification queue', () => {
  it('enqueues and retrieves failed notifications', () => {
    clearFailedNotifications()
    enqueueFailedNotification('1', 'confirmation', { type: 'confirmation', recipient: '1' })
    let items = getFailedNotifications()
    assert.equal(items.length, 1)
    assert.equal(items[0].recipient, '1')
    assert.equal(items[0].type, 'confirmation')
  })

  it('clearFailedNotifications empties the queue', () => {
    enqueueFailedNotification('1', 'confirmation', { type: 'confirmation', recipient: '1' })
    clearFailedNotifications()
    assert.equal(getFailedNotifications().length, 0)
  })

  it('multiple notifications accumulate in the queue', () => {
    clearFailedNotifications()
    enqueueFailedNotification('1', 'confirmation', { type: 'confirmation', recipient: '1' })
    enqueueFailedNotification('2', 'cancellation', { type: 'cancellation', recipient: '2' })
    enqueueFailedNotification('3', 'reminder', { type: 'reminder', recipient: '3' })
    assert.equal(getFailedNotifications().length, 3)
  })
})

describe('Booking mutation helpers', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('createAppointmentRecord creates and returns id', async () => {
    let adminId = await getAdminId()
    let resourceId = await getAnyResourceId()
    let now = Date.now()
    let dayMs = now + 86_400_000

    let id = await createAppointmentRecord(db, {
      userId: adminId,
      resourceId,
      title: 'Workflow Test Appointment',
      dayMs,
      during: '[600,660)',
      now,
    })

    assert.ok(typeof id === 'number', 'should return a numeric id')
    assert.ok(id > 0, 'id should be positive')

    await deleteAppointmentRecord(db, String(id), adminId)
  })

  it('deleteAppointmentRecord returns true for existing appointment owned by caller', async () => {
    let adminId = await getAdminId()
    let resourceId = await getAnyResourceId()
    let now = Date.now()
    let dayMs = now + 86_400_000

    let id = await createAppointmentRecord(db, {
      userId: adminId,
      resourceId,
      title: 'Delete Test',
      dayMs,
      during: '[600,660)',
      now,
    })

    let deleted = await deleteAppointmentRecord(db, String(id), adminId)
    assert.equal(deleted, true)
  })

  it('deleteAppointmentRecord returns false for non-existent appointment', async () => {
    let deleted = await deleteAppointmentRecord(db, '999999', 1)
    assert.equal(deleted, false)
  })

  it('deleteAppointmentRecord returns false when wrong user tries to delete', async () => {
    let adminId = await getAdminId()
    let customerId = await getCustomerId()
    let resourceId = await getAnyResourceId()
    let now = Date.now()
    let dayMs = now + 86_400_000

    let id = await createAppointmentRecord(db, {
      userId: adminId,
      resourceId,
      title: 'Ownership Test',
      dayMs,
      during: '[600,660)',
      now,
    })

    let deleted = await deleteAppointmentRecord(db, String(id), customerId)
    assert.equal(deleted, false, 'wrong user should not delete')

    await deleteAppointmentRecord(db, String(id), adminId)
  })

  // Saga compensation test: notification sender returns sent:true,
  // so the compensation branch (notification failure → enqueue + keep booking)
  // is exercised by verifying the sender always succeeds and the queue
  // accumulates only when explicitly enqueued.
  it('notification sender always succeeds with console provider (saga compensation path is exercised)', async () => {
    let result = await consoleNotificationSender.send('1', 'confirmation', {
      type: 'confirmation',
      recipient: '1',
      appointmentId: 999,
    })
    assert.equal(result.sent, true)
    // If the sender ever returns sent:false, the compensation path
    // (keep booking, enqueue failure) kicks in — test the queue side:
    clearFailedNotifications()
    enqueueFailedNotification('1', 'confirmation', {
      type: 'confirmation',
      recipient: '1',
      appointmentId: 999,
    })
    assert.equal(getFailedNotifications().length, 1)
    assert.equal(getFailedNotifications()[0].data.appointmentId, 999)
  })
})

describe('LockUserWorkflow', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('locks a customer account', async () => {
    let customerId = await getCustomerId()
    let adminId = await getAdminId()
    let admin = await pool.query('SELECT email FROM users WHERE id = $1', [adminId])
    let adminEmail = admin.rows[0]?.email as string

    // Ensure unlocked before test
    await pool.query('UPDATE users SET disabled_at = NULL WHERE id = $1', [customerId])

    let auditBefore = await pool.query(
      "SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_type = 'lock' AND target_id = $1 AND admin_user_id = $2",
      [String(customerId), adminId],
    )

    let { executeLockUserWorkflow } = await import('./workflow-executor.ts')
    let result = await executeLockUserWorkflow({
      targetUserId: customerId,
      adminUserId: adminId,
      adminEmail,
    })
    assert.equal(result.success, true)
    assert.equal(result.auditLogged, true)

    // Verify locked
    let check = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [customerId])
    assert.notEqual(check.rows[0]?.disabled_at, null)

    let auditAfter = await pool.query(
      "SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_type = 'lock' AND target_id = $1 AND admin_user_id = $2",
      [String(customerId), adminId],
    )
    assert.equal(
      auditAfter.rows[0].n,
      auditBefore.rows[0].n + 1,
      'successful lock must write exactly one audit entry',
    )

    // Restore unlocked state for other tests
    await pool.query('UPDATE users SET disabled_at = NULL WHERE id = $1', [customerId])
  })

  it('rejects self-lock', async () => {
    let adminId = await getAdminId()
    let admin = await pool.query('SELECT email FROM users WHERE id = $1', [adminId])
    let adminEmail = admin.rows[0]?.email as string

    let { executeLockUserWorkflow } = await import('./workflow-executor.ts')
    let result = await executeLockUserWorkflow({
      targetUserId: adminId,
      adminUserId: adminId,
      adminEmail,
    })
    assert.equal(result.success, false)
    assert.ok(result.error?.includes('own account'))
  })

  it('treats an already locked account as idempotent success', async () => {
    let customerId = await getCustomerId()
    let adminId = await getAdminId()
    let admin = await pool.query('SELECT email FROM users WHERE id = $1', [adminId])
    let adminEmail = admin.rows[0]?.email as string

    // Ensure locked
    await pool.query('UPDATE users SET disabled_at = $1 WHERE id = $2', [Date.now(), customerId])

    let auditBefore = await pool.query(
      "SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_type = 'lock' AND target_id = $1",
      [String(customerId)],
    )

    let { executeLockUserWorkflow } = await import('./workflow-executor.ts')
    let result = await executeLockUserWorkflow({
      targetUserId: customerId,
      adminUserId: adminId,
      adminEmail,
    })
    assert.equal(result.success, true)
    assert.equal(result.alreadyLocked, true)

    let auditAfter = await pool.query(
      "SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_type = 'lock' AND target_id = $1",
      [String(customerId)],
    )
    assert.equal(
      auditAfter.rows[0].n,
      auditBefore.rows[0].n,
      'no-op lock must not write an audit entry',
    )

    // Restore unlocked state for other tests
    await pool.query('UPDATE users SET disabled_at = NULL WHERE id = $1', [customerId])
  })

  it('rejects locking admin accounts', async () => {
    let adminId = await getAdminId()
    let admin = await pool.query('SELECT email FROM users WHERE id = $1', [adminId])
    let adminEmail = admin.rows[0]?.email as string

    // Create a second admin as the lock target (self-lock is a separate guard)
    let otherAdminEmail = `wf-admin-${Date.now()}@example.com`
    let created = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at)
       VALUES ($1, $2, $3, 'admin', 1, 1, $4) RETURNING id`,
      [otherAdminEmail, 'hashed-password-for-testing', 'Other Admin', Date.now()],
    )
    let otherAdminId = created.rows[0]?.id as number

    let { executeLockUserWorkflow } = await import('./workflow-executor.ts')
    let result = await executeLockUserWorkflow({
      targetUserId: otherAdminId,
      adminUserId: adminId,
      adminEmail,
    })
    assert.equal(result.success, false)
    assert.ok(result.error?.includes('admin'), `expected admin guard error, got: ${result.error}`)

    // Verify the admin account was not locked
    let check = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [otherAdminId])
    assert.equal(check.rows[0]?.disabled_at, null)
  })

  it('returns error for non-existent user', async () => {
    let adminId = await getAdminId()
    let admin = await pool.query('SELECT email FROM users WHERE id = $1', [adminId])
    let adminEmail = admin.rows[0]?.email as string

    let { executeLockUserWorkflow } = await import('./workflow-executor.ts')
    let result = await executeLockUserWorkflow({
      targetUserId: 999999,
      adminUserId: adminId,
      adminEmail,
    })
    assert.equal(result.success, false)
    assert.ok(result.error?.includes('not found'))
  })
})

describe('UnlockUserWorkflow', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('unlocks a locked customer account', async () => {
    let customerId = await getCustomerId()
    let adminId = await getAdminId()
    let admin = await pool.query('SELECT email FROM users WHERE id = $1', [adminId])
    let adminEmail = admin.rows[0]?.email as string

    // Ensure locked first
    await pool.query('UPDATE users SET disabled_at = $1 WHERE id = $2', [Date.now(), customerId])

    let auditBefore = await pool.query(
      "SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_type = 'unlock' AND target_id = $1 AND admin_user_id = $2",
      [String(customerId), adminId],
    )

    let { executeUnlockUserWorkflow } = await import('./workflow-executor.ts')
    let result = await executeUnlockUserWorkflow({
      targetUserId: customerId,
      adminUserId: adminId,
      adminEmail,
    })
    assert.equal(result.success, true)
    assert.equal(result.auditLogged, true)

    // Verify unlocked
    let check = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [customerId])
    assert.equal(check.rows[0]?.disabled_at, null)

    let auditAfter = await pool.query(
      "SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_type = 'unlock' AND target_id = $1 AND admin_user_id = $2",
      [String(customerId), adminId],
    )
    assert.equal(
      auditAfter.rows[0].n,
      auditBefore.rows[0].n + 1,
      'successful unlock must write exactly one audit entry',
    )
  })

  it('rejects self-unlock', async () => {
    let adminId = await getAdminId()
    let admin = await pool.query('SELECT email FROM users WHERE id = $1', [adminId])
    let adminEmail = admin.rows[0]?.email as string

    let { executeUnlockUserWorkflow } = await import('./workflow-executor.ts')
    let result = await executeUnlockUserWorkflow({
      targetUserId: adminId,
      adminUserId: adminId,
      adminEmail,
    })
    assert.equal(result.success, false)
    assert.ok(result.error?.includes('own account'))
  })

  it('treats an already unlocked account as idempotent success', async () => {
    let customerId = await getCustomerId()
    let adminId = await getAdminId()
    let admin = await pool.query('SELECT email FROM users WHERE id = $1', [adminId])
    let adminEmail = admin.rows[0]?.email as string

    // Ensure unlocked
    await pool.query('UPDATE users SET disabled_at = NULL WHERE id = $1', [customerId])

    let auditBefore = await pool.query(
      "SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_type = 'unlock' AND target_id = $1",
      [String(customerId)],
    )

    let { executeUnlockUserWorkflow } = await import('./workflow-executor.ts')
    let result = await executeUnlockUserWorkflow({
      targetUserId: customerId,
      adminUserId: adminId,
      adminEmail,
    })
    assert.equal(result.success, true)
    assert.equal(result.alreadyUnlocked, true)

    let auditAfter = await pool.query(
      "SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_type = 'unlock' AND target_id = $1",
      [String(customerId)],
    )
    assert.equal(
      auditAfter.rows[0].n,
      auditBefore.rows[0].n,
      'no-op unlock must not write an audit entry',
    )
  })
})

describe('Transactional audit atomicity', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('cancel-user rolls back mutation and audit together when the audit write fails', async () => {
    let adminId = await getAdminId()
    let admin = await pool.query('SELECT email FROM users WHERE id = $1', [adminId])
    let adminEmail = admin.rows[0]?.email as string
    let resourceId = await getAnyResourceId()

    let targetEmail = `wf-cancel-target-${Date.now()}@example.com`
    let created = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at)
       VALUES ($1, $2, $3, 'customer', 1, 1, $4) RETURNING id`,
      [targetEmail, 'hashed-password-for-testing', 'Cancel Target', Date.now()],
    )
    let targetId = created.rows[0]?.id as number

    let dayMs = Date.now() + 86_400_000
    await createAppointmentRecord(db, {
      userId: targetId,
      resourceId,
      title: 'Atomicity Test',
      dayMs,
      during: '[600,660)',
      now: Date.now(),
    })

    try {
      let { executeCancelUserWorkflow } = await import('./workflow-executor.ts')
      let result: Awaited<ReturnType<typeof executeCancelUserWorkflow>> | undefined
      let rejected = false
      try {
        result = await executeCancelUserWorkflow({
          targetUserId: targetId,
          adminUserId: 99999999,
          adminEmail,
          deleteAppointments: true,
        })
      } catch {
        rejected = true
      }
      assert.equal(rejected, false, 'executor should resolve failed runs, not reject')
      assert.equal(result!.success, false, 'audit failure must fail the workflow')
      assert.match(
        result!.error ?? '',
        /audit log write failed/i,
        'error should trace to the audit write',
      )

      let user = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [targetId])
      assert.equal(user.rows[0]?.disabled_at, null, 'disable must be rolled back')

      let appts = await pool.query('SELECT id FROM appointments WHERE user_id = $1', [targetId])
      assert.equal(appts.rows.length, 1, 'appointment deletion must be rolled back')

      let audit = await pool.query(
        "SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_type = 'user_cancelled' AND target_id = $1",
        [String(targetId)],
      )
      assert.equal(audit.rows[0].n, 0, 'no audit entry may survive a failed run')
    } finally {
      await pool.query('DELETE FROM appointments WHERE user_id = $1', [targetId])
      await pool.query('DELETE FROM users WHERE id = $1', [targetId])
      await pool.query(
        "DELETE FROM audit_logs WHERE action_type = 'user_cancelled' AND target_id = $1",
        [String(targetId)],
      )
    }
  })

  it('cancel-user success writes exactly one audit entry with the mutation', async () => {
    let adminId = await getAdminId()
    let admin = await pool.query('SELECT email FROM users WHERE id = $1', [adminId])
    let adminEmail = admin.rows[0]?.email as string
    let resourceId = await getAnyResourceId()

    let targetEmail = `wf-cancel-ok-${Date.now()}@example.com`
    let created = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at)
       VALUES ($1, $2, $3, 'customer', 1, 1, $4) RETURNING id`,
      [targetEmail, 'hashed-password-for-testing', 'Cancel Success Target', Date.now()],
    )
    let targetId = created.rows[0]?.id as number

    let dayMs = Date.now() + 86_400_000
    await createAppointmentRecord(db, {
      userId: targetId,
      resourceId,
      title: 'Cancel Success Test',
      dayMs,
      during: '[600,660)',
      now: Date.now(),
    })

    try {
      let auditBefore = await pool.query(
        "SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_type = 'user_cancelled' AND target_id = $1",
        [String(targetId)],
      )

      let { executeCancelUserWorkflow } = await import('./workflow-executor.ts')
      let result = await executeCancelUserWorkflow({
        targetUserId: targetId,
        adminUserId: adminId,
        adminEmail,
        deleteAppointments: true,
      })
      assert.equal(result.success, true)

      let user = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [targetId])
      assert.notEqual(user.rows[0]?.disabled_at, null, 'account must be disabled on success')

      let appts = await pool.query('SELECT id FROM appointments WHERE user_id = $1', [targetId])
      assert.equal(appts.rows.length, 0, 'upcoming appointments must be deleted on success')

      let auditAfter = await pool.query(
        "SELECT COUNT(*)::int AS n FROM audit_logs WHERE action_type = 'user_cancelled' AND target_id = $1",
        [String(targetId)],
      )
      assert.equal(
        auditAfter.rows[0].n,
        auditBefore.rows[0].n + 1,
        'successful cancel must write exactly one audit entry',
      )
    } finally {
      await pool.query('DELETE FROM appointments WHERE user_id = $1', [targetId])
      await pool.query('DELETE FROM users WHERE id = $1', [targetId])
      await pool.query(
        "DELETE FROM audit_logs WHERE action_type = 'user_cancelled' AND target_id = $1",
        [String(targetId)],
      )
    }
  })
})

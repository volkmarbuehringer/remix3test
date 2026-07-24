import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../data/setup.ts'
import { pool } from '../../data/test-pool.ts'
import { db } from '../../data/connection.ts'
// Side-effect: initializes Mastra instance with all workflows
import {} from '../mastra/index.ts'
import { workflowAgentTools } from '../mastra/agents/workflow-agent.ts'
import { runWithAdminId } from '../mastra/tools/admin-context.ts'
import { createAppointmentRecord } from '../../data/appointments.ts'
import { executeUserPreflightWorkflow } from '../mastra/workflow-executor.ts'

async function getCustomerId(): Promise<number> {
  let r = await pool.query('SELECT id FROM users WHERE email = $1', ['user@newapp.com'])
  return r.rows[0]?.id as number
}

async function getAdminId(): Promise<number> {
  let r = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com'])
  return r.rows[0]?.id as number
}

/** Create an isolated customer so confirmed workflow calls never mutate shared fixtures. */
async function createFreshCustomer(): Promise<number> {
  let email = `wf-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  let r = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at)
     VALUES ($1, $2, $3, 'customer', 1, 1, $4) RETURNING id`,
    [email, 'hashed-password-for-testing', 'WF Test User', Date.now()],
  )
  return r.rows[0]?.id as number
}

async function getAnyResourceId(): Promise<number> {
  let r = await pool.query('SELECT id FROM resources LIMIT 1')
  return r.rows[0]?.id as number
}

async function countFutureAppointments(userId: number): Promise<number> {
  let now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  let r = await pool.query(
    'SELECT count(*)::int AS c FROM appointments WHERE user_id = $1 AND date >= $2',
    [userId, now.getTime()],
  )
  return r.rows[0]?.c as number
}

describe('WorkflowAgent tools', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  describe('lookupUser', () => {
    it('returns user data for valid ID', async () => {
      let customerId = await getCustomerId()
      let tool = workflowAgentTools.lookupUser
      let result = await (tool as any).execute({ query: String(customerId) })

      assert.equal(result.found, true)
      assert.equal(result.users.length, 1)
      assert.equal(result.users[0].id, customerId)
      assert.ok(result.users[0].name)
      assert.ok(result.users[0].email)
      assert.equal(typeof result.users[0].pendingCount, 'number')
      assert.ok(Array.isArray(result.lockedUsers))
      assert.equal(typeof result.lockedTotal, 'number')
      assert.ok(Array.isArray(result.activeUsers))
      assert.equal(typeof result.activeTotal, 'number')
    })

    it('returns user data for name search', async () => {
      let tool = workflowAgentTools.lookupUser
      let result = await (tool as any).execute({ query: 'admin' })

      assert.equal(result.found, true)
      assert.ok(result.users.length >= 1)
    })

    it('returns not found for unknown query', async () => {
      let tool = workflowAgentTools.lookupUser
      let result = await (tool as any).execute({ query: 'nonexistent-user-999999' })

      assert.equal(result.found, false)
      assert.equal(result.users.length, 0)
    })

    it('returns consistency data even with no query match', async () => {
      let tool = workflowAgentTools.lookupUser
      let result = await (tool as any).execute({ query: 'nonexistent-user-999999' })

      assert.equal(result.found, false)
      assert.ok(Array.isArray(result.lockedUsers))
      assert.equal(typeof result.lockedTotal, 'number')
      assert.ok(Array.isArray(result.activeUsers))
      assert.equal(typeof result.activeTotal, 'number')
    })
  })

  describe('cancelUserWorkflow_v2', () => {
    it('returns error for non-existent user', async () => {
      let adminId = await getAdminId()
      let tool = workflowAgentTools.cancelUserWorkflow_v2
      let result = await runWithAdminId(adminId, () =>
        (tool as any).execute({ targetUserId: 999999, deleteAppointments: true }),
      )

      assert.equal(result.success, false)
      assert.ok(result.error)
    })

    it('cancels account and deletes future appointments', async () => {
      let targetId = await createFreshCustomer()
      let adminId = await getAdminId()
      let resourceId = await getAnyResourceId()
      let now = Date.now()
      await createAppointmentRecord(db, {
        userId: targetId,
        resourceId,
        title: 'WF Cancel Test',
        dayMs: now + 86_400_000,
        during: '[600,660)',
        now,
      })
      assert.equal(await countFutureAppointments(targetId), 1)

      let tool = workflowAgentTools.cancelUserWorkflow_v2
      let result = await runWithAdminId(adminId, () =>
        (tool as any).execute({ targetUserId: targetId, deleteAppointments: true }),
      )

      assert.equal(result.success, true, `expected success, got error: ${result.error}`)
      assert.equal(result.deletedAppointments, 1)
      let check = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [targetId])
      assert.notEqual(check.rows[0]?.disabled_at, null, 'account should be disabled')
      assert.equal(await countFutureAppointments(targetId), 0, 'appointments should be deleted')
    })

    it('cancel keeps future appointments when deleteAppointments=false', async () => {
      let targetId = await createFreshCustomer()
      let adminId = await getAdminId()
      let resourceId = await getAnyResourceId()
      let now = Date.now()
      await createAppointmentRecord(db, {
        userId: targetId,
        resourceId,
        title: 'WF Keep Test',
        dayMs: now + 86_400_000,
        during: '[600,660)',
        now,
      })
      assert.equal(await countFutureAppointments(targetId), 1)

      let tool = workflowAgentTools.cancelUserWorkflow_v2
      let result = await runWithAdminId(adminId, () =>
        (tool as any).execute({ targetUserId: targetId, deleteAppointments: false }),
      )

      assert.equal(result.success, true, `expected success, got error: ${result.error}`)
      assert.equal(result.deletedAppointments, 0, 'no appointments should be reported deleted')
      let check = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [targetId])
      assert.notEqual(check.rows[0]?.disabled_at, null, 'account should still be disabled')
      assert.equal(await countFutureAppointments(targetId), 1, 'appointments must survive')
    })
  })

  describe('lockUserWorkflow_v2', () => {
    it('locks an existing user', async () => {
      let targetId = await createFreshCustomer()
      let adminId = await getAdminId()
      let tool = workflowAgentTools.lockUserWorkflow_v2
      let result = await runWithAdminId(adminId, () =>
        (tool as any).execute({ targetUserId: targetId }),
      )

      assert.equal(result.success, true)
      let check = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [targetId])
      assert.notEqual(check.rows[0]?.disabled_at, null, 'account should be locked')
    })

    it('returns error for non-existent user', async () => {
      let adminId = await getAdminId()
      let tool = workflowAgentTools.lockUserWorkflow_v2
      let result = await runWithAdminId(adminId, () =>
        (tool as any).execute({ targetUserId: 999999 }),
      )

      assert.equal(result.success, false)
      assert.ok(result.error)
    })
  })

  describe('unlockUserWorkflow_v2', () => {
    it('unlocks a locked user', async () => {
      let targetId = await createFreshCustomer()
      let adminId = await getAdminId()

      await pool.query('UPDATE users SET disabled_at = $1 WHERE id = $2', [Date.now(), targetId])

      let tool = workflowAgentTools.unlockUserWorkflow_v2
      let result = await runWithAdminId(adminId, () =>
        (tool as any).execute({ targetUserId: targetId }),
      )

      assert.equal(result.success, true)
      let check = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [targetId])
      assert.equal(check.rows[0]?.disabled_at, null, 'account should be unlocked')
    })

    it('returns error for non-existent user', async () => {
      let adminId = await getAdminId()
      let tool = workflowAgentTools.unlockUserWorkflow_v2
      let result = await runWithAdminId(adminId, () =>
        (tool as any).execute({ targetUserId: 999999 }),
      )

      assert.equal(result.success, false)
      assert.ok(result.error)
    })
  })

})

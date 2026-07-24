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

  describe('cancelUserWorkflow_v2', () => {
    it('looks up a user and returns navigation on first call', async () => {
      let customerId = await getCustomerId()
      let tool = workflowAgentTools.cancelUserWorkflow_v2
      let result = await (tool as any).execute({ targetUserId: customerId })

      assert.equal(result.found, true)
      assert.ok(result.user, 'should return user info')
      assert.equal(result.user.id, customerId)
      assert.ok(result.navigate, 'should include navigation')
      assert.ok(result.navigate.path.includes('filter='))
    })

    it('returns error for non-existent user', async () => {
      let tool = workflowAgentTools.cancelUserWorkflow_v2
      let result = await (tool as any).execute({ targetUserId: 999999 })

      assert.equal(result.found, false)
      assert.ok(result.error)
    })

    it('confirmed call cancels the account and deletes future appointments when deleteAppointments=true', async () => {
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
        (tool as any).execute({
          targetUserId: targetId,
          confirmed: true,
          deleteAppointments: true,
        }),
      )

      assert.equal(result.success, true, `expected success, got error: ${result.error}`)
      assert.equal(result.deletedAppointments, 1)
      let check = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [targetId])
      assert.notEqual(check.rows[0]?.disabled_at, null, 'account should be disabled')
      assert.equal(await countFutureAppointments(targetId), 0, 'appointments should be deleted')
    })

    it('confirmed call keeps future appointments when deleteAppointments=false', async () => {
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
        (tool as any).execute({
          targetUserId: targetId,
          confirmed: true,
          deleteAppointments: false,
        }),
      )

      assert.equal(result.success, true, `expected success, got error: ${result.error}`)
      assert.equal(result.deletedAppointments, 0, 'no appointments should be reported deleted')
      let check = await pool.query('SELECT disabled_at FROM users WHERE id = $1', [targetId])
      assert.notEqual(check.rows[0]?.disabled_at, null, 'account should still be disabled')
      assert.equal(await countFutureAppointments(targetId), 1, 'appointments must survive')
    })
  })

  describe('lockUserWorkflow_v2', () => {
    it('looks up a user and returns navigation on first call', async () => {
      let customerId = await getCustomerId()
      let tool = workflowAgentTools.lockUserWorkflow_v2
      let result = await (tool as any).execute({ targetUserId: customerId })

      assert.equal(result.found, true)
      assert.ok(result.user)
      assert.equal(result.user.id, customerId)
      assert.ok(result.navigate)
    })

    it('returns error for non-existent user', async () => {
      let tool = workflowAgentTools.lockUserWorkflow_v2
      let result = await (tool as any).execute({ targetUserId: 999999 })
      assert.equal(result.found, false)
      assert.ok(result.error)
    })
  })

  describe('unlockUserWorkflow_v2', () => {
    it('looks up a user and returns navigation on first call', async () => {
      let customerId = await getCustomerId()
      let tool = workflowAgentTools.unlockUserWorkflow_v2
      let result = await (tool as any).execute({ targetUserId: customerId })

      assert.equal(result.found, true)
      assert.ok(result.user)
      assert.equal(result.user.id, customerId)
      assert.ok(result.navigate)
    })

    it('returns error for non-existent user', async () => {
      let tool = workflowAgentTools.unlockUserWorkflow_v2
      let result = await (tool as any).execute({ targetUserId: 999999 })
      assert.equal(result.found, false)
      assert.ok(result.error)
    })
  })

  describe('checkPendingAppointments', () => {
    it('returns count of future appointments', async () => {
      let customerId = await getCustomerId()
      let tool = workflowAgentTools.checkPendingAppointments
      let result = await (tool as any).execute({ userId: customerId })

      assert.ok(typeof result.count === 'number')
      assert.ok(typeof result.hasPending === 'boolean')
    })
  })
})

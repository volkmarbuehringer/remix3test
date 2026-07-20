import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { pool, initializeAppDatabase } from '../../data/setup.ts'
// Side-effect: initializes Mastra instance with all workflows
import {} from '../mastra/index.ts'
import { workflowAgentTools } from '../mastra/agents/workflow-agent.ts'
import { runWithAdminId } from '../mastra/tools/admin-context.ts'

async function getCustomerId(): Promise<number> {
  let r = await pool.query('SELECT id FROM users WHERE email = $1', ['user@newapp.com'])
  return r.rows[0]?.id as number
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
      assert.ok(result.navigate.path.includes(`editing=${customerId}`))
    })

    it('returns error for non-existent user', async () => {
      let tool = workflowAgentTools.cancelUserWorkflow_v2
      let result = await (tool as any).execute({ targetUserId: 999999 })

      assert.equal(result.found, false)
      assert.ok(result.error)
    })

    it('executes workflow on confirmed call', async () => {
      let customerId = await getCustomerId()
      let adminId = (await pool.query('SELECT id FROM users WHERE email = $1', ['admin@newapp.com']))
        .rows[0]?.id as number
      await pool.query('UPDATE users SET disabled_at = NULL WHERE id = $1', [customerId])

      let tool = workflowAgentTools.cancelUserWorkflow_v2
      let result = await runWithAdminId(adminId, () =>
        (tool as any).execute({
          targetUserId: customerId,
          confirmed: true,
          deleteAppointments: true,
        }),
      )

      assert.ok(result, 'should return a result')
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

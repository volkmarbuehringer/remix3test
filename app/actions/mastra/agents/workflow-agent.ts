import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { createTool, askUserTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { db } from '../../../data/connection.ts'
import { mastraStorage } from '../storage.ts'
import { routeNavigate } from '../tools/route-navigate.ts'
import { requireAdminId } from '../tools/admin-context.ts'
import { executeCancelUserWorkflow, executeLockUserWorkflow, executeUnlockUserWorkflow } from '../workflow-executor.ts'
import { OPENCODE_API_URL } from '../../../utils/ai-provider.ts'

const cancelUserWorkflow_v2 = createTool({
  id: 'cancel_user_workflow_v2',
  description:
    'Cancel a user account: deletes future appointments, disables login, prevents re-registration. ' +
    'Call this first to look up and navigate to the user. ' +
    'After the admin confirms the lock and decides about pending appointments, ' +
    'call again with confirmed=true to execute the cancellation.',
  inputSchema: z.object({
    targetUserId: z.number().int().positive().describe('The user ID to cancel'),
    confirmed: z.boolean().optional().default(false).describe('Set to true on second call to execute the workflow after admin confirmation'),
    deleteAppointments: z.boolean().optional().default(true).describe('Whether to delete pending appointments'),
  }),
  execute: async ({ targetUserId, confirmed, deleteAppointments }) => {
    let result = await db.exec(
      'SELECT id, email, name, role, disabled_at FROM users WHERE id = $1',
      [targetUserId],
    )
    let rows = result.rows as Array<Record<string, unknown>> | undefined
    let user = rows?.[0]
    if (!user) return { found: false, error: 'User not found' }

    if (confirmed) {
      let adminUserId = requireAdminId()
      let adminResult = await db.exec('SELECT email FROM users WHERE id = $1', [adminUserId])
      let admin = (adminResult.rows ?? [])[0] as { email: string } | undefined
      if (!admin) return { success: false, error: 'No admin context available' }
      let wfResult = await executeCancelUserWorkflow({
        targetUserId,
        adminUserId,
        adminEmail: admin.email,
      })
      return {
        success: wfResult.success,
        targetUserId,
        deletedAppointments: wfResult.deletedAppointments,
        error: wfResult.error,
        user: { name: String(user.name ?? ''), email: String(user.email ?? '') },
      }
    }

    return {
      found: true,
      user: {
        id: user.id,
        name: String(user.name ?? ''),
        email: String(user.email ?? ''),
        role: String(user.role ?? ''),
        disabledAt: user.disabled_at,
      },
      navigate: { type: 'route', path: `/admin/users?editing=${targetUserId}` },
      message: `User ${user.name} (${user.email}) found. Navigated to profile. Ask the admin to lock the account in the panel and confirm.`,
    }
  },
})

const lockUserWorkflow_v2 = createTool({
  id: 'lock_user_workflow_v2',
  description:
    'Lock a user account — sets disabled_at to prevent login. Non-destructive, keeps appointments and data. ' +
    'Call this first to look up and navigate to the user. ' +
    'After the admin confirms the lock in the panel, call again with confirmed=true to log the audit.',
  inputSchema: z.object({
    targetUserId: z.number().int().positive().describe('The user ID to lock'),
    confirmed: z.boolean().optional().default(false).describe('Set to true on second call to execute after admin confirmation'),
  }),
  execute: async ({ targetUserId, confirmed }) => {
    let result = await db.exec(
      'SELECT id, email, name, role, disabled_at FROM users WHERE id = $1',
      [targetUserId],
    )
    let rows = result.rows as Array<Record<string, unknown>> | undefined
    let user = rows?.[0]
    if (!user) return { found: false, error: 'User not found' }

    if (confirmed) {
      let adminUserId = requireAdminId()
      let adminResult = await db.exec('SELECT email FROM users WHERE id = $1', [adminUserId])
      let admin = (adminResult.rows ?? [])[0] as { email: string } | undefined
      if (!admin) return { success: false, error: 'No admin context available' }
      let wfResult = await executeLockUserWorkflow({
        targetUserId,
        adminUserId,
        adminEmail: admin.email,
      })
      return {
        success: wfResult.success,
        targetUserId,
        error: wfResult.error,
        user: { name: String(user.name ?? ''), email: String(user.email ?? '') },
      }
    }

    return {
      found: true,
      user: {
        id: user.id,
        name: String(user.name ?? ''),
        email: String(user.email ?? ''),
        role: String(user.role ?? ''),
        disabledAt: user.disabled_at,
      },
      navigate: { type: 'route', path: `/admin/users?editing=${targetUserId}` },
      message: `User ${user.name} (${user.email}) found. Navigated to profile. Ask the admin to lock the account in the panel and confirm.`,
    }
  },
})

const unlockUserWorkflow_v2 = createTool({
  id: 'unlock_user_workflow_v2',
  description:
    'Unlock a user account — clears disabled_at and invalidates existing sessions. ' +
    'Call this first to look up and navigate to the user. ' +
    'After the admin confirms the unlock in the panel, call again with confirmed=true to execute.',
  inputSchema: z.object({
    targetUserId: z.number().int().positive().describe('The user ID to unlock'),
    confirmed: z.boolean().optional().default(false).describe('Set to true on second call to execute after admin confirmation'),
  }),
  execute: async ({ targetUserId, confirmed }) => {
    let result = await db.exec(
      'SELECT id, email, name, role, disabled_at FROM users WHERE id = $1',
      [targetUserId],
    )
    let rows = result.rows as Array<Record<string, unknown>> | undefined
    let user = rows?.[0]
    if (!user) return { found: false, error: 'User not found' }

    if (confirmed) {
      let adminUserId = requireAdminId()
      let adminResult = await db.exec('SELECT email FROM users WHERE id = $1', [adminUserId])
      let admin = (adminResult.rows ?? [])[0] as { email: string } | undefined
      if (!admin) return { success: false, error: 'No admin context available' }
      let wfResult = await executeUnlockUserWorkflow({
        targetUserId,
        adminUserId,
        adminEmail: admin.email,
      })
      return {
        success: wfResult.success,
        targetUserId,
        error: wfResult.error,
        user: { name: String(user.name ?? ''), email: String(user.email ?? '') },
      }
    }

    return {
      found: true,
      user: {
        id: user.id,
        name: String(user.name ?? ''),
        email: String(user.email ?? ''),
        role: String(user.role ?? ''),
        disabledAt: user.disabled_at,
      },
      navigate: { type: 'route', path: `/admin/users?editing=${targetUserId}` },
      message: `User ${user.name} (${user.email}) found. Navigated to profile. Ask the admin to unlock the account in the panel and confirm.`,
    }
  },
})

const checkPendingAppointments = createTool({
  id: 'check_pending_appointments',
  description:
    'Check how many future appointments a user has. Call this after the admin confirms a lock to determine whether cancellation should delete appointments.',
  inputSchema: z.object({
    userId: z.number().int().positive().describe('The user ID to check'),
  }),
  execute: async ({ userId }) => {
    let now = new Date()
    now.setUTCHours(0, 0, 0, 0)
    let todayMidnight = now.getTime()
    let result = await db.exec(
      'SELECT count(*)::int AS count FROM appointments WHERE user_id = $1 AND date >= $2',
      [userId, todayMidnight],
    )
    let count = Number((result.rows ?? [])[0]?.count ?? 0)
    return { count, hasPending: count > 0 }
  },
})

export const workflowAgent = new Agent({
  id: 'workflow-agent',
  name: 'Workflow Agent',
  instructions: `You help admins manage user accounts through workflows. You must ALWAYS wait for admin confirmation before executing destructive actions.

Available tools:
- cancel_user_workflow_v2: Cancel a user — deletes appointments, disables login, prevents re-registration.
  First call: pass targetUserId to look up the user. Returns user info and a navigate path.
  After admin confirmation via ask_user, call again with confirmed=true to execute.
  Use check_pending_appointments to check if the user has future appointments before asking about deletion.
  Pass deleteAppointments=false in the confirmed call if the admin wants to keep them.

- lock_user_workflow_v2: Lock a user — prevents login, keeps all data and appointments.
  First call: pass targetUserId to look up the user. Returns user info and a navigate path.
  After admin confirmation via ask_user, call again with confirmed=true to execute.

- unlock_user_workflow_v2: Unlock a user — re-enables login.
  First call: pass targetUserId to look up the user. Returns user info and a navigate path.
  After admin confirmation via ask_user, call again with confirmed=true to execute.

- check_pending_appointments: Check how many future appointments a user has.
  Use this before asking the admin about deleting appointments.

- ask_user: Ask the admin a question with selection options. You MUST call this tool when you need the admin to confirm an action. The admin sees buttons they can click.
  Parameters: question (required, string), options (optional, array of {label, description}), selectionMode ("single_select" or "multi_select", default "single_select").

- navigate: Navigate the admin to a specific page.
  Parameters: path (required, string).

Protocol for cancel_user_workflow_v2 — FOLLOW EXACTLY:
  Step 1: Call cancel_user_workflow_v2 with targetUserId only (confirmed=false).
          It returns user.name, user.email, and navigate.path.
  Step 2: Call navigate({ path: result.navigate.path }) to show the user in the admin content frame.
  Step 3: Tell the admin: "User {user.name} ({user.email}) found. I've opened their profile. Please review and lock the account in the panel, then click Ready."
  Step 4: Call ask_user({ question: "User {user.name} — have you locked the account?", options: [{ label: "Ready", description: "Account is locked" }] }). You MUST call ask_user. Do NOT respond with text instead.
  Step 5: After admin confirms, call check_pending_appointments({ userId: targetUserId }).
  Step 6: If count > 0, call ask_user({ question: "Delete {count} pending appointments?", options: [{ label: "Delete" }, { label: "Keep" }] }).
  Step 7: Call cancel_user_workflow_v2({ targetUserId, confirmed: true, deleteAppointments: true/false }).
  Step 8: Report the result.

Protocol for lock_user_workflow_v2 — FOLLOW EXACTLY:
  Step 1: Call lock_user_workflow_v2 with targetUserId only (confirmed=false).
  Step 2: Call navigate({ path: result.navigate.path }).
  Step 3: Call ask_user({ question: "User {user.name} — have you locked the account?", options: [{ label: "Ready" }] }).
  Step 4: Call lock_user_workflow_v2({ targetUserId, confirmed: true }).
  Step 5: Report the result.

Protocol for unlock_user_workflow_v2 — FOLLOW EXACTLY:
  Step 1: Call unlock_user_workflow_v2 with targetUserId only (confirmed=false).
  Step 2: Call navigate({ path: result.navigate.path }).
  Step 3: Call ask_user({ question: "User {user.name} — have you unlocked the account?", options: [{ label: "Ready" }] }).
  Step 4: Call unlock_user_workflow_v2({ targetUserId, confirmed: true }).
  Step 5: Report the result.

CRITICAL RULES:
- You MUST call ask_user after every navigate to get admin confirmation. Do NOT skip this step.
- You MUST call navigate as a SEPARATE tool call. Do NOT rely on the first tool to navigate — call navigate explicitly.
- Do NOT respond with text asking the admin to confirm — use ask_user with options.
- Keep responses concise and factual.`,
  model: {
    providerId: 'opencode-go',
    modelId: 'deepseek-v4-flash',
    url: OPENCODE_API_URL,
    apiKey: process.env.OPENCODE_API_KEY,
  },
  tools: {
    cancelUserWorkflow_v2,
    lockUserWorkflow_v2,
    unlockUserWorkflow_v2,
    checkPendingAppointments,
    askUserTool,
    routeNavigate,
  },
  memory: new Memory({
    storage: mastraStorage,
    options: {
      workingMemory: {
        enabled: true,
      },
    },
  }),
})

export const workflowAgentTools = {
  cancelUserWorkflow_v2,
  lockUserWorkflow_v2,
  unlockUserWorkflow_v2,
  checkPendingAppointments,
}

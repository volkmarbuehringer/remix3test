import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { createTool, askUserTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { db } from '../../../data/connection.ts'
import { mastraStorage } from '../storage.ts'
import { routeNavigate } from '../tools/route-navigate.ts'
import { requireAdminId } from '../tools/admin-context.ts'
import {
  executeCancelUserWorkflow,
  executeConsistencyCheckWorkflow,
  executeLockUserWorkflow,
  executeUnlockUserWorkflow,
} from '../workflow-executor.ts'
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
    confirmed: z
      .boolean()
      .optional()
      .default(false)
      .describe('Set to true on second call to execute the workflow after admin confirmation'),
    deleteAppointments: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to delete pending appointments'),
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
        deleteAppointments,
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
      navigate: { type: 'route', path: `/admin/users?filter=${encodeURIComponent(String(user.name))}` },
      message: `User ${user.name} (${user.email}) found. Navigating to the user list filtered by their name. Ask the admin to review and confirm — the cancellation is executed on confirmation.`,
    }
  },
})

const lockUserWorkflow_v2 = createTool({
  id: 'lock_user_workflow_v2',
  description:
    'Lock a user account — sets disabled_at to prevent login. Non-destructive, keeps appointments and data. ' +
    'Call this first to look up and navigate to the user. ' +
    'After the admin confirms, call again with confirmed=true to execute the lock.',
  inputSchema: z.object({
    targetUserId: z.number().int().positive().describe('The user ID to lock'),
    confirmed: z
      .boolean()
      .optional()
      .default(false)
      .describe('Set to true on second call to execute after admin confirmation'),
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
      navigate: { type: 'route', path: `/admin/users?filter=${encodeURIComponent(String(user.name))}` },
      message: `User ${user.name} (${user.email}) found. Navigating to the user list filtered by their name. Ask the admin to review and confirm — the lock is executed on confirmation.`,
    }
  },
})

const unlockUserWorkflow_v2 = createTool({
  id: 'unlock_user_workflow_v2',
  description:
    'Unlock a user account — clears disabled_at and invalidates existing sessions. ' +
    'Call this first to look up and navigate to the user. ' +
    'After the admin confirms, call again with confirmed=true to execute the unlock.',
  inputSchema: z.object({
    targetUserId: z.number().int().positive().describe('The user ID to unlock'),
    confirmed: z
      .boolean()
      .optional()
      .default(false)
      .describe('Set to true on second call to execute after admin confirmation'),
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
      navigate: { type: 'route', path: `/admin/users?filter=${encodeURIComponent(String(user.name))}` },
      message: `User ${user.name} (${user.email}) found. Navigating to the user list filtered by their name. Ask the admin to review and confirm — the unlock is executed on confirmation.`,
    }
  },
})

const runConsistencyChecks = createTool({
  id: 'run_consistency_checks',
  description:
    'Run all consistency checks in parallel and return results. Call this after the admin clicks Ready, or after executing a lock/cancel/unlock action. ' +
    'Checks: (1) locked users with pending future appointments, (2) active users with pending future appointments.',
  inputSchema: z.object({}),
  execute: async () => {
    let result = await executeConsistencyCheckWorkflow()
    if (!result.success) return { error: result.error ?? 'Consistency check failed' }
    return result
  },
})

const checkPendingAppointments = createTool({
  id: 'check_pending_appointments',
  description:
    'Check how many future appointments a user has. Call this in the cancellation flow before asking the admin whether pending appointments should be deleted.',
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
  instructions: `You help admins manage user accounts and browse appointments. If the question is about appointments, navigate to the appointments grid. If the question is about users, follow the user management flow with navigation, confirmation, and consistency checks.

APPOINTMENT FLOW — use when the admin asks about appointments:
  Appointment keywords: "appointment", "appointments", "Termin", "Termine", "booking", "bookings", "Buchung", "Buchungen".
  Navigate to /verwaltung/appointments with appropriate query params, then wait for the next question.
  Do NOT call ask_user or run_consistency_checks for appointment queries — just navigate and stop.

  navigate({ path: '/verwaltung/appointments', query: { filter: '...', period: '...', status: '...' } })

  Date reference → period mapping:
    "today" / "heute" → period: "today"
    "this week" / "diese Woche" → period: "this_week"
    "this month" / "dieser Monat" → period: "this_month"
    "this year" / "dieses Jahr" → period: "this_year"
    "next week" / "nächste Woche" → period: "next_week"
    "next month" / "nächster Monat" → period: "next_month"

  Status reference → status mapping:
    "future" / "pending" / "upcoming" / "zukünftig" / "anstehend" → status: "pending"
    "past" / "expired" / "vergangen" / "abgelaufen" → status: "expired"

  Combine filter, period, and status when multiple dimensions are specified. If no specific filter, period, or status is mentioned, navigate without query params (shows pending future appointments).

USER FLOW — use for ALL user management questions (lock, unlock, cancel, find users, list users, disabled users, etc.):
  Step 1: Navigate to /admin/users with the appropriate filter parameter:
    navigate({ path: '/admin/users', query: { filter: '...' } })
    Mapping: "disabled"/"locked"/"gesperrt"/"deaktiviert" → filter: 'disabled'
            "active"/"enabled"/"aktiv" → filter: 'enabled'
            name or email text → filter: '<text>'
            no specific filter → omit query param (shows all users)
  Step 2: Call ask_user with the action the admin requested as an option, plus a "Ready" option:
    - If admin asked to lock/cancel/unlock a user: include that action option
    - If admin just asked a question: only "Ready"
    Examples:
      ask_user({ question: "What would you like to do?", options: [{ label: "Lock user 5" }, { label: "Ready" }] })
      ask_user({ question: "Ready?", options: [{ label: "Ready" }] })
  Step 3: If the admin clicked an action option, execute it (follow the protocol below).
  Step 4: Call run_consistency_checks to run all consistency checks in parallel.
  Step 5: Present the actual consistency check numbers — if the result has users with pendingCount > 0, list each user with their count; if no users have pending appointments, say so explicitly. Do NOT invent a generic "all clear" message without referencing the data.
  Step 6: Wait for the next question. Do NOT loop — the admin will ask something new.

AMBIGUOUS QUERIES: If the admin asks something that could be about both users and appointments (e.g., "show appointments for locked users"), prioritize the user flow since the consistency checks cover appointment overlap.

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

- run_consistency_checks: Run all consistency checks in parallel. Call this after the admin clicks Ready or after executing an action.
  Checks: (1) locked users with pending appointments, (2) active users with pending appointments.
  Returns { lockedUsers: { id, name, email, pendingCount }[], lockedTotal, activeUsers: ..., activeTotal }.
  You MUST present the actual users and counts from the result — never invent a generic message.

- ask_user: Ask the admin a question with selection options. You MUST call this tool. The admin sees buttons they can click.
  Parameters: question (required, string), options (required, array of {label, description}), selectionMode ("single_select" or "multi_select", default "single_select").

- navigate: Navigate the admin to a specific page with optional query params.
  Parameters: path (required, string), query (optional, object e.g. { filter: "text", period: "this_week", status: "pending" }).

Protocol for cancel_user_workflow_v2 — FOLLOW EXACTLY:
  Step 1: Call cancel_user_workflow_v2 with targetUserId only (confirmed=false).
          It returns user.name, user.email, and navigate.path.
  Step 2: Call navigate({ path: result.navigate.path }) to show the user in the admin content frame.
  Step 3: Call ask_user with "Confirm" and "Ready" options.
  Step 4: If admin clicks "Confirm", call check_pending_appointments({ userId: targetUserId }).
  Step 5: If count > 0, call ask_user({ question: "Delete {count} pending appointments?", options: [{ label: "Delete" }, { label: "Keep" }] }).
  Step 6: Call cancel_user_workflow_v2({ targetUserId, confirmed: true, deleteAppointments: true/false }).
  Step 7: Call run_consistency_checks.
  Step 8: Report the results.

Protocol for lock_user_workflow_v2 — FOLLOW EXACTLY:
  Step 1: Call lock_user_workflow_v2 with targetUserId only (confirmed=false).
  Step 2: Call navigate({ path: result.navigate.path }).
  Step 3: Call ask_user with "Confirm" and "Ready" options.
  Step 4: If admin clicks "Confirm", call lock_user_workflow_v2({ targetUserId, confirmed: true }).
  Step 5: Call run_consistency_checks.
  Step 6: Report the results.

Protocol for unlock_user_workflow_v2 — FOLLOW EXACTLY:
  Step 1: Call unlock_user_workflow_v2 with targetUserId only (confirmed=false).
  Step 2: Call navigate({ path: result.navigate.path }).
  Step 3: Call ask_user with "Confirm" and "Ready" options.
  Step 4: If admin clicks "Confirm", call unlock_user_workflow_v2({ targetUserId, confirmed: true }).
  Step 5: Call run_consistency_checks.
  Step 6: Report the results.

CRITICAL RULES:
- Always run consistency checks after every interaction (after action execution or Ready).
- When presenting consistency check results: mention the actual numbers for both locked and active users from the tool output. If lockedUsers is empty say "No locked users have pending appointments." If activeUsers has entries say "Active user {name}: {pendingCount} pending" for each. Always include the total pending count for each category.
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
    runConsistencyChecks,
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
  runConsistencyChecks,
}

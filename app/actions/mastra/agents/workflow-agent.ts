import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { createTool, askUserTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import { db } from '../../../data/connection.ts'
import { mastraStorage } from '../storage.ts'
import { routeNavigate } from '../tools/route-navigate.ts'
import { requireAdminId } from '../tools/admin-context.ts'
import { protocolAdherenceScorer } from '../scorers/workflow-scorers.ts'
import {
  executeCancelUserWorkflow,
  executeConsistencyCheckWorkflow,
  executeLockUserWorkflow,
  executeUnlockUserWorkflow,
} from '../workflow-executor.ts'
import { generatePdfBuffer } from '../../../utils/pdf-utils.ts'
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

const generateActionReport = createTool({
  id: 'generate_action_report',
  description:
    'Generate a PDF report after a cancel, lock, or unlock user action. ' +
    'Call this after run_consistency_checks at the end of the user management protocol. ' +
    'Returns a base64-encoded PDF with action details.',
  inputSchema: z.object({
    actionType: z
      .enum(['cancel', 'lock', 'unlock'])
      .describe('The type of action performed: cancel, lock, or unlock'),
    targetUserName: z.string().describe('Name of the target user'),
    targetUserEmail: z.string().describe('Email of the target user'),
    targetUserId: z.number().int().positive().describe('ID of the target user'),
    deletedAppointments: z
      .boolean()
      .optional()
      .default(false)
      .describe('Whether pending appointments were deleted (cancel only)'),
    deletedCount: z
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .describe('Number of deleted appointments (cancel only)'),
    lockedUsersCount: z
      .number()
      .int()
      .min(0)
      .describe('Number of locked users with pending appointments from consistency check'),
    activeUsersCount: z
      .number()
      .int()
      .min(0)
      .describe('Number of active users with pending appointments from consistency check'),
    actionedAt: z
      .string()
      .optional()
      .describe('ISO date string of when the action occurred'),
  }),
  execute: async ({
    actionType,
    targetUserName,
    targetUserEmail,
    targetUserId,
    deletedAppointments,
    deletedCount,
    lockedUsersCount,
    activeUsersCount,
    actionedAt,
  }) => {
    let adminUserId = requireAdminId()
    let adminResult = await db.exec('SELECT name, email FROM users WHERE id = $1', [adminUserId])
    let admin = (adminResult.rows ?? [])[0] as { name: string; email: string } | undefined
    let adminName = admin?.name ?? 'Unknown'
    let adminEmail = admin?.email ?? 'unknown@unknown'
    let date = actionedAt ?? new Date().toISOString()
    let dateFormatted = date.slice(0, 10)
    let safeName = targetUserName.replace(/[^a-zA-Z0-9_-]/g, '_')

    let titleText: string
    let actionLabel: string
    let actionDesc: string
    if (actionType === 'cancel') {
      titleText = 'Cancellation Report'
      actionLabel = 'Account Cancelled'
      actionDesc = 'Login disabled, API tokens revoked, future appointments deleted'
    } else if (actionType === 'lock') {
      titleText = 'Account Lock Report'
      actionLabel = 'Account Locked'
      actionDesc = 'Login disabled, all data and appointments preserved'
    } else {
      titleText = 'Account Unlock Report'
      actionLabel = 'Account Unlocked'
      actionDesc = 'Login re-enabled, existing sessions invalidated'
    }

    let docDef: any = {
      content: [
        { text: titleText, style: 'header' },
        {
          text: `Generated: ${dateFormatted}  |  Report: ${actionType}-${safeName}-${dateFormatted}`,
          style: 'subheader',
        },
        { text: '', margin: [0, 10, 0, 0] },
        { text: 'Admin', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*'],
            body: [
              [{ text: 'Field', bold: true }, { text: 'Value', bold: true }],
              ['Name', adminName],
              ['Email', adminEmail],
            ],
          },
        },
        { text: '', margin: [0, 10, 0, 0] },
        { text: 'Target User', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*'],
            body: [
              [{ text: 'Field', bold: true }, { text: 'Value', bold: true }],
              ['Name', targetUserName],
              ['Email', targetUserEmail],
              ['User ID', String(targetUserId)],
            ],
          },
        },
        { text: '', margin: [0, 10, 0, 0] },
        { text: 'Action Summary', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*'],
            body: [
              [{ text: 'Field', bold: true }, { text: 'Value', bold: true }],
              ['Action', actionLabel],
              ['Details', actionDesc],
              ...(actionType === 'cancel'
                ? [['Appointments Deleted', deletedAppointments ? `Yes (${deletedCount})` : 'No']]
                : []),
            ],
          },
        },
        { text: '', margin: [0, 10, 0, 0] },
        { text: 'Post-Action Consistency Checks', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*'],
            body: [
              [{ text: 'Check', bold: true }, { text: 'Result', bold: true }],
              [
                'Locked users with pending appointments',
                `${lockedUsersCount} user(s)`,
              ],
              [
                'Active users with pending appointments',
                `${activeUsersCount} user(s)`,
              ],
            ],
          },
        },
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        subheader: { fontSize: 10, color: '#666', margin: [0, 0, 0, 20] },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 10, 0, 4] },
      },
    }
    let buf = await generatePdfBuffer(docDef)
    return {
      filename: `${actionType}-report-${safeName}-${dateFormatted}.pdf`,
      data: buf.toString('base64'),
      size: buf.length,
      reportType: `${actionType}-summary`,
    }
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
  Step 2: Determine intent and act:
          - If the admin explicitly asked for an action (lock/cancel/unlock a user), execute it directly (follow the protocol below). Do NOT ask "What would you like to do?" or ask for confirmation in the chat — the admin's stated intent IS the confirmation.
          - If the admin just asked a question or browsed users without requesting an action, stop here — they will type their next instruction.
          - If the intent is unclear (e.g., admin provided a user ID, name, or number without stating an action), use ask_user with action options as BUTTONS — do NOT ask in plain text. Example: ask_user({ question: "Was möchten Sie tun?", options: [{ label: "Sperren" }, { label: "Entsperren" }, { label: "Konto löschen" }, { label: "Nur ansehen" }] })
  Step 3: Call run_consistency_checks to run all consistency checks in parallel.
  Step 4: Present the actual consistency check numbers — if the result has users with pendingCount > 0, list each user with their count; if no users have pending appointments, say so explicitly. Do NOT invent a generic "all clear" message without referencing the data.
  Step 5: If the action was cancel, lock, or unlock, call generate_action_report now (see protocol for exact parameters).
  Step 6: End your response with the final results. Do NOT ask "Is there anything else?", "Any other questions?", or similar closing prompts. The admin will type their next request unprompted — trust the conversation to continue naturally.

AMBIGUOUS QUERIES: If the admin asks something that could be about both users and appointments (e.g., "show appointments for locked users"), prioritize the user flow since the consistency checks cover appointment overlap.

Available tools:
- cancel_user_workflow_v2: Cancel a user — deletes appointments, disables login, prevents re-registration.
  First call: pass targetUserId (confirmed=false) to look up the user. Returns user info and navigate path.
  Second call: pass targetUserId with confirmed=true and deleteAppointments=true/false to execute.
  Use check_pending_appointments before the second call to check for future appointments.

- lock_user_workflow_v2: Lock a user — prevents login, keeps all data and appointments.
  First call: pass targetUserId (confirmed=false) to look up the user. Returns user info and navigate path.
  Second call: pass targetUserId with confirmed=true to execute.

- unlock_user_workflow_v2: Unlock a user — re-enables login.
  First call: pass targetUserId (confirmed=false) to look up the user. Returns user info and navigate path.
  Second call: pass targetUserId with confirmed=true to execute.

- check_pending_appointments: Check how many future appointments a user has.
  Use this before asking the admin about deleting appointments.

- run_consistency_checks: Run all consistency checks in parallel. Call this after executing an action.
  Checks: (1) locked users with pending appointments, (2) active users with pending appointments.
  Returns { lockedUsers: { id, name, email, pendingCount }[], lockedTotal, activeUsers: ..., activeTotal }.
  You MUST present the actual users and counts from the result — never invent a generic message.

- generate_action_report: Generate a PDF report after a cancel, lock, or unlock action.
  Call this after run_consistency_checks at the end of any user management protocol.
  Pass actionType ("cancel"|"lock"|"unlock"), target user details, deletion info (for cancel), and consistency check results. Admin info is looked up internally.
  Returns { filename, data (base64 PDF), size, reportType: 'cancel-summary'|'lock-summary'|'unlock-summary' }.

- ask_user: Ask the admin a question with selection options. You MUST call this tool. The admin sees buttons they can click.
  Parameters: question (required, string), options (required, array of {label, description}), selectionMode ("single_select" or "multi_select", default "single_select").

- navigate: Navigate the admin to a specific page with optional query params.
  Parameters: path (required, string), query (optional, object e.g. { filter: "text", period: "this_week", status: "pending" }).

Protocol for cancel_user_workflow_v2 — FOLLOW EXACTLY:
  Step 1: Call cancel_user_workflow_v2 with targetUserId only (confirmed=false).
          It returns user.name, user.email, and navigate.path.
  Step 2: Call navigate({ path: result.navigate.path }) to show the user in the admin content frame.
  Step 3: Call check_pending_appointments({ userId: targetUserId }).
  Step 4: If count > 0, call ask_user({ question: "Delete {count} pending appointments?", options: [{ label: "Delete" }, { label: "Keep" }] }).
  Step 5: Call cancel_user_workflow_v2({ targetUserId, confirmed: true, deleteAppointments: true/false }).
  Step 6: Call navigate with the SAME path from Step 2 to refresh the user grid with updated state.
  Step 7: Call run_consistency_checks.
  Step 8: Report the results.
  Step 9: You MUST call generate_action_report — do not skip this. Pass actionType="cancel", targetUserName, targetUserEmail, targetUserId, deletedAppointments, deletedCount, lockedUsersCount, activeUsersCount. Admin info is looked up internally.

Protocol for lock_user_workflow_v2 — FOLLOW EXACTLY:
  Step 1: Call lock_user_workflow_v2 with targetUserId only (confirmed=false).
  Step 2: Call navigate({ path: result.navigate.path }).
  Step 3: Call lock_user_workflow_v2({ targetUserId, confirmed: true }).
  Step 4: Call navigate with the SAME path from Step 2 to refresh the user grid with updated state.
  Step 5: Call run_consistency_checks.
  Step 6: Report the results.
  Step 7: You MUST call generate_action_report — do not skip this. Pass actionType="lock", targetUserName, targetUserEmail, targetUserId, lockedUsersCount, activeUsersCount. Admin info is looked up internally.

Protocol for unlock_user_workflow_v2 — FOLLOW EXACTLY:
  Step 1: Call unlock_user_workflow_v2 with targetUserId only (confirmed=false).
  Step 2: Call navigate({ path: result.navigate.path }).
  Step 3: Call unlock_user_workflow_v2({ targetUserId, confirmed: true }).
  Step 4: Call navigate with the SAME path from Step 2 to refresh the user grid with updated state.
  Step 5: Call run_consistency_checks.
  Step 6: Report the results.
  Step 7: You MUST call generate_action_report — do not skip this. Pass actionType="unlock", targetUserName, targetUserEmail, targetUserId, lockedUsersCount, activeUsersCount. Admin info is looked up internally.

CRITICAL RULES:
- Always run consistency checks after every action execution.
- When presenting consistency check results: mention the actual numbers for both locked and active users from the tool output. If lockedUsers is empty say "No locked users have pending appointments." If activeUsers has entries say "Active user {name}: {pendingCount} pending" for each. Always include the total pending count for each category.
- You MUST call navigate as a SEPARATE tool call. Do NOT rely on the first tool to navigate — call navigate explicitly.
- Carry the targetUserId forward between tool calls — use the SAME targetUserId from the lookup call in the execute call. NEVER ask the admin for the user ID again — you already have it.
- When you need to ask the admin a question (e.g., unclear intent, delete appointments), you MUST use the ask_user tool with buttons. Do NOT ask in plain chat text — the admin needs clickable options to respond.
- Keep responses concise and factual.
- CRITICAL: You MUST call generate_action_report as the FINAL step of every cancel, lock, and unlock protocol. Do NOT just mention the PDF report in text — you must actually call the tool. The tool returns the PDF data which the UI uses to show a download link. If you only say "PDF-Bericht wurde generiert" without calling the tool, the admin will not see a download button.`,
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
    generateActionReport,
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
  scorers: {
    completeness: {
      scorer: protocolAdherenceScorer,
      sampling: { type: 'ratio', rate: 0.5 },
    },
  },
})

export const workflowAgentTools = {
  cancelUserWorkflow_v2,
  lockUserWorkflow_v2,
  unlockUserWorkflow_v2,
  checkPendingAppointments,
  runConsistencyChecks,
  generateActionReport,
}

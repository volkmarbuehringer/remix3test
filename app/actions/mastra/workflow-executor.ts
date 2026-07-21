import type { Mastra } from '@mastra/core'

let _mastra: Mastra | undefined

export function setMastra(m: Mastra) {
  _mastra = m
}

export async function executeBookingWorkflow(input: {
  resourceId: number
  customerId: number
  title?: string
  date?: number
  startMin?: number
}): Promise<{ workflowRunId: string; success: boolean; appointmentId?: number; error?: string }> {
  if (!_mastra) throw new Error('Mastra not initialized')
  let wf = _mastra.getWorkflow('customerBookingWorkflow')
  let run = await wf.createRun({ resourceId: String(input.customerId) })
  let result = await run.start({ inputData: input })
  let out =
    result.status === 'success' && result.result
      ? (result.result as { success?: boolean; id?: number; error?: string })
      : {
          success: false,
          error: result.status === 'failed' ? String(result.error) : 'unknown_error',
        }
  return {
    workflowRunId: run.runId,
    success: out.success ?? false,
    appointmentId: out.id,
    error: out.error,
  }
}

export async function executeCancellationWorkflow(input: {
  appointmentId: number
  requestingUserId: number
}): Promise<{ workflowRunId: string; success: boolean; error?: string }> {
  if (!_mastra) throw new Error('Mastra not initialized')
  let wf = _mastra.getWorkflow('bookingCancellationWorkflow')
  let run = await wf.createRun({ resourceId: String(input.requestingUserId) })
  let result = await run.start({ inputData: input })
  let out =
    result.status === 'success' && result.result
      ? (result.result as { success?: boolean; error?: string })
      : {
          success: false,
          error: result.status === 'failed' ? String(result.error) : 'unknown_error',
        }
  return { workflowRunId: run.runId, success: out.success ?? false, error: out.error }
}

export async function executeCancelUserWorkflow(input: {
  targetUserId: number
  adminUserId: number
  adminEmail: string
  deleteAppointments?: boolean
}): Promise<{
  workflowRunId: string
  success: boolean
  targetUserId: number
  deletedAppointments: number
  error?: string
}> {
  if (!_mastra) throw new Error('Mastra not initialized')
  let wf = _mastra.getWorkflow('cancelUserWorkflow')
  let run = await wf.createRun({ resourceId: String(input.adminUserId) })
  let result = await run.start({ inputData: input })
  let out =
    result.status === 'success' && result.result
      ? (result.result as {
          success?: boolean
          targetUserId?: number
          deletedAppointments?: number
          error?: string
        })
      : {
          success: false,
          targetUserId: input.targetUserId,
          deletedAppointments: 0,
          error: result.status === 'failed' ? String(result.error) : 'unknown_error',
        }
  return {
    workflowRunId: run.runId,
    success: out.success ?? false,
    targetUserId: out.targetUserId ?? input.targetUserId,
    deletedAppointments: out.deletedAppointments ?? 0,
    error: out.error,
  }
}

export async function executeConsistencyCheckWorkflow(): Promise<{
  success: boolean
  lockedUsers: { id: number; name: string; email: string; pendingCount: number }[]
  lockedTotal: number
  activeUsers: { id: number; name: string; email: string; pendingCount: number }[]
  activeTotal: number
  error?: string
}> {
  if (!_mastra) throw new Error('Mastra not initialized')
  let wf = _mastra.getWorkflow('consistencyCheckWorkflow')
  let run = await wf.createRun({ resourceId: 'consistency' })
  let result = await run.start({ inputData: {} })
  if (result.status === 'success' && result.result) {
    let out = result.result as {
      lockedUsers?: { id: number; name: string; email: string; pendingCount: number }[]
      lockedTotal?: number
      activeUsers?: { id: number; name: string; email: string; pendingCount: number }[]
      activeTotal?: number
    }
    return {
      success: true,
      lockedUsers: out.lockedUsers ?? [],
      lockedTotal: out.lockedTotal ?? 0,
      activeUsers: out.activeUsers ?? [],
      activeTotal: out.activeTotal ?? 0,
    }
  }
  return {
    success: false,
    lockedUsers: [],
    lockedTotal: 0,
    activeUsers: [],
    activeTotal: 0,
    error: result.status === 'failed' ? String(result.error) : 'unknown_error',
  }
}

export async function executeLockUserWorkflow(input: {
  targetUserId: number
  adminUserId: number
  adminEmail: string
}): Promise<{
  workflowRunId: string
  success: boolean
  error?: string
  auditLogged: boolean
  alreadyLocked?: boolean
}> {
  if (!_mastra) throw new Error('Mastra not initialized')
  let wf = _mastra.getWorkflow('lockUserWorkflow')
  let run = await wf.createRun({ resourceId: String(input.adminUserId) })
  let result = await run.start({ inputData: input })
  let out =
    result.status === 'success' && result.result
      ? (result.result as {
          success?: boolean
          error?: string
          auditLogged?: boolean
          alreadyLocked?: boolean
        })
      : {
          success: false,
          error: result.status === 'failed' ? String(result.error) : 'unknown_error',
          auditLogged: false,
        }
  return {
    workflowRunId: run.runId,
    success: out.success ?? false,
    error: out.error,
    auditLogged: out.auditLogged ?? false,
    alreadyLocked: out.alreadyLocked,
  }
}

export async function executeUnlockUserWorkflow(input: {
  targetUserId: number
  adminUserId: number
  adminEmail: string
}): Promise<{
  workflowRunId: string
  success: boolean
  error?: string
  auditLogged: boolean
  alreadyUnlocked?: boolean
}> {
  if (!_mastra) throw new Error('Mastra not initialized')
  let wf = _mastra.getWorkflow('unlockUserWorkflow')
  let run = await wf.createRun({ resourceId: String(input.adminUserId) })
  let result = await run.start({ inputData: input })
  let out =
    result.status === 'success' && result.result
      ? (result.result as {
          success?: boolean
          error?: string
          auditLogged?: boolean
          alreadyUnlocked?: boolean
        })
      : {
          success: false,
          error: result.status === 'failed' ? String(result.error) : 'unknown_error',
          auditLogged: false,
        }
  return {
    workflowRunId: run.runId,
    success: out.success ?? false,
    error: out.error,
    auditLogged: out.auditLogged ?? false,
    alreadyUnlocked: out.alreadyUnlocked,
  }
}

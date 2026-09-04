import type { Mastra } from '@mastra/core'

let _mastra: Mastra | undefined

export function setMastra(m: Mastra) {
  _mastra = m
}

function runErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    let e = error as { message?: unknown }
    if (typeof e.message === 'string') return e.message
    return JSON.stringify(error)
  }
  return String(error)
}

export async function executeUserPreflightWorkflow(input: { targetUserId: number }): Promise<{
  found: boolean
  user?: { id: number; name: string; email: string; role: string; disabledAt: number | null } | undefined
  pendingCount: number
  lockedUsers: { id: number; name: string; email: string; pendingCount: number }[]
  lockedTotal: number
  activeUsers: { id: number; name: string; email: string; pendingCount: number }[]
  activeTotal: number
  error?: string | undefined
}> {
  if (!_mastra) throw new Error('Mastra not initialized')

  let [preflightResult, consistencyResult] = await Promise.all([
    (async () => {
      let wf = _mastra.getWorkflow('userPreflightWorkflow')
      let run = await wf.createRun({ resourceId: String(input.targetUserId) })
      return run.start({ inputData: input })
    })(),
    (async () => {
      let wf = _mastra.getWorkflow('consistencyCheckWorkflow')
      let run = await wf.createRun({ resourceId: 'consistency' })
      return run.start({ inputData: {} })
    })(),
  ])

  let found = false
  let user:
    | { id: number; name: string; email: string; role: string; disabledAt: number | null }
    | undefined
  let pendingCount = 0
  let error: string | undefined

  if (preflightResult.status === 'success' && preflightResult.result) {
    let out = preflightResult.result as {
      found?: boolean
      user?: { id: number; name: string; email: string; role: string; disabledAt: number | null }
      pendingCount?: number
      error?: string
    }
    found = out.found ?? false
    user = out.user
    pendingCount = out.pendingCount ?? 0
    error = out.error
  }

  let lockedUsers: { id: number; name: string; email: string; pendingCount: number }[] = []
  let lockedTotal = 0
  let activeUsers: { id: number; name: string; email: string; pendingCount: number }[] = []
  let activeTotal = 0

  if (consistencyResult.status === 'success' && consistencyResult.result) {
    let out = consistencyResult.result as {
      lockedUsers?: { id: number; name: string; email: string; pendingCount: number }[]
      lockedTotal?: number
      activeUsers?: { id: number; name: string; email: string; pendingCount: number }[]
      activeTotal?: number
    }
    lockedUsers = out.lockedUsers ?? []
    lockedTotal = out.lockedTotal ?? 0
    activeUsers = out.activeUsers ?? []
    activeTotal = out.activeTotal ?? 0
  }

  if (preflightResult.status !== 'success') {
    let preflightError =
      preflightResult.status === 'failed' ? String(preflightResult.error) : 'unknown_error'
    if (!error) error = preflightError
  }

  return {
    found,
    user,
    pendingCount,
    lockedUsers,
    lockedTotal,
    activeUsers,
    activeTotal,
    error,
  }
}

export async function executeBookingWorkflow(input: {
  resourceId: number
  customerId: number
  title?: string
  date?: number
  startMin?: number
}): Promise<{
  workflowRunId: string
  success: boolean
  appointmentId?: number | undefined
  error?: string | undefined
}> {
  if (!_mastra) throw new Error('Mastra not initialized')
  let wf = _mastra.getWorkflow('customerBookingWorkflow')
  let run = await wf.createRun({ resourceId: String(input.customerId) })
  let result = await run.start({ inputData: input })
  let out =
    result.status === 'success' && result.result
      ? (result.result as { success?: boolean; id?: number; error?: string })
      : {
          success: false,
          error: result.status === 'failed' ? runErrorMessage(result.error) : 'unknown_error',
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
}): Promise<{ workflowRunId: string; success: boolean; error?: string | undefined }> {
  if (!_mastra) throw new Error('Mastra not initialized')
  let wf = _mastra.getWorkflow('bookingCancellationWorkflow')
  let run = await wf.createRun({ resourceId: String(input.requestingUserId) })
  let result = await run.start({ inputData: input })
  let out =
    result.status === 'success' && result.result
      ? (result.result as { success?: boolean; error?: string })
      : {
          success: false,
          error: result.status === 'failed' ? runErrorMessage(result.error) : 'unknown_error',
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
  error?: string | undefined
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
          error: result.status === 'failed' ? runErrorMessage(result.error) : 'unknown_error',
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
    error: result.status === 'failed' ? runErrorMessage(result.error) : 'unknown_error',
  }
}

export async function executeLockUserWorkflow(input: {
  targetUserId: number
  adminUserId: number
  adminEmail: string
}): Promise<{
  workflowRunId: string
  success: boolean
  error?: string | undefined
  auditLogged: boolean
  alreadyLocked?: boolean | undefined
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
          error: result.status === 'failed' ? runErrorMessage(result.error) : 'unknown_error',
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
  error?: string | undefined
  auditLogged: boolean
  alreadyUnlocked?: boolean | undefined
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
          error: result.status === 'failed' ? runErrorMessage(result.error) : 'unknown_error',
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

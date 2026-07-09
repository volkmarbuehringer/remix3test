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
  let out = result.status === 'success' && result.result
    ? (result.result as { success?: boolean; id?: number; error?: string })
    : { success: false, error: result.status === 'failed' ? String(result.error) : 'unknown_error' }
  return { workflowRunId: run.runId, success: out.success ?? false, appointmentId: out.id, error: out.error }
}

export async function executeCancellationWorkflow(input: {
  appointmentId: number
  requestingUserId: number
}): Promise<{ workflowRunId: string; success: boolean; error?: string }> {
  if (!_mastra) throw new Error('Mastra not initialized')
  let wf = _mastra.getWorkflow('bookingCancellationWorkflow')
  let run = await wf.createRun({ resourceId: String(input.requestingUserId) })
  let result = await run.start({ inputData: input })
  let out = result.status === 'success' && result.result
    ? (result.result as { success?: boolean; error?: string })
    : { success: false, error: result.status === 'failed' ? String(result.error) : 'unknown_error' }
  return { workflowRunId: run.runId, success: out.success ?? false, error: out.error }
}

export async function executeCancelUserWorkflow(input: {
  targetUserId: number
  adminUserId: number
  adminEmail: string
}): Promise<{ workflowRunId: string; success: boolean; deletedAppointments: number; error?: string }> {
  if (!_mastra) throw new Error('Mastra not initialized')
  let wf = _mastra.getWorkflow('cancelUserWorkflow')
  let run = await wf.createRun({ resourceId: String(input.adminUserId) })
  let result = await run.start({ inputData: input })
  let out = result.status === 'success' && result.result
    ? (result.result as { success?: boolean; deletedAppointments?: number; error?: string })
    : { success: false, deletedAppointments: 0, error: result.status === 'failed' ? String(result.error) : 'unknown_error' }
  return { workflowRunId: run.runId, success: out.success ?? false, deletedAppointments: out.deletedAppointments ?? 0, error: out.error }
}

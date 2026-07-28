import { sseEncoder } from '../../utils/agent-sse.ts'

export function writeEvent(
  controller: ReadableStreamDefaultController,
  type: string,
  data: unknown,
) {
  controller.enqueue(sseEncoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`))
}

export type WorkflowResult = {
  success: boolean
  action: string
  targetUserId: number
  targetUserName: string
  targetUserEmail: string
  deletedAppointments?: number
  auditLogged?: boolean
  error?: string
}

export async function pipeWorkflowStream(
  stream: AsyncIterable<unknown>,
  controller: ReadableStreamDefaultController,
  signal: AbortSignal,
): Promise<WorkflowResult | null> {
  let lastReportPdf: string | undefined
  let lastReportFilename: string | undefined
  let finalOutput: Record<string, unknown> | null = null
  let streamError: string | null = null

  function handleEvent(chunk: unknown) {
    let c = chunk as Record<string, unknown>
    if (!c || typeof c !== 'object') return
    let type = c.type as string | undefined
    let payload = c.payload as Record<string, unknown> | undefined

    if (type === 'workflow-start') {
      writeEvent(controller, 'workflow-start', { workflowId: payload?.workflowId })
    } else if (type === 'workflow-step-start') {
      writeEvent(controller, 'workflow-step-start', {
        stepId: payload?.id ?? c.id,
      })
    } else if (type === 'workflow-step-suspended') {
      writeEvent(controller, 'workflow-step-suspended', {
        stepId: payload?.id,
        suspendPayload: payload?.suspendPayload ?? {},
      })
    } else if (type === 'workflow-step-result') {
      let stepOutput = payload?.output as Record<string, unknown> | undefined
      if (stepOutput?.reportPdf) {
        lastReportPdf = String(stepOutput.reportPdf)
        lastReportFilename = String(stepOutput.reportFilename || 'report.pdf')
      }
      if (stepOutput && 'success' in stepOutput && 'targetUserName' in stepOutput) {
        finalOutput = stepOutput as Record<string, unknown>
      }
      writeEvent(controller, 'workflow-step-result', {
        stepId: payload?.id,
        status: payload?.status,
        output: stepOutput ?? {},
      })
    } else if (type === 'workflow-step-output') {
      writeEvent(controller, 'workflow-step-output', {
        stepId: payload?.id ?? 'unknown',
        output: payload?.output ?? {},
      })
    } else if (type === 'workflow-finish') {
      let ws = payload?.workflowStatus as string | undefined
      writeEvent(controller, 'workflow-finish', {
        success: ws === 'success',
        workflowStatus: ws,
        reportPdf: lastReportPdf,
        reportFilename: lastReportFilename,
      })
    } else if (type === 'workflow-canceled') {
      writeEvent(controller, 'workflow-canceled', {})
    } else if (type === 'workflow-paused') {
      writeEvent(controller, 'workflow-step-suspended', {
        stepId: 'unknown',
        suspendPayload: {},
      })
    }
  }

  let reader: ReadableStreamDefaultReader<unknown> | undefined

  if (stream instanceof ReadableStream) {
    reader = stream.getReader()
  }

  if (signal.aborted) {
    reader?.cancel().catch(() => {})
    safeClose(controller)
    return null
  }

  signal.addEventListener(
    'abort',
    () => {
      reader?.cancel().catch(() => {})
      safeClose(controller)
    },
    { once: true },
  )

  try {
    if (reader) {
      while (true) {
        let { done, value } = await reader.read()
        if (done) break
        if (signal.aborted) return null
        handleEvent(value)
      }
    } else {
      for await (let chunk of stream) {
        if (signal.aborted) return null
        handleEvent(chunk)
      }
    }
  } catch (err) {
    streamError = String(err)
    writeEvent(controller, 'workflow-error', { error: streamError })
  }

  safeClose(controller)

  if (streamError) {
    return {
      success: false,
      action: '',
      targetUserId: 0,
      targetUserName: '',
      targetUserEmail: '',
      error: streamError,
    }
  }

  if (finalOutput) {
    let out = finalOutput as Record<string, unknown>
    return {
      success: Boolean(out.success),
      action: String(out.action || ''),
      targetUserId: Number(out.targetUserId || 0),
      targetUserName: String(out.targetUserName || ''),
      targetUserEmail: String(out.targetUserEmail || ''),
      deletedAppointments:
        out.deletedAppointments != null ? Number(out.deletedAppointments) : undefined,
      auditLogged: out.auditLogged != null ? Boolean(out.auditLogged) : undefined,
      error: out.error ? String(out.error) : undefined,
    }
  }

  return null
}

function safeClose(controller: ReadableStreamDefaultController) {
  try {
    controller.close()
  } catch {
    /* already closed */
  }
}

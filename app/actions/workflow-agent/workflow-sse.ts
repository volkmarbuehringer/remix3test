import { sseEncoder } from '../../utils/agent-sse.ts'

export function writeEvent(controller: ReadableStreamDefaultController, type: string, data: unknown) {
  controller.enqueue(sseEncoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`))
}

export async function pipeWorkflowStream(
  stream: AsyncIterable<unknown>,
  controller: ReadableStreamDefaultController,
  signal: AbortSignal,
): Promise<void> {
  let lastReportPdf: string | undefined
  let lastReportFilename: string | undefined

  function handleEvent(chunk: unknown) {
    let c = chunk as Record<string, unknown>
    if (!c || typeof c !== 'object') return
    let type = c.type as string | undefined
    let payload = c.payload as Record<string, unknown> | undefined

    if (type === 'workflow-start') {
      writeEvent(controller, 'workflow-start', { workflowId: payload?.workflowId })
    } else if (type === 'workflow-step-start') {
      writeEvent(controller, 'workflow-step-start', {
        stepId: payload?.id ?? (c as any).id,
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
      writeEvent(controller, 'workflow-step-result', {
        stepId: payload?.id,
        status: payload?.status,
        output: stepOutput ?? {},
      })
    } else if (type === 'workflow-step-output') {
      writeEvent(controller, 'workflow-step-output', {
        stepId: (payload as any)?.id ?? 'unknown',
        output: payload?.output ?? {},
      })
    } else if (type === 'workflow-finish') {
      writeEvent(controller, 'workflow-finish', {
        success: payload?.workflowStatus === 'success',
        workflowStatus: payload?.workflowStatus,
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
    return
  }

  signal.addEventListener('abort', () => {
    reader?.cancel().catch(() => {})
    safeClose(controller)
  }, { once: true })

  try {
    if (reader) {
      while (true) {
        let { done, value } = await reader.read()
        if (done) break
        if (signal.aborted) return
        handleEvent(value)
      }
    } else {
      for await (let chunk of stream) {
        if (signal.aborted) return
        handleEvent(chunk)
      }
    }
  } catch (err) {
    writeEvent(controller, 'workflow-error', { error: String(err) })
  }

  safeClose(controller)
}

function safeClose(controller: ReadableStreamDefaultController) {
  try { controller.close() } catch { /* already closed */ }
}

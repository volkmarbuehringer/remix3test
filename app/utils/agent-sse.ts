import { SuperHeaders } from 'remix/headers'

export const sseEncoder = new TextEncoder()

export function sseHeaders() {
  let headers = new SuperHeaders()
  headers.contentType = { mediaType: 'text/event-stream' }
  headers.cacheControl = { noCache: true, noStore: true }
  headers.connection = 'keep-alive'
  headers.set('X-Accel-Buffering', 'no')
  return headers
}

/** Create an SSE error Response with the given message and HTTP status */
export function sseErrorResponse(error: string, status: number = 400): Response {
  return new Response(
    sseEncoder.encode(
      `event: agent-error\ndata: ${JSON.stringify({ error })}\n\n`,
    ),
    { status, headers: sseHeaders() },
  )
}

/** Encode a single SSE event for direct controller.enqueue() usage */
export function sseEvent(type: string, data: unknown): Uint8Array {
  return sseEncoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
}

/** Safely close a ReadableStream controller, ignoring errors if already closed */
export function safeClose(controller: ReadableStreamDefaultController) {
  try { controller.close() } catch { /* already closed */ }
}

function filterAndForward(
  chunk: Record<string, unknown>,
  controller: ReadableStreamDefaultController,
  options?: { runId?: string; getTarget?: (path: string) => string },
): 'suspended' | undefined {
  let { runId, getTarget } = options ?? {}
  let p = chunk.payload as Record<string, unknown> | undefined
  let type = chunk.type as string

  function fwd(type: string, data: unknown) {
    let payload: string
    try {
      payload = JSON.stringify(data)
    } catch {
      payload = JSON.stringify({ _serializeError: true, type })
    }
    if (payload.length > 65536) {
      if (type === 'message') {
        let msg = JSON.parse(payload) as { text?: string }
        msg.text = msg.text?.slice(0, 65536 - 50)
        payload = JSON.stringify(msg)
      } else {
        payload = JSON.stringify({ _truncated: true, type })
      }
    }
    controller.enqueue(sseEncoder.encode(`event: ${type}\ndata: ${payload}\n\n`))
  }

  if (type === 'text-delta') {
    let text = String(p?.text ?? chunk.textDelta ?? '')
    if (text) fwd('message', { text })
  } else if (type === 'tool-call-approval') {
    fwd('suspension', {
      toolCallId: p?.toolCallId,
      toolName: p?.toolName,
      args: p?.args,
    })
  } else if (type === 'tool-call-suspended') {
    let sp = p?.suspendPayload as
      | {
          question?: string
          options?: { label: string; description?: string }[]
          selectionMode?: string
        }
      | undefined
    if (sp?.question) {
      fwd('question', {
        runId,
        toolCallId: p?.toolCallId,
        question: sp.question,
        options: sp.options ?? null,
        selectionMode: sp.selectionMode ?? 'single_select',
      })
    }
    return 'suspended'
  } else if (type === 'finish') {
    fwd('complete', {})
  } else if (type === 'tool-result') {
    let result = p?.result as Record<string, unknown> | undefined
    if (result?.type === 'route' && typeof result.path === 'string') {
      fwd('navigate', {
        href: result.path,
        target: getTarget ? getTarget(result.path) : 'admin-content',
        history: 'push',
        ...(result.data ? { prefill: result.data } : {}),
      })
    } else {
      fwd('tool-result', {
        toolCallId: p?.toolCallId,
        toolName: p?.toolName,
        result,
        isError: p?.isError,
      })
    }
  } else if (type === 'tool-error') {
    fwd('tool-error', {
      toolCallId: p?.toolCallId,
      toolName: p?.toolName,
      args: p?.args,
      error: p?.error,
    })
  } else if (type === 'error') {
    fwd('agent-error', { error: p?.error })
  }
}

export function pipeStream(
  fullStream: ReadableStream,
  controller: ReadableStreamDefaultController,
  signal: AbortSignal,
  runId?: string,
  getTarget?: (path: string) => string,
): Promise<void> {
  let reader: ReadableStreamDefaultReader<unknown> | undefined
  let closed = false

  function closeOnce() {
    if (closed) return
    closed = true
    try {
      controller.close()
    } catch {
      /* already closed */
    }
  }

  return new Promise<void>((resolve) => {
    reader = fullStream.getReader()
    if (signal.aborted) {
      reader.cancel().catch(() => {})
      closeOnce()
      resolve()
      return
    }
    signal.addEventListener(
      'abort',
      () => {
        reader?.cancel().catch(() => {})
        closeOnce()
        resolve()
      },
      { once: true },
    )

    ;(async () => {
      try {
        while (true) {
          let { done, value } = await reader!.read()
          if (done) break
          if (signal.aborted) {
            closeOnce()
            resolve()
            return
          }
          if (!value || typeof value !== 'object') continue

          let chunk = value as Record<string, unknown>
          let result = filterAndForward(chunk, controller, { runId, getTarget })
          if (result === 'suspended') {
            reader?.cancel().catch(() => {})
            closeOnce()
            resolve()
            return
          }
        }
        closeOnce()
      } catch (err) {
        try {
          controller.enqueue(
            sseEncoder.encode(
              `event: stream-error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`,
            ),
          )
        } catch {
          /* controller already errored */
        }
        closeOnce()
      }
      resolve()
    })()
  })
}

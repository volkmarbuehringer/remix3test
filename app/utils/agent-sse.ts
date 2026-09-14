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
    sseEncoder.encode(`event: agent-error\ndata: ${JSON.stringify({ error })}\n\n`),
    { status, headers: sseHeaders() },
  )
}

/** Encode a single SSE event for direct controller.enqueue() usage */
export function sseEvent(type: string, data: unknown): Uint8Array {
  return sseEncoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
}

/** Safely close a ReadableStream controller, ignoring errors if already closed */
export function safeClose(controller: ReadableStreamDefaultController) {
  try {
    controller.close()
  } catch {
    /* already closed */
  }
}

/**
 * Normalizes an agent/tool error payload to a display string.
 *
 * Mastra may surface an `Error`, a plain object, or a string. Forwarding the raw
 * value let the browser stringify an object as "[object Object]", so everything
 * crossing the SSE boundary is converted to text here.
 */
export function errorToText(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message || error.name || 'Unbekannter Fehler'
  if (error == null) return 'Unbekannter Fehler'
  try {
    let json = JSON.stringify(error)
    if (typeof json === 'string') return json
  } catch {
    /* circular / non-serializable */
  }
  return String(error)
}

/**
 * Builds the abort signal for a single agent run.
 *
 * Links the request signal (a browser Cancel or disconnect aborts the fetch, and
 * that must abort the server-side model run too) with a whole-run timeout, and
 * returns a `cleanup` that clears both. Centralizing this keeps every SSE path
 * — message, approve/decline, answer — from drifting into "timeout but no
 * disconnect" or "disconnect but no timeout".
 *
 * The signal must be handed to the agent call (as `abortSignal`) *and* to
 * `pipeStream`, and `cleanup` must run once the run settles.
 */
export function createRunSignal(
  requestSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  let controller = new AbortController()
  let timeout = setTimeout(() => controller.abort(), timeoutMs)
  let onRequestAbort = () => controller.abort()

  if (requestSignal?.aborted) {
    controller.abort()
  } else {
    requestSignal?.addEventListener('abort', onRequestAbort, { once: true })
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout)
      requestSignal?.removeEventListener('abort', onRequestAbort)
    },
  }
}

type SuspensionInfo = {
  runId?: string | undefined
  toolCallId?: string | undefined
  toolName?: string | undefined
  args?: Record<string, unknown> | undefined
  gateType: 'tool_decision' | 'question'
  suspendPayload?: Record<string, unknown> | undefined
}

type PipeHooks = {
  /** Called when the run suspends on a tool decision or an ask_user question. */
  onSuspension?: (info: SuspensionInfo) => void
  /** Called exactly once when the stream settles, with the terminal reason. */
  onEnd?: (reason: 'complete' | 'suspended' | 'error' | 'aborted') => void
}

async function filterAndForward(
  chunk: Record<string, unknown>,
  controller: ReadableStreamDefaultController,
  options?: {
    runId?: string | undefined
    getTarget?: ((path: string) => string) | undefined
    hooks?: PipeHooks | undefined
  },
): Promise<'suspended' | undefined> {
  let { runId, getTarget, hooks } = options ?? {}
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
        let msg = JSON.parse(payload) as { text?: string | undefined }
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
    // Only the durable-index flow (which supplies onSuspension) needs the
    // stream to end at the approval; consumers without a hook keep the prior
    // behavior of forwarding the suspension event without stopping.
    let hasHook = hooks?.onSuspension != null
    if (hasHook) {
      await hooks?.onSuspension?.({
        runId,
        toolCallId: p?.toolCallId as string | undefined,
        toolName: p?.toolName as string | undefined,
        args: p?.args as Record<string, unknown> | undefined,
        gateType: 'tool_decision',
      })
    }
    fwd('suspension', {
      runId,
      toolCallId: p?.toolCallId,
      toolName: p?.toolName,
      args: p?.args,
      gateType: 'tool_decision',
    })
    return hasHook ? 'suspended' : undefined
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
        gateType: 'question',
      })
      await hooks?.onSuspension?.({
        runId,
        toolCallId: p?.toolCallId as string | undefined,
        toolName: p?.toolName as string | undefined,
        gateType: 'question',
        suspendPayload: {
          question: sp.question,
          options: sp.options ?? null,
          selectionMode: sp.selectionMode ?? 'single_select',
        },
      })
    }
    return 'suspended'
  } else if (type === 'tool-call-input-streaming-start') {
    fwd('tool-call-input-streaming-start', {
      toolCallId: p?.toolCallId,
      toolName: p?.toolName,
    })
  } else if (type === 'tool-call-delta') {
    fwd('tool-call-delta', {
      toolCallId: p?.toolCallId,
      toolName: p?.toolName,
      argsTextDelta: p?.argsTextDelta,
    })
  } else if (type === 'tool-call') {
    fwd('tool-call', {
      toolCallId: p?.toolCallId,
      toolName: p?.toolName,
      args: p?.args,
    })
  } else if (type === 'step-finish') {
    let output = p?.output as Record<string, unknown> | undefined
    fwd('step-finish', {
      reason: (p?.stepResult as Record<string, unknown> | undefined)?.reason,
      usage: output?.usage,
    })
  } else if (type === 'reasoning-start') {
    fwd('reasoning-start', { id: p?.id })
  } else if (type === 'reasoning-delta') {
    fwd('reasoning-delta', { text: p?.text })
  } else if (type === 'reasoning-end') {
    fwd('reasoning-end', {})
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
      error: errorToText(p?.error),
    })
  } else if (type === 'error') {
    fwd('agent-error', { error: errorToText(p?.error) })
  }
}

export function pipeStream(
  fullStream: ReadableStream,
  controller: ReadableStreamDefaultController,
  signal: AbortSignal,
  runId?: string,
  getTarget?: (path: string) => string,
  hooks?: PipeHooks,
): Promise<void> {
  let reader: ReadableStreamDefaultReader<unknown> | undefined
  let closed = false
  let settled = false

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
    function settle(reason: 'complete' | 'suspended' | 'error' | 'aborted') {
      if (settled) return
      settled = true
      hooks?.onEnd?.(reason)
      resolve()
    }

    reader = fullStream.getReader()
    if (signal.aborted) {
      reader.cancel().catch(() => {})
      closeOnce()
      settle('aborted')
      return
    }
    signal.addEventListener(
      'abort',
      () => {
        reader?.cancel().catch(() => {})
        closeOnce()
        settle('aborted')
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
            settle('aborted')
            return
          }
          if (!value || typeof value !== 'object') continue

          let chunk = value as Record<string, unknown>
          let result = await filterAndForward(chunk, controller, { runId, getTarget, hooks })
          if (result === 'suspended') {
            reader?.cancel().catch(() => {})
            closeOnce()
            settle('suspended')
            return
          }
        }
        closeOnce()
        settle('complete')
      } catch (err) {
        try {
          controller.enqueue(
            sseEncoder.encode(
              `event: stream-error\ndata: ${JSON.stringify({ error: errorToText(err) })}\n\n`,
            ),
          )
        } catch {
          /* controller already errored */
        }
        closeOnce()
        settle('error')
      }
    })()
  })
}

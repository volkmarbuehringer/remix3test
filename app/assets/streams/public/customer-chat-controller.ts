import { readEventStream, isAbortError } from './sse-post.ts'

/**
 * Turn-and-conversation state machine for the customer chat stream.
 *
 * This module owns everything that is not pixels: which conversation a turn
 * belongs to (the server-rendered `data-thread-id` and the `?new=1` marker),
 * the run/thread ids adopted from `start` events, the in-flight abort
 * controller, the suspended flag, and the mapping of SSE event types to
 * delegate calls.
 *
 * The delegate (the client entry) owns all DOM: bubbles, tool cards, the busy
 * indicator, gate forms, focus. Read-only document access stays in the
 * delegate too — the controller never asserts on page structure.
 */

export interface CustomerChatApprovalData {
  runId: string
  toolCallId?: string | undefined
  toolName?: string | undefined
  args?: Record<string, unknown> | undefined
  threadId?: string | undefined
}

export interface CustomerChatQuestionData {
  runId: string
  toolCallId?: string | undefined
  question: string
  options?: { label: string; description?: string }[] | null
  selectionMode: string
  threadId?: string | undefined
}

export interface CustomerChatReconnectPayload {
  status?: string
  runId?: string
  threadId?: string
  gateType?: string
  toolCallId?: string
  toolName?: string
  args?: Record<string, unknown>
  suspendPayload?: Record<string, unknown>
}

export interface CustomerChatStepUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface CustomerChatUiDelegate {
  appendMessage(text: string, role: 'user' | 'assistant' | 'error', accumulate?: boolean): void
  setBusy(busy: boolean): void
  setFormEnabled(enabled: boolean): void
  focusComposer(): void
  /** Per-turn DOM reset: close the streaming bubble, clear tool trackers, hide pending gate. */
  beginTurn(): void
  /** Ends the current accumulating assistant bubble. */
  endStreamingBubble(): void
  showApproval(data: CustomerChatApprovalData): void
  hideApproval(): void
  showQuestion(data: CustomerChatQuestionData): void
  hideQuestion(): void
  focusApprovalButton(): void
  focusQuestionOption(): void
  appendToolCard(toolName: string, toolCallId: string): void
  updateToolArgs(toolCallId: string, argsTextDelta: string): void
  finalizeToolArgs(toolCallId: string, args: Record<string, unknown>): void
  appendToolResult(toolCallId: string, result: unknown, isError?: boolean, toolName?: string): void
  appendStepStats(reason: string, usage: CustomerChatStepUsage): void
  startReasoning(): void
  appendReasoning(text: string): void
  endReasoning(): void
  /**
   * Adopts the thread id the page rendered (transcript's `data-thread-id`
   * attribute), without consulting closure state. Returns null when absent.
   */
  getThreadIdFromDom(): string | null
}

export interface CustomerChatControllerOptions {
  /** Abort signal of the containing component; a pending fetch cannot outlive the component. */
  lifecycleSignal?: AbortSignal | null
  /** Reconnect probe endpoint (should also emit `resume` payloads). */
  reconnectHref: string
}

export interface CustomerChatController {
  /**
   * Which conversation the next turn belongs to. Null while the page is in
   * fresh-conversation mode (`?new=1`) or before a thread exists.
   */
  threadId(): string | null
  /** True while the streamed turn left the run suspended at a gate. */
  suspended(): boolean
  /** Adopt the thread id the page itself rendered (mount-time resume). */
  adoptThreadFromDom(): void
  /**
   * Reconcile closure state with the page that is on screen. Returns
   * `startingFresh` — the URL's `?new=1` marker outranks any captured thread
   * id, because an in-app navigation reuses this entry while it swaps the page
   * under it.
   */
  threadFromPageWins(): boolean
  /** Append the resolved thread id to the streaming request body, if any. */
  setThreadOnForm(formData: FormData): void
  /** Reset per-turn state and delegate DOM trackers for a new turn. */
  beginTurn(): void
  /** Cancel the in-flight request, if any. */
  abort(): void
  /** POST the turn and stream the reply. Resolves once the stream settles. */
  submit(url: string, formData: FormData): Promise<void>
  /** Ingest one SSE frame (exposed for tests). */
  handleEvent(type: string, raw: unknown): void
  /** Probe the reconnect endpoint to restore a suspended gate after a reload. */
  reconnect(): Promise<void>
}

function isStartingFresh(): boolean {
  try {
    return new URL(window.location.href).searchParams.has('new')
  } catch {
    return false
  }
}

/**
 * Once the customer sends a message (or continues an existing conversation)
 * the one-shot fresh-state marker is no longer wanted: otherwise a page
 * refresh keeps serving an empty conversation for /chat?new=1. Drop the
 * query param so the resumed conversation wins on the next load.
 */
function clearFreshParam() {
  try {
    let url = new URL(window.location.href)
    if (!url.searchParams.has('new')) return
    url.searchParams.delete('new')
    window.history.replaceState({}, '', url.pathname + url.search)
  } catch {
    /* best-effort */
  }
}

export function createCustomerChatController(
  ui: CustomerChatUiDelegate,
  options: CustomerChatControllerOptions,
): CustomerChatController {
  let lifecycleSignal = options.lifecycleSignal
  let reconnectHref = options.reconnectHref

  let currentRunId: string | null = null
  let currentThreadId: string | null = null
  let currentAbort: AbortController | null = null
  let suspended = false

  function abort() {
    if (currentAbort) {
      currentAbort.abort()
      currentAbort = null
    }
  }

  function beginTurn() {
    suspended = false
    ui.beginTurn()
    ui.hideQuestion()
  }

  // ── SSE event → delegate mapping ──────────────────────────────

  function gateThreadId(d: Record<string, unknown>): string {
    return String(d.runId ?? currentRunId ?? '')
  }

  function handleEvent(type: string, raw: unknown) {
    let d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

    if (type === 'start') {
      if (d.threadId != null) currentThreadId = String(d.threadId)
      if (d.runId != null) currentRunId = String(d.runId)
      beginTurn()
    } else if (type === 'message') {
      let text = String(d.text ?? '')
      if (text) {
        ui.appendMessage(text, 'assistant', true)
        ui.setBusy(false)
      }
    } else if (type === 'suspension') {
      suspended = true
      ui.showApproval({
        runId: gateThreadId(d),
        toolCallId: d.toolCallId as string | undefined,
        toolName: d.toolName as string | undefined,
        args: d.args as Record<string, unknown> | undefined,
        threadId: currentThreadId ?? undefined,
      })
      ui.focusApprovalButton()
      ui.endStreamingBubble()
    } else if (type === 'question') {
      suspended = true
      ui.showQuestion({
        runId: gateThreadId(d),
        toolCallId: d.toolCallId as string | undefined,
        question: String(d.question ?? ''),
        options:
          (d.options as { label: string; description?: string }[] | null | undefined) ?? null,
        selectionMode: String(d.selectionMode ?? 'single_select'),
        threadId: currentThreadId ?? undefined,
      })
      ui.focusQuestionOption()
      ui.endStreamingBubble()
    } else if (type === 'agent-error') {
      ui.appendMessage('Fehler: ' + String(d.error ?? 'unbekannt'), 'error')
    } else if (type === 'stream-error') {
      ui.appendMessage('Stream-Fehler: ' + String(d.error ?? 'unbekannt'), 'error')
    } else if (type === 'tool-call-input-streaming-start') {
      ui.appendToolCard(String(d.toolName ?? 'unbekannt'), String(d.toolCallId ?? ''))
      ui.setBusy(false)
    } else if (type === 'tool-call-delta') {
      if (d.toolCallId != null && d.argsTextDelta != null) {
        ui.updateToolArgs(String(d.toolCallId), String(d.argsTextDelta))
      }
    } else if (type === 'tool-call') {
      if (d.toolCallId != null && d.args != null) {
        ui.finalizeToolArgs(String(d.toolCallId), d.args as Record<string, unknown>)
      }
    } else if (type === 'tool-result') {
      if (d.toolCallId != null)
        ui.appendToolResult(
          String(d.toolCallId),
          d.result,
          d.isError as boolean,
          d.toolName as string | undefined,
        )
    } else if (type === 'tool-error') {
      if (d.toolCallId != null)
        ui.appendToolResult(String(d.toolCallId), d.error, true, d.toolName as string | undefined)
    } else if (type === 'step-finish') {
      if (d.usage != null || d.reason != null) {
        ui.appendStepStats(
          String(d.reason ?? ''),
          (d.usage as CustomerChatStepUsage | undefined) ?? {},
        )
      }
    } else if (type === 'reasoning-start') {
      ui.startReasoning()
      ui.setBusy(false)
    } else if (type === 'reasoning-delta') {
      if (d.text != null) ui.appendReasoning(String(d.text))
    } else if (type === 'reasoning-end') {
      ui.endReasoning()
    }
  }

  // ── Turn lifecycle ────────────────────────────────────────────

  async function submit(url: string, formData: FormData): Promise<void> {
    abort()
    let requestAbort = new AbortController()
    currentAbort = requestAbort
    if (lifecycleSignal) {
      lifecycleSignal.addEventListener('abort', () => requestAbort.abort(), { once: true })
    }

    // The `?new=1` marker is what keeps a refresh on the fresh conversation
    // instead of resuming the previous one, so it may only be dropped once a
    // turn has actually been accepted by the server. Dropping it up front
    // meant a failed first turn — or one still in flight when the customer hit
    // refresh — silently resumed the old thread, so a "new" conversation
    // looked like it was continuing the previous one.
    let turnAccepted = false
    ui.setFormEnabled(false)
    ui.setBusy(true)
    try {
      let res = await fetch(url, {
        method: 'POST',
        headers: { 'X-Sse-Request': '1' },
        body: formData,
        signal: requestAbort.signal,
      })

      let isSse = (res.headers.get('Content-Type') || '').includes('text/event-stream')

      if (!res.ok && !isSse) {
        let text = await res.text()
        ui.appendMessage('Fehler: ' + (text || res.statusText), 'error')
        return
      }

      // Anything past this point has persisted the turn: the conversation
      // exists even if the stream then breaks, so the marker is spent.
      turnAccepted = true

      if (isSse) {
        await readEventStream(res, handleEvent)
      } else {
        await res.text()
      }
    } catch (err) {
      if (isAbortError(err)) return
      ui.appendMessage('Fehler: ' + String(err), 'error')
    } finally {
      if (turnAccepted) clearFreshParam()
      currentAbort = null
      ui.setBusy(false)
      if (!suspended) {
        ui.endStreamingBubble()
        ui.focusComposer()
      }
      ui.setFormEnabled(true)
    }
  }

  // ── Reconnect: re-surface a pending gate after a reload ───────

  /**
   * Restores a still-suspended `ask_user` question or tool approval after a
   * reload. The transcript rehydration only restores text, so without this
   * the card would be lost and the composer would start a new turn instead of
   * resuming the run.
   */
  async function reconnect(): Promise<void> {
    try {
      let res = await fetch(reconnectHref, { headers: { 'X-Sse-Request': '1' } })
      if (!res.ok) return
      let data = (await res.json()) as CustomerChatReconnectPayload
      if (!data || data.status !== 'suspended' || !data.runId) return

      currentRunId = data.runId
      if (data.threadId) currentThreadId = data.threadId
      suspended = true
      // Block the composer until the re-surfaced gate is resolved, so a new
      // turn can't be started on top of a pending decision.
      ui.setFormEnabled(false)

      if (data.gateType === 'question') {
        let sp = (data.suspendPayload ?? {}) as {
          question?: string
          options?: { label: string; description?: string }[]
          selectionMode?: string
        }
        ui.showQuestion({
          runId: data.runId,
          toolCallId: data.toolCallId,
          threadId: data.threadId,
          question: sp.question ?? 'Bitte beantworten Sie die Frage.',
          options: sp.options ?? null,
          selectionMode: sp.selectionMode ?? 'single_select',
        })
      } else {
        ui.showApproval({
          runId: data.runId,
          toolCallId: data.toolCallId,
          threadId: data.threadId,
          toolName: data.toolName,
          args: data.args,
        })
      }
    } catch {
      /* reconnect is best-effort */
    }
  }

  function threadFromPageWins(): boolean {
    let startingFresh = isStartingFresh()
    if (!startingFresh && !currentThreadId) {
      currentThreadId = ui.getThreadIdFromDom()
    }
    return startingFresh
  }

  return {
    threadId: () => currentThreadId,
    suspended: () => suspended,
    adoptThreadFromDom: () => {
      currentThreadId = ui.getThreadIdFromDom()
    },
    threadFromPageWins,
    setThreadOnForm: (formData) => {
      let startingFresh = isStartingFresh()
      if (currentThreadId && !startingFresh) formData.set('threadId', currentThreadId)
    },
    beginTurn,
    abort,
    submit,
    handleEvent,
    reconnect,
  }
}

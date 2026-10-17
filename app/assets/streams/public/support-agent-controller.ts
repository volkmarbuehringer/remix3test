import { readEventStream, isAbortError, fetchSseStream, type SseInit } from './sse-post.ts'

/**
 * Turn, thread-navigation, and retry state machine for the admin support
 * agent stream.
 *
 * Owns: the in-flight abort controller, run/thread ids with their
 * page-adoption anchors (which page and which chat element produced a thread
 * id, so a stale closure cannot post to a conversation the admin has left),
 * the retry state machine (`lastSubmission`), the pending question gate, and
 * the mapping of SSE event types to delegate calls.
 *
 * The delegate (the client entry) owns all DOM: bubbles, the thinking
 * indicator, gate cards, the tool-result table renderer, and focus.
 */

/** Host element carrying `data-active-frame`; its value outranks the default panel name. */
export const PANEL_CONTAINER_ID = 'support-agent-frame-container'

/**
 * Server-rendered marker on POST forms whose controller has an `X-Agent-Thread`
 * JSON branch (resources create, offering-configs create). A runtime frame
 * fetch never carries `X-Agent-Thread`, so deferring such a form would strand a
 * pending `ask_user` gate — the client replay must keep owning them even when
 * their `data-rmx-target` names the panel.
 */
export const AGENT_FORM_ATTRIBUTE = 'data-agent-form'

/**
 * Per-form ownership decision for a POST form submitted inside the panel
 * container: should it be left to the runtime's native `data-rmx-target`
 * interception (`true`, the submit proceeds uncanceled) or replayed by the
 * client SSE transport (`false`, the intercept preventDefaults it)?
 *
 * Deferral is only safe when the form already targets the support panel itself
 * (its frame fetch swaps the panel in place) and its controller takes no part
 * in agent flows. Anything else — a wrong/outside target, or an agent-aware
 * form — is replayed.
 *
 * See `.opencode/skills/learned/mastra-deltas/references/remix3-agent-routing/support-panel-form-targets.md`.
 */
export function deferPanelFormToRuntime(
  formTarget: string | null,
  agentAwareForm: boolean,
  panelTarget: string,
): boolean {
  return formTarget === panelTarget && !agentAwareForm
}

export interface SupportAgentFrame {
  reload(options?: { src?: string }): Promise<unknown>
}
export type SupportAgentNavigationInfo = {
  href: string
  target?: string | undefined
  history?: string | undefined
}

export type SupportAgentQuestionData = {
  runId?: string | undefined
  toolCallId?: string | undefined
  question: string
  options?: { label: string; description?: string }[] | null | undefined
  selectionMode: string
}

export type SupportAgentSuspensionData = {
  runId?: string | undefined
  toolCallId?: string | undefined
  toolName?: string | undefined
  args?: Record<string, unknown> | undefined
}

export interface SupportAgentUiDelegate {
  showThinking(): void
  hideThinking(): void
  /** Appends a fresh (empty) agent bubble; the delegate tracks it as "current". */
  appendAgentMessage(): HTMLElement
  /** Replaces the current agent bubble's text with `text`. */
  updateLastAgentMessage(text: string): void
  /** Renders markdown into the final text bubble once the stream settles. */
  finalizeAgentMessage(): void
  /** After this, `updateLastAgentMessage`/`finalizeAgentMessage` are no-ops until a new bubble is appended. */
  clearAgentMessageEl(): void
  appendStatusMessage(text: string, isError?: boolean): void
  appendUserMessage(text: string): void
  setFormEnabled(enabled: boolean): void
  /**
   * Render a retriable error row; when the retry control is activated, call
   * the `retry()` callback (the controller's retry state machine).
   */
  showErrorWithRetry(message: string, retry: () => void): void
  setPreviewVisible(visible: boolean, path?: string): void
  renderQuestionCard(
    mount: HTMLElement,
    data: SupportAgentQuestionData & { threadId?: string | undefined },
  ): void
  renderApprovalCard(
    mount: HTMLElement,
    data: SupportAgentSuspensionData & { threadId?: string | undefined },
  ): void
  renderToolResult(result: Record<string, unknown>): void
  hasQuestionGate(): boolean
  hasApprovalGate(): boolean
  removeQuestionGate(): void
  removeApprovalGate(): void
}

export interface SupportAgentControllerOptions {
  /** Abort signal of the containing component; readEventStream lifetime signal. */
  signal: AbortSignal
  /** Resolves the frame that hosts the active panel content. */
  getActivePanelFrame(): SupportAgentFrame | null
  /** Resolves a named frame, or the component's own frame for no target. */
  getFrame(target?: string | null): SupportAgentFrame | null
  reconnectHref: string
}

export interface SupportAgentStreamController {
  /** Abort the in-flight stream, if any. */
  abort(): void
  /** Start (or restart) a turn: POST `url/init` and stream the reply. */
  startStream(url: string, init: SseInit): Promise<void>
  /** Re-run the most recent failed submission (the retry state machine). */
  retry(): void
  /** Replay: re-submits the current pending question once a run is suspended. */
  hasPendingQuestion(): boolean
  /**
   * Which conversation the next turn belongs to, decided by the page on
   * screen: the server-rendered `data-thread-id` when set, else the entry's
   * captured id only while the page and chat element that produced it still
   * show.
   */
  resolveThreadId(): string | null
  /** True while an inner-panel form replay is in flight; a new submit should proceed natively. */
  frameFormBusy(): boolean
  /** Intercepts an inner-panel POST form and replays it over the SSE transport. */
  frameFormSubmit(form: HTMLFormElement): Promise<void>
  /** Handle a "tool decision" gate submission. */
  toolDecision(decision: 'approve' | 'decline', form: HTMLFormElement): void
  /** Handle an "answer" gate submission. */
  answer(form: HTMLFormElement): void
  /** Probe the reconnect endpoint to restore a suspended gate after a reload. */
  reconnect(): Promise<void>
}

export function createSupportAgentStreamController(
  ui: SupportAgentUiDelegate,
  options: SupportAgentControllerOptions,
): SupportAgentStreamController {
  let { signal, getActivePanelFrame, getFrame, reconnectHref } = options

  let abortController: AbortController | null = null

  // The component's teardown aborts an in-flight stream: a torn-down entry
  // must not keep a fetch or readEventStream loop alive past its lifetime
  // signal (matches customer-chat-controller's lifecycleSignal wiring).
  if (!signal.aborted) {
    signal.addEventListener('abort', () => abort(), { once: true })
  }
  let currentRunId: string | null = null
  let currentThreadId: string | null = null
  // The page key and chat element that produced `currentThreadId`, so a value
  // the entry captured itself is only reused while that same page is on screen.
  let startedOnPage: string = ''
  let startedChatEl: HTMLElement | null = null
  let didNavigate: boolean = false

  let submitting: boolean = false

  // The most recent submit, so a failed turn can be retried with one click.
  let lastSubmission: { url: string; init: SseInit } | null = null

  let pendingQuestion: {
    runId: string
    toolCallId?: string | undefined
    selectionMode: string
  } | null = null

  // ── Thread adoption anchors ─────────────────────────────────

  function getChat() {
    return document.getElementById('chat-messages')
  }

  function currentPageKey(): string {
    try {
      let url = new URL(window.location.href)
      return url.pathname + url.search
    } catch {
      return ''
    }
  }

  /**
   * Which conversation the next turn belongs to, decided by the page on
   * screen rather than by this entry's closure.
   *
   * The server-rendered `data-thread-id` is the only adoption signal: the
   * server renders it exactly when it validated and opened the requested
   * thread. A `?threadId=` that appears only in the URL was therefore not
   * adopted (unknown, foreign, or rejected) and must not be posted — doing so
   * would target a conversation the page never opened. The id this entry
   * captured is reused only while the page and chat element that produced it
   * are still on screen — an in-app navigation or a frame reload can otherwise
   * leave a stale thread in the closure and silently continue a conversation
   * the admin has left.
   */
  function resolveThreadId(): string | null {
    let fromDom = getChat()?.getAttribute('data-thread-id') ?? ''
    if (fromDom) return fromDom

    if (
      currentThreadId &&
      startedOnPage !== '' &&
      startedOnPage === currentPageKey() &&
      startedChatEl !== null &&
      getChat() === startedChatEl
    ) {
      return currentThreadId
    }

    return null
  }

  /**
   * Adopts a thread id the server created or resumed into the page state and
   * the address bar, so a reload restores the conversation instead of
   * starting empty.
   */
  function reflectThreadInUrl(threadId: string) {
    let chat = getChat()
    if (chat) chat.setAttribute('data-thread-id', threadId)
    try {
      let url = new URL(window.location.href)
      if (url.searchParams.get('threadId') !== threadId) {
        url.searchParams.set('threadId', threadId)
        window.history.replaceState({}, '', url.pathname + url.search)
      }
    } catch {
      /* best-effort */
    }
  }

  // ── Navigation ──────────────────────────────────────────────

  function handleNavigate(data: SupportAgentNavigationInfo) {
    let { href, target, history: historyMode } = data
    if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
      ui.appendStatusMessage('Ungültiger Navigationspfad: ' + href)
      return
    }

    let frame = getFrame(target)
    if (frame) {
      frame.reload({ src: href }).catch((err) => {
        ui.appendStatusMessage('Navigation fehlgeschlagen: ' + String(err), true)
      })
      ui.setPreviewVisible(true, href)
      if (!historyMode || historyMode !== 'skip') {
        if (historyMode === 'replace') {
          window.history.replaceState({}, '', href)
        } else {
          window.history.pushState({}, '', href)
        }
      }
    } else {
      ui.appendStatusMessage('Fehler: Frame nicht gefunden', true)
    }
  }

  // ── Gates (question / suspension) ───────────────────────────

  function showQuestion(data: SupportAgentQuestionData) {
    let runId = data.runId || currentRunId || ''
    pendingQuestion = {
      runId,
      toolCallId: data.toolCallId,
      selectionMode: data.selectionMode,
    }
    ui.hideThinking()
    // A server-rendered no-JS gate may already be on the page; a stream
    // question would otherwise duplicate the same answer form.
    if (ui.hasQuestionGate()) return
    let el = ui.appendAgentMessage()

    ui.renderQuestionCard(el, {
      runId,
      toolCallId: data.toolCallId,
      threadId: currentThreadId ?? undefined,
      question: data.question,
      options: data.options,
      selectionMode: data.selectionMode,
    })
  }

  function showSuspension(data: SupportAgentSuspensionData) {
    ui.hideThinking()
    // A server-rendered no-JS gate may already be on the page; a stream
    // suspension would otherwise duplicate the same decision form.
    if (ui.hasApprovalGate()) return
    let el = ui.appendAgentMessage()

    ui.renderApprovalCard(el, {
      runId: data.runId || currentRunId || '',
      toolCallId: data.toolCallId,
      threadId: currentThreadId ?? undefined,
      toolName: data.toolName,
      args: data.args,
    })
  }

  // ── Tool decision / Answer handlers ─────────────────────────

  function toolDecision(decision: 'approve' | 'decline', form: HTMLFormElement) {
    ui.setFormEnabled(false)

    let label = decision === 'approve' ? 'Aktion genehmigt' : 'Aktion abgelehnt'
    ui.appendUserMessage(label)

    // Carry the form's hidden runId/toolCallId/threadId and the submitter's
    // decision into the streamed request. The SSE path authenticates with the
    // X-Sse-Request header, so the native CSRF token is dropped.
    let body = new FormData(form)
    body.delete('_csrf')
    if (!body.get('runId') && currentRunId) body.set('runId', currentRunId)
    if (!body.get('decision')) body.set('decision', decision)
    if (!body.get('threadId') && currentThreadId) body.set('threadId', currentThreadId)

    ui.removeApprovalGate()
    ui.clearAgentMessageEl()
    void startStream('/admin/support-agent/tool-decision', { method: 'POST', body })
  }

  function answer(form: HTMLFormElement) {
    ui.setFormEnabled(false)

    // Carry the form's hidden fields and the named answer control(s) into the
    // streamed request. The SSE path authenticates with the X-Sse-Request
    // header, so the native CSRF token is dropped.
    let body = new FormData(form)
    body.delete('_csrf')
    let answers = body
      .getAll('answer')
      .map(String)
      .filter((value) => value.length > 0)
    if (answers.length === 0) return
    if (!body.get('runId') && currentRunId) body.set('runId', currentRunId)
    if (!body.get('threadId') && currentThreadId) body.set('threadId', currentThreadId)

    ui.appendUserMessage(answers.join(', '))

    ui.removeQuestionGate()
    ui.clearAgentMessageEl()
    void startStream('/admin/support-agent/answer', { method: 'POST', body })
  }

  // ── Reconnect: re-surface a pending gate after a reload ─────

  type SupportAgentReconnectPayload = {
    status?: string
    runId?: string
    threadId?: string
    gateType?: string
    toolCallId?: string
    toolName?: string
    args?: Record<string, unknown>
    suspendPayload?: Record<string, unknown>
  }

  async function reconnect() {
    try {
      // Bounded by the component's lifetime: a torn-down entry's probe must
      // not outlive it (agent-events-controller's reconnect takes the
      // component signal for the same reason).
      let res = await fetch(reconnectHref, {
        headers: { 'X-Sse-Request': '1' },
        signal,
      })
      if (!res.ok) return
      let data = (await res.json()) as SupportAgentReconnectPayload
      if (!data || data.status !== 'suspended') return

      currentRunId = data.runId ?? null
      currentThreadId = data.threadId ?? null
      if (data.threadId) {
        startedOnPage = currentPageKey()
        startedChatEl = getChat()
      }
      ui.clearAgentMessageEl()
      // A server-rendered no-JS gate is already on the page; appending an
      // empty bubble for it would be noise (show* early-returns below).
      if (!ui.hasApprovalGate() && !ui.hasQuestionGate()) {
        ui.appendAgentMessage()
      }
      // Disable the message input until the re-surfaced gate is resolved, so
      // the admin can't start a new query on top of a pending decision.
      ui.setFormEnabled(false)

      if (data.gateType === 'question') {
        let sp = (data.suspendPayload || {}) as {
          question?: string
          options?: { label: string; description?: string }[]
          selectionMode?: string
        }
        showQuestion({
          runId: data.runId,
          toolCallId: data.toolCallId,
          question: sp.question || 'Bitte beantworte die Frage.',
          options: sp.options ?? null,
          selectionMode: sp.selectionMode || 'single_select',
        })
      } else {
        showSuspension({
          runId: data.runId,
          toolCallId: data.toolCallId,
          toolName: data.toolName,
          args: data.args,
        })
      }
    } catch {
      /* reconnect is best-effort; ignore connection errors */
    }
  }

  // ── SSE stream ──────────────────────────────────────────────

  function abort() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  async function startStream(url: string, init: SseInit) {
    pendingQuestion = null
    abort()
    abortController = new AbortController()
    let requestSignal = abortController.signal
    let streamingText = ''
    lastSubmission = { url, init }
    ui.showThinking()

    try {
      let outcome = await fetchSseStream(url, init, requestSignal)
      if (!outcome.ok) {
        ui.hideThinking()
        ui.showErrorWithRetry('Fehler: ' + outcome.message, retry)
        ui.setFormEnabled(true)
        return
      }
      let res = outcome.res

      let stopped = await readEventStream(
        res,
        (eventType, data) => {
          try {
            let parsed = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>

            if (eventType === 'start') {
              didNavigate = false
              ui.hideThinking()
              if (parsed.runId) currentRunId = String(parsed.runId)
              if (parsed.threadId) {
                currentThreadId = String(parsed.threadId)
                startedOnPage = currentPageKey()
                startedChatEl = getChat()
                reflectThreadInUrl(String(parsed.threadId))
              }
              ui.appendAgentMessage()
              streamingText = ''
            } else if (eventType === 'message') {
              streamingText += String(parsed.text ?? '')
              ui.updateLastAgentMessage(streamingText)
            } else if (eventType === 'navigate') {
              didNavigate = true
              ui.appendStatusMessage('Navigiere zu ' + String(parsed.href) + '...')
              handleNavigate({
                href: String(parsed.href),
                ...(parsed.target !== undefined ? { target: String(parsed.target) } : {}),
                ...(parsed.history !== undefined ? { history: String(parsed.history) } : {}),
              })
            } else if (eventType === 'question') {
              showQuestion(parsed as unknown as SupportAgentQuestionData)
              return false
            } else if (eventType === 'suspension') {
              showSuspension(parsed as unknown as SupportAgentSuspensionData)
              return false
            } else if (eventType === 'tool-error') {
              ui.appendStatusMessage('Tool-Fehler: ' + String(parsed.error ?? 'unbekannt'), true)
            } else if (eventType === 'tool-result') {
              ui.renderToolResult((parsed.result as Record<string, unknown>) ?? {})
            } else if (eventType === 'stream-error') {
              ui.hideThinking()
              ui.showErrorWithRetry('Stream-Fehler: ' + String(parsed.error ?? 'unbekannt'), retry)
            } else if (eventType === 'complete') {
              if (pendingQuestion) return false
              ui.hideThinking()
              ui.finalizeAgentMessage()
              lastSubmission = null
              currentRunId = null
              // Keep the active thread so the next message continues it; only
              // remove it once the page itself changes (see resolveThreadId).
              ui.clearAgentMessageEl()
              if (!didNavigate) {
                let theFrame = getActivePanelFrame()
                if (theFrame) {
                  theFrame.reload().catch((err) => {
                    ui.appendStatusMessage('Panel-Reload fehlgeschlagen: ' + String(err), true)
                  })
                }
              }
            } else if (eventType === 'agent-error') {
              ui.hideThinking()
              ui.showErrorWithRetry('Fehler: ' + String(parsed.error ?? 'unbekannt'), retry)
            }
          } catch {
            if (eventType === 'message') {
              streamingText += typeof data === 'string' ? data : ''
              ui.updateLastAgentMessage(streamingText)
            }
          }
          return undefined
        },
        { signal: requestSignal },
      )

      if (!stopped && !pendingQuestion) {
        ui.hideThinking()
        ui.setFormEnabled(true)
      }
    } catch (err) {
      ui.hideThinking()
      if (isAbortError(err)) return
      ui.showErrorWithRetry('Fehler: ' + String(err), retry)
      ui.setFormEnabled(true)
    }
  }

  function retry(): void {
    if (!lastSubmission) return
    ui.setFormEnabled(false)
    void startStream(lastSubmission.url, lastSubmission.init)
  }

  // ── Frame form submit ───────────────────────────────────────

  async function frameFormSubmit(form: HTMLFormElement): Promise<void> {
    if ((form.method || 'GET').toUpperCase() === 'GET') return

    if (submitting) return
    submitting = true

    let frame = getActivePanelFrame()

    ui.appendStatusMessage('Formular wird gesendet...')

    // The component's lifetime signal bounds this fetch: a torn-down entry
    // must not keep the replay POST (or its follow-up reads) alive past its
    // component — same contract as startStream, same wiring as
    // customer-chat-controller's submit().
    let requestAbort = new AbortController()
    let onComponentAbort = () => requestAbort.abort()
    if (signal.aborted) requestAbort.abort()
    else signal.addEventListener('abort', onComponentAbort, { once: true })

    try {
      let headers: Record<string, string> = { 'X-Sse-Request': '1' }
      // Only the client replay carries `X-Agent-Thread` — a runtime frame
      // fetch never does (that asymmetry is why the `AGENT_FORM_ATTRIBUTE`
      // forms above must stay on the replay). The value itself originates
      // from the server side of the same conversation (the rendered page's
      // thread anchor DOM, or the stream's own SSE `start`/reconnect
      // payloads), never from user input, but it is still reflected back as
      // a request header: an origin-validated source would be the
      // header-injection-safe ideal (review note, intentionally not reworked
      // here — would need a server-issued, signed thread-token mechanism).
      if (currentThreadId) headers['X-Agent-Thread'] = currentThreadId
      let res = await fetch(form.action, {
        method: form.method || 'POST',
        headers,
        body: new FormData(form),
        signal: requestAbort.signal,
      })
      if (signal.aborted) return

      if (
        res.ok &&
        pendingQuestion &&
        currentRunId &&
        res.headers.get('Content-Type')?.includes('json')
      ) {
        let data = await res.json()
        if (signal.aborted) return
        let body = new FormData()
        body.set('runId', currentRunId)
        body.set('answer', JSON.stringify(data))
        body.set('selectionMode', 'single_select')
        if (pendingQuestion.toolCallId) body.set('toolCallId', pendingQuestion.toolCallId)
        if (currentThreadId) body.set('threadId', currentThreadId)
        void startStream('/admin/support-agent/answer', { method: 'POST', body })
        return
      }
    } catch (err) {
      // An abort is an intentional cancellation, not a failed submission.
      if (isAbortError(err)) return
      ui.appendStatusMessage('Fehler: ' + String(err), true)
    } finally {
      signal.removeEventListener('abort', onComponentAbort)
      submitting = false
    }

    if (signal.aborted) return

    if (frame) {
      await frame.reload().catch((err) => {
        ui.appendStatusMessage('Panel-Reload nach Formular fehlgeschlagen: ' + String(err), true)
      })
    }
  }

  return {
    abort,
    startStream,
    retry,
    hasPendingQuestion: () => pendingQuestion !== null,
    resolveThreadId,
    frameFormBusy: () => submitting,
    frameFormSubmit,
    toolDecision,
    answer,
    reconnect,
  }
}

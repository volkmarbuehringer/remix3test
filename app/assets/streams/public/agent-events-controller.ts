import { readEventStream, fetchSseStream, type SseInit } from './sse-post.ts'
import { frames } from '../../../routes.ts'
import {
  formatTime,
  inferKind,
  pipelineLogHtml,
  type PipelineRow,
  type RowKind,
} from '../../../ui/agent-events-log.ts'

/**
 * Command-and-workflow state machine for the agent events stream.
 *
 * Owns: the in-flight abort controller, the suspended run/workflow ids, the
 * `didNavigate` flag, and the pipeline row log (pure data + HTML rendering
 * into the pipeline frame).
 *
 * The delegate (the client entry) owns the status bar rows, the confirm gate
 * DOM, the composer state, and focus.
 */

export interface AgentEventsFrame {
  /** Hot-swaps the frame's content with rendered HTML. */
  replace(html: string): Promise<unknown>
  reload(options?: { src?: string }): Promise<unknown>
}

export type AgentEventsRowKind = RowKind

export interface AgentEventsUiDelegate {
  /** Appends a status row at the bottom of the status bar. */
  showInfo(text: string, opts?: { kind?: RowKind }): void
  /** Collapses (does not remove) the confirm gate container. */
  hideConfirmGate(): void
  /**
   * Renders the confirm gate for the suspended workflow; both callbacks must
   * resolve the suspended run (confirm / cancel).
   */
  renderConfirmGate(
    suspendPayload: Record<string, unknown>,
    onConfirm: () => void,
    onCancel: () => void,
  ): void
  setFormEnabled(enabled: boolean): void
  /** Empties the status bar. */
  clearStatusBar(): void
}

export interface AgentEventsControllerOptions {
  /** Resolves the frame rendering the pipeline log (or null when absent). */
  getPipelineFrame(): AgentEventsFrame | null
  /** Resolves a named frame, or the component's own frame for no target. */
  getFrame(target?: string | null): AgentEventsFrame | null
  /** Resume endpoint for a suspended workflow run. */
  resumeHref: string
  /** Reconnect probe endpoint. */
  reconnectHref: string
}

export interface AgentEventsStreamController {
  /** Abort the in-flight stream, if any. */
  abort(): void
  /** True while a workflow run has not reached a terminal state. */
  hasRunPending(): boolean
  /** Drops the buffered pipeline rows (they re-populate on the next run). */
  resetPipelineRows(): void
  /** Reset state for a new command and start streaming its reply. */
  beginCommand(url: string, formData: FormData): void
  /** Resume a suspended workflow run with the confirm/cancel decision. */
  resume(confirmed: boolean): void
  /** Probe the reconnect endpoint to restore a suspended confirm gate. */
  reconnect(signal: AbortSignal): Promise<void>
}

export function createAgentEventsStreamController(
  ui: AgentEventsUiDelegate,
  options: AgentEventsControllerOptions,
): AgentEventsStreamController {
  let { getPipelineFrame, getFrame, resumeHref, reconnectHref } = options

  let abortController: AbortController | null = null
  let didNavigate = false
  let currentRunId: string | null = null
  let currentWorkflowId: string | null = null

  // ── Live pipeline rendered into the main frame ──────────────

  let pipelineRows: PipelineRow[] = []

  function renderPipeline() {
    let frame = getPipelineFrame()
    if (!frame || pipelineRows.length === 0) return
    frame
      .replace(String(pipelineLogHtml(pipelineRows)))
      .then(() => {
        let logEl = document.getElementById('ae-pipeline-log')
        if (logEl) logEl.scrollTop = logEl.scrollHeight
      })
      .catch(() => {})
  }

  function pushRow(text: string, kind: RowKind) {
    pipelineRows.push({ kind, text, time: formatTime(Date.now()) })
    if (didNavigate || !getPipelineFrame()) {
      ui.showInfo(text, { kind })
    } else {
      renderPipeline()
    }
  }

  function resetPipeline() {
    pipelineRows = []
  }

  function restoreFilterValue(url: string) {
    let filterValue = new URL(url, window.location.origin).searchParams.get('filter')
    if (filterValue !== null && filterValue !== 'enabled' && filterValue !== 'disabled') {
      for (let input of document.querySelectorAll<HTMLInputElement>('input[name="filter"]')) {
        input.value = filterValue
      }
    }
  }

  // ── Confirm gate ────────────────────────────────────────────

  function showConfirmGate(suspendPayload: Record<string, unknown>) {
    ui.renderConfirmGate(
      suspendPayload,
      () => startResume(true),
      () => startResume(false),
    )

    // The workflow is not streaming anything while it waits at the gate, so
    // "Sending…" is misleading. Keep the composer disabled (a run is pending)
    // but say so honestly.
    let submit = document.getElementById('agent-events-submit') as HTMLButtonElement | null
    if (submit && submit.disabled) submit.textContent = 'Waiting…'
  }

  function abort() {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  function startResume(confirmed: boolean) {
    if (!currentRunId) return
    ui.setFormEnabled(false)

    let body = new FormData()
    body.set('runId', currentRunId)
    body.set('confirmed', String(confirmed))
    if (currentWorkflowId) body.set('workflowId', currentWorkflowId)
    void startStream(resumeHref, { method: 'POST', body })
  }

  // ── SSE stream ──────────────────────────────────────────────

  async function startStream(url: string, init: SseInit) {
    abort()
    abortController = new AbortController()
    let signal = abortController.signal

    try {
      let outcome = await fetchSseStream(url, init, signal)
      if (!outcome.ok) {
        ui.showInfo('Error: ' + outcome.message, { kind: 'error' })
        ui.setFormEnabled(true)
        return
      }
      let res = outcome.res

      await readEventStream(
        res,
        (eventType, data) => {
          try {
            let parsed = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>

            if (eventType === 'status') {
              let text = String(parsed.text ?? '')
              pushRow(text, (parsed.kind as RowKind) ?? inferKind(text))
            } else if (eventType === 'start') {
              currentRunId = (parsed.runId as string) || null
              currentWorkflowId = (parsed.workflowId as string) || null
            } else if (eventType === 'workflow-step-suspended') {
              showConfirmGate((parsed.suspendPayload as Record<string, unknown>) || {})
            } else if (eventType === 'workflow-finish') {
              currentRunId = null
              ui.hideConfirmGate()
              if (parsed.success) {
                ui.showInfo('Action completed', { kind: 'success' })
                let theFrame = getPipelineFrame()
                if (theFrame) {
                  theFrame.reload().catch((err) => {
                    ui.showInfo('Panel reload failed: ' + String(err), { kind: 'error' })
                  })
                } else {
                  ui.showInfo('Panel reload failed: frame not found', { kind: 'error' })
                }
              } else {
                ui.showInfo('Action failed: ' + String(parsed.error ?? 'unknown'), {
                  kind: 'error',
                })
              }
            } else if (eventType === 'workflow-error') {
              currentRunId = null
              ui.hideConfirmGate()
              ui.showInfo('Action failed: ' + String(parsed.error ?? 'unknown'), { kind: 'error' })
            } else if (eventType === 'navigate') {
              didNavigate = true
              let href = String(parsed.href)
              let target = (parsed.target as string) || frames.agentEventsPanel
              ui.showInfo('Navigating to ' + href + '...', { kind: 'info' })
              let frame = getFrame(target)
              if (frame) {
                frame.reload({ src: href }).then(
                  () => restoreFilterValue(href),
                  (err) => ui.showInfo('Navigation failed: ' + String(err), { kind: 'error' }),
                )
                let historyMode = parsed.history as string | undefined
                if (!historyMode || historyMode !== 'skip') {
                  if (historyMode === 'replace') {
                    window.history.replaceState({}, '', href)
                  } else {
                    window.history.pushState({}, '', href)
                  }
                }
              }
            } else if (eventType === 'message') {
              pushRow(String(parsed.text ?? ''), 'info')
            } else if (eventType === 'complete') {
              currentRunId = null
              ui.hideConfirmGate()
              ui.setFormEnabled(true)
            } else if (eventType === 'agent-error') {
              let msg = 'Error: ' + String(parsed.error ?? 'unknown')
              ui.hideConfirmGate()
              pushRow(msg, 'error')
              ui.showInfo(msg, { kind: 'error' })
              ui.setFormEnabled(true)
            }
          } catch {
            // ignore parse errors
          }
        },
        { signal },
      )

      ui.setFormEnabled(true)
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      ui.showInfo('Error: ' + String(err), { kind: 'error' })
      ui.setFormEnabled(true)
    } finally {
      // The stream has settled: clear the "run active" marker so the
      // reconnect race guard (`if (abortController) return`) only skips the
      // probe while a stream is genuinely in flight.
      abortController = null
    }
  }

  // ── Command lifecycle ───────────────────────────────────────

  function beginCommand(url: string, formData: FormData) {
    ui.setFormEnabled(false)
    didNavigate = false
    currentRunId = null
    currentWorkflowId = null
    ui.hideConfirmGate()
    ui.clearStatusBar()
    resetPipeline()
    pushRow('Processing…', 'active')

    void startStream(url, { method: 'POST', body: formData })
  }

  // ── Reconnect ───────────────────────────────────────────────

  async function reconnect(signal: AbortSignal) {
    try {
      let res = await fetch(reconnectHref, {
        signal,
      })
      if (!res.ok) return
      let body = (await res.json()) as {
        status: string
        runId?: string
        workflowId?: string
        suspendPayload?: Record<string, unknown>
      }
      if (body.status !== 'suspended' || !body.runId || !body.suspendPayload) return

      // A stream (submit or resume) is already active: the admin submitted a
      // new command while the reconnect probe was in flight. Applying the
      // stale gate now would clobber the new run's state — drop it.
      if (abortController) return

      let frame = getPipelineFrame()
      if (!frame) return

      // Re-attach the stream closures to the suspended run so confirm/cancel
      // resume the correct run, then render the gate.
      currentRunId = body.runId
      currentWorkflowId = body.workflowId ?? null
      didNavigate = false
      ui.clearStatusBar()
      resetPipeline()
      showConfirmGate(body.suspendPayload)
    } catch {
      // ignore — reconnect is best-effort
    }
  }

  return {
    abort,
    hasRunPending: () => currentRunId !== null,
    resetPipelineRows: resetPipeline,
    beginCommand,
    resume: startResume,
    reconnect,
  }
}

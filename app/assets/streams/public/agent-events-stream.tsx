import { clientEntry, css, ref, type Handle } from 'remix/ui'
import { routes } from '../../../routes.ts'
import { theme } from '../../../ui/theme/theme.ts'
import { MAX_MESSAGE_LENGTH } from '../../../utils/message-limits.ts'
import { setupAutoGrowTextarea } from '../../../ui/auto-grow-textarea.ts'
import {
  formatTime,
  inferKind,
  kindGlyph,
  kindColor,
  pipelineLogHtml,
  type PipelineRow,
  type RowKind,
} from '../../../ui/agent-events-log.ts'
import { renderAgentApprovalCard } from '../../../ui/agent-chat/cards.ts'
import { readEventStream } from './read-sse.ts'

export const AgentEventsStream = clientEntry(
  import.meta.url + '#AgentEventsStream',
  function AgentEventsStream(handle: Handle) {
    let abortController: AbortController | null = null
    let didNavigate = false
    let currentRunId: string | null = null
    let currentWorkflowId: string | null = null
    let autoGrowReset: (() => void) | null = null

    function getStatusBar() {
      return document.getElementById('ae-status-bar')
    }

    function getStatusBody() {
      return (
        document.getElementById('ae-status-body') ??
        (document.getElementById('ae-status-bar') as HTMLElement | null)
      )
    }

    function setFormEnabled(enabled: boolean) {
      let input = document.getElementById('agent-events-input') as HTMLTextAreaElement | null
      let submit = document.getElementById('agent-events-submit') as HTMLButtonElement | null
      if (input) input.disabled = !enabled
      if (submit) {
        submit.disabled = !enabled
        submit.textContent = enabled ? 'Send' : 'Sending…'
      }
    }

    function clearStatusBar() {
      let body = getStatusBody()
      if (body) body.innerHTML = ''
    }

    function updateCharCount() {
      let input = document.getElementById('agent-events-input') as HTMLTextAreaElement | null
      let counter = document.getElementById('ae-char-count')
      if (!input || !counter) return
      let len = input.value.length
      counter.textContent = `${len} / ${MAX_MESSAGE_LENGTH}`
      counter.style.color = len >= MAX_MESSAGE_LENGTH ? theme.colors.action.danger.background : ''
    }

    function hideConfirmGate() {
      let gate = document.getElementById('ae-confirm-gate') as HTMLElement | null
      if (gate) gate.style.display = 'none'
    }

    // ── Live pipeline rendered into the main frame ──────────────

    let pipelineRows: PipelineRow[] = []

    function getPipelineFrame() {
      let container = document.getElementById('agent-events-frame-container')
      let activeFrame = container?.getAttribute('data-active-frame') ?? 'agent-events-panel'
      return handle.frames.get(activeFrame)
    }

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
        showInfo(text, { kind })
      } else {
        renderPipeline()
      }
    }

    function resetPipeline() {
      pipelineRows = []
    }

    function showInfo(text: string, opts?: { kind?: RowKind }) {
      let bar = getStatusBody()
      if (!bar) return
      let kind = opts?.kind ?? inferKind(text)

      let row = document.createElement('div')
      row.style.display = 'flex'
      row.style.alignItems = 'baseline'
      row.style.gap = '0.5rem'
      row.style.padding = '0.25rem 0'
      row.style.fontSize = '0.8125rem'
      row.style.lineHeight = '1.4'

      let glyph = document.createElement('span')
      glyph.textContent = kindGlyph(kind)
      glyph.style.flexShrink = '0'
      glyph.style.width = '1rem'
      glyph.style.textAlign = 'center'
      glyph.style.fontWeight = '600'
      glyph.style.color = kindColor(kind)

      let time = document.createElement('span')
      time.textContent = formatTime(Date.now())
      time.style.flexShrink = '0'
      time.style.minWidth = '4.5rem'
      time.style.fontFamily = theme.fontFamily.mono
      time.style.fontSize = '0.75rem'
      time.style.color = theme.colors.text.muted

      let message = document.createElement('span')
      message.textContent = text
      message.style.color =
        kind === 'error' ? theme.colors.action.danger.background : theme.colors.text.primary
      message.style.wordBreak = 'break-word'

      row.appendChild(glyph)
      row.appendChild(time)
      row.appendChild(message)
      bar.appendChild(row)
      bar.scrollTop = bar.scrollHeight
    }

    function showConfirmGate(suspendPayload: Record<string, unknown>) {
      let container = document.getElementById('ae-confirm-gate') as HTMLElement | null
      if (!container) {
        // Fallback for hosts without the dedicated container (tests): render
        // the gate at the top of the status bar so it stays discoverable.
        container = document.createElement('div')
        container.id = 'ae-confirm-gate'
        let bar = getStatusBar()
        if (!bar) return
        bar.prepend(container)
      }

      renderAgentApprovalCard({
        variant: 'workflow',
        container,
        question: String(suspendPayload.question || 'Confirm?'),
        actionType: String(suspendPayload.actionType || ''),
        targetUserName: String(suspendPayload.targetUserName || ''),
        pendingCount: Number(suspendPayload.pendingCount || 0),
        onConfirm: () => handleResume(true),
        onCancel: () => handleResume(false),
      })

      // The workflow is not streaming anything while it waits at the gate, so
      // "Sending…" is misleading. Keep the composer disabled (a run is pending)
      // but say so honestly.
      let submit = document.getElementById('agent-events-submit') as HTMLButtonElement | null
      if (submit && submit.disabled) submit.textContent = 'Waiting…'
    }

    function abortStream() {
      if (abortController) {
        abortController.abort()
        abortController = null
      }
    }

    async function handleResume(confirmed: boolean) {
      if (!currentRunId) return
      setFormEnabled(false)

      let body = new FormData()
      body.set('runId', currentRunId)
      body.set('confirmed', String(confirmed))
      if (currentWorkflowId) body.set('workflowId', currentWorkflowId)
      startStream(routes.admin.agentEvents.resume.href(), { method: 'POST', body })
    }

    function restoreFilterValue(url: string) {
      let filterValue = new URL(url, window.location.origin).searchParams.get('filter')
      if (filterValue !== null && filterValue !== 'enabled' && filterValue !== 'disabled') {
        for (let input of document.querySelectorAll<HTMLInputElement>('input[name="filter"]')) {
          input.value = filterValue
        }
      }
    }

    async function startStream(url: string, init: RequestInit) {
      abortStream()
      abortController = new AbortController()
      let signal = abortController.signal

      try {
        let res = await fetch(url, {
          ...init,
          signal,
          headers: { 'X-Sse-Request': '1', ...(init.headers ?? {}) },
        })
        if (!res.ok) {
          let text = await res.text().catch(() => '')
          let match = text.match(/data: (.*)\n/)
          let msg = match ? (JSON.parse(match[1]!).error ?? res.statusText) : res.statusText
          showInfo('Error: ' + msg, { kind: 'error' })
          setFormEnabled(true)
          return
        }

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
                hideConfirmGate()
                if (parsed.success) {
                  showInfo('Action completed', { kind: 'success' })
                  let container = document.getElementById('agent-events-frame-container')
                  let activeFrame =
                    container?.getAttribute('data-active-frame') ?? 'agent-events-panel'
                  let theFrame = handle.frames.get(activeFrame)
                  if (theFrame) theFrame.reload().catch(() => {})
                } else {
                  showInfo('Action failed: ' + String(parsed.error ?? 'unknown'), { kind: 'error' })
                }
              } else if (eventType === 'workflow-error') {
                currentRunId = null
                hideConfirmGate()
                showInfo('Action failed: ' + String(parsed.error ?? 'unknown'), { kind: 'error' })
              } else if (eventType === 'navigate') {
                didNavigate = true
                let href = String(parsed.href)
                let target = (parsed.target as string) || 'agent-events-panel'
                showInfo('Navigating to ' + href + '...', { kind: 'info' })
                let frame = target ? handle.frames.get(target) : handle.frame
                if (frame) {
                  frame.src = href
                  frame.reload().then(
                    () => restoreFilterValue(href),
                    (err) => showInfo('Navigation failed: ' + String(err), { kind: 'error' }),
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
                hideConfirmGate()
                setFormEnabled(true)
              } else if (eventType === 'agent-error') {
                let msg = 'Error: ' + String(parsed.error ?? 'unknown')
                hideConfirmGate()
                pushRow(msg, 'error')
                showInfo(msg, { kind: 'error' })
                setFormEnabled(true)
              }
            } catch {
              // ignore parse errors
            }
          },
          { signal },
        )

        setFormEnabled(true)
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        showInfo('Error: ' + String(err), { kind: 'error' })
        setFormEnabled(true)
      }
    }

    async function handleFormSubmit(e: Event) {
      e.preventDefault()
      let form = e.target as HTMLFormElement
      let formData = new FormData(form)
      let message = formData.get('message')?.toString().trim()
      if (!message) return

      let textarea = document.getElementById('agent-events-input') as HTMLTextAreaElement | null
      if (textarea) {
        textarea.value = ''
        autoGrowReset?.()
      }
      setFormEnabled(false)
      didNavigate = false
      currentRunId = null
      currentWorkflowId = null
      hideConfirmGate()
      clearStatusBar()
      resetPipeline()
      updateCharCount()
      pushRow('Processing…', 'active')

      startStream(routes.admin.agentEvents.index.href(), { method: 'POST', body: formData })
    }

    function prefillFromChip(command: string) {
      let textarea = document.getElementById('agent-events-input') as HTMLTextAreaElement | null
      if (!textarea) return
      // Programmatic value assignment bypasses the maxLength attribute; clamp so
      // a chip can never produce a value the server would reject.
      textarea.value = command.slice(0, MAX_MESSAGE_LENGTH)
      autoGrowReset?.()
      updateCharCount()
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }

    function clearLog() {
      // A run may still be suspended server-side awaiting confirmation; hiding
      // the gate would make a pending destructive action invisible. Keep the
      // log/gate intact until the run reaches a terminal state.
      if (currentRunId) return
      hideConfirmGate()
      clearStatusBar()
      resetPipeline()
      let frame = getPipelineFrame()
      if (frame) frame.reload().catch(() => {})
    }

    function handleTextareaKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        let form = document.getElementById('agent-events-form') as HTMLFormElement | null
        if (form) form.requestSubmit()
      }
    }

    async function checkReconnect(handle: Handle) {
      try {
        let res = await fetch(routes.admin.agentEvents.reconnect.href(), {
          signal: handle.signal,
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

        let container = document.getElementById('agent-events-frame-container')
        let activeFrame = container?.getAttribute('data-active-frame') ?? 'agent-events-panel'
        let frame = handle.frames.get(activeFrame)
        if (!frame) return

        // Re-attach the stream closures to the suspended run so confirm/cancel
        // resume the correct run, then render the gate.
        currentRunId = body.runId
        currentWorkflowId = body.workflowId ?? null
        didNavigate = false
        clearStatusBar()
        resetPipeline()
        showConfirmGate(body.suspendPayload)
      } catch {
        // ignore — reconnect is best-effort
      }
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let form = document.getElementById('agent-events-form') as HTMLFormElement | null
            if (form) {
              form.addEventListener('submit', handleFormSubmit, { signal: handle.signal })
            }

            let textarea = document.getElementById(
              'agent-events-input',
            ) as HTMLTextAreaElement | null
            if (textarea) {
              textarea.addEventListener('keydown', handleTextareaKeydown, { signal: handle.signal })
              textarea.addEventListener('input', updateCharCount, { signal: handle.signal })
              autoGrowReset = setupAutoGrowTextarea(textarea, { signal: handle.signal }).reset
            }

            let clearBtn = document.getElementById('ae-clear-log') as HTMLButtonElement | null
            if (clearBtn) {
              clearBtn.addEventListener('click', clearLog, { signal: handle.signal })
            }

            // Example-command chips live inside the panel frame (same document);
            // delegate clicks so they prefill the composer even when the frame
            // re-resolves its content.
            document.addEventListener(
              'click',
              (e) => {
                let target = (e.target as HTMLElement | null)?.closest?.(
                  '[data-agent-command]',
                ) as HTMLElement | null
                if (!target) return
                let command = target.getAttribute('data-agent-command')
                if (command) prefillFromChip(command)
              },
              { signal: handle.signal },
            )

            // Reconnect after a reload / browser change / server restart: if a
            // workflow run is still suspended at the confirm gate, re-render it
            // so the admin can confirm or cancel the pending action.
            checkReconnect(handle)
          }),
        ]}
      />
    )
  },
)

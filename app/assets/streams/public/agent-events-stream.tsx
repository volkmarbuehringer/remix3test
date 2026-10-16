import { clientEntry, css, ref, type Handle } from 'remix/component'
import { frames, routes } from '../../../routes.ts'
import { activeFrameName } from '../../../utils/frame-utils.ts'
import { theme } from '../../../ui/theme/theme.ts'
import { MAX_MESSAGE_LENGTH } from '../../../utils/message-limits.ts'
import { setupAutoGrowTextarea } from '../../../ui/auto-grow-textarea.ts'
import {
  formatTime,
  inferKind,
  kindGlyph,
  kindColor,
  type RowKind,
} from '../../../ui/agent-events-log.ts'
import { renderAgentApprovalCard } from '../../../ui/agent-chat/cards.ts'
import {
  type AgentEventsUiDelegate,
  type AgentEventsFrame,
  createAgentEventsStreamController,
} from './agent-events-controller.ts'

export const AgentEventsStream = clientEntry(
  import.meta.url + '#AgentEventsStream',
  function AgentEventsStream(handle: Handle) {
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

    function getPipelineFrame(): AgentEventsFrame | null {
      return (
        handle.frames.get(
          activeFrameName('agent-events-frame-container', frames.agentEventsPanel),
        ) ?? null
      )
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

    function showConfirmGate(
      suspendPayload: Record<string, unknown>,
      onConfirm: () => void,
      onCancel: () => void,
    ) {
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
        onConfirm,
        onCancel,
      })
    }

    // ── Delegate + controller ──────────────────────────────────

    let delegate: AgentEventsUiDelegate = {
      showInfo,
      hideConfirmGate,
      renderConfirmGate: showConfirmGate,
      setFormEnabled,
      clearStatusBar,
    }

    let controller = createAgentEventsStreamController(delegate, {
      getPipelineFrame,
      getFrame: (target) => (target ? (handle.frames.get(target) ?? null) : (handle.frame ?? null)),
      resumeHref: routes.admin.agentEvents.resume.href(),
      reconnectHref: routes.admin.agentEvents.reconnect.href(),
    })

    // ── Event handlers ─────────────────────────────────────────

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
      updateCharCount()

      // beginCommand owns the gate/status/pipeline reset (hideConfirmGate,
      // clearStatusBar, resetPipeline, 'Processing…' row) and the run state.
      controller.beginCommand(routes.admin.agentEvents.index.href(), formData)
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
      if (controller.hasRunPending()) return
      hideConfirmGate()
      clearStatusBar()
      controller.resetPipelineRows()
      let frame = getPipelineFrame()
      if (frame) {
        frame.reload().catch((err) => {
          showInfo('Log reset failed: ' + String(err), { kind: 'error' })
        })
      }
    }

    function handleTextareaKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        let form = document.getElementById('agent-events-form') as HTMLFormElement | null
        if (form) form.requestSubmit()
      }
    }

    async function checkReconnect(componentHandle: Handle) {
      await controller.reconnect(componentHandle.signal)
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
            void checkReconnect(handle)
          }),
        ]}
      />
    )
  },
)

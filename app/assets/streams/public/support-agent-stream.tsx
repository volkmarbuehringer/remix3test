import { clientEntry, css, ref, type Handle } from 'remix/component'
import { theme } from '../../../ui/theme/theme.ts'
import { setupAutoGrowTextarea } from '../../../ui/auto-grow-textarea.ts'
import { frames, routes } from '../../../routes.ts'
import { activeFrameName } from '../../../utils/frame-utils.ts'
import { renderMarkdownToDom } from './markdown-dom.ts'
import { renderAgentApprovalCard, renderAgentQuestionCard } from '../../../ui/agent-chat/cards.ts'
import {
  AGENT_FORM_ATTRIBUTE,
  PANEL_CONTAINER_ID,
  deferPanelFormToRuntime,
  type SupportAgentUiDelegate,
  type SupportAgentFrame,
  createSupportAgentStreamController,
} from './support-agent-controller.ts'

export const SupportAgentStream = clientEntry(
  import.meta.url + '#SupportAgentStream',
  function SupportAgentStream(handle: Handle) {
    let autoGrowReset: (() => void) | null = null

    let currentAgentMessageEl: HTMLElement | null = null
    let thinkingEl: HTMLElement | null = null

    // ── Helpers ──────────────────────────────────────────────────

    function getChat() {
      return document.getElementById('chat-messages')
    }

    function scrollToBottom(force?: boolean) {
      let chat = getChat()
      if (!chat) return
      if (!force) {
        let threshold = 50
        let atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < threshold
        if (!atBottom) return
      }
      chat.scrollTop = chat.scrollHeight
    }

    function setFormEnabled(enabled: boolean) {
      let input = document.getElementById('support-agent-input') as HTMLTextAreaElement | null
      let submit = document.getElementById('support-agent-submit') as HTMLButtonElement | null
      if (input) input.disabled = !enabled
      if (submit) {
        submit.disabled = !enabled
        submit.textContent = enabled ? 'Senden' : 'Senden …'
      }
      let chat = getChat()
      if (chat) {
        if (enabled) chat.removeAttribute('aria-busy')
        else chat.setAttribute('aria-busy', 'true')
      }
    }

    // ── Thinking indicator ────────────────────────────────────────

    let THINKING_ID = 'support-agent-thinking'

    function ensureSupportStyles() {
      if (document.getElementById('support-agent-styles')) return
      let style = document.createElement('style')
      style.id = 'support-agent-styles'
      style.textContent =
        `@keyframes support-agent-dots { 0%,20% {content:''} 40% {content:'.'} ` +
        `60% {content:'..'} 80%,100% {content:'...'} } ` +
        `.support-agent-dots::after { content:''; animation: support-agent-dots 1.2s infinite; }`
      document.head.appendChild(style)
    }

    function showThinking() {
      let chat = getChat()
      if (!chat || thinkingEl) return
      let el = document.createElement('div')
      el.id = THINKING_ID
      el.style.cssText =
        `max-width:75%;align-self:flex-start;padding:0.5rem 0.75rem;` +
        `border-radius:8px 8px 8px 4px;background:${theme.surface.lvl1};` +
        `border:1px solid ${theme.colors.border.subtle};font-size:0.875rem;` +
        `color:${theme.colors.text.secondary};`
      let label = document.createElement('span')
      label.setAttribute('aria-live', 'polite')
      label.textContent = 'Assistent denkt nach'
      let dots = document.createElement('span')
      dots.className = 'support-agent-dots'
      label.appendChild(dots)
      el.appendChild(label)
      chat.appendChild(el)
      thinkingEl = el
      scrollToBottom(true)
    }

    function hideThinking() {
      if (thinkingEl) {
        thinkingEl.remove()
        thinkingEl = null
      }
    }

    // ── Preview pane ─────────────────────────────────────────────

    function setPreviewVisible(visible: boolean, path?: string) {
      let pane = document.getElementById('support-agent-preview')
      if (!pane) return
      if (visible) {
        pane.hidden = false
        pane.setAttribute('aria-hidden', 'false')
        let pathEl = document.getElementById('support-agent-preview-path')
        if (pathEl && path) pathEl.textContent = path
      } else {
        pane.hidden = true
        pane.setAttribute('aria-hidden', 'true')
      }
    }

    function handlePreviewClose() {
      setPreviewVisible(false)
      let frame = handle.frames.get(frames.supportAgentPanel)
      if (frame) {
        frame.reload({ src: routes.admin.supportAgent.panel.href() }).catch((err) => {
          delegate.appendStatusMessage('Panel-Reload fehlgeschlagen: ' + String(err), true)
        })
      }
    }

    // ── Active panel frame ───────────────────────────────────────

    /**
     * The frame the panel content currently lives in: resolved through the
     * container's `data-active-frame`, exactly like agent-events-stream's
     * `getPipelineFrame()`, so the container-id/fallback pair cannot drift.
     */
    function getActivePanelFrame(): SupportAgentFrame | null {
      return (
        handle.frames.get(activeFrameName(PANEL_CONTAINER_ID, frames.supportAgentPanel)) ?? null
      )
    }

    let delegate: SupportAgentUiDelegate = {
      showThinking,
      hideThinking,
      appendAgentMessage,
      updateLastAgentMessage,
      finalizeAgentMessage,
      clearAgentMessageEl: () => {
        currentAgentMessageEl = null
      },
      appendStatusMessage,
      appendUserMessage,
      setFormEnabled,
      showErrorWithRetry,
      setPreviewVisible,
      renderQuestionCard: (mount, data) => {
        renderAgentQuestionCard({
          variant: 'support',
          mount,
          runId: data.runId ?? '',
          toolCallId: data.toolCallId,
          threadId: data.threadId,
          question: data.question,
          options: data.options,
          selectionMode: data.selectionMode,
        })
      },
      renderApprovalCard: (mount, data) => {
        renderAgentApprovalCard({
          variant: 'support',
          mount,
          runId: data.runId ?? '',
          toolCallId: data.toolCallId,
          threadId: data.threadId,
          toolName: data.toolName,
        })
      },
      renderToolResult,
      hasQuestionGate: () => document.getElementById('support-agent-question') !== null,
      hasApprovalGate: () => document.getElementById('support-agent-approval') !== null,
      removeQuestionGate: () => {
        let card = document.getElementById('support-agent-question')
        if (card) card.remove()
      },
      removeApprovalGate: () => {
        let card = document.getElementById('support-agent-approval')
        if (card) card.remove()
      },
    }

    let controller = createSupportAgentStreamController(delegate, {
      signal: handle.signal,
      getActivePanelFrame,
      getFrame: (target) => (target ? (handle.frames.get(target) ?? null) : (handle.frame ?? null)),
      reconnectHref: '/admin/support-agent/reconnect',
    })

    // ── Error + retry ────────────────────────────────────────────

    function showErrorWithRetry(message: string, retry: () => void, retryDelayMs = 2000) {
      let chat = getChat()
      if (!chat) return

      let row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;'
      let msgEl = document.createElement('span')
      msgEl.textContent = message
      msgEl.style.cssText = `font-size:0.8125rem;color:${theme.colors.action.danger.background};font-style:italic;`
      row.appendChild(msgEl)

      let retryBtn = document.createElement('button')
      retryBtn.type = 'button'
      retryBtn.textContent = 'Erneut versuchen'
      retryBtn.style.cssText =
        `padding:0.25rem 0.75rem;background:${theme.surface.lvl1};` +
        `color:${theme.colors.text.primary};border:1px solid ${theme.colors.border.default};` +
        `border-radius:6px;font-size:0.8125rem;cursor:pointer;`
      retryBtn.disabled = true
      row.appendChild(retryBtn)
      chat.appendChild(row)
      scrollToBottom(true)

      let remaining = Math.ceil(retryDelayMs / 1000)
      let timer: number | null = null
      let tick = () => {
        remaining--
        if (remaining <= 0) {
          retryBtn.disabled = false
          retryBtn.textContent = 'Erneut versuchen'
          return
        }
        retryBtn.textContent = `Erneut versuchen (${remaining}s)`
        timer = window.setTimeout(tick, 1000)
      }
      timer = window.setTimeout(tick, 1000)
      let clearTimer = () => {
        if (timer !== null) {
          clearTimeout(timer)
          timer = null
        }
      }
      handle.signal.addEventListener(
        'abort',
        () => {
          clearTimer()
          row.remove()
        },
        { once: true },
      )
      retryBtn.onclick = () => {
        clearTimer()
        row.remove()
        retry()
      }
    }

    // ── Message rendering ────────────────────────────────────────

    function appendUserMessage(text: string) {
      let chat = getChat()
      if (!chat) return

      let bubble = document.createElement('div')
      bubble.textContent = text
      bubble.style.maxWidth = '75%'
      bubble.style.alignSelf = 'flex-end'
      bubble.style.padding = '0.5rem 0.75rem'
      bubble.style.borderRadius = '8px 8px 4px 8px'
      bubble.style.background = theme.colors.action.primary.background
      bubble.style.color = theme.colors.action.primary.foreground
      bubble.style.fontSize = '0.875rem'
      bubble.style.lineHeight = '1.4'
      bubble.style.whiteSpace = 'pre-wrap'
      bubble.style.wordBreak = 'break-word'

      chat.appendChild(bubble)
      scrollToBottom(true)
    }

    function appendAgentMessage(): HTMLElement {
      let chat = getChat()
      if (!chat) throw new Error('chat-messages container not found')

      let bubble = document.createElement('div')
      bubble.style.maxWidth = '75%'
      bubble.style.alignSelf = 'flex-start'
      bubble.style.padding = '0.5rem 0.75rem'
      bubble.style.borderRadius = '8px 8px 8px 4px'
      bubble.style.background = theme.surface.lvl1
      bubble.style.border = '1px solid ' + theme.colors.border.subtle
      bubble.style.fontSize = '0.875rem'
      bubble.style.lineHeight = '1.4'
      bubble.style.whiteSpace = 'pre-wrap'
      bubble.style.wordBreak = 'break-word'

      chat.appendChild(bubble)
      currentAgentMessageEl = bubble
      scrollToBottom(true)
      return bubble
    }

    function updateLastAgentMessage(text: string) {
      if (currentAgentMessageEl) {
        currentAgentMessageEl.textContent = text
        if (!currentAgentMessageEl.dataset.kind) currentAgentMessageEl.dataset.kind = 'text'
        scrollToBottom()
      }
    }

    /** Renders markdown into the final text bubble once the stream settles. */
    function finalizeAgentMessage() {
      if (currentAgentMessageEl && currentAgentMessageEl.dataset.kind === 'text') {
        let text = currentAgentMessageEl.textContent || ''
        currentAgentMessageEl.textContent = ''
        currentAgentMessageEl.dataset.kind = 'markdown'
        currentAgentMessageEl.appendChild(renderMarkdownToDom(text))
        scrollToBottom()
      }
    }

    function appendStatusMessage(text: string, isError?: boolean) {
      let chat = getChat()
      if (!chat) return

      let el = document.createElement('div')
      el.textContent = text
      el.style.fontSize = '0.8125rem'
      el.style.color = isError ? theme.colors.action.danger.background : theme.colors.text.muted
      el.style.padding = '0.25rem 0'
      el.style.fontStyle = 'italic'

      chat.appendChild(el)
      scrollToBottom(true)
    }

    // ── Structured tool-result rendering ─────────────────────────

    function renderToolResult(result: Record<string, unknown>) {
      let chat = getChat()
      if (!chat) return

      let card = document.createElement('div')
      card.style.maxWidth = '90%'
      card.style.alignSelf = 'flex-start'
      card.style.padding = '0.5rem 0.75rem'
      card.style.borderRadius = '8px 8px 8px 4px'
      card.style.background = theme.surface.lvl1
      card.style.border = '1px solid ' + theme.colors.border.subtle
      card.style.fontSize = '0.8125rem'
      card.style.lineHeight = '1.4'
      card.style.display = 'flex'
      card.style.flexDirection = 'column'
      card.style.gap = '0.375rem'

      // Generated PDF → downloadable artifact.
      if (typeof result.data === 'string' && typeof result.reportType === 'string') {
        let link = document.createElement('a')
        link.href = 'data:application/pdf;base64,' + result.data
        link.download = (result.filename as string) || 'bericht.pdf'
        link.textContent = '📄 ' + ((result.filename as string) || 'Bericht herunterladen')
        link.style.color = theme.colors.action.primary.background
        link.style.fontWeight = '600'
        link.style.textDecoration = 'none'
        card.appendChild(link)
        chat.appendChild(card)
        currentAgentMessageEl = card
        scrollToBottom(true)
        return
      }

      // Collection result → table (or empty state).
      let arrKey = Object.keys(result).find((k) => Array.isArray(result[k]))
      if (typeof result.count === 'number' && arrKey && Array.isArray(result[arrKey])) {
        let rows = (result[arrKey] as Record<string, unknown>[]) ?? []
        if (rows.length === 0) {
          card.textContent = '✅ Keine Ergebnisse gefunden.'
          chat.appendChild(card)
          currentAgentMessageEl = card
          scrollToBottom(true)
          return
        }
        let columns = Object.keys(rows[0] ?? {})
        let table = document.createElement('table')
        table.style.borderCollapse = 'collapse'
        table.style.width = '100%'
        table.style.fontSize = '0.75rem'
        let thead = document.createElement('thead')
        let headerRow = document.createElement('tr')
        for (let col of columns) {
          let th = document.createElement('th')
          th.textContent = col
          th.style.textAlign = 'left'
          th.style.padding = '4px 8px'
          th.style.borderBottom = '1px solid ' + theme.colors.border.default
          th.style.color = theme.colors.text.muted
          headerRow.appendChild(th)
        }
        thead.appendChild(headerRow)
        table.appendChild(thead)
        let tbody = document.createElement('tbody')
        for (let row of rows.slice(0, 20)) {
          let tr = document.createElement('tr')
          for (let col of columns) {
            let td = document.createElement('td')
            let v = row[col]
            td.textContent = v === null || v === undefined ? '' : String(v)
            td.style.padding = '4px 8px'
            td.style.borderBottom = '1px solid ' + theme.colors.border.subtle
            tr.appendChild(td)
          }
          tbody.appendChild(tr)
        }
        table.appendChild(tbody)
        card.appendChild(table)
        chat.appendChild(card)
        currentAgentMessageEl = card
        scrollToBottom(true)
        return
      }

      // Single-entity detail → key/value card.
      if (result.found === true) {
        let entityKey = Object.keys(result).find(
          (k) =>
            k !== 'found' && k !== 'message' && typeof result[k] === 'object' && result[k] !== null,
        )
        if (entityKey) {
          let entity = result[entityKey] as Record<string, unknown>
          let dl = document.createElement('dl')
          dl.style.margin = '0'
          dl.style.display = 'grid'
          dl.style.gridTemplateColumns = 'auto 1fr'
          dl.style.gap = '4px 12px'
          for (let [k, v] of Object.entries(entity)) {
            let dt = document.createElement('dt')
            dt.textContent = k
            dt.style.color = theme.colors.text.muted
            dt.style.fontWeight = '600'
            let dd = document.createElement('dd')
            dd.textContent = v === null || v === undefined ? '' : String(v)
            dd.style.margin = '0'
            dl.appendChild(dt)
            dl.appendChild(dd)
          }
          card.appendChild(dl)
          chat.appendChild(card)
          currentAgentMessageEl = card
          scrollToBottom(true)
          return
        }
      }

      // Fallback: plain text.
      card.textContent = JSON.stringify(result)
      chat.appendChild(card)
      currentAgentMessageEl = card
      scrollToBottom(true)
    }

    // ── Event handlers ───────────────────────────────────────────

    async function handleFormSubmit(e: Event) {
      e.preventDefault()
      let form = e.target as HTMLFormElement
      let formData = new FormData(form)
      let message = formData.get('message')?.toString().trim()
      if (!message) return

      let threadId = controller.resolveThreadId()
      if (threadId) formData.set('threadId', threadId)

      appendUserMessage(message)

      let textarea = document.getElementById('support-agent-input') as HTMLTextAreaElement | null
      if (textarea) {
        textarea.value = ''
        autoGrowReset?.()
        textarea.focus()
      }
      setFormEnabled(false)
      currentAgentMessageEl = null

      void controller.startStream('/admin/support-agent', { method: 'POST', body: formData })
    }

    function handleTextareaKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        let form = document.getElementById('support-agent-form') as HTMLFormElement | null
        if (form) form.requestSubmit()
      }
    }

    async function handleFrameFormSubmit(e: Event) {
      let form = (e.target as HTMLElement).closest('form')
      if (!form || form.id === 'support-agent-form') return
      if ((form.method || 'GET').toUpperCase() === 'GET') return
      if (controller.frameFormBusy()) return

      // Defer to the runtime's native frame interception only when the form
      // already targets the support panel itself and its controller takes no
      // part in agent flows: the submission then proceeds uncanceled and the
      // runtime frame-fetches the panel in place (with the real FormData and
      // CSRF token, but without X-Agent-Thread). Everything else is replayed —
      // a wrong/outside target would swap the outer admin-content frame and
      // tear down the host page, and an agent-aware create form deferred here
      // could never answer a pending ask_user gate.
      let agentAwareForm = form.hasAttribute(AGENT_FORM_ATTRIBUTE)
      if (
        deferPanelFormToRuntime(
          form.getAttribute('data-rmx-target'),
          agentAwareForm,
          frames.supportAgentPanel,
        )
      ) {
        return
      }

      e.preventDefault()
      await controller.frameFormSubmit(form)
    }

    // ── Empty-state prompts / controls ──────────────────────────

    function handleNewConversation() {
      window.location.assign(routes.admin.supportAgent.index.href())
    }

    /** Example chips in the panel empty state submit their prompt into the chat. */
    function handlePanelClick(e: MouseEvent) {
      let target = (e.target as HTMLElement).closest('[data-support-prompt]') as HTMLElement | null
      if (!target) return
      let prompt = target.getAttribute('data-support-prompt')
      if (!prompt) return
      let textarea = document.getElementById('support-agent-input') as HTMLTextAreaElement | null
      if (textarea) {
        textarea.value = prompt
        autoGrowReset?.()
      }
      let form = document.getElementById('support-agent-form') as HTMLFormElement | null
      form?.requestSubmit()
    }

    // ── Return (lifecycle) ───────────────────────────────────────

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((_el) => {
            ensureSupportStyles()

            let form = document.getElementById('support-agent-form') as HTMLFormElement | null
            if (form) {
              form.addEventListener('submit', handleFormSubmit, {
                signal: handle.signal,
              })
            }

            let textarea = document.getElementById(
              'support-agent-input',
            ) as HTMLTextAreaElement | null
            if (textarea) {
              textarea.addEventListener('keydown', handleTextareaKeydown, {
                signal: handle.signal,
              })
              autoGrowReset = setupAutoGrowTextarea(textarea, { signal: handle.signal }).reset
            }

            let container = document.getElementById(PANEL_CONTAINER_ID)
            if (container) {
              container.addEventListener('submit', handleFrameFormSubmit, {
                signal: handle.signal,
              })
              container.addEventListener('click', handlePanelClick, {
                signal: handle.signal,
              })
            }

            let chat = getChat()
            if (chat) {
              // Upgrade the native gate forms to the SSE transport. The elements
              // stay real forms, so a no-JS submit still posts to
              // /admin/support-agent/tool-decision or /answer via the form action.
              chat.addEventListener(
                'submit',
                (e) => {
                  let gateForm = e.target
                  if (!(gateForm instanceof HTMLFormElement)) return
                  if (gateForm.id === 'support-agent-approval') {
                    e.preventDefault()
                    let submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null
                    void controller.toolDecision(
                      submitter?.value === 'decline' ? 'decline' : 'approve',
                      gateForm,
                    )
                  } else if (gateForm.id === 'support-agent-question') {
                    e.preventDefault()
                    void controller.answer(gateForm)
                  }
                },
                { signal: handle.signal },
              )
            }

            let closeBtn = document.getElementById('support-agent-preview-close')
            if (closeBtn) {
              closeBtn.addEventListener('click', handlePreviewClose, {
                signal: handle.signal,
              })
            }

            let newBtn = document.getElementById('support-agent-new')
            if (newBtn) {
              newBtn.addEventListener('click', handleNewConversation, {
                signal: handle.signal,
              })
            }

            // Surface any pending gate (tool decision or question) that survived
            // a reload / tab switch / server restart.
            void controller.reconnect()
          }),
        ]}
      />
    )
  },
)

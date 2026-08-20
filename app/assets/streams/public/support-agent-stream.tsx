import { clientEntry, css, ref, type Handle } from 'remix/ui'
import { theme } from '../../../ui/theme/theme.ts'
import { setupAutoGrowTextarea } from '../../../ui/auto-grow-textarea.ts'

export const SupportAgentStream = clientEntry(
  import.meta.url + '#SupportAgentStream',
  function SupportAgentStream(handle: Handle) {
    let abortController: AbortController | null = null
    let currentRunId: string | null = null
    let currentThreadId: string | null = null
    let didNavigate: boolean = false
    let autoGrowReset: (() => void) | null = null

    let submitting: boolean = false

    let currentAgentMessageEl: HTMLElement | null = null

    let pendingQuestion: {
      runId: string
      toolCallId?: string
      selectionMode: string
    } | null = null

    // ── Helpers ──────────────────────────────────────────────────────

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

    function abortStream() {
      if (abortController) {
        abortController.abort()
        abortController = null
      }
    }

    function setFormEnabled(enabled: boolean) {
      let input = document.getElementById('support-agent-input') as HTMLTextAreaElement | null
      let submit = document.getElementById('support-agent-submit') as HTMLButtonElement | null
      if (input) input.disabled = !enabled
      if (submit) submit.disabled = !enabled
    }

    // ── Message rendering ────────────────────────────────────────────

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

    function appendAgentMessage(text?: string): HTMLElement {
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
      if (text) bubble.textContent = text

      chat.appendChild(bubble)
      currentAgentMessageEl = bubble
      scrollToBottom(true)
      return bubble
    }

    function updateLastAgentMessage(text: string) {
      if (currentAgentMessageEl) {
        currentAgentMessageEl.textContent = text
        scrollToBottom()
      }
    }

    function replaceAgentMessageContent(fn: (el: HTMLElement) => void) {
      if (currentAgentMessageEl) {
        currentAgentMessageEl.textContent = ''
        fn(currentAgentMessageEl)
        scrollToBottom(true)
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

    // ── Question rendering (inline in agent bubble) ───────────────────

    function showQuestion(data: {
      runId?: string
      toolCallId?: string
      question: string
      options?: { label: string; description?: string }[] | null
      selectionMode: string
    }) {
      pendingQuestion = {
        runId: data.runId || currentRunId || '',
        toolCallId: data.toolCallId,
        selectionMode: data.selectionMode,
      }

      if (!data.options || data.options.length === 0) {
        replaceAgentMessageContent((el) => {
          let questionLine = document.createElement('div')
          questionLine.textContent = '❓ ' + data.question
          questionLine.style.fontWeight = '600'
          questionLine.style.marginBottom = '8px'
          el.appendChild(questionLine)

          let promptBtn = document.createElement('button')
          promptBtn.textContent = 'Klicken zum Antworten...'
          promptBtn.style.padding = '4px 14px'
          promptBtn.style.border = '1px solid ' + theme.colors.border.default
          promptBtn.style.borderRadius = '4px'
          promptBtn.style.cursor = 'pointer'
          promptBtn.style.background = theme.surface.lvl1
          promptBtn.style.color = theme.colors.text.primary
          promptBtn.style.fontSize = '0.8125rem'
          promptBtn.style.alignSelf = 'flex-start'
          promptBtn.onclick = () => {
            let answer = prompt(data.question)
            if (answer) handleAnswer(answer)
          }
          el.appendChild(promptBtn)
        })
        return
      }

      let isMulti = data.selectionMode === 'multi_select'
      let inputType = isMulti ? 'checkbox' : 'radio'
      let MAX_OPTIONS = 50
      let optionList = data.options.slice(0, MAX_OPTIONS)

      try {
        replaceAgentMessageContent((el) => {
          let questionEl = document.createElement('div')
          questionEl.textContent = data.question
          questionEl.style.fontWeight = '600'
          questionEl.style.marginBottom = '8px'
          questionEl.style.fontSize = '0.875rem'
          el.appendChild(questionEl)

          for (let opt of optionList) {
            let label = document.createElement('label')
            label.style.display = 'flex'
            label.style.alignItems = 'center'
            label.style.gap = '6px'
            label.style.cursor = 'pointer'
            label.style.fontSize = '0.8125rem'
            label.style.padding = '2px 0'

            let input = document.createElement('input')
            input.type = inputType
            input.name = 'q-option'
            input.value = opt.label

            let span = document.createElement('span')
            span.textContent = opt.label

            label.appendChild(input)
            label.appendChild(span)

            if (opt.description) {
              let desc = document.createElement('span')
              desc.textContent = '— ' + opt.description
              desc.style.color = theme.colors.text.muted
              desc.style.fontSize = '0.75rem'
              label.appendChild(desc)
            }

            el.appendChild(label)
          }

          let btn = document.createElement('button')
          btn.textContent = 'Bestätigen'
          btn.style.padding = '4px 14px'
          btn.style.marginTop = '6px'
          btn.style.border = '1px solid ' + theme.colors.border.default
          btn.style.borderRadius = '4px'
          btn.style.cursor = 'pointer'
          btn.style.background = theme.surface.lvl1
          btn.style.color = theme.colors.text.primary
          btn.style.fontSize = '0.8125rem'
          btn.style.alignSelf = 'flex-start'
          btn.onclick = () => {
            let checked = el.querySelectorAll(
              'input[name="q-option"]:checked',
            ) as NodeListOf<HTMLInputElement>
            if (checked.length === 0) return

            let selected = [...checked].map((el2) => el2.value)
            let answer = isMulti ? JSON.stringify(selected) : selected[0]

            el.innerHTML = ''
            handleAnswer(answer)
          }
          el.appendChild(btn)
        })
      } catch (err) {
        pendingQuestion = null
        appendStatusMessage('Fehler beim Anzeigen der Frage: ' + String(err), true)
      }
    }

    // ── Suspension rendering (inline in agent bubble) ────────────────

    function showSuspension(data: {
      toolCallId?: string
      toolName?: string
      args?: Record<string, unknown>
    }) {
      let isCancelUser = data.toolName === 'cancel_user_account'

      replaceAgentMessageContent((el) => {
        let warning = document.createElement('div')
        warning.textContent = isCancelUser
          ? '⚠ Benutzerkonto löschen?'
          : 'Tool erfordert Bestätigung: ' + (data.toolName || 'unbekannt')
        warning.style.fontWeight = '600'
        warning.style.marginBottom = '8px'
        warning.style.fontSize = '0.875rem'
        if (isCancelUser) {
          warning.style.color = theme.colors.action.danger.background
        }
        el.appendChild(warning)

        if (isCancelUser && data.args?.targetUserId) {
          let info = document.createElement('div')
          info.textContent =
            'Benutzer #' +
            data.args.targetUserId +
            ' löschen? Diese Aktion löscht alle zukünftigen Termine und deaktiviert den Login.'
          info.style.fontSize = '0.75rem'
          info.style.color = theme.colors.text.muted
          info.style.marginBottom = '8px'
          el.appendChild(info)
        }

        let actions = document.createElement('div')
        actions.style.display = 'flex'
        actions.style.gap = '8px'

        let approveBtn = document.createElement('button')
        approveBtn.textContent = isCancelUser ? '✔ Bestätigen' : '✔ Zulassen'
        approveBtn.style.padding = '4px 14px'
        approveBtn.style.border = 'none'
        approveBtn.style.borderRadius = '4px'
        approveBtn.style.cursor = 'pointer'
        if (isCancelUser) {
          approveBtn.style.background = '#dc3545'
          approveBtn.style.color = '#fff'
        } else {
          approveBtn.style.background = theme.colors.action.primary.background
          approveBtn.style.color = theme.colors.action.primary.foreground
        }
        approveBtn.style.fontSize = '0.8125rem'
        approveBtn.onclick = () => handleToolDecision('approve', data.toolCallId)
        actions.appendChild(approveBtn)

        let declineBtn = document.createElement('button')
        declineBtn.textContent = '✖ Ablehnen'
        declineBtn.style.padding = '4px 14px'
        declineBtn.style.border = '1px solid ' + theme.colors.border.default
        declineBtn.style.borderRadius = '4px'
        declineBtn.style.cursor = 'pointer'
        declineBtn.style.background = theme.surface.lvl1
        declineBtn.style.color = theme.colors.text.primary
        declineBtn.style.fontSize = '0.8125rem'
        declineBtn.onclick = () => handleToolDecision('decline', data.toolCallId)
        actions.appendChild(declineBtn)

        el.appendChild(actions)
      })
    }

    // ── Navigation ───────────────────────────────────────────────────

    function handleNavigate(data: { href: string; target?: string; history?: string }) {
      let { href, target, history: historyMode } = data
      if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
        appendStatusMessage('Ungültiger Navigationspfad: ' + href)
        return
      }

      let frame = target ? handle.frames.get(target) : handle.frame
      if (frame) {
        frame.src = href
        frame.reload().catch((err) => {
          appendStatusMessage('Navigation fehlgeschlagen: ' + String(err), true)
        })
        if (!historyMode || historyMode !== 'skip') {
          if (historyMode === 'replace') {
            window.history.replaceState({}, '', href)
          } else {
            window.history.pushState({}, '', href)
          }
        }
      } else {
        appendStatusMessage('Fehler: Frame nicht gefunden', true)
      }
    }

    // ── Tool decision / Answer handlers ───────────────────────────────

    async function handleToolDecision(decision: string, toolCallId?: string) {
      if (!currentRunId) return
      setFormEnabled(false)

      let label = decision === 'approve' ? 'Aktion genehmigt' : 'Aktion abgelehnt'
      appendUserMessage(label)

      let body = new FormData()
      body.set('runId', currentRunId)
      body.set('decision', decision)
      if (toolCallId) body.set('toolCallId', toolCallId)
      if (currentThreadId) body.set('threadId', currentThreadId)

      currentAgentMessageEl = null
      startStream('/admin/support-agent/tool-decision', { method: 'POST', body })
    }

    async function handleAnswer(answer: string) {
      if (!pendingQuestion || !answer) return
      let pq = pendingQuestion
      setFormEnabled(false)

      appendUserMessage(answer)

      let body = new FormData()
      body.set('runId', pq.runId)
      body.set('answer', answer)
      body.set('selectionMode', pq.selectionMode)
      if (pq.toolCallId) body.set('toolCallId', pq.toolCallId)
      if (currentThreadId) body.set('threadId', currentThreadId)

      currentAgentMessageEl = null
      startStream('/admin/support-agent/answer', { method: 'POST', body })
    }

    // ── SSE Stream ───────────────────────────────────────────────────

    async function startStream(url: string, init: RequestInit) {
      pendingQuestion = null
      abortStream()
      abortController = new AbortController()
      let signal = abortController.signal
      let streamingText = ''

      try {
        let res = await fetch(url, { ...init, signal })
        if (!res.ok) {
          let text = await res.text().catch(() => '')
          let match = text.match(/data: (.*)\n/)
          let msg = match ? (JSON.parse(match[1]).error ?? res.statusText) : res.statusText
          appendStatusMessage('Fehler: ' + msg, true)
          setFormEnabled(true)
          return
        }

        let reader = res.body?.getReader()
        if (!reader) {
          appendStatusMessage('Fehler: Kein Antwortstream', true)
          setFormEnabled(true)
          return
        }

        let decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          let { done, value } = await reader.read()
          if (done) break
          if (signal.aborted) {
            reader.cancel().catch(() => {})
            return
          }

          buffer += decoder.decode(value, { stream: true })
          let parts = buffer.split('\n\n')
          buffer = parts.pop() || ''

          for (let part of parts) {
            let lines = part.split('\n')
            let eventType = ''
            let data = ''
            for (let line of lines) {
              if (line.startsWith('event: ')) eventType = line.slice(7)
              else if (line.startsWith('data: ')) data = line.slice(6)
            }
            if (!data) continue

            try {
              let parsed = JSON.parse(data)

              if (eventType === 'start') {
                didNavigate = false
                if (parsed.runId) currentRunId = parsed.runId
                if (parsed.threadId) currentThreadId = parsed.threadId
                appendAgentMessage()
                streamingText = ''
              } else if (eventType === 'message') {
                streamingText += parsed.text || ''
                updateLastAgentMessage(streamingText)
              } else if (eventType === 'navigate') {
                didNavigate = true
                appendStatusMessage('Navigiere zu ' + parsed.href + '...')
                handleNavigate(parsed)
              } else if (eventType === 'question') {
                showQuestion(parsed)
                reader.cancel().catch(() => {})
                return
              } else if (eventType === 'suspension') {
                showSuspension(parsed)
                reader.cancel().catch(() => {})
                return
              } else if (eventType === 'tool-error') {
                appendStatusMessage('Tool-Fehler: ' + (parsed.error || 'unbekannt'), true)
              } else if (eventType === 'stream-error') {
                appendStatusMessage('Stream-Fehler: ' + (parsed.error || 'unbekannt'), true)
              } else if (eventType === 'complete') {
                if (pendingQuestion) return
                currentRunId = null
                currentThreadId = null
                currentAgentMessageEl = null
                if (!didNavigate) {
                  let container = document.getElementById('support-agent-frame-container')
                  let activeFrame =
                    container?.getAttribute('data-active-frame') ?? 'support-agent-panel'
                  let theFrame = handle.frames.get(activeFrame)
                  if (theFrame) theFrame.reload().catch(() => {})
                }
              } else if (eventType === 'agent-error') {
                appendStatusMessage('Fehler: ' + (parsed.error || 'unbekannt'), true)
              }
            } catch {
              if (eventType === 'message') {
                streamingText += data
                updateLastAgentMessage(streamingText)
              }
            }
          }
        }

        if (!pendingQuestion) {
          setFormEnabled(true)
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        appendStatusMessage('Fehler: ' + String(err), true)
        setFormEnabled(true)
      }
    }

    // ── Frame form submit ─────────────────────────────────────────────

    async function handleFrameFormSubmit(e: Event) {
      let form = (e.target as HTMLElement).closest('form')
      if (!form || form.id === 'support-agent-form') return

      if ((form.method || 'GET').toUpperCase() === 'GET') return

      if (submitting) return
      submitting = true
      e.preventDefault()

      let container = document.getElementById('support-agent-frame-container')
      let activeFrame = container?.getAttribute('data-active-frame') ?? 'support-agent-panel'
      let frame = handle.frames.get(activeFrame)

      appendStatusMessage('Formular wird gesendet...')

      try {
        let headers: Record<string, string> = {}
        if (currentThreadId) headers['X-Agent-Thread'] = currentThreadId
        let res = await fetch(form.action, {
          method: form.method || 'POST',
          headers,
          body: new FormData(form),
        })

        if (
          res.ok &&
          pendingQuestion &&
          currentRunId &&
          res.headers.get('Content-Type')?.includes('json')
        ) {
          let data = await res.json()
          let body = new FormData()
          body.set('runId', currentRunId)
          body.set('answer', JSON.stringify(data))
          body.set('selectionMode', 'single_select')
          if (pendingQuestion.toolCallId) body.set('toolCallId', pendingQuestion.toolCallId)
          if (currentThreadId) body.set('threadId', currentThreadId)
          startStream('/admin/support-agent/answer', { method: 'POST', body })
          return
        }
      } catch (err) {
        appendStatusMessage('Fehler: ' + String(err), true)
      } finally {
        submitting = false
      }

      if (frame) {
        await frame.reload().catch(() => {})
      }
    }

    // ── Main form submit ──────────────────────────────────────────────

    async function handleFormSubmit(e: Event) {
      e.preventDefault()
      let form = e.target as HTMLFormElement
      let formData = new FormData(form)
      let message = formData.get('message')?.toString().trim()
      if (!message) return

      if (currentThreadId) formData.set('threadId', currentThreadId)

      appendUserMessage(message)

      let textarea = document.getElementById('support-agent-input') as HTMLTextAreaElement | null
      if (textarea) {
        textarea.value = ''
        autoGrowReset?.()
      }
      setFormEnabled(false)
      currentAgentMessageEl = null

      startStream('/admin/support-agent', { method: 'POST', body: formData })
    }

    function handleTextareaKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        let form = document.getElementById('support-agent-form') as HTMLFormElement | null
        if (form) form.requestSubmit()
      }
    }

    // ── Return (lifecycle) ───────────────────────────────────────────

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
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

            let container = document.getElementById('support-agent-frame-container')
            if (container) {
              container.addEventListener('submit', handleFrameFormSubmit, {
                signal: handle.signal,
              })
            }
          }),
        ]}
      />
    )
  },
)

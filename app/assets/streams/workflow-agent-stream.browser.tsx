import { clientEntry, css, ref, type Handle } from 'remix/ui'
import { agentPrefillMap } from '../../ui/agent-prefill-store.browser.ts'

export const WorkflowAgentStream = clientEntry(
  import.meta.url + '#WorkflowAgentStream',
  function WorkflowAgentStream(handle: Handle) {
    let abortController: AbortController | null = null
    let currentRunId: string | null = null
    let currentThreadId: string | null = null
    let didNavigate: boolean = false
    let lastFilterValue: string = ''

    let currentAgentMessageEl: HTMLElement | null = null

    let pendingQuestion: {
      runId: string
      toolCallId?: string
      selectionMode: string
    } | null = null

    let pendingPdf: { filename: string; data: string } | null = null

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
      let input = document.getElementById('workflow-agent-input') as HTMLTextAreaElement | null
      let submit = document.getElementById('workflow-agent-submit') as HTMLButtonElement | null
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
      bubble.style.background = 'var(--rmx-color-action-primary-background, #0066cc)'
      bubble.style.color = 'var(--rmx-color-action-primary-foreground, #fff)'
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
      bubble.style.background = 'var(--rmx-surface-lvl1, #f5f5f5)'
      bubble.style.border = '1px solid var(--rmx-color-border-subtle, #e0e0e0)'
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
      el.style.color = isError
        ? 'var(--rmx-color-action-danger, #dc3545)'
        : 'var(--rmx-color-text-muted, #888)'
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
          questionLine.textContent = data.question
          questionLine.style.fontWeight = '600'
          questionLine.style.marginBottom = '8px'
          el.appendChild(questionLine)

          let promptBtn = document.createElement('button')
          promptBtn.textContent = 'Click to answer...'
          promptBtn.style.padding = '4px 14px'
          promptBtn.style.border = '1px solid var(--rmx-color-border-default, #ccc)'
          promptBtn.style.borderRadius = '4px'
          promptBtn.style.cursor = 'pointer'
          promptBtn.style.background = 'var(--rmx-surface-lvl1, #fff)'
          promptBtn.style.color = 'var(--rmx-color-text-primary, #333)'
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
      let MAX_OPTIONS = 50
      let optionList = data.options.slice(0, MAX_OPTIONS)
      let useButtons = !isMulti && optionList.length <= 6

      try {
        replaceAgentMessageContent((el) => {
          let questionEl = document.createElement('div')
          questionEl.textContent = data.question
          questionEl.style.fontWeight = '600'
          questionEl.style.marginBottom = '8px'
          questionEl.style.fontSize = '0.875rem'
          el.appendChild(questionEl)

          if (useButtons) {
            let btnGroup = document.createElement('div')
            btnGroup.style.display = 'flex'
            btnGroup.style.flexWrap = 'wrap'
            btnGroup.style.gap = '6px'

            for (let opt of optionList) {
              let optBtn = document.createElement('button')
              optBtn.textContent = opt.label
              optBtn.style.padding = '6px 14px'
              optBtn.style.border = '1px solid var(--rmx-color-border-default, #ccc)'
              optBtn.style.borderRadius = '4px'
              optBtn.style.cursor = 'pointer'
              optBtn.style.background = 'var(--rmx-surface-lvl1, #fff)'
              optBtn.style.color = 'var(--rmx-color-text-primary, #333)'
              optBtn.style.fontSize = '0.8125rem'
              optBtn.style.whiteSpace = 'nowrap'
              optBtn.onclick = () => {
                btnGroup.querySelectorAll('button').forEach((b) => (b.disabled = true))
                handleAnswer(opt.label)
              }
              if (opt.description) {
                optBtn.title = opt.description
              }
              btnGroup.appendChild(optBtn)
            }

            el.appendChild(btnGroup)
          } else {
            let inputType = isMulti ? 'checkbox' : 'radio'

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
                desc.style.color = 'var(--rmx-color-text-muted, #888)'
                desc.style.fontSize = '0.75rem'
                label.appendChild(desc)
              }

              el.appendChild(label)
            }

            let btn = document.createElement('button')
            btn.textContent = 'Confirm'
            btn.style.padding = '4px 14px'
            btn.style.marginTop = '6px'
            btn.style.border = '1px solid var(--rmx-color-border-default, #ccc)'
            btn.style.borderRadius = '4px'
            btn.style.cursor = 'pointer'
            btn.style.background = 'var(--rmx-surface-lvl1, #fff)'
            btn.style.color = 'var(--rmx-color-text-primary, #333)'
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
          }
        })
      } catch (err) {
        pendingQuestion = null
        appendStatusMessage('Error rendering question: ' + String(err), true)
      }
    }

    // ── Suspension rendering (inline in agent bubble) ────────────────

    function showSuspension(data: {
      toolCallId?: string
      toolName?: string
      args?: Record<string, unknown>
    }) {
      let isCancelUser = data.toolName === 'cancel_user_workflow_v2'

      replaceAgentMessageContent((el) => {
        let warning = document.createElement('div')
        warning.textContent = isCancelUser
          ? 'Delete user account?'
          : 'Tool requires approval: ' + (data.toolName || 'unknown')
        warning.style.fontWeight = '600'
        warning.style.marginBottom = '8px'
        warning.style.fontSize = '0.875rem'
        if (isCancelUser) {
          warning.style.color = 'var(--rmx-color-action-danger, #dc3545)'
        }
        el.appendChild(warning)

        if (isCancelUser && data.args?.targetUserId) {
          let info = document.createElement('div')
          info.textContent =
            'Delete user #' +
            data.args.targetUserId +
            '? This will delete all future appointments and disable login.'
          info.style.fontSize = '0.75rem'
          info.style.color = 'var(--rmx-color-text-muted, #888)'
          info.style.marginBottom = '8px'
          el.appendChild(info)
        }

        let actions = document.createElement('div')
        actions.style.display = 'flex'
        actions.style.gap = '8px'

        let approveBtn = document.createElement('button')
        approveBtn.textContent = isCancelUser ? 'Confirm' : 'Approve'
        approveBtn.style.padding = '4px 14px'
        approveBtn.style.border = 'none'
        approveBtn.style.borderRadius = '4px'
        approveBtn.style.cursor = 'pointer'
        if (isCancelUser) {
          approveBtn.style.background = '#dc3545'
          approveBtn.style.color = '#fff'
        } else {
          approveBtn.style.background = 'var(--rmx-color-action-primary-background, #0066cc)'
          approveBtn.style.color = 'var(--rmx-color-action-primary-foreground, #fff)'
        }
        approveBtn.style.fontSize = '0.8125rem'
        approveBtn.onclick = () => handleToolDecision('approve', data.toolCallId)
        actions.appendChild(approveBtn)

        let declineBtn = document.createElement('button')
        declineBtn.textContent = 'Decline'
        declineBtn.style.padding = '4px 14px'
        declineBtn.style.border = '1px solid var(--rmx-color-border-default, #ccc)'
        declineBtn.style.borderRadius = '4px'
        declineBtn.style.cursor = 'pointer'
        declineBtn.style.background = 'var(--rmx-surface-lvl1, #fff)'
        declineBtn.style.color = 'var(--rmx-color-text-primary, #333)'
        declineBtn.style.fontSize = '0.8125rem'
        declineBtn.onclick = () => handleToolDecision('decline', data.toolCallId)
        actions.appendChild(declineBtn)

        el.appendChild(actions)
      })
    }

    // ── Tool decision / Answer handlers ───────────────────────────────

    async function handleToolDecision(decision: string, toolCallId?: string) {
      if (!currentRunId) return
      setFormEnabled(false)

      let label = decision === 'approve' ? 'Action approved' : 'Action declined'
      appendUserMessage(label)

      let body = new FormData()
      body.set('runId', currentRunId)
      body.set('decision', decision)
      if (toolCallId) body.set('toolCallId', toolCallId)
      if (currentThreadId) body.set('threadId', currentThreadId)

      currentAgentMessageEl = null
      startStream('/workflow-agent/tool-decision', { method: 'POST', body })
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
      startStream('/workflow-agent/answer', { method: 'POST', body })
    }

    // ── Navigation ───────────────────────────────────────────────────

    function restoreFilterValue(url: string) {
      let filterValue = new URL(url, window.location.origin).searchParams.get('filter')
      if (filterValue !== null && filterValue !== 'enabled' && filterValue !== 'disabled') {
        lastFilterValue = filterValue
      }
      let value = filterValue ?? lastFilterValue
      for (let input of document.querySelectorAll<HTMLInputElement>('input[name="filter"]')) {
        input.value = value
      }
    }

    function handleNavigate(data: {
      href: string
      target?: string
      history?: string
      prefill?: Record<string, string>
    }) {
      let { href, target, history: historyMode } = data
      if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
        appendStatusMessage('Invalid navigation path: ' + href, true)
        return
      }

      if (data.prefill) {
        agentPrefillMap.set(href, data.prefill)
      }

      let frame = target ? handle.frames.get(target) : handle.frame
      if (frame) {
        frame.src = href
        frame.reload().then(
          () => restoreFilterValue(href),
          (err) => appendStatusMessage('Navigation failed: ' + String(err), true),
        )
        if (!historyMode || historyMode !== 'skip') {
          if (historyMode === 'replace') {
            window.history.replaceState({}, '', href)
          } else {
            window.history.pushState({}, '', href)
          }
        }
      } else {
        appendStatusMessage('Error: frame not found', true)
      }
    }

    // ── SSE Stream ───────────────────────────────────────────────────

    async function startStream(url: string, init: RequestInit) {
      pendingQuestion = null
      pendingPdf = null
      abortStream()
      abortController = new AbortController()
      let signal = abortController.signal
      let streamingText = ''

      try {
        let res = await fetch(url, { ...init, signal })
        if (!res.ok) {
          let text = await res.text().catch(() => '')
          let match = text.match(/data: (.*)\n/)
          let msg = res.statusText
          if (match) {
            try { msg = JSON.parse(match[1]).error ?? res.statusText } catch { /* keep statusText */ }
          }
          appendStatusMessage('Error: ' + msg, true)
          setFormEnabled(true)
          return
        }

        let reader = res.body?.getReader()
        if (!reader) {
          appendStatusMessage('Error: no response body', true)
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
                appendStatusMessage('Navigating to ' + parsed.href + '...')
                handleNavigate(parsed)
              } else if (eventType === 'question') {
                showQuestion(parsed)
                reader.cancel().catch(() => {})
                return
              } else if (eventType === 'suspension') {
                showSuspension(parsed)
                reader.cancel().catch(() => {})
                return
              } else if (eventType === 'tool-result') {
                let result = parsed.result as Record<string, unknown> | undefined
                if (result?.data && typeof result.data === 'string' && result.filename) {
                  pendingPdf = { filename: result.filename as string, data: result.data as string }
                } else {
                  appendStatusMessage('Tool completed: ' + (parsed.toolName || 'unknown'))
                }
              } else if (eventType === 'tool-error') {
                appendStatusMessage('Tool error: ' + (parsed.error || 'unknown'), true)
              } else if (eventType === 'stream-error') {
                appendStatusMessage('Stream error: ' + (parsed.error || 'unknown'), true)
              } else if (eventType === 'complete') {
                if (pendingQuestion) return
                if (pendingPdf) {
                  replaceAgentMessageContent((el) => {
                    let textEl = document.createElement('div')
                    textEl.textContent = streamingText || pendingPdf!.filename
                    textEl.style.marginBottom = '8px'
                    textEl.style.fontSize = '0.875rem'
                    textEl.style.whiteSpace = 'pre-wrap'
                    el.appendChild(textEl)
                    let link = document.createElement('a')
                    link.href = 'data:application/pdf;base64,' + pendingPdf!.data
                    link.download = pendingPdf!.filename
                    link.textContent = pendingPdf!.filename + ' download'
                    link.style.display = 'inline-block'
                    link.style.padding = '6px 14px'
                    link.style.background = 'var(--rmx-color-action-primary-background, #0055ff)'
                    link.style.color = 'var(--rmx-color-action-primary-foreground, #fff)'
                    link.style.borderRadius = '4px'
                    link.style.textDecoration = 'none'
                    link.style.fontSize = '0.8125rem'
                    link.style.cursor = 'pointer'
                    el.appendChild(link)
                  })
                }
                currentRunId = null
                currentThreadId = null
                currentAgentMessageEl = null
                if (!didNavigate) {
                  let container = document.getElementById('workflow-agent-frame-container')
                  let activeFrame = container?.getAttribute('data-active-frame') ?? 'admin-content'
                  let theFrame = handle.frames.get(activeFrame)
                  if (theFrame) theFrame.reload().catch(() => {})
                }
              } else if (eventType === 'agent-error') {
                appendStatusMessage('Error: ' + (parsed.error || 'unknown'), true)
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
        appendStatusMessage('Error: ' + String(err), true)
        setFormEnabled(true)
      }
    }

    // ── Frame form submit ─────────────────────────────────────────────

    async function handleFrameFormSubmit(e: Event) {
      let form = (e.target as HTMLElement).closest('form')
      if (!form || form.id === 'workflow-agent-form') return
      e.preventDefault()

      let action = form.getAttribute('action') || ''
      let method = (form.method || 'GET').toUpperCase()
      let target = form.getAttribute('rmx-target')

      let frame = target ? handle.frames.get(target) : handle.frame
      if (!frame) return

      if (method === 'GET') {
        let params = new URLSearchParams(new FormData(form) as any)
        let qs = params.toString()
        let url = action + (qs ? '?' + qs : '')
        frame.src = url
        frame.reload().then(
          () => restoreFilterValue(url),
          () => {},
        )
        window.history.replaceState({}, '', url)
      } else {
        try {
          let headers: Record<string, string> = {}
          if (currentThreadId) headers['X-Agent-Thread'] = currentThreadId
          let res = await fetch(action, {
            method,
            headers,
            body: new FormData(form),
          })
          await res.text().catch(() => '')
          if (!res.ok) {
            appendStatusMessage('Form submission failed: ' + res.status, true)
          }
          frame.reload().catch(() => {})
        } catch {
          frame.reload().catch(() => {})
        }
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

      let textarea = document.getElementById('workflow-agent-input') as HTMLTextAreaElement | null
      if (textarea) textarea.value = ''
      setFormEnabled(false)
      currentAgentMessageEl = null

      startStream('/workflow-agent', { method: 'POST', body: formData })
    }

    function handleTextareaKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        let form = document.getElementById('workflow-agent-form') as HTMLFormElement | null
        if (form) form.requestSubmit()
      }
    }

    // ── Return (lifecycle) ───────────────────────────────────────────

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let form = document.getElementById('workflow-agent-form') as HTMLFormElement | null
            if (form) {
              form.addEventListener('submit', handleFormSubmit, { signal: handle.signal })
            }

            let textarea = document.getElementById(
              'workflow-agent-input',
            ) as HTMLTextAreaElement | null
            if (textarea) {
              textarea.addEventListener('keydown', handleTextareaKeydown, {
                signal: handle.signal,
              })
            }

            let container = document.getElementById('workflow-agent-frame-container')
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

import { clientEntry, css, ref, type Handle } from 'remix/ui'

export const SupportAgentStream = clientEntry(
  import.meta.url + '#SupportAgentStream',
  function SupportAgentStream(handle: Handle) {
    let abortController: AbortController | null = null
    let currentRunId: string | null = null
    let currentThreadId: string | null = null
    let didNavigate: boolean = false

    let pendingQuestion: {
      runId: string
      toolCallId?: string
      selectionMode: string
    } | null = null

    function abortStream() {
      if (abortController) {
        abortController.abort()
        abortController = null
      }
    }

    function setBarText(text: string) {
      let bar = document.getElementById('agent-bar')
      if (bar) bar.textContent = text
    }

    function setFormEnabled(enabled: boolean) {
      let input = document.getElementById('support-agent-input') as HTMLInputElement | null
      let submit = document.getElementById('support-agent-submit') as HTMLButtonElement | null
      if (input) input.disabled = !enabled
      if (submit) submit.disabled = !enabled
    }

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

      let bar = document.getElementById('agent-bar')
      if (!bar) return

      if (!data.options || data.options.length === 0) {
        bar.textContent = 'Frage: ' + data.question
        bar.style.cursor = 'pointer'
        bar.title = 'Klicken zum Antworten...'
        bar.onclick = () => {
          let answer = prompt(data.question)
          if (answer) handleAnswer(answer)
        }
        return
      }

      try {
        bar.innerHTML = ''
        bar.style.cursor = ''
        bar.title = ''
        bar.onclick = null

        let questionEl = document.createElement('div')
        questionEl.textContent = data.question
        questionEl.style.fontWeight = '600'
        questionEl.style.marginBottom = '8px'
        questionEl.style.fontSize = '0.875rem'
        bar.appendChild(questionEl)

        let isMulti = data.selectionMode === 'multi_select'
        let inputType = isMulti ? 'checkbox' : 'radio'

        let MAX_OPTIONS = 50
        let options = data.options.slice(0, MAX_OPTIONS)

        for (let opt of options) {
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

          bar.appendChild(label)
        }

        let btn = document.createElement('button')
        btn.textContent = 'Bestätigen'
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
          let checked = bar.querySelectorAll('input[name="q-option"]:checked') as NodeListOf<HTMLInputElement>
          if (checked.length === 0) return

          let selected = [...checked].map(el => el.value)
          let answer = isMulti ? JSON.stringify(selected) : selected[0]

          bar.innerHTML = ''
          handleAnswer(answer)
        }
        bar.appendChild(btn)
      } catch (err) {
        pendingQuestion = null
        bar.innerHTML = ''
        bar.textContent = 'Fehler beim Anzeigen der Frage: ' + String(err)
      }
    }

    function showSuspension(data: {
      toolCallId?: string
      toolName?: string
      args?: Record<string, unknown>
    }) {
      let bar = document.getElementById('agent-bar')
      if (!bar) return

      bar.innerHTML = ''
      bar.style.cursor = ''
      bar.title = ''
      bar.onclick = null

      let isCancelUser = data.toolName === 'cancel_user_account'

      let warning = document.createElement('div')
      warning.textContent = isCancelUser
        ? '⚠ Benutzerkonto löschen?'
        : 'Tool erfordert Bestätigung: ' + (data.toolName || 'unbekannt')
      warning.style.fontWeight = '600'
      warning.style.marginBottom = '8px'
      warning.style.fontSize = '0.875rem'
      if (isCancelUser) {
        warning.style.color = 'var(--rmx-color-action-danger, #dc3545)'
      }
      bar.appendChild(warning)

      if (isCancelUser && data.args?.targetUserId) {
        let info = document.createElement('div')
        info.textContent = 'Benutzer #' + data.args.targetUserId + ' löschen? Diese Aktion löscht alle zukünftigen Termine und deaktiviert den Login.'
        info.style.fontSize = '0.75rem'
        info.style.color = 'var(--rmx-color-text-muted, #888)'
        info.style.marginBottom = '8px'
        bar.appendChild(info)
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
        approveBtn.style.background = 'var(--rmx-color-action-primary-background, #0066cc)'
        approveBtn.style.color = 'var(--rmx-color-action-primary-foreground, #fff)'
      }
      approveBtn.style.fontSize = '0.8125rem'
      approveBtn.onclick = () => handleToolDecision('approve', data.toolCallId)
      actions.appendChild(approveBtn)

      let declineBtn = document.createElement('button')
      declineBtn.textContent = '✖ Ablehnen'
      declineBtn.style.padding = '4px 14px'
      declineBtn.style.border = '1px solid var(--rmx-color-border-default, #ccc)'
      declineBtn.style.borderRadius = '4px'
      declineBtn.style.cursor = 'pointer'
      declineBtn.style.background = 'var(--rmx-surface-lvl1, #fff)'
      declineBtn.style.color = 'var(--rmx-color-text-primary, #333)'
      declineBtn.style.fontSize = '0.8125rem'
      declineBtn.onclick = () => handleToolDecision('decline', data.toolCallId)
      actions.appendChild(declineBtn)

      bar.appendChild(actions)
    }

    function hideQuestion() {
      pendingQuestion = null
      let bar = document.getElementById('agent-bar')
      if (bar) {
        bar.innerHTML = ''
        bar.style.cursor = ''
        bar.title = ''
        bar.onclick = null
      }
    }

    function handleNavigate(data: { href: string; target?: string; history?: string }) {
      let { href, target, history: historyMode } = data
      if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
        setBarText('Ungültiger Navigationspfad')
        return
      }

      let frame = target ? handle.frames.get(target) : handle.frame
      if (frame) {
        let container = document.getElementById('support-agent-frame-container')
        if (container && target) {
          let activeFrame = container.getAttribute('data-active-frame')
          if (activeFrame && activeFrame !== target) {
            let oldWrapper = document.getElementById('frame-' + activeFrame)
            if (oldWrapper) oldWrapper.style.display = 'none'
            let newWrapper = document.getElementById('frame-' + target)
            if (newWrapper) newWrapper.style.display = 'block'
            container.setAttribute('data-active-frame', target)
          }
        }

        frame.src = href
        frame.reload().catch((err) => {
          setBarText('Navigation fehlgeschlagen: ' + String(err))
        })
        if (!historyMode || historyMode !== 'skip') {
          if (historyMode === 'replace') {
            window.history.replaceState({}, '', href)
          } else {
            window.history.pushState({}, '', href)
          }
        }
      } else {
        setBarText('Fehler: Frame nicht gefunden')
      }
    }

    async function handleToolDecision(decision: string, toolCallId?: string) {
      if (!currentRunId) return
      setFormEnabled(false)

      let body = new FormData()
      body.set('runId', currentRunId)
      body.set('decision', decision)
      if (toolCallId) body.set('toolCallId', toolCallId)
      if (currentThreadId) body.set('threadId', currentThreadId)

      startStream('/mastra/chat/tool-decision', { method: 'POST', body })
    }

    async function handleAnswer(answer: string) {
      if (!pendingQuestion || !answer) return
      let pq = pendingQuestion
      setFormEnabled(false)
      hideQuestion()

      let body = new FormData()
      body.set('runId', pq.runId)
      body.set('answer', answer)
      body.set('selectionMode', pq.selectionMode)
      if (pq.toolCallId) body.set('toolCallId', pq.toolCallId)
      if (currentThreadId) body.set('threadId', currentThreadId)

      startStream('/mastra/chat/answer', { method: 'POST', body })
    }

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
          setBarText('Fehler: ' + msg)
          setFormEnabled(true)
          return
        }

        let reader = res.body?.getReader()
        if (!reader) {
          setBarText('Fehler: Kein Antwortstream')
          setFormEnabled(true)
          return
        }

        let decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          let { done, value } = await reader.read()
          if (done) break
          if (signal.aborted) { reader.cancel().catch(() => {}); return }

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
              } else if (eventType === 'message') {
                streamingText += parsed.text || ''
                setBarText(streamingText)
              } else if (eventType === 'navigate') {
                didNavigate = true
                setBarText('Navigiere zu ' + parsed.href + '...')
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
                setBarText('Tool-Fehler: ' + (parsed.error || 'unbekannt'))
              } else if (eventType === 'stream-error') {
                setBarText('Stream-Fehler: ' + (parsed.error || 'unbekannt'))
              } else if (eventType === 'complete') {
                if (pendingQuestion) return
                currentRunId = null
                currentThreadId = null
                if (!didNavigate) {
                  let container = document.getElementById('support-agent-frame-container')
                  let activeFrame = container?.getAttribute('data-active-frame') ?? 'support-content'
                  let theFrame = handle.frames.get(activeFrame)
                  if (theFrame) theFrame.reload().catch(() => {})
                }
              } else if (eventType === 'agent-error') {
                setBarText('Fehler: ' + (parsed.error || 'unbekannt'))
              }
            } catch {
              if (eventType === 'message') {
                streamingText += data
                setBarText(streamingText)
              }
            }
          }
        }

        if (!pendingQuestion) {
          setFormEnabled(true)
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        setBarText('Fehler: ' + String(err))
        setFormEnabled(true)
      }
    }

    async function handleFormSubmit(e: Event) {
      e.preventDefault()
      let form = e.target as HTMLFormElement
      let formData = new FormData(form)
      let message = formData.get('message')?.toString().trim()
      if (!message) return

      if (currentThreadId) formData.set('threadId', currentThreadId)
      setBarText('Sende: ' + message)
      let input = document.getElementById('support-agent-input') as HTMLInputElement | null
      if (input) input.value = ''
      setFormEnabled(false)

      startStream('/mastra/chat', { method: 'POST', body: formData })
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let form = document.getElementById('support-agent-form') as HTMLFormElement | null
            if (form) {
              form.addEventListener('submit', handleFormSubmit, { signal: handle.signal })
            }
          }),
        ]}
      />
    )
  },
)

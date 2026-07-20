import { clientEntry, css, ref, type Handle } from 'remix/ui'
import { agentPrefillMap } from './agent-prefill-store.ts'

export const WorkflowAgentStream = clientEntry(
  import.meta.url + '#WorkflowAgentStream',
  function WorkflowAgentStream(handle: Handle) {
    let abortController: AbortController | null = null
    let currentRunId: string | null = null
    let currentThreadId: string | null = null
    let didNavigate: boolean = false
    let lastFilterValue: string = ''

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
      let input = document.getElementById('workflow-agent-input') as HTMLInputElement | null
      let submit = document.getElementById('workflow-agent-submit') as HTMLButtonElement | null
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
        bar.textContent = 'Agent asks: ' + data.question
        bar.style.cursor = 'pointer'
        bar.title = 'Click to answer...'
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

        if (options.length === 1 && !isMulti) {
          let firstInput = bar.querySelector(
            'input[name="q-option"]',
          ) as HTMLInputElement | null
          if (firstInput) firstInput.checked = true
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
          let checked = bar.querySelectorAll(
            'input[name="q-option"]:checked',
          ) as NodeListOf<HTMLInputElement>
          if (checked.length === 0) return

          let selected = [...checked].map((el) => el.value)
          let answer = isMulti ? JSON.stringify(selected) : selected[0]

          bar.innerHTML = ''
          handleAnswer(answer)
        }
        bar.appendChild(btn)
      } catch (err) {
        pendingQuestion = null
        bar.innerHTML = ''
        bar.textContent = 'Error rendering question: ' + String(err)
      }
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
      let { href, target } = data
      if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
        setBarText('Invalid navigation path')
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
          (err) => setBarText('Navigation failed: ' + String(err)),
        )
      } else {
        setBarText('Error: frame not found')
      }
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

      startStream('/workflow-agent/answer', { method: 'POST', body })
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
          setBarText('Error: ' + msg)
          setFormEnabled(true)
          return
        }

        let reader = res.body?.getReader()
        if (!reader) {
          setBarText('Error: no response body')
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
              } else if (eventType === 'message') {
                streamingText += parsed.text || ''
                setBarText(streamingText)
              } else if (eventType === 'navigate') {
                didNavigate = true
                setBarText('Navigating to ' + parsed.href + '...')
                handleNavigate(parsed)
              } else if (eventType === 'question') {
                showQuestion(parsed)
                reader.cancel().catch(() => {})
                return
              } else if (eventType === 'suspension') {
                setBarText('Tool requires approval: ' + (parsed.toolName || 'unknown'))
                reader.cancel().catch(() => {})
                return
              } else if (eventType === 'tool-error') {
                setBarText('Tool error: ' + (parsed.error || 'unknown'))
              } else if (eventType === 'stream-error') {
                setBarText('Stream error: ' + (parsed.error || 'unknown'))
              } else if (eventType === 'complete') {
                if (pendingQuestion) return
                currentRunId = null
                currentThreadId = null
              } else if (eventType === 'agent-error') {
                setBarText('Error: ' + (parsed.error || 'unknown'))
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
        setBarText('Error: ' + String(err))
        setFormEnabled(true)
      }
    }

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
      } else {
        try {
          let headers: Record<string, string> = {}
          if (currentThreadId) headers['X-Agent-Thread'] = currentThreadId
          let res = await fetch(action, {
            method,
            headers,
            body: new FormData(form),
          })
          // Drain the body, then reload the frame's current location to show
          // updated state. Never serialize form data into a URL — it would
          // leak fields like _csrf into browser history and access logs.
          await res.text().catch(() => '')
          if (!res.ok) {
            setBarText('Form submission failed: ' + res.status)
          }
          frame.reload().catch(() => {})
        } catch {
          frame.reload().catch(() => {})
        }
      }
    }

    async function handleFormSubmit(e: Event) {
      e.preventDefault()
      let form = e.target as HTMLFormElement
      let formData = new FormData(form)
      let message = formData.get('message')?.toString().trim()
      if (!message) return

      if (currentThreadId) formData.set('threadId', currentThreadId)
      setBarText('Sending: ' + message)
      let input = document.getElementById('workflow-agent-input') as HTMLInputElement | null
      if (input) input.value = ''
      setFormEnabled(false)

      startStream('/workflow-agent', { method: 'POST', body: formData })
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let form = document.getElementById('workflow-agent-form') as HTMLFormElement | null
            if (form) {
              form.addEventListener('submit', handleFormSubmit, { signal: handle.signal })
            }
            let container = document.getElementById('workflow-agent-frame-container')
            if (container) {
              container.addEventListener('submit', handleFrameFormSubmit, { signal: handle.signal })
            }
          }),
        ]}
      />
    )
  },
)

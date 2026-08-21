import { clientEntry, css, ref, type Handle } from 'remix/ui'
import { theme } from '../../../ui/theme/theme.ts'
import { agentPrefillMap } from '../../../ui/agent-prefill-store.browser.ts'
import { setupAutoGrowTextarea } from '../../../ui/auto-grow-textarea.ts'

export const RouteAgentStream = clientEntry(
  import.meta.url + '#RouteAgentStream',
  function RouteAgentStream(handle: Handle) {
    let abortController: AbortController | null = null
    let currentRunId: string | null = null
    let currentThreadId: string | null = null
    let didNavigate: boolean = false
    let lastFilterValue: string = ''
    let autoGrowReset: (() => void) | null = null

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
      let input = document.getElementById('route-agent-input') as HTMLTextAreaElement | null
      let submit = document.getElementById('route-agent-submit') as HTMLButtonElement | null
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
            desc.style.color = theme.colors.text.muted
            desc.style.fontSize = '0.75rem'
            label.appendChild(desc)
          }

          bar.appendChild(label)
        }

        if (options.length === 1 && !isMulti) {
          let firstInput = bar.querySelector('input[name="q-option"]') as HTMLInputElement | null
          if (firstInput) firstInput.checked = true
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
      let { href, target, history: historyMode } = data
      if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
        setBarText('Invalid navigation path')
        return
      }

      if (data.prefill) {
        agentPrefillMap.set(href, data.prefill)
      }

      let frame = target ? handle.frames.get(target) : handle.frame
      if (frame) {
        let container = document.getElementById('route-agent-frame-container')
        if (container && target) {
          let activeFrame = container.getAttribute('data-active-frame')
          if (activeFrame && activeFrame !== target) {
            let oldWrapper = document.getElementById('frame-' + activeFrame)
            if (oldWrapper) oldWrapper.style.display = 'none'
            let newWrapper = document.getElementById('frame-' + target)
            if (newWrapper) newWrapper.style.display = 'block'
            let oldFrame = handle.frames.get(activeFrame)
            if (oldFrame) {
              oldFrame.src = '/route-agent/panel'
              oldFrame.reload().catch(() => {})
            }
            container.setAttribute('data-active-frame', target)
          }
        }

        frame.src = href
        frame.reload().then(
          () => restoreFilterValue(href),
          (err) => setBarText('Navigation failed: ' + String(err)),
        )
        if (!historyMode || historyMode !== 'skip') {
          if (historyMode === 'replace') {
            window.history.replaceState({}, '', href)
          } else {
            window.history.pushState({}, '', href)
          }
        }
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

      startStream('/route-agent/answer', { method: 'POST', body })
    }

    async function startStream(url: string, init: RequestInit) {
      pendingQuestion = null
      abortStream()
      abortController = new AbortController()
      let signal = abortController.signal
      let streamingText = ''

      try {
        let res = await fetch(url, {
          ...init,
          signal,
          headers: { 'X-Sse-Request': '1', ...(init.headers ?? {}) },
        })
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
                if (!didNavigate) {
                  let container = document.getElementById('route-agent-frame-container')
                  let activeFrame = container?.getAttribute('data-active-frame') ?? 'lists-content'
                  let theFrame = handle.frames.get(activeFrame)
                  if (theFrame) theFrame.reload().catch(() => {})
                }
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

    async function handleFormSubmit(e: Event) {
      e.preventDefault()
      let form = e.target as HTMLFormElement
      let formData = new FormData(form)
      let message = formData.get('message')?.toString().trim()
      if (!message) return

      if (currentThreadId) formData.set('threadId', currentThreadId)
      setBarText('Sending: ' + message)
      let input = document.getElementById('route-agent-input') as HTMLTextAreaElement | null
      if (input) {
        input.value = ''
        autoGrowReset?.()
      }
      setFormEnabled(false)

      startStream('/route-agent', { method: 'POST', body: formData })
    }

    function handleTextareaKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        let form = document.getElementById('route-agent-form') as HTMLFormElement | null
        if (form) form.requestSubmit()
      }
    }

    async function handleFrameFormSubmit(e: Event) {
      if (!pendingQuestion || !currentThreadId) return
      let form = (e.target as HTMLElement).closest('form')
      if (!form || form.id === 'route-agent-form') return
      e.preventDefault()

      let container = document.getElementById('route-agent-frame-container')
      let activeFrame = container?.getAttribute('data-active-frame') ?? 'lists-content'
      let frame = handle.frames.get(activeFrame)

      setBarText('Submitting form...')

      try {
        let headers: Record<string, string> = {}
        headers['X-Agent-Thread'] = currentThreadId
        let res = await fetch(form.action, {
          method: 'POST',
          headers,
          body: new FormData(form),
        })
        let ct = res.headers.get('Content-Type') || ''
        if (ct.includes('json')) {
          let data = await res.json()
          let body = new FormData()
          body.set('runId', currentRunId || '')
          body.set('answer', JSON.stringify(data))
          body.set('selectionMode', 'single_select')
          if (pendingQuestion?.toolCallId) body.set('toolCallId', pendingQuestion.toolCallId)
          startStream('/route-agent/answer', { method: 'POST', body })
          return
        }
      } catch (err) {
        console.error('Form submission failed:', err)
      }

      if (frame) {
        await frame.reload()
      }
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let form = document.getElementById('route-agent-form') as HTMLFormElement | null
            if (form) {
              form.addEventListener('submit', handleFormSubmit, { signal: handle.signal })
            }

            let textarea = document.getElementById(
              'route-agent-input',
            ) as HTMLTextAreaElement | null
            if (textarea) {
              textarea.addEventListener('keydown', handleTextareaKeydown, {
                signal: handle.signal,
              })
              autoGrowReset = setupAutoGrowTextarea(textarea, { signal: handle.signal }).reset
            }

            let container = document.getElementById('route-agent-frame-container')
            if (container) {
              container.addEventListener('submit', handleFrameFormSubmit, { signal: handle.signal })
            }
          }),
        ]}
      />
    )
  },
)

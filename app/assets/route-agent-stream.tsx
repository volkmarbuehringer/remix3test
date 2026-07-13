import { clientEntry, css, ref, type Handle } from 'remix/ui'

export const RouteAgentStream = clientEntry(
  import.meta.url + '#RouteAgentStream',
  function RouteAgentStream(handle: Handle) {
    let abortController: AbortController | null = null
    let currentRunId: string | null = null
    let currentThreadId: string | null = null

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
      let input = document.getElementById('route-agent-input') as HTMLInputElement | null
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
      setBarText('Agent asks: ' + data.question)

      let bar = document.getElementById('agent-bar')
      if (!bar) return
      bar.style.cursor = 'pointer'
      bar.title = 'Click to answer...'
      bar.onclick = () => {
        let answer = prompt(data.question)
        if (answer) handleAnswer(answer)
      }
    }

    function hideQuestion() {
      pendingQuestion = null
      let bar = document.getElementById('agent-bar')
      if (bar) {
        bar.style.cursor = ''
        bar.title = ''
        bar.onclick = null
      }
    }

    function handleNavigate(data: { href: string; target?: string; history?: string }) {
      let { href, target, history: historyMode } = data
      if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) {
        setBarText('Invalid navigation path')
        return
      }
      let frame = target ? handle.frames.get(target) : handle.frame
      if (frame) {
        frame.src = href
        frame.reload().catch(() => {})
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
      setFormEnabled(false)
      hideQuestion()

      let body = new FormData()
      body.set('runId', pendingQuestion.runId)
      body.set('answer', answer)
      body.set('selectionMode', pendingQuestion.selectionMode)
      if (pendingQuestion.toolCallId) body.set('toolCallId', pendingQuestion.toolCallId)
      if (currentThreadId) body.set('threadId', currentThreadId)

      startStream('/route-agent/answer', { method: 'POST', body })
    }

    async function startStream(url: string, init: RequestInit) {
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
                if (parsed.runId) currentRunId = parsed.runId
                if (parsed.threadId) currentThreadId = parsed.threadId
              } else if (eventType === 'message') {
                streamingText += parsed.text || ''
                setBarText(streamingText)
              } else if (eventType === 'navigate') {
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
      let input = document.getElementById('route-agent-input') as HTMLInputElement | null
      if (input) input.value = ''
      setFormEnabled(false)

      startStream('/route-agent', { method: 'POST', body: formData })
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
          }),
        ]}
      />
    )
  },
)

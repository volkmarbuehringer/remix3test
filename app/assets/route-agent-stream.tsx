import { clientEntry, css, ref, type Handle } from 'remix/ui'

export const RouteAgentStream = clientEntry(
  import.meta.url + '#RouteAgentStream',
  function RouteAgentStream(handle: Handle) {
    let currentEventSource: EventSource | null = null
    let currentRunId: string | null = null
    let currentThreadId: string | null = null
    let streamingText = ''

    let pendingQuestion: {
      runId: string
      toolCallId?: string
      selectionMode: string
    } | null = null

    function abortStream() {
      if (currentEventSource) {
        currentEventSource.close()
        currentEventSource = null
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

    function navigateFrame(path: string) {
      if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
        setBarText('Invalid navigation path')
        return
      }
      let frame = handle.frames.get('lists-content')
      if (frame) {
        frame.src = path
        frame.reload().catch(() => {})
      } else {
        setBarText('Error: frame not found')
      }
    }

    function esc(s: string): string {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }

    function showQuestion(data: {
      runId: string
      toolCallId?: string
      question: string
      options?: { label: string; description?: string }[] | null
      selectionMode: string
    }) {
      pendingQuestion = {
        runId: data.runId,
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

    async function handleAnswer(answer: string) {
      if (!pendingQuestion || !answer) return
      setFormEnabled(false)
      hideQuestion()

      try {
        let body = new FormData()
        body.set('runId', pendingQuestion.runId)
        body.set('answer', answer)
        body.set('selectionMode', pendingQuestion.selectionMode)
        if (pendingQuestion.toolCallId) body.set('toolCallId', pendingQuestion.toolCallId)
        if (currentThreadId) body.set('threadId', currentThreadId)

        let res = await fetch('/route-agent/answer', {
          method: 'POST',
          body,
        })
        if (!res.ok) {
          setBarText('Failed to submit answer')
          setFormEnabled(true)
          return
        }
        let data = await res.json()
        if (data.runId) {
          startStream(data.runId)
        }
      } catch (err) {
        setBarText('Answer error: ' + String(err))
        setFormEnabled(true)
      }
    }

    function startStream(runId: string) {
      abortStream()
      streamingText = ''
      currentRunId = runId

      let url = `/route-agent/stream/${encodeURIComponent(runId)}`
      let es = new EventSource(url)
      currentEventSource = es

      es.addEventListener('message', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.text) {
            streamingText += data.text
            setBarText(streamingText)
          }
        } catch {
          streamingText += event.data
          setBarText(streamingText)
        }
      })

      es.addEventListener('tool-result', (event) => {
        try {
          let data = JSON.parse(event.data)
          let result = data.result as Record<string, unknown> | undefined
          if (result?.type === 'route' && typeof result.path === 'string') {
            setBarText('Navigating to ' + result.path + '...')
            navigateFrame(result.path)
          }
        } catch {
          /* ignore parse errors */
        }
      })

      es.addEventListener('tool-error', (event) => {
        try {
          let data = JSON.parse(event.data)
          setBarText('Tool error: ' + (data.error || 'unknown'))
        } catch {
          setBarText('A tool error occurred.')
        }
      })

      es.addEventListener('suspension', (event) => {
        try {
          let data = JSON.parse(event.data)
          setBarText('Tool requires approval: ' + (data.toolName || 'unknown'))
        } catch {
          setBarText('Tool requires approval.')
        }
        es.close()
        currentEventSource = null
        currentRunId = null
        streamingText = ''
        setFormEnabled(true)
      })

      es.addEventListener('question', (event) => {
        try {
          let data = JSON.parse(event.data)
          showQuestion(data)
        } catch {
          /* ignore parse errors */
        }
        es.close()
        currentEventSource = null
        currentRunId = null
        streamingText = ''
        setFormEnabled(true)
      })

      function streamEnded() {
        if (pendingQuestion) return
        es.close()
        currentEventSource = null
        currentRunId = null
        setFormEnabled(true)
      }

      es.addEventListener('complete', streamEnded)
      es.addEventListener('stream-error', (event) => {
        try {
          let data = JSON.parse(event.data)
          setBarText('Stream error: ' + (data.error || 'unknown'))
        } catch {
          setBarText('Stream error.')
        }
        streamEnded()
      })

      es.addEventListener('error', streamEnded)
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

      try {
        let res = await fetch('/route-agent', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          let err = await res.json().catch(() => ({ error: 'Request failed' }))
          setBarText('Error: ' + (err.error || res.statusText))
          setFormEnabled(true)
          return
        }
        let data = await res.json()
        if (data.threadId) currentThreadId = data.threadId
        if (data.runId) {
          startStream(data.runId)
        }
      } catch (err) {
        setBarText('Error: ' + String(err))
        setFormEnabled(true)
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
          }),
        ]}
      />
    )
  },
)

import { clientEntry, css, ref, type Handle } from 'remix/ui'

export const TestAgentStream = clientEntry(
  import.meta.url + '#TestAgentStream',
  function TestAgentStream(handle: Handle) {
    let currentEventSource: EventSource | null = null
    let currentRunId: string | null = null
    let currentThreadId: string | null = null
    let streamingAssistant: HTMLDivElement | null = null
    let suspended = false

    function abortStream() {
      if (currentEventSource) {
        currentEventSource.close()
        currentEventSource = null
      }
    }

    function isFileLike(line: string): boolean {
      let t = line.trim()
      if (!t) return false
      return /\.\w{1,6}$/.test(t) || t.endsWith('/') || /^[\w.\-/@]+$/.test(t)
    }

    function esc(s: string): string {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }

    function formatFilenames(text: string): string {
      return text
        .split('\n')
        .map((line) => {
          if (!line.trim()) return '<br>'
          return isFileLike(line)
            ? `<code style="font-family:monospace;background:rgba(255,255,255,0.1);color:inherit;padding:0 4px;border-radius:3px;white-space:pre-wrap">${esc(line)}</code><br>`
            : esc(line) + '<br>'
        })
        .join('')
    }

    let bubbleStyles: Record<string, [string, string, string]> = {
      user: ['#3b82f6', '#ffffff', 'flex-end'],
      assistant: ['transparent', 'inherit', 'flex-start'],
      error: ['#ef4444', '#ffffff', 'flex-start'],
    }

    function appendMessage(text: string, role: string, accumulate?: boolean) {
      let container = document.getElementById('test-messages')
      if (!container) return
      if (accumulate && streamingAssistant) {
        streamingAssistant.textContent += text
      } else {
        let s = bubbleStyles[role] || bubbleStyles.assistant
        let bubble = document.createElement('div')
        bubble.style.cssText =
          `padding:0.5rem 0.75rem;border-radius:12px;max-width:80%;` +
          `line-height:1.5;font-size:0.9375rem;` +
          `background:${s[0]};color:${s[1]};align-self:${s[2]}`
        bubble.textContent = text
        container.appendChild(bubble)
        if (role === 'assistant') streamingAssistant = bubble
      }
      container.scrollTop = container.scrollHeight
    }

    function finalizeAssistantBubble() {
      if (!streamingAssistant) return
      let raw = streamingAssistant.textContent || ''
      streamingAssistant.innerHTML = formatFilenames(raw)
      streamingAssistant = null
    }

    function showApproval(data: {
      runId: string
      toolCallId?: string
      toolName?: string
      args?: Record<string, unknown>
    }) {
      let card = document.getElementById('test-approval')
      if (!card) return
      let toolInfo = document.getElementById('test-approval-info')
      if (toolInfo) {
        toolInfo.textContent =
          `Tool: ${data.toolName || 'unknown'}\n` +
          `Args: ${JSON.stringify(data.args || {}, null, 2)}`
      }
      let approveBtn = document.getElementById('test-approve-btn') as HTMLButtonElement | null
      let declineBtn = document.getElementById('test-decline-btn') as HTMLButtonElement | null
      if (approveBtn) {
        approveBtn.dataset.runId = data.runId
        approveBtn.dataset.toolCallId = data.toolCallId || ''
        approveBtn.disabled = false
      }
      if (declineBtn) {
        declineBtn.dataset.runId = data.runId
        declineBtn.dataset.toolCallId = data.toolCallId || ''
        declineBtn.disabled = false
      }
      card.style.display = 'block'
    }

    function hideApproval() {
      let card = document.getElementById('test-approval')
      if (card) card.style.display = 'none'
    }

    function setFormEnabled(enabled: boolean) {
      let textarea = document.getElementById('test-input') as HTMLTextAreaElement | null
      let submitBtn = document.getElementById('test-submit') as HTMLButtonElement | null
      if (textarea) textarea.disabled = !enabled
      if (submitBtn) submitBtn.disabled = !enabled
    }

    function startStream(runId: string) {
      abortStream()
      streamingAssistant = null
      suspended = false
      currentRunId = runId

      let url = `/testagent/stream/${encodeURIComponent(runId)}`
      let es = new EventSource(url)
      currentEventSource = es

      es.addEventListener('message', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.text) {
            appendMessage(data.text, 'assistant', true)
          }
        } catch {
          appendMessage(event.data, 'assistant', true)
        }
      })

      es.addEventListener('suspension', (event) => {
        suspended = true
        try {
          let data = JSON.parse(event.data)
          showApproval(data)
        } catch {
          /* ignore parse errors */
        }
        es.close()
        currentEventSource = null
        currentRunId = null
        finalizeAssistantBubble()
        setFormEnabled(true)
      })

      function streamEnded() {
        if (suspended) return
        es.close()
        currentEventSource = null
        currentRunId = null
        finalizeAssistantBubble()
        setFormEnabled(true)
        hideApproval()
      }

      es.addEventListener('complete', streamEnded)

      es.addEventListener('stream-error', (event) => {
        try {
          let data = JSON.parse(event.data)
          appendMessage('Stream error: ' + (data.error || 'unknown'), 'error')
        } catch {
          appendMessage('Stream error', 'error')
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
      appendMessage(message, 'user')
      ;(document.getElementById('test-input') as HTMLTextAreaElement)!.value = ''
      setFormEnabled(false)

      try {
        let res = await fetch('/testagent', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          let err = await res.json().catch(() => ({ error: 'Request failed' }))
          appendMessage('Error: ' + (err.error || res.statusText), 'error')
          setFormEnabled(true)
          return
        }
        let data = await res.json()
        if (data.threadId) currentThreadId = data.threadId
        if (data.runId) {
          startStream(data.runId)
        }
      } catch (err) {
        appendMessage('Error: ' + String(err), 'error')
        setFormEnabled(true)
      }
    }

    async function handleApproval(action: 'approve' | 'decline', e: Event) {
      let btn = e.currentTarget as HTMLButtonElement
      btn.disabled = true
      let runId = btn.dataset.runId
      let toolCallId = btn.dataset.toolCallId

      try {
        let body = new FormData()
        body.set('runId', runId || '')
        if (toolCallId) body.set('toolCallId', toolCallId)

        let res = await fetch('/testagent/' + action, {
          method: 'POST',
          body,
        })
        if (!res.ok) {
          appendMessage('Approval failed', 'error')
          setFormEnabled(true)
          hideApproval()
          return
        }
        let data = await res.json()
        hideApproval()
        if (data.requiresApproval) {
          showApproval({ runId: data.runId, toolCallId: data.toolCallId, toolName: data.toolName, args: data.args })
        } else if (data.runId) {
          startStream(data.runId)
        }
      } catch (err) {
        appendMessage('Approval error: ' + String(err), 'error')
        setFormEnabled(true)
        hideApproval()
      }
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let form = document.getElementById('test-form') as HTMLFormElement | null
            if (form) {
              form.addEventListener('submit', handleFormSubmit, {
                signal: handle.signal,
              })
            }
            let approveBtn = document.getElementById('test-approve-btn')
            let declineBtn = document.getElementById('test-decline-btn')
            if (approveBtn) {
              approveBtn.addEventListener(
                'click',
                (e) => handleApproval('approve', e),
                { signal: handle.signal },
              )
            }
            if (declineBtn) {
              declineBtn.addEventListener(
                'click',
                (e) => handleApproval('decline', e),
                { signal: handle.signal },
              )
            }
          }),
        ]}
      />
    )
  },
)

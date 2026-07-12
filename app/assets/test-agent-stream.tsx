import { clientEntry, css, ref, type Handle } from 'remix/ui'

export const TestAgentStream = clientEntry(
  import.meta.url + '#TestAgentStream',
  function TestAgentStream(handle: Handle) {
    let currentEventSource: EventSource | null = null
    let currentRunId: string | null = null
    let currentThreadId: string | null = null
    let streamingAssistant: HTMLDivElement | null = null
    let suspended = false

    // Tool lifecycle tracking
    let toolCards: Record<string, HTMLDivElement> = {}
    let toolArgsAcc: Record<string, string> = {}
    let reasoningBlock: HTMLDetailsElement | null = null
    let reasoningBody: HTMLDivElement | null = null

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

    function getTimeline(): HTMLElement | null {
      return document.getElementById('test-timeline')
    }

    let bubbleStyles: Record<string, [string, string, string]> = {
      user: ['#3b82f6', '#ffffff', 'flex-end'],
      assistant: ['transparent', 'inherit', 'flex-start'],
      error: ['#ef4444', '#ffffff', 'flex-start'],
    }

    function appendMessage(text: string, role: string, accumulate?: boolean) {
      let container = getTimeline()
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

    // ── Tool lifecycle helpers ──────────────────────────────────

    function cardHeaderHtml(icon: string, title: string): string {
      return `<span>${icon}</span><span style="font-weight:600">${esc(title)}</span><span style="margin-left:auto;font-size:0.75rem;transition:transform 0.15s">▾</span>`
    }

    function appendToolCard(toolName: string, toolCallId: string) {
      let container = getTimeline()
      if (!container || toolCards[toolCallId]) return

      let card = document.createElement('div')
      card.style.cssText =
        `border:1px solid var(--rmx-color-border-default);border-radius:8px;overflow:hidden;`

      let header = document.createElement('div')
      header.style.cssText =
        `display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;` +
        `cursor:pointer;user-select:none;font-size:0.875rem;background:var(--rmx-surface-lvl1);`
      header.innerHTML = cardHeaderHtml('🔧', toolName)
      header.onclick = () => {
        let body = card.querySelector('.tl-card-body') as HTMLElement | null
        let toggle = header.querySelector('span:last-child') as HTMLElement | null
        if (body) {
          let hidden = body.style.display === 'none'
          body.style.display = hidden ? '' : 'none'
          if (toggle) toggle.style.transform = hidden ? '' : 'rotate(-90deg)'
        }
      }

      let body = document.createElement('div')
      body.className = 'tl-card-body'
      body.style.cssText =
        `padding:0.5rem 0.75rem;font-size:0.8125rem;line-height:1.5;` +
        `font-family:monospace;white-space:pre-wrap;word-break:break-word;color:var(--rmx-color-text-secondary);`
      body.textContent = 'Waiting for arguments...'

      card.appendChild(header)
      card.appendChild(body)
      container.appendChild(card)
      toolCards[toolCallId] = card
      toolArgsAcc[toolCallId] = ''

      container.scrollTop = container.scrollHeight
    }

    function updateToolArgs(toolCallId: string, argsTextDelta: string) {
      if (!toolArgsAcc.hasOwnProperty(toolCallId)) return
      toolArgsAcc[toolCallId] += argsTextDelta
      let card = toolCards[toolCallId]
      if (!card) return
      let body = card.querySelector('.tl-card-body') as HTMLElement | null
      if (!body) return
      let acc = toolArgsAcc[toolCallId]
      try {
        let parsed = JSON.parse(acc)
        body.textContent = JSON.stringify(parsed, null, 2)
      } catch {
        body.textContent = acc
      }
    }

    function finalizeToolArgs(toolCallId: string, args: Record<string, unknown>) {
      if (!toolCards[toolCallId]) return
      let card = toolCards[toolCallId]
      let body = card.querySelector('.tl-card-body') as HTMLElement | null
      if (!body) return
      body.textContent = JSON.stringify(args, null, 2)
    }

    function appendToolResult(toolCallId: string, result: unknown, isError?: boolean) {
      let card = toolCards[toolCallId]
      if (!card) return
      removeResultOrError(card)
      let div = document.createElement('div')
      div.className = 'tl-card-result'
      if (isError) {
        div.style.cssText =
          `padding:0.5rem 0.75rem;font-size:0.8125rem;color:#fff;` +
          `background:#ef4444;border-top:1px solid var(--rmx-color-border-default);`
        div.textContent = typeof result === 'string' ? result : 'Error: ' + JSON.stringify(result)
      } else {
        div.style.cssText =
          `padding:0.5rem 0.75rem;font-size:0.8125rem;color:var(--rmx-color-text-primary);` +
          `border-top:1px solid var(--rmx-color-border-default);`
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          let r = result as Record<string, unknown>
          if (Array.isArray(r.files)) {
            let count = (r as Record<string, unknown>)._truncated
              ? `${r.files.length}+ (truncated)`
              : `${r.files.length}`
            div.innerHTML =
              `<div style="font-weight:500">${r.files.length} file${r.files.length !== 1 ? 's' : ''} found</div>` +
              r.files
                .slice(0, 10)
                .map(
                  (f: unknown) =>
                    `<div style="display:flex;justify-content:space-between;padding:2px 0;font-family:monospace;font-size:0.75rem">` +
                    `<span>${esc((f as Record<string, unknown>).name as string)}</span>` +
                    `<span>${esc(String(((f as Record<string, unknown>).display as Record<string, unknown> | undefined)?.formattedSize ?? ''))}</span>` +
                    `</div>`,
                )
                .join('')
            if (r.files.length > 10) {
              div.innerHTML += `<div style="font-size:0.75rem;color:var(--rmx-color-text-secondary);padding-top:4px">and ${r.files.length - 10} more...</div>`
            }
          } else {
            div.textContent = typeof result === 'object' ? JSON.stringify(result, null, 2).slice(0, 500) : String(result)
          }
        } else {
          div.textContent = typeof result === 'string' ? result.slice(0, 500) : JSON.stringify(result).slice(0, 500)
        }
      }
      card.appendChild(div)
      let tl = getTimeline()
      if (tl) tl.scrollTop = tl.scrollHeight
    }

    function appendToolError(toolCallId: string, error: unknown) {
      appendToolResult(toolCallId, error, true)
    }

    function removeResultOrError(card: HTMLElement) {
      let toRemove: HTMLElement[] = []
      for (let i = 0; i < card.children.length; i++) {
        let el = card.children[i] as HTMLElement
        if (el.classList.contains('tl-card-result')) toRemove.push(el)
      }
      for (let el of toRemove) el.remove()
    }

    function appendStepStats(reason: string, usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) {
      let container = getTimeline()
      if (!container) return
      let div = document.createElement('div')
      div.style.cssText =
        `padding:0.25rem 0.75rem;font-size:0.75rem;color:var(--rmx-color-text-secondary);` +
        `background:var(--rmx-surface-lvl1);border-radius:4px;align-self:flex-start;`
      let parts: string[] = []
      if (usage?.totalTokens != null) {
        parts.push(`⚡ ${usage.totalTokens} tokens`)
        if (usage.promptTokens != null && usage.completionTokens != null) {
          parts.push(`(${usage.promptTokens}→${usage.completionTokens})`)
        }
      }
      if (reason) parts.push(`reason: ${reason}`)
      div.textContent = parts.join(' · ') || 'step finished'
      container.appendChild(div)
      container.scrollTop = container.scrollHeight
    }

    function startReasoning() {
      if (reasoningBlock) return
      let container = getTimeline()
      if (!container) return
      let details = document.createElement('details')
      details.style.cssText =
        `border:1px solid var(--rmx-color-border-default);border-radius:8px;overflow:hidden;`

      let summary = document.createElement('summary')
      summary.style.cssText =
        `display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;` +
        `cursor:pointer;user-select:none;font-size:0.875rem;font-weight:500;` +
        `background:var(--rmx-surface-lvl1);`
      summary.innerHTML = `<span>💭</span><span>Reasoning</span>`

      let body = document.createElement('div')
      body.style.cssText =
        `padding:0.5rem 0.75rem;font-size:0.8125rem;line-height:1.5;` +
        `color:var(--rmx-color-text-secondary);white-space:pre-wrap;word-break:break-word;`

      details.appendChild(summary)
      details.appendChild(body)
      container.appendChild(details)
      reasoningBlock = details
      reasoningBody = body
      container.scrollTop = container.scrollHeight
    }

    function appendReasoning(text: string) {
      if (!reasoningBody) return
      reasoningBody.textContent += text
      let tl = getTimeline()
      if (tl) tl.scrollTop = tl.scrollHeight
    }

    function endReasoning() {
      reasoningBlock = null
      reasoningBody = null
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

    let pendingQuestion: {
      runId: string
      toolCallId?: string
      selectionMode: string
    } | null = null

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
      let card = document.getElementById('test-question')
      let textEl = document.getElementById('test-question-text')
      let optionsEl = document.getElementById('test-question-options')
      if (!card || !textEl || !optionsEl) return
      textEl.textContent = data.question

      if (data.options && data.options.length > 0) {
        if (data.selectionMode === 'multi_select') {
          optionsEl.innerHTML = data.options
            .map(
              (o) =>
                `<label style="display:block;margin:4px 0;cursor:pointer">` +
                `<input type="checkbox" name="q_option" value="${esc(o.label)}" /> ` +
                esc(o.label) +
                (o.description ? ` <span style="opacity:0.6;font-size:0.85em">— ${esc(o.description)}</span>` : '') +
                `</label>`,
            )
            .join('')
        } else {
          optionsEl.innerHTML = data.options
            .map(
              (o, i) =>
                `<label style="display:block;margin:4px 0;cursor:pointer">` +
                `<input type="radio" name="q_option" value="${esc(o.label)}" ${i === 0 ? 'checked' : ''} /> ` +
                esc(o.label) +
                (o.description ? ` <span style="opacity:0.6;font-size:0.85em">— ${esc(o.description)}</span>` : '') +
                `</label>`,
            )
            .join('')
        }
      } else {
        optionsEl.innerHTML =
          `<input id="q-free-text" type="text" style="width:100%;padding:0.5rem;border:1px solid #ccc;border-radius:6px;font-size:0.9rem;box-sizing:border-box" placeholder="Type your answer..." />`
        setTimeout(() => {
          let input = document.getElementById('q-free-text')
          if (input) {
            input.addEventListener('keydown', (e) => {
              if ((e as KeyboardEvent).key === 'Enter') handleAnswer()
            })
          }
        }, 0)
      }

      card.style.display = 'block'
    }

    function hideQuestion() {
      pendingQuestion = null
      let card = document.getElementById('test-question')
      if (card) card.style.display = 'none'
    }

    function getAnswer(): string {
      let optionsEl = document.getElementById('test-question-options')
      if (!optionsEl) return ''
      let freeText = document.getElementById('q-free-text') as HTMLInputElement | null
      if (freeText) return freeText.value

      let checked = optionsEl.querySelectorAll('input[type="checkbox"]:checked') as NodeListOf<HTMLInputElement>
      if (checked.length > 0) {
        return JSON.stringify(Array.from(checked).map((cb) => cb.value))
      }

      let selected = optionsEl.querySelector('input[type="radio"]:checked') as HTMLInputElement | null
      return selected?.value || ''
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
      toolCards = {}
      toolArgsAcc = {}
      reasoningBlock = null
      reasoningBody = null
      hideQuestion()

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

      es.addEventListener('question', (event) => {
        suspended = true
        try {
          let data = JSON.parse(event.data)
          showQuestion(data)
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

      // ── Tool lifecycle event handlers ────────────────────────

      es.addEventListener('tool-call-input-streaming-start', (event) => {
        try {
          let data = JSON.parse(event.data)
          appendToolCard(data.toolName || 'unknown', data.toolCallId || '')
        } catch { /* ignore */ }
      })

      es.addEventListener('tool-call-delta', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.toolCallId && data.argsTextDelta != null) {
            updateToolArgs(data.toolCallId, data.argsTextDelta as string)
          }
        } catch { /* ignore */ }
      })

      es.addEventListener('tool-call-input-streaming-end', () => {
        /* args streaming complete — tool-call event follows */
      })

      es.addEventListener('tool-call', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.toolCallId && data.args) {
            finalizeToolArgs(data.toolCallId, data.args as Record<string, unknown>)
          }
        } catch { /* ignore */ }
      })

      es.addEventListener('tool-result', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.toolCallId) {
            appendToolResult(data.toolCallId, data.result, data.isError)
          }
        } catch { /* ignore */ }
      })

      es.addEventListener('tool-error', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.toolCallId) {
            appendToolError(data.toolCallId, data.error)
          }
        } catch { /* ignore */ }
      })

      es.addEventListener('step-finish', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.usage || data.reason) {
            appendStepStats(data.reason || '', data.usage || {})
          }
        } catch { /* ignore */ }
      })

      // ── Reasoning event handlers ─────────────────────────────

      es.addEventListener('reasoning-start', () => {
        startReasoning()
      })

      es.addEventListener('reasoning-delta', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.text) appendReasoning(data.text as string)
        } catch { /* ignore */ }
      })

      es.addEventListener('reasoning-end', () => {
        endReasoning()
      })
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

    async function handleAnswer() {
      if (!pendingQuestion) return
      let answer = getAnswer()
      if (!answer) return

      let btn = document.getElementById('test-answer-btn') as HTMLButtonElement | null
      if (btn) {
        btn.disabled = true
        btn.textContent = 'Submitting...'
      }

      try {
        let body = new FormData()
        body.set('runId', pendingQuestion.runId)
        body.set('answer', answer)
        body.set('selectionMode', pendingQuestion.selectionMode)
        if (pendingQuestion.toolCallId) body.set('toolCallId', pendingQuestion.toolCallId)

        setFormEnabled(false)

        let res = await fetch('/testagent/answer', {
          method: 'POST',
          body,
        })
        if (!res.ok) {
          appendMessage('Failed to submit answer', 'error')
          if (btn) { btn.disabled = false; btn.textContent = 'Answer' }
          setFormEnabled(true)
          return
        }
        hideQuestion()
        let data = await res.json()
        if (data.runId) {
          startStream(data.runId)
        }
      } catch (err) {
        appendMessage('Answer error: ' + String(err), 'error')
        if (btn) { btn.disabled = false; btn.textContent = 'Answer' }
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
            let answerBtn = document.getElementById('test-answer-btn')
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
            if (answerBtn) {
              answerBtn.addEventListener(
                'click',
                handleAnswer,
                { signal: handle.signal },
              )
            }
          }),
        ]}
      />
    )
  },
)

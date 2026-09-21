import { clientEntry, css, ref, type Handle } from 'remix/ui'
import { theme } from '../../../ui/theme/theme.ts'
import { setupAutoGrowTextarea } from '../../../ui/auto-grow-textarea.ts'
import { routes } from '../../../routes.ts'
import { renderMarkdownToDom } from './markdown-dom.ts'
import { renderAgentApprovalCard, renderAgentQuestionCard } from '../../../ui/agent-chat/cards.ts'
import { readEventStream } from './read-sse.ts'

export const SupportAgentStream = clientEntry(
  import.meta.url + '#SupportAgentStream',
  function SupportAgentStream(handle: Handle) {
    let abortController: AbortController | null = null
    let currentRunId: string | null = null
    let currentThreadId: string | null = null
    // The page key and chat element that produced `currentThreadId`, so a value
    // the entry captured itself is only reused while that same page is on screen.
    let startedOnPage: string = ''
    let startedChatEl: HTMLElement | null = null
    let didNavigate: boolean = false
    let autoGrowReset: (() => void) | null = null

    let submitting: boolean = false

    let currentAgentMessageEl: HTMLElement | null = null

    // The most recent submit, so a failed turn can be retried with one click.
    let lastSubmission: { url: string; init: RequestInit } | null = null
    let thinkingEl: HTMLElement | null = null

    let pendingQuestion: {
      runId: string
      toolCallId?: string | undefined
      selectionMode: string
    } | null = null

    // ── Helpers ──────────────────────────────────────────────────────

    function getChat() {
      return document.getElementById('chat-messages')
    }

    function currentPageKey(): string {
      try {
        let url = new URL(window.location.href)
        return url.pathname + url.search
      } catch {
        return ''
      }
    }

    /**
     * Which conversation the next turn belongs to, decided by the page on
     * screen rather than by this entry's closure.
     *
     * The server-rendered `data-thread-id` is the only adoption signal: the
     * server renders it exactly when it validated and opened the requested
     * thread. A `?threadId=` that appears only in the URL was therefore not
     * adopted (unknown, foreign, or rejected) and must not be posted — doing so
     * would target a conversation the page never opened. The id this entry
     * captured is reused only while the page and chat element that produced it
     * are still on screen — an in-app navigation or a frame reload can otherwise
     * leave a stale thread in the closure and silently continue a conversation
     * the admin has left.
     */
    function resolveThreadId(): string | null {
      let fromDom = getChat()?.getAttribute('data-thread-id') ?? ''
      if (fromDom) return fromDom

      if (
        currentThreadId &&
        startedOnPage !== '' &&
        startedOnPage === currentPageKey() &&
        startedChatEl !== null &&
        getChat() === startedChatEl
      ) {
        return currentThreadId
      }

      return null
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

    // ── Thinking indicator ─────────────────────────────────────────

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

    // ── URL / thread reflection ────────────────────────────────────

    /**
     * Adopts a thread id the server created or resumed into the page state and
     * the address bar, so a reload restores the conversation instead of
     * starting empty.
     */
    function reflectThreadInUrl(threadId: string) {
      let chat = getChat()
      if (chat) chat.setAttribute('data-thread-id', threadId)
      try {
        let url = new URL(window.location.href)
        if (url.searchParams.get('threadId') !== threadId) {
          url.searchParams.set('threadId', threadId)
          window.history.replaceState({}, '', url.pathname + url.search)
        }
      } catch {
        /* best-effort */
      }
    }

    // ── Preview pane ───────────────────────────────────────────────

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
      let frame = handle.frames.get('support-agent-panel')
      if (frame) {
        frame.src = routes.admin.supportAgent.panel.href()
        frame.reload().catch(() => {})
      }
    }

    // ── Error + retry ──────────────────────────────────────────────

    function showErrorWithRetry(message: string, retryDelayMs = 2000) {
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
        if (lastSubmission) {
          setFormEnabled(false)
          startStream(lastSubmission.url, lastSubmission.init)
        }
      }
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
      if (text) {
        bubble.textContent = text
        bubble.dataset.kind = 'text'
      }

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

    // ── Question rendering (fresh bubble, never clobbers streamed text) ──

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
      hideThinking()
      let el = appendAgentMessage()

      renderAgentQuestionCard({
        variant: 'support',
        mount: el,
        question: data.question,
        options: data.options,
        selectionMode: data.selectionMode,
        onAnswer: (answer) => handleAnswer(answer),
        onError: (err) => {
          pendingQuestion = null
          appendStatusMessage('Fehler beim Anzeigen der Frage: ' + String(err), true)
        },
      })
    }

    // ── Suspension rendering (fresh bubble, never clobbers streamed text) ──

    function showSuspension(data: {
      toolCallId?: string
      toolName?: string
      args?: Record<string, unknown>
    }) {
      hideThinking()
      let el = appendAgentMessage()

      renderAgentApprovalCard({
        variant: 'support',
        mount: el,
        toolName: data.toolName,
        onApprove: () => handleToolDecision('approve', data.toolCallId),
        onDecline: () => handleToolDecision('decline', data.toolCallId),
      })
    }

    // ── Structured tool-result rendering ─────────────────────────────

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
        setPreviewVisible(true, href)
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

    // ── Reconnect: re-surface a pending gate after a reload ───────────

    async function checkReconnect() {
      try {
        let res = await fetch('/admin/support-agent/reconnect', {
          headers: { 'X-Sse-Request': '1' },
        })
        if (!res.ok) return
        let data = await res.json()
        if (!data || data.status !== 'suspended') return

        currentRunId = data.runId
        currentThreadId = data.threadId
        if (data.threadId) {
          startedOnPage = currentPageKey()
          startedChatEl = getChat()
        }
        currentAgentMessageEl = null
        appendAgentMessage()
        // Disable the message input until the re-surfaced gate is resolved, so
        // the admin can't start a new query on top of a pending decision.
        setFormEnabled(false)

        if (data.gateType === 'question') {
          let sp = (data.suspendPayload || {}) as {
            question?: string
            options?: { label: string; description?: string }[]
            selectionMode?: string
          }
          showQuestion({
            runId: data.runId,
            toolCallId: data.toolCallId,
            question: sp.question || 'Bitte beantworte die Frage.',
            options: sp.options ?? null,
            selectionMode: sp.selectionMode || 'single_select',
          })
        } else {
          showSuspension({
            toolCallId: data.toolCallId,
            toolName: data.toolName,
            args: data.args,
          })
        }
      } catch {
        /* reconnect is best-effort; ignore connection errors */
      }
    }

    // ── SSE Stream ───────────────────────────────────────────────────

    async function startStream(url: string, init: RequestInit) {
      pendingQuestion = null
      abortStream()
      abortController = new AbortController()
      let signal = abortController.signal
      let streamingText = ''
      lastSubmission = { url, init }
      showThinking()

      try {
        let res = await fetch(url, {
          ...init,
          signal,
          headers: { 'X-Sse-Request': '1', ...(init.headers ?? {}) },
        })
        if (!res.ok) {
          let text = await res.text().catch(() => '')
          let match = text.match(/data: (.*)\n/)
          let msg = match ? (JSON.parse(match[1]!).error ?? res.statusText) : res.statusText
          hideThinking()
          showErrorWithRetry('Fehler: ' + msg)
          setFormEnabled(true)
          return
        }

        let stopped = await readEventStream(
          res,
          (eventType, data) => {
            try {
              let parsed = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>

              if (eventType === 'start') {
                didNavigate = false
                hideThinking()
                if (parsed.runId) currentRunId = String(parsed.runId)
                if (parsed.threadId) {
                  currentThreadId = String(parsed.threadId)
                  startedOnPage = currentPageKey()
                  startedChatEl = getChat()
                  reflectThreadInUrl(String(parsed.threadId))
                }
                appendAgentMessage()
                streamingText = ''
              } else if (eventType === 'message') {
                streamingText += String(parsed.text ?? '')
                updateLastAgentMessage(streamingText)
              } else if (eventType === 'navigate') {
                didNavigate = true
                appendStatusMessage('Navigiere zu ' + String(parsed.href) + '...')
                handleNavigate({
                  href: String(parsed.href),
                  ...(parsed.target !== undefined ? { target: String(parsed.target) } : {}),
                  ...(parsed.history !== undefined ? { history: String(parsed.history) } : {}),
                })
              } else if (eventType === 'question') {
                showQuestion(parsed as unknown as Parameters<typeof showQuestion>[0])
                return false
              } else if (eventType === 'suspension') {
                showSuspension(parsed as unknown as Parameters<typeof showSuspension>[0])
                return false
              } else if (eventType === 'tool-error') {
                appendStatusMessage('Tool-Fehler: ' + String(parsed.error ?? 'unbekannt'), true)
              } else if (eventType === 'tool-result') {
                renderToolResult((parsed.result as Record<string, unknown>) ?? {})
              } else if (eventType === 'stream-error') {
                hideThinking()
                showErrorWithRetry('Stream-Fehler: ' + String(parsed.error ?? 'unbekannt'))
              } else if (eventType === 'complete') {
                if (pendingQuestion) return false
                hideThinking()
                finalizeAgentMessage()
                lastSubmission = null
                currentRunId = null
                // Keep the active thread so the next message continues it; only
                // remove it once the page itself changes (see resolveThreadId).
                currentAgentMessageEl = null
                if (!didNavigate) {
                  let container = document.getElementById('support-agent-frame-container')
                  let activeFrame =
                    container?.getAttribute('data-active-frame') ?? 'support-agent-panel'
                  let theFrame = handle.frames.get(activeFrame)
                  if (theFrame) theFrame.reload().catch(() => {})
                }
              } else if (eventType === 'agent-error') {
                hideThinking()
                showErrorWithRetry('Fehler: ' + String(parsed.error ?? 'unbekannt'))
              }
            } catch {
              if (eventType === 'message') {
                streamingText += typeof data === 'string' ? data : ''
                updateLastAgentMessage(streamingText)
              }
            }
          },
          { signal },
        )

        if (!stopped && !pendingQuestion) {
          hideThinking()
          setFormEnabled(true)
        }
      } catch (err) {
        hideThinking()
        if ((err as Error)?.name === 'AbortError') return
        showErrorWithRetry('Fehler: ' + String(err))
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
        let headers: Record<string, string> = { 'X-Sse-Request': '1' }
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

      let threadId = resolveThreadId()
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

      startStream('/admin/support-agent', { method: 'POST', body: formData })
    }

    function handleTextareaKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        let form = document.getElementById('support-agent-form') as HTMLFormElement | null
        if (form) form.requestSubmit()
      }
    }

    // ── Empty-state prompts / controls ────────────────────────────────

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

    // ── Return (lifecycle) ───────────────────────────────────────────

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
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

            let container = document.getElementById('support-agent-frame-container')
            if (container) {
              container.addEventListener('submit', handleFrameFormSubmit, {
                signal: handle.signal,
              })
              container.addEventListener('click', handlePanelClick, {
                signal: handle.signal,
              })
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
            checkReconnect()
          }),
        ]}
      />
    )
  },
)

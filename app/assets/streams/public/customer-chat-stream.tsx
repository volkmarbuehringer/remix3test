import { clientEntry, css, ref, type Handle } from 'remix/ui'

import { theme } from '../../../ui/theme/theme.ts'
import { setupAutoGrowTextarea } from '../../../ui/auto-grow-textarea.ts'
import { readEventStream } from './read-sse.ts'
import { renderAgentApprovalCard, renderAgentQuestionCard } from '../../../ui/agent-chat/cards.ts'

export const CustomerChatStream = clientEntry(
  import.meta.url + '#CustomerChatStream',
  function CustomerChatStream(handle: Handle) {
    let ac = new AbortController()
    let lifecycleSignal = (handle.signal ?? ac.signal) as AbortSignal
    if (handle.signal) {
      handle.signal.addEventListener('abort', () => ac.abort(), { once: true })
    }

    let currentRunId: string | null = null
    let currentThreadId: string | null = null
    let currentAbort: AbortController | null = null
    let streamingAssistant: HTMLDivElement | null = null
    let suspended = false
    let autoGrowReset: (() => void) | null = null

    let toolCards: Record<string, HTMLDivElement> = {}
    let toolArgsAcc: Record<string, string> = {}
    let reasoningBlock: HTMLDetailsElement | null = null
    let reasoningBody: HTMLDivElement | null = null

    function abortStream() {
      if (currentAbort) {
        currentAbort.abort()
        currentAbort = null
      }
    }

    function esc(s: string): string {
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    function getChatArea(): HTMLElement | null {
      return document.getElementById('chat-messages')
    }

    /**
     * Scrolls the transcript to the newest content, but only when the reader is
     * already near the bottom. Forcing `scrollTop = scrollHeight` on every chunk
     * yanked a customer who had scrolled up to re-read back down mid-turn.
     */
    function scrollToBottom(force?: boolean) {
      let chat = getChatArea()
      if (!chat) return
      if (!force) {
        let threshold = 50
        let atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < threshold
        if (!atBottom) return
      }
      chat.scrollTop = chat.scrollHeight
    }

    function appendMessage(text: string, role: string, accumulate?: boolean) {
      let container = getChatArea()
      if (!container) return
      if (accumulate && streamingAssistant) {
        streamingAssistant.textContent += text
      } else {
        let isUser = role === 'user'
        let isError = role === 'error'
        let background = isError
          ? theme.colors.action.danger.background
          : isUser
            ? theme.colors.action.primary.background
            : theme.surface.lvl1
        let color = isError
          ? theme.colors.action.danger.foreground
          : isUser
            ? theme.colors.action.primary.foreground
            : theme.colors.text.primary
        let bubble = document.createElement('div')
        bubble.style.cssText =
          `padding:0.75rem;border-radius:12px;max-width:75%;` +
          `line-height:1.5;font-size:0.9375rem;` +
          `background:${background};color:${color};` +
          `align-self:${isUser ? 'flex-end' : 'flex-start'};` +
          `border-bottom-${isUser ? 'right' : 'left'}-radius:4px;` +
          (isError ? `border:1px solid ${theme.colors.action.danger.border};` : '') +
          `white-space:pre-wrap;word-break:break-word;`
        // An error is announced as an alert instead of masquerading as a reply.
        if (isError) bubble.setAttribute('role', 'alert')
        bubble.textContent = text
        container.appendChild(bubble)
        // Only assistant bubbles accumulate; otherwise a streamed reply would
        // be appended into a preceding error/other bubble.
        if (role === 'assistant') streamingAssistant = bubble
      }
      scrollToBottom(role === 'user')
    }

    // `ask_user` renders its own question card (showQuestion); the raw
    // tool-call args JSON above it is noise, so its tool card is suppressed.
    let SILENT_TOOL_NAMES = new Set(['ask_user', 'askUserTool'])

    function appendToolCard(toolName: string, toolCallId: string) {
      let container = getChatArea()
      if (!container || !toolCallId || toolCards[toolCallId]) return
      // Returning before registering the id also suppresses the later
      // tool-call-delta / tool-call / tool-result for the same call.
      if (SILENT_TOOL_NAMES.has(toolName)) return

      let card = document.createElement('div')
      card.style.cssText = `border:1px solid ${theme.colors.border.default};border-radius:8px;overflow:hidden;align-self:flex-start;width:100%;`

      let header = document.createElement('div')
      header.style.cssText =
        `display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;` +
        `cursor:pointer;user-select:none;font-size:0.875rem;font-weight:500;` +
        `background:${theme.surface.lvl1};`
      header.innerHTML = `<span style="opacity:0.6;font-size:1em">&#9881;</span><span>${esc(toolName)}</span><span style="margin-left:auto;font-size:0.75rem;transition:transform 0.15s">&#9662;</span>`
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
        `font-family:monospace;white-space:pre-wrap;word-break:break-word;color:${theme.colors.text.secondary};`
      body.textContent = 'Warte auf Argumente...'

      card.appendChild(header)
      card.appendChild(body)
      container.appendChild(card)
      toolCards[toolCallId] = card
      toolArgsAcc[toolCallId] = ''

      scrollToBottom()
    }

    function updateToolArgs(toolCallId: string, argsTextDelta: string) {
      if (!toolArgsAcc.hasOwnProperty(toolCallId)) return
      toolArgsAcc[toolCallId] += argsTextDelta
      let card = toolCards[toolCallId]
      if (!card) return
      let body = card.querySelector('.tl-card-body') as HTMLElement | null
      if (!body) return
      let acc = toolArgsAcc[toolCallId]!
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

    function removeResultOrError(card: HTMLElement) {
      let toRemove: HTMLElement[] = []
      for (let i = 0; i < card.children.length; i++) {
        let el = card.children[i] as HTMLElement
        if (el.classList.contains('tl-card-result')) toRemove.push(el)
      }
      for (let el of toRemove) el.remove()
    }

    function appendToolResult(
      toolCallId: string,
      result: unknown,
      isError?: boolean,
      toolName?: string,
    ) {
      // A result can arrive without a preceding streaming-start chunk (Mastra
      // emits that chunk separately). Create the card here too, otherwise the
      // result — including the booking slot picker — would be dropped.
      let card = toolCards[toolCallId]
      if (!card) {
        appendToolCard(toolName || 'Werkzeug', toolCallId)
        card = toolCards[toolCallId]
        if (!card) return
      }
      removeResultOrError(card)

      let div = document.createElement('div')
      div.className = 'tl-card-result'
      if (isError) {
        div.style.cssText =
          `padding:0.5rem 0.75rem;font-size:0.8125rem;` +
          `color:${theme.colors.action.danger.foreground};` +
          `background:${theme.colors.action.danger.background};` +
          `border-top:1px solid ${theme.colors.border.default};`
        div.textContent = typeof result === 'string' ? result : 'Fehler: ' + JSON.stringify(result)
      } else {
        div.style.cssText =
          `padding:0.5rem 0.75rem;font-size:0.8125rem;color:${theme.colors.text.primary};` +
          `border-top:1px solid ${theme.colors.border.default};`
        if (result && typeof result === 'object') {
          let r = result as Record<string, unknown>
          if (r.slots && Array.isArray(r.slots)) {
            div.innerHTML = `<div style="font-size:0.8125rem;color:${theme.colors.text.secondary}">Verfügbare Termine werden unten angezeigt.</div>`
            appendSlotPicker(r)
          } else {
            div.textContent =
              typeof result === 'object'
                ? JSON.stringify(result, null, 2).slice(0, 500)
                : String(result)
          }
        } else {
          div.textContent = String(result).slice(0, 500)
        }
      }
      card.appendChild(div)
      scrollToBottom()
    }

    function appendSlotPicker(result: Record<string, unknown>) {
      let SLOTS_PER_PAGE = 10
      let container = getChatArea()
      if (!container) return
      let old = document.getElementById('chat-slot-picker')
      if (old) old.remove()

      let slots = result.slots as Array<Record<string, unknown>> | undefined
      if (!slots || slots.length === 0) return

      let resourceName = esc(String(result.resource_name ?? ''))

      let pages: (typeof slots)[] = []
      for (let i = 0; i < slots.length; i += SLOTS_PER_PAGE) {
        pages.push(slots.slice(i, i + SLOTS_PER_PAGE))
      }

      let html = `<div style="font-weight:600;font-size:1rem;margin-bottom:0.5rem">Termin buchen — ${resourceName}</div>`

      for (let pi = 0; pi < pages.length; pi++) {
        let pageSlots = pages[pi]!
        let display = pi === 0 ? '' : 'none'
        html += `<div id="slot-page-${pi}" style="display:${display}">`
        let groups = new Map<string, typeof slots>()
        for (let s of pageSlots) {
          let day = String(s.date_display ?? '')
          if (!groups.has(day)) groups.set(day, [])
          groups.get(day)!.push(s)
        }
        for (let [day, daySlots] of groups) {
          html += `<div style="font-size:0.85rem;font-weight:600;margin:0.5rem 0 0.25rem">${esc(day)}</div>`
          for (let s of daySlots) {
            let startMin = Number(s.start_min ?? 0)
            let endMin = Number(s.end_min ?? 60)
            let label = `${formatMin(startMin)}–${formatMin(endMin)}`
            let data = JSON.stringify({
              resourceId: result.resource_id,
              dateEpochMs: s.date_epoch_ms,
              startMin,
              label,
              resourceName: result.resource_name,
            })
            html += `<button type="button" class="slot-btn" data-slot='${esc(data)}' style="display:inline-block;margin:0.2rem;padding:0.5rem 1rem;background:${theme.surface.lvl1};color:${theme.colors.text.primary};border:1px solid ${theme.colors.border.default};border-radius:6px;cursor:pointer;font-size:0.9rem;font-weight:500">${esc(label)}</button>`
          }
        }
        html += `</div>`
      }

      if (pages.length > 1) {
        html += `<div id="slot-pagination" style="display:flex;align-items:center;justify-content:center;gap:0.75rem;margin-top:0.75rem;font-size:0.85rem">`
        html += `<button type="button" class="page-prev-btn" style="padding:0.3rem 0.75rem;background:${theme.surface.lvl1};color:${theme.colors.text.primary};border:1px solid ${theme.colors.border.default};border-radius:4px;cursor:pointer;font-size:0.85rem;opacity:0.5" disabled>← Zurück</button>`
        html += `<span id="slot-page-indicator">Seite 1 von ${pages.length}</span>`
        html += `<button type="button" class="page-next-btn" style="padding:0.3rem 0.75rem;background:${theme.surface.lvl1};color:${theme.colors.text.primary};border:1px solid ${theme.colors.border.default};border-radius:4px;cursor:pointer;font-size:0.85rem">Weiter →</button>`
        html += `</div>`
      }

      html += `<div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;padding-top:0.5rem;border-top:1px solid ${theme.colors.border.default}">`
      html += `<button type="button" class="slot-other-resource-btn" style="padding:0.4rem 0.75rem;background:${theme.surface.lvl1};color:${theme.colors.text.primary};border:1px solid ${theme.colors.border.default};border-radius:6px;cursor:pointer;font-size:0.85rem">Andere Ressource</button>`
      html += `<button type="button" class="slot-close-btn" style="padding:0.4rem 0.75rem;background:transparent;color:${theme.colors.text.secondary};border:1px solid ${theme.colors.border.default};border-radius:6px;cursor:pointer;font-size:0.85rem">Schließen</button>`
      html += `</div>`

      let picker = document.createElement('div')
      picker.id = 'chat-slot-picker'
      picker.style.cssText =
        `padding:1rem;border:2px solid ${theme.colors.border.default};border-radius:12px;` +
        `background:${theme.surface.lvl0};align-self:stretch;width:100%;margin-top:0.5rem;`
      picker.innerHTML = html
      container.appendChild(picker)
      scrollToBottom()

      if (pages.length <= 1) return

      let currentPage = 0
      let prevBtn = picker.querySelector('.page-prev-btn') as HTMLButtonElement | null
      let nextBtn = picker.querySelector('.page-next-btn') as HTMLButtonElement | null

      function showPage(n: number) {
        for (let pi = 0; pi < pages.length; pi++) {
          let pageEl = document.getElementById(`slot-page-${pi}`)
          if (pageEl) pageEl.style.display = pi === n ? '' : 'none'
        }
        if (prevBtn) {
          prevBtn.disabled = n === 0
          prevBtn.style.opacity = n === 0 ? '0.5' : '1'
        }
        if (nextBtn) {
          nextBtn.disabled = n >= pages.length - 1
          nextBtn.style.opacity = n >= pages.length - 1 ? '0.5' : '1'
        }
        let indicator = document.getElementById('slot-page-indicator')
        if (indicator) indicator.textContent = `Seite ${n + 1} von ${pages.length}`
        currentPage = n
      }

      prevBtn?.addEventListener('click', () => {
        if (currentPage > 0) showPage(currentPage - 1)
      })
      nextBtn?.addEventListener('click', () => {
        if (currentPage < pages.length - 1) showPage(currentPage + 1)
      })
    }

    function formatMin(m: number): string {
      let h = Math.floor(m / 60)
      let min = m % 60
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
    }

    function appendStepStats(
      reason: string,
      usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
    ) {
      let container = getChatArea()
      if (!container) return
      let div = document.createElement('div')
      div.style.cssText =
        `padding:0.25rem 0.75rem;font-size:0.75rem;color:${theme.colors.text.secondary};` +
        `background:${theme.surface.lvl1};border-radius:4px;align-self:flex-start;`
      let parts: string[] = []
      if (usage?.totalTokens != null) {
        parts.push(`${usage.totalTokens} Tokens`)
        if (usage.promptTokens != null && usage.completionTokens != null) {
          parts.push(`(${usage.promptTokens}→${usage.completionTokens})`)
        }
      }
      if (reason) parts.push(`Grund: ${reason}`)
      div.textContent = parts.join(' · ') || 'Schritt beendet'
      container.appendChild(div)
      scrollToBottom()
    }

    function startReasoning() {
      if (reasoningBlock) return
      let container = getChatArea()
      if (!container) return
      let details = document.createElement('details')
      details.style.cssText = `border:1px solid ${theme.colors.border.default};border-radius:8px;overflow:hidden;align-self:flex-start;width:100%;`

      let summary = document.createElement('summary')
      summary.style.cssText =
        `display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;` +
        `cursor:pointer;user-select:none;font-size:0.875rem;font-weight:500;` +
        `background:${theme.surface.lvl1};`
      summary.innerHTML = `<span>[...]</span><span>Überlege...</span>`

      let body = document.createElement('div')
      body.style.cssText =
        `padding:0.5rem 0.75rem;font-size:0.8125rem;line-height:1.5;` +
        `color:${theme.colors.text.secondary};white-space:pre-wrap;word-break:break-word;`

      details.appendChild(summary)
      details.appendChild(body)
      container.appendChild(details)
      reasoningBlock = details
      reasoningBody = body
      scrollToBottom()
    }

    function appendReasoning(text: string) {
      if (!reasoningBody) return
      reasoningBody.textContent += text
      scrollToBottom()
    }

    function endReasoning() {
      reasoningBlock = null
      reasoningBody = null
    }

    function finalizeAssistantBubble() {
      if (!streamingAssistant) return
      streamingAssistant.textContent = streamingAssistant.textContent || ''
      streamingAssistant = null
    }

    function setFormEnabled(enabled: boolean) {
      let textarea = document.getElementById('msg') as HTMLTextAreaElement | null
      let submitBtn = document.getElementById('chat-submit') as HTMLButtonElement | null
      if (textarea) textarea.disabled = !enabled
      if (submitBtn) submitBtn.disabled = !enabled
    }

    function focusComposer() {
      let textarea = document.getElementById('msg') as HTMLTextAreaElement | null
      if (textarea) textarea.focus()
    }

    /** Keeps the visible counter in sync with the textarea's own maxLength. */
    function updateCounter() {
      let counter = document.getElementById('chat-counter')
      let textarea = document.getElementById('msg') as HTMLTextAreaElement | null
      if (counter && textarea) {
        counter.textContent = `${textarea.value.length} / ${textarea.maxLength}`
      }
    }

    function handleTextareaKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        let form = document.getElementById('chat-form') as HTMLFormElement | null
        form?.requestSubmit()
      }
    }

    // ── Busy / thinking indicator + Cancel ────────────────────
    let BUSY_ID = 'chat-busy'

    function setBusy(busy: boolean) {
      let container = getChatArea()
      if (!container) return
      let el = document.getElementById(BUSY_ID) as HTMLDivElement | null
      if (busy) {
        if (!el) {
          el = document.createElement('div')
          el.id = BUSY_ID
          el.style.cssText =
            `display:flex;align-items:center;gap:0.75rem;align-self:flex-start;` +
            `padding:0.5rem 0.75rem;border-radius:${theme.radius.md};` +
            `background:${theme.surface.lvl1};font-size:0.875rem;color:${theme.colors.text.secondary};`
          el.innerHTML =
            `<span aria-live="polite">Agent antwortet…</span>` +
            `<button type="button" id="chat-cancel" style="padding:0.25rem 0.75rem;background:transparent;color:${theme.colors.text.secondary};border:1px solid ${theme.colors.border.default};border-radius:6px;font-size:0.8125rem;cursor:pointer">Abbrechen</button>`
          container.appendChild(el)
        }
        el.style.display = 'flex'
        scrollToBottom()
      } else {
        if (el) el.remove()
      }
    }

    function handleCancel() {
      abortStream()
      setBusy(false)
      setFormEnabled(true)
      focusComposer()
    }

    // Once the customer sends a message (or continues an existing conversation)
    // the one-shot fresh-state marker is no longer wanted: otherwise a page
    // refresh keeps serving an empty conversation for /chat?new=1. Drop the
    // query param so the resumed conversation wins on the next load.
    /**
     * Whether the page on screen is in fresh-conversation mode.
     *
     * `/chat?new=1` is the server's instruction to skip the resume, so it must
     * outrank any thread id this entry captured from an earlier page — an in-app
     * navigation reuses this entry's listener while swapping the page under it.
     */
    function isStartingFresh(): boolean {
      try {
        return new URL(window.location.href).searchParams.has('new')
      } catch {
        return false
      }
    }

    function clearFreshParam() {
      try {
        let url = new URL(window.location.href)
        if (!url.searchParams.has('new')) return
        url.searchParams.delete('new')
        window.history.replaceState({}, '', url.pathname + url.search)
      } catch {
        /* best-effort */
      }
    }

    // ── Approval UI ───────────────────────────────────────────

    function showApproval(data: {
      runId: string
      toolCallId?: string | undefined
      toolName?: string | undefined
      args?: Record<string, unknown> | undefined
    }) {
      let container = getChatArea()
      if (!container) return

      let args = data.args || {}
      let isCancelSingle = 'appointmentSummary' in args
      let isCancelAll = 'count' in args || 'appointmentSummaries' in args

      let title: string
      let description: string
      if (isCancelSingle) {
        title = 'Termin stornieren?'
        description = String(args.appointmentSummary ?? '')
      } else if (isCancelAll) {
        title = String(args.count ?? 0) + ' Termine stornieren?'
        description = (args.appointmentSummaries as string[] | undefined)?.join(', ') ?? ''
      } else {
        title = 'Aktion bestätigen'
        description = JSON.stringify(args, null, 2)
      }

      container.appendChild(
        renderAgentApprovalCard({
          variant: 'customer',
          runId: data.runId,
          toolCallId: data.toolCallId,
          title,
          description,
        }),
      )
      scrollToBottom()
    }

    function hideApproval() {
      let card = document.getElementById('chat-approval')
      if (card) card.remove()
    }

    // ── Question UI ───────────────────────────────────────────

    let pendingQuestion: {
      runId: string
      toolCallId?: string | undefined
      selectionMode: string
    } | null = null

    function showQuestion(data: {
      runId: string
      toolCallId?: string | undefined
      question: string
      options?: { label: string; description?: string }[] | null
      selectionMode: string
    }) {
      pendingQuestion = {
        runId: data.runId,
        toolCallId: data.toolCallId,
        selectionMode: data.selectionMode,
      }

      let container = getChatArea()
      if (!container) return

      container.appendChild(
        renderAgentQuestionCard({
          variant: 'customer',
          question: data.question,
          options: data.options,
          selectionMode: data.selectionMode,
        }),
      )
      scrollToBottom()
    }

    function hideQuestion() {
      pendingQuestion = null
      let card = document.getElementById('chat-question')
      if (card) card.remove()
    }

    function getAnswer(): string {
      let optionsEl = document.getElementById('q-options')
      let freeText = document.getElementById('q-free-text') as HTMLInputElement | null
      if (freeText) return freeText.value

      if (!optionsEl) return ''

      let checked = optionsEl.querySelectorAll(
        'input[type="checkbox"]:checked',
      ) as NodeListOf<HTMLInputElement>
      if (checked.length > 0) {
        return JSON.stringify(Array.from(checked).map((cb) => cb.value))
      }

      let selected = optionsEl.querySelector(
        'input[type="radio"]:checked',
      ) as HTMLInputElement | null
      return selected?.value || ''
    }

    // ── Stream lifecycle ──────────────────────────────────────

    function beginStream() {
      streamingAssistant = null
      suspended = false
      toolCards = {}
      toolArgsAcc = {}
      reasoningBlock = null
      reasoningBody = null
      hideQuestion()
    }

    function handleEvent(type: string, raw: unknown) {
      let d = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

      if (type === 'start') {
        if (d.threadId != null) currentThreadId = String(d.threadId)
        if (d.runId != null) currentRunId = String(d.runId)
        beginStream()
      } else if (type === 'message') {
        let text = String(d.text ?? '')
        if (text) {
          appendMessage(text, 'assistant', true)
          setBusy(false)
        }
      } else if (type === 'suspension') {
        suspended = true
        showApproval({
          runId: String(d.runId ?? currentRunId ?? ''),
          toolCallId: d.toolCallId as string | undefined,
          toolName: d.toolName as string | undefined,
          args: d.args as Record<string, unknown> | undefined,
        })
        let approveBtn = getChatArea()?.querySelector('.approve-btn') as HTMLButtonElement | null
        if (approveBtn) approveBtn.focus()
        finalizeAssistantBubble()
      } else if (type === 'question') {
        suspended = true
        showQuestion({
          runId: String(d.runId ?? currentRunId ?? ''),
          toolCallId: d.toolCallId as string | undefined,
          question: String(d.question ?? ''),
          options:
            (d.options as { label: string; description?: string }[] | null | undefined) ?? null,
          selectionMode: String(d.selectionMode ?? 'single_select'),
        })
        let firstOpt = getChatArea()?.querySelector('.q-option') as HTMLInputElement | null
        let freeText = document.getElementById('q-free-text') as HTMLInputElement | null
        if (firstOpt) firstOpt.focus()
        else if (freeText) freeText.focus()
        finalizeAssistantBubble()
      } else if (type === 'agent-error') {
        appendMessage('Fehler: ' + String(d.error ?? 'unbekannt'), 'error')
      } else if (type === 'stream-error') {
        appendMessage('Stream-Fehler: ' + String(d.error ?? 'unbekannt'), 'error')
      } else if (type === 'tool-call-input-streaming-start') {
        appendToolCard(String(d.toolName ?? 'unbekannt'), String(d.toolCallId ?? ''))
        setBusy(false)
      } else if (type === 'tool-call-delta') {
        if (d.toolCallId != null && d.argsTextDelta != null) {
          updateToolArgs(String(d.toolCallId), String(d.argsTextDelta))
        }
      } else if (type === 'tool-call') {
        if (d.toolCallId != null && d.args != null) {
          finalizeToolArgs(String(d.toolCallId), d.args as Record<string, unknown>)
        }
      } else if (type === 'tool-result') {
        if (d.toolCallId != null)
          appendToolResult(
            String(d.toolCallId),
            d.result,
            d.isError as boolean,
            d.toolName as string | undefined,
          )
      } else if (type === 'tool-error') {
        if (d.toolCallId != null)
          appendToolResult(String(d.toolCallId), d.error, true, d.toolName as string | undefined)
      } else if (type === 'step-finish') {
        if (d.usage != null || d.reason != null) {
          appendStepStats(
            String(d.reason ?? ''),
            (d.usage as Record<string, never> | undefined) ?? {},
          )
        }
      } else if (type === 'reasoning-start') {
        startReasoning()
        setBusy(false)
      } else if (type === 'reasoning-delta') {
        if (d.text != null) appendReasoning(String(d.text))
      } else if (type === 'reasoning-end') {
        endReasoning()
      }
    }

    async function submitAndStream(url: string, formData: FormData) {
      abortStream()
      let requestAbort = new AbortController()
      currentAbort = requestAbort
      if (lifecycleSignal) {
        lifecycleSignal.addEventListener('abort', () => requestAbort.abort(), { once: true })
      }

      // The `?new=1` marker is what keeps a refresh on the fresh conversation
      // instead of resuming the previous one, so it may only be dropped once a
      // turn has actually been accepted by the server. Dropping it up front
      // meant a failed first turn — or one still in flight when the customer hit
      // refresh — silently resumed the old thread, so a "new" conversation
      // looked like it was continuing the previous one.
      let turnAccepted = false
      setFormEnabled(false)
      setBusy(true)
      try {
        let res = await fetch(url, {
          method: 'POST',
          headers: { 'X-Sse-Request': '1' },
          body: formData,
          signal: requestAbort.signal,
        })

        let isSse = (res.headers.get('Content-Type') || '').includes('text/event-stream')

        if (!res.ok && !isSse) {
          let text = await res.text()
          appendMessage('Fehler: ' + (text || res.statusText), 'error')
          return
        }

        // Anything past this point has persisted the turn: the conversation
        // exists even if the stream then breaks, so the marker is spent.
        turnAccepted = true

        if (isSse) {
          await readEventStream(res, handleEvent)
        } else {
          await res.text()
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        appendMessage('Fehler: ' + String(err), 'error')
      } finally {
        if (turnAccepted) clearFreshParam()
        currentAbort = null
        setBusy(false)
        if (!suspended) {
          finalizeAssistantBubble()
          focusComposer()
        }
        setFormEnabled(true)
      }
    }

    // ── Reconnect: re-surface a pending gate after a reload ───

    /**
     * Restores a still-suspended `ask_user` question or tool approval after a
     * reload. The transcript rehydration only restores text, so without this
     * the card would be lost and the composer would start a new turn instead of
     * resuming the run.
     */
    async function checkReconnect() {
      try {
        let res = await fetch('/chat/reconnect', { headers: { 'X-Sse-Request': '1' } })
        if (!res.ok) return
        let data = (await res.json()) as {
          status?: string
          runId?: string
          threadId?: string
          gateType?: string
          toolCallId?: string
          toolName?: string
          args?: Record<string, unknown>
          suspendPayload?: Record<string, unknown>
        }
        if (!data || data.status !== 'suspended' || !data.runId) return

        currentRunId = data.runId
        if (data.threadId) currentThreadId = data.threadId
        suspended = true
        // Block the composer until the re-surfaced gate is resolved, so a new
        // turn can't be started on top of a pending decision.
        setFormEnabled(false)

        if (data.gateType === 'question') {
          let sp = (data.suspendPayload ?? {}) as {
            question?: string
            options?: { label: string; description?: string }[]
            selectionMode?: string
          }
          showQuestion({
            runId: data.runId,
            toolCallId: data.toolCallId,
            question: sp.question ?? 'Bitte beantworten Sie die Frage.',
            options: sp.options ?? null,
            selectionMode: sp.selectionMode ?? 'single_select',
          })
        } else {
          showApproval({
            runId: data.runId,
            toolCallId: data.toolCallId,
            toolName: data.toolName,
            args: data.args,
          })
        }
      } catch {
        /* reconnect is best-effort */
      }
    }

    // ── Event handlers ────────────────────────────────────────

    async function handleFormSubmit(e: Event) {
      e.preventDefault()
      let form = e.target as HTMLFormElement
      if (!form) return

      let formData = new FormData(form)
      let message = formData.get('message')?.toString().trim()
      if (!message) return

      // Which conversation a turn belongs to is decided by the page that is on
      // screen, not by this entry's captured state. "Neue Unterhaltung" is an
      // in-app navigation: the runtime reconciles the page and REUSES the form
      // element, so this listener — with the previous page's `currentThreadId`
      // still in its closure — can serve the fresh page. Posting that id
      // continued the old conversation even though the URL said `?new=1`.
      //
      // The URL wins over the closure: `?new=1` always starts a new thread, and
      // otherwise the rendered chat area is the source of truth.
      let startingFresh = isStartingFresh()
      if (!startingFresh && !currentThreadId) {
        currentThreadId = getChatArea()?.getAttribute('data-thread-id') ?? null
      }
      if (currentThreadId && !startingFresh) formData.set('threadId', currentThreadId)

      appendMessage(message, 'user')
      let textarea = document.getElementById('msg') as HTMLTextAreaElement | null
      if (textarea) textarea.value = ''
      autoGrowReset?.()
      updateCounter()
      beginStream()
      await submitAndStream('/chat', formData)
    }

    function handleSlotCancel() {
      abortStream()
      let picker = document.getElementById('chat-slot-picker')
      if (picker) picker.remove()
      setBusy(false)
      setFormEnabled(true)
      focusComposer()
    }

    async function handleSlotClick(e: Event) {
      let btn = e.target as HTMLButtonElement
      let raw = btn.dataset.slot
      if (!raw) return

      let slot: {
        resourceId: number
        dateEpochMs: number
        startMin: number
        label: string
        resourceName: string
      }
      try {
        slot = JSON.parse(raw)
      } catch {
        return
      }

      let dayStr = new Date(slot.dateEpochMs).toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      })
      let message = `Ich möchte den Termin am ${dayStr} um ${slot.label} bei ${slot.resourceName} buchen.`
      appendMessage(message, 'user')

      let formData = new FormData()
      if (currentThreadId) formData.set('threadId', currentThreadId)
      formData.set('message', message)

      beginStream()
      await submitAndStream('/chat', formData)
    }

    let submittingOtherResource = false

    async function handleOtherResource() {
      if (submittingOtherResource) return
      submittingOtherResource = true
      let message = 'Ich möchte eine andere Ressource ausprobieren.'
      appendMessage(message, 'user')

      let formData = new FormData()
      if (currentThreadId) formData.set('threadId', currentThreadId)
      formData.set('message', message)

      beginStream()
      await submitAndStream('/chat', formData)
      submittingOtherResource = false
    }

    async function handleApproval(action: 'approve' | 'decline', e: Event) {
      let btn = e.target as HTMLButtonElement
      btn.disabled = true
      let runId = btn.dataset.runId
      let toolCallId = btn.dataset.toolCallId

      hideApproval()
      beginStream()

      let body = new FormData()
      body.set('runId', runId || '')
      if (toolCallId) body.set('toolCallId', toolCallId)
      if (currentThreadId) body.set('threadId', currentThreadId)

      await submitAndStream('/chat/' + action, body)
    }

    async function handleAnswer() {
      if (!pendingQuestion) return
      let answer = getAnswer()
      if (!answer) return

      let btn = document.getElementById('q-answer-btn') as HTMLButtonElement | null
      if (btn) {
        btn.disabled = true
        btn.textContent = 'Sende...'
      }

      let body = new FormData()
      body.set('runId', pendingQuestion.runId)
      body.set('answer', answer)
      body.set('selectionMode', pendingQuestion.selectionMode)
      if (pendingQuestion.toolCallId) body.set('toolCallId', pendingQuestion.toolCallId)
      if (currentThreadId) body.set('threadId', currentThreadId)

      hideQuestion()
      beginStream()

      await submitAndStream('/chat/answer', body)
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let form = document.getElementById('chat-form') as HTMLFormElement | null
            if (form) {
              form.addEventListener('submit', handleFormSubmit, { signal: lifecycleSignal })
            }

            let textarea = document.getElementById('msg') as HTMLTextAreaElement | null
            if (textarea) {
              textarea.addEventListener('keydown', handleTextareaKeydown, {
                signal: lifecycleSignal,
              })
              textarea.addEventListener('input', updateCounter, { signal: lifecycleSignal })
              autoGrowReset = setupAutoGrowTextarea(textarea, { signal: lifecycleSignal }).reset
              updateCounter()
            }

            let chatArea = document.getElementById('chat-messages')
            // Adopt the resumed thread id that the server rendered (see
            // customer-chat-page.tsx data-thread-id), or null for a fresh thread.
            currentThreadId = chatArea?.getAttribute('data-thread-id') ?? null
            if (chatArea) {
              chatArea.addEventListener(
                'click',
                (e) => {
                  let target = e.target as HTMLElement
                  if (target.id === 'chat-cancel') {
                    handleCancel()
                  } else if (target.classList.contains('slot-btn')) {
                    handleSlotClick(e)
                  } else if (target.classList.contains('approve-btn')) {
                    handleApproval('approve', e)
                  } else if (target.classList.contains('decline-btn')) {
                    handleApproval('decline', e)
                  } else if (target.classList.contains('q-answer-btn')) {
                    handleAnswer()
                  } else if (target.classList.contains('slot-other-resource-btn')) {
                    handleOtherResource()
                  } else if (target.classList.contains('slot-close-btn')) {
                    handleSlotCancel()
                  }
                },
                { signal: lifecycleSignal },
              )
            }

            // Re-surface a gate that survived a reload / dropped stream.
            void checkReconnect()
          }),
        ]}
      />
    )
  },
)

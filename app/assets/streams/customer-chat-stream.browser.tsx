import { clientEntry, css, ref, type Handle } from 'remix/ui'

import { theme } from '../../ui/theme/theme.ts'

export const CustomerChatStream = clientEntry(
  import.meta.url + '#CustomerChatStream',
  function CustomerChatStream(handle: Handle) {
    let ac = new AbortController()
    let lifecycleSignal = (handle.signal ?? ac.signal) as AbortSignal
    if (handle.signal) {
      handle.signal.addEventListener('abort', () => ac.abort(), { once: true })
    }

    let currentEventSource: EventSource | null = null
    let currentRunId: string | null = null
    let currentThreadId: string | null = null
    let streamingAssistant: HTMLDivElement | null = null
    let suspended = false

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

    function esc(s: string): string {
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    function getCsrfToken(): string {
      let el = document.getElementById('chat-csrf-token')
      return el?.getAttribute('data-token') || ''
    }

    function getChatArea(): HTMLElement | null {
      return document.getElementById('chat-messages')
    }

    function appendMessage(text: string, role: string, accumulate?: boolean) {
      let container = getChatArea()
      if (!container) return
      if (accumulate && streamingAssistant) {
        streamingAssistant.textContent += text
      } else {
        let isUser = role === 'user'
        let bubble = document.createElement('div')
        bubble.style.cssText =
          `padding:0.75rem;border-radius:12px;max-width:75%;` +
          `line-height:1.5;font-size:0.9375rem;` +
          `background:${isUser ? '#3b82f6' : theme.surface.lvl1};` +
          `color:${isUser ? '#fff' : 'inherit'};` +
          `align-self:${isUser ? 'flex-end' : 'flex-start'};` +
          `border-bottom-${isUser ? 'right' : 'left'}-radius:4px;` +
          `white-space:pre-wrap;word-break:break-word;`
        bubble.textContent = text
        container.appendChild(bubble)
        if (!isUser) streamingAssistant = bubble
      }
      container.scrollTop = container.scrollHeight
    }

    function appendToolCard(toolName: string, toolCallId: string) {
      let container = getChatArea()
      if (!container || toolCards[toolCallId]) return

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

    function removeResultOrError(card: HTMLElement) {
      let toRemove: HTMLElement[] = []
      for (let i = 0; i < card.children.length; i++) {
        let el = card.children[i] as HTMLElement
        if (el.classList.contains('tl-card-result')) toRemove.push(el)
      }
      for (let el of toRemove) el.remove()
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
          `background:#ef4444;border-top:1px solid ${theme.colors.border.default};`
        div.textContent = typeof result === 'string' ? result : 'Fehler: ' + JSON.stringify(result)
      } else {
        div.style.cssText =
          `padding:0.5rem 0.75rem;font-size:0.8125rem;color:${theme.colors.text.primary};` +
          `border-top:1px solid ${theme.colors.border.default};`
        if (result && typeof result === 'object') {
          let r = result as Record<string, unknown>
          if (r.slots && Array.isArray(r.slots)) {
            div.innerHTML =
              '<div style="font-size:0.8125rem;color:${theme.colors.text.secondary}">Verfügbare Termine werden unten angezeigt.</div>'
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
      let tl = getChatArea()
      if (tl) tl.scrollTop = tl.scrollHeight
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
        let pageSlots = pages[pi]
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
      container.scrollTop = container.scrollHeight

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

    function renderSlotButtons(result: Record<string, unknown>): string {
      let slots = result.slots as Array<Record<string, unknown>> | undefined
      if (!slots || slots.length === 0) return 'Keine freien Termine gefunden.'
      let resourceName = esc(String(result.resource_name ?? ''))
      let groups = new Map<string, typeof slots>()
      for (let s of slots) {
        let day = String(s.date_display ?? '')
        if (!groups.has(day)) groups.set(day, [])
        groups.get(day)!.push(s)
      }

      let html = `<div style="font-weight:500;margin-bottom:0.5rem">${resourceName}</div>`
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
          html += `<button type="button" class="slot-btn" data-slot='${esc(data)}' style="display:inline-block;margin:0.2rem;padding:0.4rem 0.75rem;background:${theme.surface.lvl1};color:${theme.colors.text.primary};border:1px solid ${theme.colors.border.default};border-radius:6px;cursor:pointer;font-size:0.85rem">${esc(label)}</button>`
        }
      }
      return html
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
      container.scrollTop = container.scrollHeight
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
      container.scrollTop = container.scrollHeight
    }

    function appendReasoning(text: string) {
      if (!reasoningBody) return
      reasoningBody.textContent += text
      let tl = getChatArea()
      if (tl) tl.scrollTop = tl.scrollHeight
    }

    function endReasoning() {
      reasoningBlock = null
      reasoningBody = null
    }

    function finalizeAssistantBubble() {
      if (!streamingAssistant) return
      let raw = streamingAssistant.textContent || ''
      streamingAssistant.textContent = raw
      streamingAssistant = null
    }

    function setFormEnabled(enabled: boolean) {
      let textarea = document.getElementById('msg') as HTMLTextAreaElement | null
      let submitBtn = document.getElementById('chat-submit') as HTMLButtonElement | null
      if (textarea) textarea.disabled = !enabled
      if (submitBtn) submitBtn.disabled = !enabled
    }

    // ── Approval UI ───────────────────────────────────────────

    function showApproval(data: {
      runId: string
      toolCallId?: string
      toolName?: string
      args?: Record<string, unknown>
    }) {
      let container = getChatArea()
      if (!container) return

      let card = document.createElement('div')
      card.id = 'chat-approval'
      card.style.cssText =
        `padding:1rem;border:2px solid #ef4444;border-radius:12px;` +
        `background:${theme.surface.lvl0};align-self:flex-start;width:100%;`

      let args = data.args || {}
      let isCancelSingle = 'appointmentSummary' in args
      let isCancelAll = 'count' in args || 'appointmentSummaries' in args

      let title: string
      let description: string
      if (isCancelSingle) {
        title = 'Termin stornieren?'
        description = String(args.appointmentSummary ?? '')
      } else if (isCancelAll) {
        title = `${String(args.count ?? 0)} Termine stornieren?`
        description = (args.appointmentSummaries as string[] | undefined)?.join(', ') ?? ''
      } else {
        title = 'Aktion bestätigen'
        description = JSON.stringify(args, null, 2)
      }

      card.innerHTML =
        `<div style="font-weight:600;font-size:1rem;margin-bottom:0.75rem;color:#ef4444">${esc(title)}</div>` +
        (description
          ? `<div style="font-size:0.875rem;color:${theme.colors.text.secondary};margin-bottom:0.75rem;white-space:pre-wrap">${esc(description)}</div>`
          : '') +
        `<div style="display:flex;gap:0.75rem">` +
        `<button class="approve-btn" data-run-id="${esc(data.runId)}" data-tool-call-id="${esc(data.toolCallId || '')}" style="padding:0.5rem 1.25rem;background:#ef4444;color:#fff;border:none;border-radius:6px;font-size:0.9rem;cursor:pointer">[X] Bestätigen</button>` +
        `<button class="decline-btn" data-run-id="${esc(data.runId)}" data-tool-call-id="${esc(data.toolCallId || '')}" style="padding:0.5rem 1.25rem;background:${theme.surface.lvl1};color:inherit;border:1px solid ${theme.colors.border.default};border-radius:6px;font-size:0.9rem;cursor:pointer">[/] Ablehnen</button>` +
        `</div>`

      container.appendChild(card)
      container.scrollTop = container.scrollHeight
    }

    function hideApproval() {
      let card = document.getElementById('chat-approval')
      if (card) card.remove()
    }

    // ── Question UI ───────────────────────────────────────────

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

      let container = getChatArea()
      if (!container) return

      let card = document.createElement('div')
      card.id = 'chat-question'
      card.style.cssText =
        `padding:1rem;border:2px solid #f59e0b;border-radius:12px;` +
        `background:${theme.surface.lvl0};align-self:flex-start;width:100%;margin-top:0.5rem;`

      let html = `<div style="font-weight:600;font-size:1rem;margin-bottom:0.75rem;color:#b45309">${esc(data.question)}</div>`

      if (data.options && data.options.length > 0) {
        if (data.selectionMode === 'multi_select') {
          html +=
            `<div id="q-options">` +
            data.options
              .map(
                (o) =>
                  `<label style="display:block;margin:4px 0;cursor:pointer">` +
                  `<input type="checkbox" class="q-option" value="${esc(o.label)}" /> ` +
                  esc(o.label) +
                  (o.description
                    ? ` <span style="opacity:0.6;font-size:0.85em">— ${esc(o.description)}</span>`
                    : '') +
                  `</label>`,
              )
              .join('') +
            `</div>`
        } else {
          html +=
            `<div id="q-options">` +
            data.options
              .map(
                (o, i) =>
                  `<label style="display:block;margin:4px 0;cursor:pointer">` +
                  `<input type="radio" class="q-option" name="q_option" value="${esc(o.label)}" ${i === 0 ? 'checked' : ''} /> ` +
                  esc(o.label) +
                  (o.description
                    ? ` <span style="opacity:0.6;font-size:0.85em">— ${esc(o.description)}</span>`
                    : '') +
                  `</label>`,
              )
              .join('') +
            `</div>`
        }
      } else {
        html += `<input id="q-free-text" type="text" style="width:100%;padding:0.5rem;border:1px solid #ccc;border-radius:6px;font-size:0.9rem;box-sizing:border-box" placeholder="Antwort eingeben..." />`
      }

      html += `<div style="margin-top:0.75rem"><button type="button" class="q-answer-btn" style="padding:0.5rem 1.25rem;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:0.9rem;cursor:pointer">Antworten</button></div>`

      card.innerHTML = html
      container.appendChild(card)
      container.scrollTop = container.scrollHeight
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

      let url = `/chat/stream/${encodeURIComponent(runId)}`
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
          /* ignore */
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
          /* ignore */
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
      es.addEventListener('agent-error', streamEnded)
      es.addEventListener('error', streamEnded)

      es.addEventListener('stream-error', (event) => {
        try {
          let data = JSON.parse(event.data)
          appendMessage('Stream-Fehler: ' + (data.error || 'unbekannt'), 'error')
        } catch {
          appendMessage('Stream-Fehler', 'error')
        }
        streamEnded()
      })

      // Tool lifecycle events
      es.addEventListener('tool-call-input-streaming-start', (event) => {
        try {
          let data = JSON.parse(event.data)
          appendToolCard(data.toolName || 'unbekannt', data.toolCallId || '')
        } catch {
          /* ignore */
        }
      })

      es.addEventListener('tool-call-delta', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.toolCallId && data.argsTextDelta != null) {
            updateToolArgs(data.toolCallId, data.argsTextDelta as string)
          }
        } catch {
          /* ignore */
        }
      })

      es.addEventListener('tool-call', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.toolCallId && data.args) {
            finalizeToolArgs(data.toolCallId, data.args as Record<string, unknown>)
          }
        } catch {
          /* ignore */
        }
      })

      es.addEventListener('tool-result', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.toolCallId) {
            appendToolResult(data.toolCallId, data.result, data.isError)
          }
        } catch {
          /* ignore */
        }
      })

      es.addEventListener('tool-error', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.toolCallId) {
            appendToolResult(data.toolCallId, data.error, true)
          }
        } catch {
          /* ignore */
        }
      })

      es.addEventListener('step-finish', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.usage || data.reason) {
            appendStepStats(data.reason || '', data.usage || {})
          }
        } catch {
          /* ignore */
        }
      })

      es.addEventListener('reasoning-start', () => startReasoning())
      es.addEventListener('reasoning-delta', (event) => {
        try {
          let data = JSON.parse(event.data)
          if (data.text) appendReasoning(data.text as string)
        } catch {
          /* ignore */
        }
      })
      es.addEventListener('reasoning-end', () => endReasoning())
    }

    // ── Event handlers ────────────────────────────────────────

    async function handleFormSubmit(e: Event) {
      e.preventDefault()
      let form = e.target as HTMLFormElement
      if (!form) return

      let formData = new FormData(form)
      let message = formData.get('message')?.toString().trim()
      if (!message) return

      if (currentThreadId) formData.set('threadId', currentThreadId)
      appendMessage(message, 'user')
      ;(document.getElementById('msg') as HTMLTextAreaElement)!.value = ''
      setFormEnabled(false)

      try {
        let res = await fetch('/chat', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          let err = await res.json().catch(() => ({ error: 'Anfrage fehlgeschlagen' }))
          appendMessage('Fehler: ' + (err.error || res.statusText), 'error')
          setFormEnabled(true)
          return
        }
        let data = await res.json()
        if (data.threadId) currentThreadId = data.threadId
        if (data.runId) {
          startStream(data.runId)
        }
      } catch (err) {
        appendMessage('Fehler: ' + String(err), 'error')
        setFormEnabled(true)
      }
    }

    function handleSlotCancel() {
      abortStream()
      let picker = document.getElementById('chat-slot-picker')
      if (picker) picker.remove()
      setFormEnabled(true)
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
      setFormEnabled(false)

      let formData = new FormData()
      if (currentThreadId) formData.set('threadId', currentThreadId)
      formData.set('message', message)
      formData.set('_csrf', getCsrfToken())

      try {
        let res = await fetch('/chat', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          let err = await res.json().catch(() => ({ error: 'Buchungsanfrage fehlgeschlagen' }))
          appendMessage('Fehler: ' + (err.error || res.statusText), 'error')
          setFormEnabled(true)
          return
        }
        let data = await res.json()
        if (data.threadId) currentThreadId = data.threadId
        if (data.runId) {
          startStream(data.runId)
        }
      } catch (err) {
        appendMessage('Fehler: ' + String(err), 'error')
        setFormEnabled(true)
      }
    }

    let submittingOtherResource = false

    async function handleOtherResource() {
      if (submittingOtherResource) return
      submittingOtherResource = true
      abortStream()
      let picker = document.getElementById('chat-slot-picker')
      if (picker) picker.remove()

      let message = 'Ich möchte eine andere Ressource ausprobieren.'
      appendMessage(message, 'user')
      setFormEnabled(false)

      let formData = new FormData()
      if (currentThreadId) formData.set('threadId', currentThreadId)
      formData.set('message', message)
      formData.set('_csrf', getCsrfToken())

      try {
        let res = await fetch('/chat', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          let err = await res.json().catch(() => ({ error: 'Anfrage fehlgeschlagen' }))
          appendMessage('Fehler: ' + (err.error || res.statusText), 'error')
          setFormEnabled(true)
          submittingOtherResource = false
          return
        }
        let data = await res.json()
        if (data.threadId) currentThreadId = data.threadId
        if (data.runId) {
          startStream(data.runId)
        }
        submittingOtherResource = false
      } catch (err) {
        appendMessage('Fehler: ' + String(err), 'error')
        setFormEnabled(true)
        submittingOtherResource = false
      }
    }

    async function handleApproval(action: 'approve' | 'decline', e: Event) {
      let btn = e.target as HTMLButtonElement
      btn.disabled = true
      let runId = btn.dataset.runId
      let toolCallId = btn.dataset.toolCallId

      try {
        let body = new FormData()
        body.set('runId', runId || '')
        if (toolCallId) body.set('toolCallId', toolCallId)
        body.set('_csrf', getCsrfToken())

        let res = await fetch('/chat/' + action, {
          method: 'POST',
          body,
        })
        if (!res.ok) {
          appendMessage('Bestätigung fehlgeschlagen', 'error')
          setFormEnabled(true)
          hideApproval()
          return
        }
        let data = await res.json()
        hideApproval()
        if (data.requiresApproval) {
          showApproval({
            runId: data.runId,
            toolCallId: data.toolCallId,
            toolName: data.toolName,
            args: data.args,
          })
        } else if (data.runId) {
          startStream(data.runId)
        }
      } catch (err) {
        appendMessage('Bestätigungsfehler: ' + String(err), 'error')
        setFormEnabled(true)
        hideApproval()
      }
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

      try {
        let body = new FormData()
        body.set('runId', pendingQuestion.runId)
        body.set('answer', answer)
        body.set('selectionMode', pendingQuestion.selectionMode)
        if (pendingQuestion.toolCallId) body.set('toolCallId', pendingQuestion.toolCallId)
        if (currentThreadId) body.set('threadId', currentThreadId)
        body.set('_csrf', getCsrfToken())

        setFormEnabled(false)

        let res = await fetch('/chat/answer', {
          method: 'POST',
          body,
        })
        if (!res.ok) {
          appendMessage('Antwort konnte nicht gesendet werden', 'error')
          if (btn) {
            btn.disabled = false
            btn.textContent = 'Antworten'
          }
          setFormEnabled(true)
          return
        }
        hideQuestion()
        let data = await res.json()
        if (data.runId) {
          startStream(data.runId)
        }
      } catch (err) {
        appendMessage('Antwort-Fehler: ' + String(err), 'error')
        if (btn) {
          btn.disabled = false
          btn.textContent = 'Antworten'
        }
        setFormEnabled(true)
      }
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

            let chatArea = document.getElementById('chat-messages')
            if (chatArea) {
              chatArea.addEventListener(
                'click',
                (e) => {
                  let target = e.target as HTMLElement
                  if (target.classList.contains('slot-btn')) {
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
          }),
        ]}
      />
    )
  },
)

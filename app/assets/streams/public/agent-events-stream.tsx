import { clientEntry, css, ref, type Handle } from 'remix/ui'
import { theme } from '../../../ui/theme/theme.ts'
import { setupAutoGrowTextarea } from '../../../ui/auto-grow-textarea.ts'
import {
  formatTime,
  inferKind,
  kindGlyph,
  kindColor,
  pipelineLogHtml,
  type PipelineRow,
  type RowKind,
} from '../../../ui/agent-events-log.ts'

export const AgentEventsStream = clientEntry(
  import.meta.url + '#AgentEventsStream',
  function AgentEventsStream(handle: Handle) {
    let abortController: AbortController | null = null
    let _isResume = false
    let didNavigate = false
    let autoGrowReset: (() => void) | null = null

    function getStatusBar() {
      return document.getElementById('ae-status-bar')
    }

    function setFormEnabled(enabled: boolean) {
      let input = document.getElementById('agent-events-input') as HTMLTextAreaElement | null
      let submit = document.getElementById('agent-events-submit') as HTMLButtonElement | null
      if (input) input.disabled = !enabled
      if (submit) submit.disabled = !enabled
    }

    function clearStatusBar() {
      let bar = getStatusBar()
      if (bar) bar.innerHTML = ''
    }

    // ── Live pipeline rendered into the main frame ──────────────

    let pipelineRows: PipelineRow[] = []

    function getPipelineFrame() {
      let container = document.getElementById('agent-events-frame-container')
      let activeFrame = container?.getAttribute('data-active-frame') ?? 'agent-events-panel'
      return handle.frames.get(activeFrame)
    }

    function renderPipeline() {
      let frame = getPipelineFrame()
      if (!frame || pipelineRows.length === 0) return
      frame
        .replace(String(pipelineLogHtml(pipelineRows)))
        .then(() => {
          let logEl = document.getElementById('ae-pipeline-log')
          if (logEl) logEl.scrollTop = logEl.scrollHeight
        })
        .catch(() => {})
    }

    function pushRow(text: string, kind: RowKind) {
      pipelineRows.push({ kind, text, time: formatTime(Date.now()) })
      if (didNavigate || !getPipelineFrame()) {
        showInfo(text, { kind })
      } else {
        renderPipeline()
      }
    }

    function resetPipeline() {
      pipelineRows = []
    }

    function showInfo(text: string, opts?: { kind?: RowKind }) {
      let bar = getStatusBar()
      if (!bar) return
      let kind = opts?.kind ?? inferKind(text)

      let row = document.createElement('div')
      row.style.display = 'flex'
      row.style.alignItems = 'baseline'
      row.style.gap = '0.5rem'
      row.style.padding = '0.25rem 0'
      row.style.fontSize = '0.8125rem'
      row.style.lineHeight = '1.4'

      let glyph = document.createElement('span')
      glyph.textContent = kindGlyph(kind)
      glyph.style.flexShrink = '0'
      glyph.style.width = '1rem'
      glyph.style.textAlign = 'center'
      glyph.style.fontWeight = '600'
      glyph.style.color = kindColor(kind)

      let time = document.createElement('span')
      time.textContent = formatTime(Date.now())
      time.style.flexShrink = '0'
      time.style.minWidth = '4.5rem'
      time.style.fontFamily = theme.fontFamily.mono
      time.style.fontSize = '0.75rem'
      time.style.color = theme.colors.text.muted

      let message = document.createElement('span')
      message.textContent = text
      message.style.color =
        kind === 'error' ? theme.colors.action.danger.background : theme.colors.text.primary
      message.style.wordBreak = 'break-word'

      row.appendChild(glyph)
      row.appendChild(time)
      row.appendChild(message)
      bar.appendChild(row)
      bar.scrollTop = bar.scrollHeight
    }

    function showConfirmGate(data: Record<string, unknown>) {
      let bar = getStatusBar()
      if (!bar) return

      let container = document.createElement('div')
      container.id = 'ae-confirm-gate'
      container.style.marginTop = '0.5rem'
      container.style.padding = '0.75rem'
      container.style.border = '1px solid ' + theme.colors.border.default
      container.style.borderRadius = '6px'
      container.style.background = theme.surface.lvl1
      container.style.display = 'flex'
      container.style.flexDirection = 'column'
      container.style.gap = '0.5rem'

      let q = document.createElement('div')
      q.textContent = String(data.question || 'Confirm?')
      q.style.fontWeight = '600'
      q.style.fontSize = '0.875rem'
      container.appendChild(q)

      let buttons = document.createElement('div')
      buttons.style.display = 'flex'
      buttons.style.gap = '0.5rem'

      let confirmBtn = document.createElement('button')
      confirmBtn.textContent = 'Bestätigen'
      confirmBtn.style.padding = '0.4rem 1rem'
      confirmBtn.style.border = 'none'
      confirmBtn.style.borderRadius = '4px'
      confirmBtn.style.cursor = 'pointer'
      confirmBtn.style.background = theme.colors.action.primary.background
      confirmBtn.style.color = theme.colors.action.primary.foreground
      confirmBtn.style.fontSize = '0.8125rem'
      confirmBtn.onclick = () => {
        confirmBtn.disabled = true
        cancelBtn.disabled = true
        handleResume(true, String(data.runId || ''))
      }
      buttons.appendChild(confirmBtn)

      let cancelBtn = document.createElement('button')
      cancelBtn.textContent = 'Abbrechen'
      cancelBtn.style.padding = '0.4rem 1rem'
      cancelBtn.style.border = '1px solid ' + theme.colors.border.default
      cancelBtn.style.borderRadius = '4px'
      cancelBtn.style.cursor = 'pointer'
      cancelBtn.style.background = theme.surface.lvl1
      cancelBtn.style.color = theme.colors.text.primary
      cancelBtn.style.fontSize = '0.8125rem'
      cancelBtn.onclick = () => {
        confirmBtn.disabled = true
        cancelBtn.disabled = true
        handleResume(false, String(data.runId || ''))
      }
      buttons.appendChild(cancelBtn)

      container.appendChild(buttons)
      bar.appendChild(container)
      bar.scrollTop = bar.scrollHeight
    }

    function abortStream() {
      if (abortController) {
        abortController.abort()
        abortController = null
      }
    }

    async function handleResume(confirmed: boolean, runId: string) {
      if (!runId) return
      setFormEnabled(false)
      _isResume = true

      let body = new FormData()
      body.set('runId', runId)
      body.set('confirmed', String(confirmed))
      startStream('/admin/workflowagent2/resume', { method: 'POST', body })
    }

    function reloadActiveFrame() {
      let container = document.getElementById('agent-events-frame-container')
      let activeFrame = container?.getAttribute('data-active-frame') ?? 'agent-events-panel'
      let frame = handle.frames.get(activeFrame)
      if (frame) frame.reload().catch(() => {})
    }

    function restoreFilterValue(url: string) {
      let filterValue = new URL(url, window.location.origin).searchParams.get('filter')
      if (filterValue !== null && filterValue !== 'enabled' && filterValue !== 'disabled') {
        for (let input of document.querySelectorAll<HTMLInputElement>('input[name="filter"]')) {
          input.value = filterValue
        }
      }
    }

    async function startStream(url: string, init: RequestInit) {
      abortStream()
      abortController = new AbortController()
      let signal = abortController.signal

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
          showInfo('Error: ' + msg, { kind: 'error' })
          setFormEnabled(true)
          return
        }

        let reader = res.body?.getReader()
        if (!reader) {
          showInfo('Error: no response body', { kind: 'error' })
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

              if (eventType === 'status') {
                pushRow(parsed.text || '', (parsed.kind as RowKind) ?? inferKind(parsed.text || ''))
              } else if (eventType === 'confirm-required') {
                showConfirmGate(parsed)
              } else if (eventType === 'navigate') {
                didNavigate = true
                let href = parsed.href as string
                let target = (parsed.target as string) || 'agent-events-panel'
                showInfo('Navigating to ' + href + '...', { kind: 'info' })
                let frame = target ? handle.frames.get(target) : handle.frame
                if (frame) {
                  frame.src = href
                  frame.reload().then(
                    () => restoreFilterValue(href),
                    (err) => showInfo('Navigation failed: ' + String(err), { kind: 'error' }),
                  )
                  let historyMode = parsed.history as string
                  if (!historyMode || historyMode !== 'skip') {
                    if (historyMode === 'replace') {
                      window.history.replaceState({}, '', href)
                    } else {
                      window.history.pushState({}, '', href)
                    }
                  }
                }
              } else if (eventType === 'message') {
                pushRow(parsed.text || '', 'info')
              } else if (eventType === 'complete') {
                if (_isResume && didNavigate) {
                  _isResume = false
                  reloadActiveFrame()
                }
                setFormEnabled(true)
              } else if (eventType === 'agent-error') {
                let msg = 'Error: ' + (parsed.error || 'unknown')
                pushRow(msg, 'error')
                showInfo(msg, { kind: 'error' })
                setFormEnabled(true)
              }
            } catch {
              // ignore parse errors
            }
          }
        }

        setFormEnabled(true)
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        showInfo('Error: ' + String(err), { kind: 'error' })
        setFormEnabled(true)
      }
    }

    async function handleFormSubmit(e: Event) {
      e.preventDefault()
      let form = e.target as HTMLFormElement
      let formData = new FormData(form)
      let message = formData.get('message')?.toString().trim()
      if (!message) return

      let textarea = document.getElementById('agent-events-input') as HTMLTextAreaElement | null
      if (textarea) {
        textarea.value = ''
        autoGrowReset?.()
      }
      setFormEnabled(false)
      didNavigate = false
      clearStatusBar()
      resetPipeline()
      pushRow('Processing…', 'active')

      startStream('/admin/workflowagent2', { method: 'POST', body: formData })
    }

    function handleTextareaKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        let form = document.getElementById('agent-events-form') as HTMLFormElement | null
        if (form) form.requestSubmit()
      }
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let form = document.getElementById('agent-events-form') as HTMLFormElement | null
            if (form) {
              form.addEventListener('submit', handleFormSubmit, { signal: handle.signal })
            }

            let textarea = document.getElementById(
              'agent-events-input',
            ) as HTMLTextAreaElement | null
            if (textarea) {
              textarea.addEventListener('keydown', handleTextareaKeydown, { signal: handle.signal })
              autoGrowReset = setupAutoGrowTextarea(textarea, { signal: handle.signal }).reset
            }
          }),
        ]}
      />
    )
  },
)

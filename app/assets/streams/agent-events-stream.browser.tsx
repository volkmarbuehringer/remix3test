import { clientEntry, css, ref, type Handle } from 'remix/ui'
import { setupAutoGrowTextarea } from '../../ui/auto-grow-textarea.ts'

export const AgentEventsStream = clientEntry(
  import.meta.url + '#AgentEventsStream',
  function AgentEventsStream(handle: Handle) {
    let abortController: AbortController | null = null
    let currentRunId: string | null = null
    let _isResume = false
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

    function showInfo(text: string, isError?: boolean) {
      let bar = getStatusBar()
      if (!bar) return
      let el = document.createElement('div')
      el.textContent = text
      el.style.fontSize = '0.8125rem'
      el.style.color = isError
        ? 'var(--rmx-color-action-danger, #dc3545)'
        : 'var(--rmx-color-text-muted, #888)'
      el.style.padding = '0.25rem 0'
      el.style.fontStyle = 'italic'
      bar.appendChild(el)
      bar.scrollTop = bar.scrollHeight
    }

    function showConfirmGate(data: Record<string, unknown>) {
      let bar = getStatusBar()
      if (!bar) return

      let container = document.createElement('div')
      container.id = 'ae-confirm-gate'
      container.style.marginTop = '0.5rem'
      container.style.padding = '0.75rem'
      container.style.border = '1px solid var(--rmx-color-border-default, #ddd)'
      container.style.borderRadius = '6px'
      container.style.background = 'var(--rmx-surface-lvl1, #fafafa)'
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
      confirmBtn.style.background = 'var(--rmx-color-action-primary-background, #0055ff)'
      confirmBtn.style.color = 'var(--rmx-color-action-primary-foreground, #fff)'
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
      cancelBtn.style.border = '1px solid var(--rmx-color-border-default, #ccc)'
      cancelBtn.style.borderRadius = '4px'
      cancelBtn.style.cursor = 'pointer'
      cancelBtn.style.background = 'var(--rmx-surface-lvl1, #fff)'
      cancelBtn.style.color = 'var(--rmx-color-text-primary, #333)'
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
        let res = await fetch(url, { ...init, signal })
        if (!res.ok) {
          let text = await res.text().catch(() => '')
          let match = text.match(/data: (.*)\n/)
          let msg = match ? (JSON.parse(match[1]).error ?? res.statusText) : res.statusText
          showInfo('Error: ' + msg, true)
          setFormEnabled(true)
          return
        }

        let reader = res.body?.getReader()
        if (!reader) {
          showInfo('Error: no response body', true)
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
                showInfo(parsed.text || '')
              } else if (eventType === 'confirm-required') {
                showConfirmGate(parsed)
              } else if (eventType === 'navigate') {
                let href = parsed.href as string
                let target = (parsed.target as string) || 'agent-events-panel'
                showInfo('Navigating to ' + href + '...')
                let frame = target ? handle.frames.get(target) : handle.frame
                if (frame) {
                  frame.src = href
                  frame.reload().then(
                    () => restoreFilterValue(href),
                    (err) => showInfo('Navigation failed: ' + String(err), true),
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
                showInfo(parsed.text || '')
              } else if (eventType === 'complete') {
                if (_isResume) {
                  _isResume = false
                  reloadActiveFrame()
                }
                setFormEnabled(true)
                currentRunId = null
              } else if (eventType === 'agent-error') {
                showInfo('Error: ' + (parsed.error || 'unknown'), true)
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
        showInfo('Error: ' + String(err), true)
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
      clearStatusBar()
      showInfo('Processing...')

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

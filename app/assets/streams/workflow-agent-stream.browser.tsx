import { clientEntry, css, ref, type Handle } from 'remix/ui'
import { agentPrefillMap } from '../../ui/agent-prefill-store.browser.ts'

export const WorkflowAgentStream = clientEntry(
  import.meta.url + '#WorkflowAgentStream',
  function WorkflowAgentStream(handle: Handle) {
    let abortController: AbortController | null = null
    let currentRunId: string | null = null
    let currentWorkflowId: string | null = null

    let completedSteps: string[] = []
    let currentStepId: string | null = null
    let finalResult: Record<string, unknown> | null = null
    let isCancelled = false

    function getStatusBar() {
      return document.getElementById('wf-status-bar')
    }

    function setFormEnabled(enabled: boolean) {
      let input = document.getElementById('workflow-agent-input') as HTMLTextAreaElement | null
      let submit = document.getElementById('workflow-agent-submit') as HTMLButtonElement | null
      if (input) input.disabled = !enabled
      if (submit) submit.disabled = !enabled
    }

    function clearStatusBar() {
      let bar = getStatusBar()
      if (bar) bar.innerHTML = ''
      completedSteps = []
      currentStepId = null
      finalResult = null
      isCancelled = false
    }

    function addStep(
      stepId: string,
      status: 'running' | 'done' | 'suspended' | 'error',
      label?: string,
    ) {
      let bar = getStatusBar()
      if (!bar) return

      let existing = document.getElementById('wf-step-' + stepId)
      if (existing) {
        existing.remove()
      }

      let el = document.createElement('div')
      el.id = 'wf-step-' + stepId
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.gap = '0.5rem'
      el.style.padding = '0.15rem 0'
      el.style.fontSize = '0.8125rem'

      let icon = document.createElement('span')
      if (status === 'running') {
        icon.textContent = '⏳'
      } else if (status === 'done') {
        icon.textContent = '✓'
        icon.style.color = 'var(--rmx-color-success, #28a745)'
      } else if (status === 'suspended') {
        icon.textContent = '⏸'
        icon.style.color = 'var(--rmx-color-warning, #ffc107)'
      } else {
        icon.textContent = '✗'
        icon.style.color = 'var(--rmx-color-action-danger, #dc3545)'
      }
      el.appendChild(icon)

      let text = document.createElement('span')
      text.textContent = label || stepId
      if (status === 'done') text.style.color = 'var(--rmx-color-text-muted, #888)'
      el.appendChild(text)

      bar.appendChild(el)
      bar.scrollTop = bar.scrollHeight
    }

    function showResolving() {
      let bar = getStatusBar()
      if (!bar) return
      bar.innerHTML = ''
      let el = document.createElement('div')
      el.id = 'wf-resolving'
      el.textContent = '⏳ Resolving intent...'
      el.style.padding = '0.25rem 0'
      el.style.fontSize = '0.8125rem'
      bar.appendChild(el)
    }

    function showConfirmGate(suspendPayload: Record<string, unknown>) {
      let bar = getStatusBar()
      if (!bar) return

      let container = document.createElement('div')
      container.id = 'wf-confirm-gate'
      container.style.marginTop = '0.5rem'
      container.style.padding = '0.75rem'
      container.style.border = '1px solid var(--rmx-color-border-default, #ddd)'
      container.style.borderRadius = '6px'
      container.style.background = 'var(--rmx-surface-lvl1, #fafafa)'
      container.style.display = 'flex'
      container.style.flexDirection = 'column'
      container.style.gap = '0.5rem'

      let q = document.createElement('div')
      q.textContent = String(suspendPayload.question || 'Confirm?')
      q.style.fontWeight = '600'
      q.style.fontSize = '0.875rem'
      container.appendChild(q)

      let details = document.createElement('div')
      details.style.fontSize = '0.75rem'
      details.style.color = 'var(--rmx-color-text-muted, #888)'
      let actionType = String(suspendPayload.actionType || '')
      let userName = String(suspendPayload.targetUserName || '')
      let pendingCount = Number(suspendPayload.pendingCount || 0)
      let detailsText = `${actionType} ${userName}`
      if (pendingCount > 0) detailsText += ` — ${pendingCount} pending appointments`
      details.textContent = detailsText
      container.appendChild(details)

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
        handleResume(true)
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
        handleResume(false)
      }
      buttons.appendChild(cancelBtn)

      container.appendChild(buttons)
      bar.appendChild(container)
      bar.scrollTop = bar.scrollHeight
    }

    function showResult(data: Record<string, unknown>) {
      let bar = getStatusBar()
      if (!bar) return

      let container = document.createElement('div')
      container.id = 'wf-result'
      container.style.marginTop = '0.5rem'
      container.style.padding = '0.75rem'
      container.style.border = '1px solid var(--rmx-color-border-default, #ddd)'
      container.style.borderRadius = '6px'
      container.style.background = 'var(--rmx-surface-lvl1, #fafafa)'
      container.style.display = 'flex'
      container.style.flexDirection = 'column'
      container.style.gap = '0.5rem'

      if (data.success) {
        let success = document.createElement('div')
        success.textContent = '✓ Action completed'
        success.style.color = 'var(--rmx-color-success, #28a745)'
        success.style.fontWeight = '600'
        success.style.fontSize = '0.875rem'
        container.appendChild(success)

        if (data.targetUserName) {
          let name = document.createElement('div')
          name.textContent = String(data.targetUserName)
          name.style.fontSize = '0.8125rem'
          name.style.color = 'var(--rmx-color-text-secondary, #666)'
          container.appendChild(name)
        }

        if (data.reportPdf && data.reportFilename) {
          let link = document.createElement('a')
          link.href = 'data:application/pdf;base64,' + data.reportPdf
          link.download = String(data.reportFilename)
          link.textContent = '📄 ' + data.reportFilename + ' download'
          link.style.display = 'inline-block'
          link.style.padding = '0.4rem 1rem'
          link.style.background = 'var(--rmx-color-action-primary-background, #0055ff)'
          link.style.color = 'var(--rmx-color-action-primary-foreground, #fff)'
          link.style.borderRadius = '4px'
          link.style.textDecoration = 'none'
          link.style.fontSize = '0.8125rem'
          link.style.cursor = 'pointer'
          link.style.alignSelf = 'flex-start'
          container.appendChild(link)
        }
      } else {
        let error = document.createElement('div')
        error.textContent = '✗ Action failed: ' + (data.error || 'unknown error')
        error.style.color = 'var(--rmx-color-action-danger, #dc3545)'
        error.style.fontWeight = '600'
        error.style.fontSize = '0.875rem'
        container.appendChild(error)
      }

      bar.appendChild(container)
      bar.scrollTop = bar.scrollHeight
    }

    function showPdfDownload(filename: string, base64Data: string) {
      let bar = getStatusBar()
      if (!bar) return
      let container = document.createElement('div')
      container.style.marginTop = '0.5rem'
      container.style.padding = '0.5rem 0'
      let link = document.createElement('a')
      link.href = 'data:application/pdf;base64,' + base64Data
      link.download = filename
      link.textContent = '📄 ' + filename + ' download'
      link.style.display = 'inline-block'
      link.style.padding = '0.4rem 1rem'
      link.style.background = 'var(--rmx-color-action-primary-background, #0055ff)'
      link.style.color = 'var(--rmx-color-action-primary-foreground, #fff)'
      link.style.borderRadius = '4px'
      link.style.textDecoration = 'none'
      link.style.fontSize = '0.8125rem'
      link.style.cursor = 'pointer'
      container.appendChild(link)
      bar.appendChild(container)
      bar.scrollTop = bar.scrollHeight
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

    function abortStream() {
      if (abortController) {
        abortController.abort()
        abortController = null
      }
    }

    async function handleResume(confirmed: boolean) {
      if (!currentRunId) return
      setFormEnabled(false)

      let body = new FormData()
      body.set('runId', currentRunId)
      body.set('confirmed', String(confirmed))
      if (currentWorkflowId) body.set('workflowId', currentWorkflowId)
      startStream('/workflow-agent/resume', { method: 'POST', body })
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

              if (eventType === 'start') {
                clearStatusBar()
                setFormEnabled(false)
                currentRunId = parsed.runId || null
                currentWorkflowId = parsed.workflowId || null
                let resolving = document.getElementById('wf-resolving')
                if (resolving) resolving.textContent = '✓ Intent resolved'
                else showInfo('Intent resolved')
              } else if (eventType === 'workflow-start') {
                showInfo('Starting workflow...')
              } else if (eventType === 'workflow-step-start') {
                currentStepId = parsed.stepId || null
                addStep(currentStepId || 'step', 'running', currentStepId || 'Step')
              } else if (eventType === 'workflow-step-result') {
                let sid = parsed.stepId || ''
                addStep(sid, 'done', sid)
              } else if (eventType === 'workflow-step-suspended') {
                let sp = parsed.suspendPayload || {}
                showConfirmGate(sp)
              } else if (eventType === 'workflow-step-output') {
                // Step output data — could show details here
              } else if (eventType === 'workflow-finish') {
                if (parsed.success) {
                  showInfo('✓ Workflow completed')
                  if (parsed.reportPdf && parsed.reportFilename) {
                    showPdfDownload(String(parsed.reportFilename), String(parsed.reportPdf))
                  }
                  let container = document.getElementById('workflow-agent-frame-container')
                  let activeFrame = container?.getAttribute('data-active-frame') ?? 'admin-content'
                  let theFrame = handle.frames.get(activeFrame)
                  if (theFrame) theFrame.reload().catch(() => {})
                } else {
                  showInfo('✗ Workflow failed: ' + (parsed.error || 'unknown'), true)
                }
              } else if (eventType === 'workflow-canceled') {
                showInfo('Workflow cancelled', true)
                isCancelled = true
              } else if (eventType === 'message') {
                showInfo(parsed.text || '')
              } else if (eventType === 'navigate') {
                let href = parsed.href as string
                let target = (parsed.target as string) || 'admin-content'
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
              } else if (eventType === 'complete') {
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

      let textarea = document.getElementById('workflow-agent-input') as HTMLTextAreaElement | null
      if (textarea) textarea.value = ''
      setFormEnabled(false)
      clearStatusBar()
      showResolving()

      startStream('/workflow-agent', { method: 'POST', body: formData })
    }

    function handleTextareaKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        let form = document.getElementById('workflow-agent-form') as HTMLFormElement | null
        if (form) form.requestSubmit()
      }
    }

    async function handleFrameFormSubmit(e: Event) {
      let form = (e.target as HTMLElement).closest('form')
      if (!form || form.id === 'workflow-agent-form') return
      e.preventDefault()

      let action = form.getAttribute('action') || ''
      let method = (form.method || 'GET').toUpperCase()
      let target = form.getAttribute('rmx-target')

      let frame = target ? handle.frames.get(target) : handle.frame
      if (!frame) return

      if (method === 'GET') {
        let params = new URLSearchParams()
        for (let [key, value] of new FormData(form)) {
          if (typeof value === 'string') params.append(key, value)
        }
        let qs = params.toString()
        let url = action + (qs ? '?' + qs : '')
        frame.src = url
        frame.reload().then(
          () => restoreFilterValue(url),
          (err) => showInfo('Navigation failed: ' + String(err), true),
        )
        window.history.replaceState({}, '', url)
      } else {
        try {
          let res = await fetch(action, {
            method,
            body: new FormData(form),
          })
          await res.text().catch(() => '')
          frame.reload().catch(() => {})
        } catch {
          frame.reload().catch(() => {})
        }
      }
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let form = document.getElementById('workflow-agent-form') as HTMLFormElement | null
            if (form) {
              form.addEventListener('submit', handleFormSubmit, { signal: handle.signal })
            }

            let textarea = document.getElementById(
              'workflow-agent-input',
            ) as HTMLTextAreaElement | null
            if (textarea) {
              textarea.addEventListener('keydown', handleTextareaKeydown, { signal: handle.signal })
            }

            let container = document.getElementById('workflow-agent-frame-container')
            if (container) {
              container.addEventListener('submit', handleFrameFormSubmit, { signal: handle.signal })
            }
          }),
        ]}
      />
    )
  },
)

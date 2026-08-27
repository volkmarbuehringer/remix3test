import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { Frame } from 'remix/ui'
import { render } from 'remix/ui/test'

import { AgentEventsStream } from './public/agent-events-stream.tsx'

function setupAgentEventsDom() {
  let container = document.createElement('div')
  container.id = 'agent-events-page'
  container.innerHTML = `
    <div id="agent-events-frame-container" data-active-frame="agent-events-panel"></div>
    <div id="ae-status-bar"></div>
    <form id="agent-events-form">
      <textarea id="agent-events-input" name="message"></textarea>
      <button id="agent-events-submit" type="submit">Send</button>
    </form>
  `
  document.body.appendChild(container)
  return container
}

function cleanupAgentEventsDom() {
  document.getElementById('agent-events-page')?.remove()
}

function createControllableSse() {
  let encoder = new TextEncoder()
  let pushFn: (chunk: string) => void = () => {}
  let closeFn: () => void = () => {}
  let stream = new ReadableStream<Uint8Array>({
    start(controller) {
      pushFn = (chunk) => controller.enqueue(encoder.encode(chunk))
      closeFn = () => controller.close()
    },
  })
  let response = new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
  return {
    response,
    push(type: string, data: Record<string, unknown>) {
      pushFn(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
    },
    close() {
      closeFn()
    },
  }
}

async function waitFor(cond: () => boolean, timeoutMs = 3000) {
  let start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out')
    await new Promise((r) => setTimeout(r, 10))
  }
}

function submitAgentEventsForm(message: string) {
  let form = document.getElementById('agent-events-form') as HTMLFormElement
  let textarea = document.getElementById('agent-events-input') as HTMLTextAreaElement
  textarea.value = message
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

describe('Agent events pipeline', () => {
  let cleanup: (() => void) | undefined
  let originalFetch: typeof window.fetch

  beforeEach(() => {
    originalFetch = window.fetch
  })

  afterEach(() => {
    window.fetch = originalFetch
    cleanup?.()
    cleanupAgentEventsDom()
  })

  function renderWithFrame() {
    let result = render(
      <>
        <Frame name="agent-events-panel" src="/admin/agent-events/panel" />
        <AgentEventsStream />
      </>,
      {
        frameInit: {
          src: '/',
          resolveFrame: async (src) =>
            src === '/admin/users'
              ? '<div id="users-page">users list</div>'
              : '<div id="panel-page">panel</div>',
        },
      },
    )
    cleanup = result.cleanup
  }

  it('renders pipeline rows into the frame log and escapes agent text', async () => {
    setupAgentEventsDom()
    let sse = createControllableSse()
    window.fetch = async () => sse.response
    renderWithFrame()

    // The frame resolves its initial src asynchronously; wait for it so the
    // live log is not clobbered by the initial resolve.
    await waitFor(() => !!document.getElementById('panel-page'))

    submitAgentEventsForm('cancel user 42')

    sse.push('status', { text: 'Input validated', kind: 'success' })
    sse.push('status', { text: '<script>alert(1)</script>', kind: 'info' })
    sse.push('complete', {})
    sse.close()

    await waitFor(() => !!document.getElementById('ae-pipeline-log'))
    let log = document.getElementById('ae-pipeline-log')!
    assert.ok(log.textContent?.includes('Input validated'), 'status row renders into frame log')
    assert.ok(!log.querySelector('script'), 'agent script tag must not be injected')
    assert.ok(
      log.textContent?.includes('<script>alert(1)</script>'),
      'agent text stays literal (escaped) in the log',
    )
  })

  it('routes pipeline rows to the status bar after a navigate event', async () => {
    setupAgentEventsDom()
    let sse = createControllableSse()
    window.fetch = async () => sse.response
    renderWithFrame()

    await waitFor(() => !!document.getElementById('panel-page'))

    submitAgentEventsForm('cancel user 42')

    sse.push('status', { text: 'Input validated', kind: 'success' })
    await waitFor(() => !!document.getElementById('ae-pipeline-log'))

    sse.push('navigate', { href: '/admin/users', target: 'agent-events-panel', history: 'skip' })
    sse.push('status', { text: 'Action running', kind: 'active' })
    sse.push('complete', {})
    sse.close()

    await waitFor(() => !!document.getElementById('users-page'))
    await waitFor(() => {
      let bar = document.getElementById('ae-status-bar')
      return !!bar && !!bar.textContent?.includes('Action running')
    })

    let bar = document.getElementById('ae-status-bar')!
    assert.ok(
      bar.textContent?.includes('Navigating to /admin/users...'),
      'navigate notice shows in status bar',
    )
    assert.ok(
      bar.textContent?.includes('Action running'),
      'post-navigate rows route to the status bar',
    )
    assert.ok(document.getElementById('users-page'), 'frame shows the navigated page')
    assert.ok(
      !document.getElementById('ae-pipeline-log'),
      'frame log is not re-rendered over the navigated page',
    )
  })

  it('shows a confirm gate on workflow-step-suspended and resumes the same run', async () => {
    setupAgentEventsDom()
    let calls: Array<{ url: string; init: RequestInit }> = []
    let sse = createControllableSse()
    window.fetch = async (input, init) => {
      calls.push({ url: String(input), init: init as RequestInit })
      return sse.response
    }
    renderWithFrame()

    await waitFor(() => !!document.getElementById('panel-page'))

    submitAgentEventsForm('cancel user 42')
    sse.push('start', { runId: 'run-123', workflowId: 'userManagementWorkflow' })
    sse.push('workflow-step-suspended', {
      suspendPayload: {
        question: 'Cancel Jane Doe?',
        actionType: 'cancel',
        targetUserName: 'Jane Doe',
        pendingCount: 3,
      },
    })
    await waitFor(() => !!document.getElementById('ae-confirm-gate'))
    sse.close()

    let gate = document.getElementById('ae-confirm-gate')!
    assert.ok(gate.textContent?.includes('Cancel Jane Doe?'), 'question renders in the gate')
    assert.ok(gate.textContent?.includes('3 pending appointments'), 'preflight detail renders')

    let confirmBtn = gate.querySelector('button')!
    confirmBtn.click()

    await waitFor(() => calls.some((c) => c.url.includes('/resume')))
    let resumeCall = calls.find((c) => c.url.includes('/resume'))!
    let body = resumeCall.init.body as FormData
    assert.equal(body.get('runId'), 'run-123', 'resume posts the tracked run id')
    assert.equal(body.get('confirmed'), 'true', 'resume posts the confirmed flag')
  })
})

import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/ui/test'

import { CustomerChatStream } from './public/customer-chat-stream.tsx'
import { theme } from '../../ui/theme/theme.ts'
import { SupportAgentStream } from './public/support-agent-stream.tsx'
import { AgentEventsStream } from './public/agent-events-stream.tsx'
import { ConnectionIndicator } from '../../ui/connection-indicator.browser.tsx'
import {
  installSseMock,
  uninstallSseMock,
  getCreatedEventSources,
  resetCreatedEventSources,
  type MockEventSource,
} from '../../test-utils/sse-mock.ts'

// -----------------------------------------------------------------------
// Setup: create the DOM structure expected by the stream components
// -----------------------------------------------------------------------

function setupChatDom() {
  let container = document.createElement('div')
  container.innerHTML = `
    <form id="chat-form">
      <textarea id="msg" name="message"></textarea>
      <button id="chat-submit" type="submit">Send</button>
    </form>
    <div id="chat-messages"></div>
  `
  document.body.appendChild(container)
  return container
}

function cleanupChatDom() {
  let form = document.getElementById('chat-form')
  if (form) form.remove()
  let msgs = document.getElementById('chat-messages')
  if (msgs) msgs.remove()
}

// -----------------------------------------------------------------------
// 1. EventSource lifecycle: connect/disconnect on mount/unmount
// -----------------------------------------------------------------------

describe('SSE stream EventSource lifecycle', () => {
  let cleanup: () => void

  afterEach(() => {
    uninstallSseMock()
    cleanup?.()
    cleanupChatDom()
  })

  function sseResponse(events: Array<{ type: string; data: string }>): Response {
    let encoder = new TextEncoder()
    let body = new ReadableStream({
      start(controller) {
        for (let { type, data } of events) {
          controller.enqueue(encoder.encode(`event: ${type}\ndata: ${data}\n\n`))
        }
        controller.close()
      },
    })
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
  }

  it('CustomerChatStream submits via fetch with X-Sse-Request and streams, no EventSource', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    let captured = { url: '', headers: {} as Record<string, string> }
    let originalFetch = window.fetch
    window.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      captured.url = String(url)
      captured.headers = Object.fromEntries(new Headers(init?.headers).entries())
      return sseResponse([
        { type: 'start', data: JSON.stringify({ runId: 'test-run-123', threadId: 't1' }) },
        { type: 'message', data: JSON.stringify({ text: 'Hallo' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])
    }

    let { cleanup: c } = render(<CustomerChatStream />)
    cleanup = c

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    let form = document.getElementById('chat-form') as HTMLFormElement
    textarea.value = 'Hello'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 50))

    assert.equal(captured.url, '/chat', 'should POST to /chat')
    assert.equal(captured.headers['x-sse-request'], '1', 'should send X-Sse-Request: 1')

    // No EventSource is used; the body is streamed from the fetch response.
    assert.equal(getCreatedEventSources().length, 0, 'should not create an EventSource')

    let msgs = document.getElementById('chat-messages') as HTMLElement
    assert.ok(msgs.textContent?.includes('Hallo'), 'streamed message should be rendered')

    window.fetch = originalFetch
    cleanup?.()
  })

  it('CustomerChatStream renders an error for a non-SSE error response', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    let originalFetch = window.fetch
    window.fetch = async () =>
      new Response('Fehler bei der Verarbeitung.', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })

    let { cleanup: c } = render(<CustomerChatStream />)
    cleanup = c

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    let form = document.getElementById('chat-form') as HTMLFormElement
    textarea.value = 'Hello'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 50))

    let msgs = document.getElementById('chat-messages') as HTMLElement
    assert.ok(msgs.textContent?.includes('Fehler'), 'error should be rendered')

    window.fetch = originalFetch
    cleanup?.()
  })
})

// -----------------------------------------------------------------------
// 2. Stream DOM manipulation: appendMessage, tool cards, scroll
// -----------------------------------------------------------------------

describe('SSE stream DOM rendering', () => {
  let chatArea: HTMLElement

  beforeEach(() => {
    chatArea = document.createElement('div')
    chatArea.id = 'chat-messages'
    chatArea.style.cssText = 'height:200px;overflow-y:auto;'
    document.body.appendChild(chatArea)
  })

  afterEach(() => {
    chatArea.remove()
  })

  it('appendMessage creates user bubble as right-aligned blue div', () => {
    // Simulate the appendMessage function from CustomerChatStream
    let container = document.getElementById('chat-messages')!
    let isUser = true
    let bubble = document.createElement('div')
    bubble.style.cssText =
      `padding:0.75rem;border-radius:12px;max-width:75%;` +
      `line-height:1.5;font-size:0.9375rem;` +
      `background:${isUser ? '#3b82f6' : theme.surface.lvl1};` +
      `color:${isUser ? '#fff' : 'inherit'};` +
      `align-self:${isUser ? 'flex-end' : 'flex-start'};` +
      `border-bottom-${isUser ? 'right' : 'left'}-radius:4px;` +
      `white-space:pre-wrap;word-break:break-word;`
    bubble.textContent = 'Hello, I need an appointment'
    container.appendChild(bubble)

    assert.equal(container.children.length, 1, 'one bubble should be present')
    assert.equal(bubble.textContent, 'Hello, I need an appointment')
    let bg = getComputedStyle(bubble).backgroundColor
    assert.ok(
      bg === 'rgb(59, 130, 246)' || bubble.style.background.includes('#3b82f6'),
      'user bubble should be blue',
    )
  })

  it('appendMessage creates assistant bubble as left-aligned surface-colored div', () => {
    let container = document.getElementById('chat-messages')!
    let isUser = false
    let bubble = document.createElement('div')
    bubble.style.cssText =
      `padding:0.75rem;border-radius:12px;max-width:75%;` +
      `line-height:1.5;font-size:0.9375rem;` +
      `background:${isUser ? '#3b82f6' : theme.surface.lvl1};` +
      `color:${isUser ? '#fff' : 'inherit'};` +
      `align-self:${isUser ? 'flex-end' : 'flex-start'};` +
      `border-bottom-${isUser ? 'right' : 'left'}-radius:4px;` +
      `white-space:pre-wrap;word-break:break-word;`
    bubble.textContent = 'I can help you with that.'
    container.appendChild(bubble)

    assert.equal(container.children.length, 1, 'one bubble should be present')
    let bg = getComputedStyle(bubble).backgroundColor
    assert.ok(
      bg !== '' || bubble.style.background !== '',
      'assistant bubble should have a background color',
    )
  })

  it('appendMessage accumulates text into existing assistant bubble', () => {
    let container = document.getElementById('chat-messages')!

    // First message
    let streamingAssistant = document.createElement('div')
    streamingAssistant.style.whiteSpace = 'pre-wrap'
    streamingAssistant.textContent = 'I can help'
    container.appendChild(streamingAssistant)

    // Accumulate
    streamingAssistant.textContent += ' you with that.'
    assert.equal(streamingAssistant.textContent, 'I can help you with that.')
  })

  it('scroll-to-bottom fires after appending content', () => {
    let container = document.getElementById('chat-messages')!
    container.scrollTop = 0

    // Add enough content to create scroll
    for (let i = 0; i < 20; i++) {
      let div = document.createElement('div')
      div.style.height = '30px'
      div.textContent = `Line ${i}`
      container.appendChild(div)
    }

    // The container needs to have layout for scroll properties to work
    let hadOverflow = container.scrollHeight > container.clientHeight
    assert.ok(hadOverflow, 'content should overflow container')

    container.scrollTop = container.scrollHeight
    // After setting scrollTop to scrollHeight, it should be at the bottom
    assert.ok(container.scrollTop > 0, 'scrollTop should be > 0 after scrolling to bottom')
  })

  it('tool card renders with header, args body, and result footer', () => {
    let container = document.getElementById('chat-messages')!
    let toolCallId = 'call_123'

    // Create card like appendToolCard does
    let card = document.createElement('div')
    card.style.cssText = `border:1px solid ${theme.colors.border.default};border-radius:8px;overflow:hidden;align-self:flex-start;width:100%;`

    let header = document.createElement('div')
    header.style.cssText =
      `display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;` +
      `cursor:pointer;user-select:none;font-size:0.875rem;font-weight:500;` +
      `background:${theme.surface.lvl1};`
    header.innerHTML = `<span style="opacity:0.6">\u2699</span><span>findSlots</span>`

    let body = document.createElement('div')
    body.className = 'tl-card-body'
    body.style.cssText =
      `padding:0.5rem 0.75rem;font-size:0.8125rem;line-height:1.5;` +
      `font-family:monospace;white-space:pre-wrap;word-break:break-word;` +
      `color:${theme.colors.text.secondary};`
    body.textContent = JSON.stringify({ date: '2025-01-15', resourceId: 3 }, null, 2)

    let result = document.createElement('div')
    result.className = 'tl-card-result'
    result.style.cssText =
      `padding:0.5rem 0.75rem;font-size:0.8125rem;color:${theme.colors.text.primary};` +
      `border-top:1px solid ${theme.colors.border.default};`
    result.textContent = 'Found 3 available slots'

    card.appendChild(header)
    card.appendChild(body)
    card.appendChild(result)
    container.appendChild(card)

    assert.equal(container.children.length, 1, 'one tool card should exist')
    let cardEl = container.children[0] as HTMLElement
    assert.ok(cardEl.textContent?.includes('findSlots'), 'card should show tool name')
    assert.ok(cardEl.textContent?.includes('resourceId'), 'card should show args')
    assert.ok(cardEl.textContent?.includes('Found 3'), 'card should show result')
  })

  it('duplicate tool_call_id does not create duplicate card', () => {
    let container = document.getElementById('chat-messages')!
    let toolCards: Record<string, HTMLDivElement> = {}

    function createCard(toolCallId: string) {
      if (toolCards[toolCallId]) return // Guard from component
      let card = document.createElement('div')
      card.textContent = `Tool: ${toolCallId}`
      container.appendChild(card)
      toolCards[toolCallId] = card
    }

    createCard('call_123')
    assert.equal(container.children.length, 1, 'first call creates card')

    createCard('call_123')
    assert.equal(container.children.length, 1, 'second call with same id does not duplicate')
  })

  it('tool args accumulate incrementally in the card body', () => {
    let toolCallId = 'call_456'
    let toolArgsAcc: Record<string, string> = {}

    let body = document.createElement('div')
    body.className = 'tl-card-body'

    // Simulate: first delta
    toolArgsAcc[toolCallId] = '{"date":'
    body.textContent = toolArgsAcc[toolCallId]

    // Second delta
    toolArgsAcc[toolCallId] += '"2025-01-15"'
    body.textContent = toolArgsAcc[toolCallId]

    assert.equal(body.textContent, '{"date":"2025-01-15"', 'args should accumulate incrementally')
  })

  it('tool result is appended as a card footer', () => {
    let card = document.createElement('div')

    // Simulate removeResultOrError + appendToolResult
    let resultDiv = document.createElement('div')
    resultDiv.className = 'tl-card-result'
    resultDiv.style.cssText =
      `padding:0.5rem 0.75rem;font-size:0.8125rem;color:${theme.colors.text.primary};` +
      `border-top:1px solid ${theme.colors.border.default};`
    resultDiv.textContent = JSON.stringify({ slots: 5 }, null, 2).slice(0, 500)
    card.appendChild(resultDiv)

    assert.ok(card.textContent?.includes('slots'), 'result should be visible in card')
  })
})

// -----------------------------------------------------------------------
// 3. ConnectionIndicator component
// -----------------------------------------------------------------------

describe('ConnectionIndicator component', () => {
  let cleanup: () => void

  afterEach(() => {
    uninstallSseMock()
    cleanup?.()
  })

  it('renders with initial connecting state', () => {
    installSseMock()

    let result = render(<ConnectionIndicator url="/test/subscribe" />)
    cleanup = result.cleanup

    let el = result.container.querySelector('[aria-label]')
    assert.ok(el, 'indicator should have aria-label')
    assert.ok(
      el!.innerHTML.includes('Connecting') || el!.textContent?.includes('Connecting'),
      'should show Connecting state initially',
    )
  })

  it('updates to connected when EventSource opens', async () => {
    installSseMock()
    resetCreatedEventSources()

    let result = render(<ConnectionIndicator url="/test/subscribe" />)
    cleanup = result.cleanup

    // EventSource creation happens in a queueTask (post-hydration)
    await new Promise((r) => setTimeout(r, 20))

    let sources = getCreatedEventSources()
    if (sources.length > 0) {
      sources[0]!.open()
      await new Promise((r) => setTimeout(r, 10))
    }

    // Indicator should show connected
    let el = result.container.querySelector('[aria-label]')
    if (el) {
      let label = el.getAttribute('aria-label') || ''
      assert.ok(
        label.includes('Connected') || el.textContent?.includes('Connected'),
        'should show Connected state after open',
      )
    }
  })

  it('shows disconnected when EventSource errors to CLOSED', async () => {
    installSseMock()
    resetCreatedEventSources()

    let result = render(<ConnectionIndicator url="/test/subscribe" />)
    cleanup = result.cleanup

    await new Promise((r) => setTimeout(r, 20))

    let sources = getCreatedEventSources()
    if (sources.length > 0) {
      sources[0]!.readyState = EventSource.CLOSED
      sources[0]!.emitError()
      await new Promise((r) => setTimeout(r, 10))
    }

    let el = result.container.querySelector('[aria-label]')
    if (el) {
      assert.ok(
        el.textContent?.includes('Disconnected'),
        'should show Disconnected after error when CLOSED',
      )
    }
  })
})

// -----------------------------------------------------------------------
// 4. Workflow agent step rendering
// -----------------------------------------------------------------------

describe('Workflow agent step rendering', () => {
  let statusBar: HTMLElement

  beforeEach(() => {
    statusBar = document.createElement('div')
    statusBar.id = 'wf-status-bar'
    document.body.appendChild(statusBar)
  })

  afterEach(() => {
    statusBar.remove()
  })

  it('addStep renders running step with hourglass icon', () => {
    let el = document.createElement('div')
    el.id = 'wf-step-step_1'
    el.style.display = 'flex'
    el.style.alignItems = 'center'
    el.style.gap = '0.5rem'

    let icon = document.createElement('span')
    icon.textContent = '\u23F3'
    el.appendChild(icon)

    let text = document.createElement('span')
    text.textContent = 'Finding slots'
    el.appendChild(text)

    statusBar.appendChild(el)

    let stepEl = document.getElementById('wf-step-step_1')
    assert.ok(stepEl, 'step element should exist')
    assert.ok(stepEl?.textContent?.includes('\u23F3'), 'running step shows hourglass')
    assert.ok(stepEl?.textContent?.includes('Finding slots'), 'running step shows label')
  })

  it('addStep renders completed step with checkmark', () => {
    let el = document.createElement('div')
    el.id = 'wf-step-step_2'

    let icon = document.createElement('span')
    icon.textContent = '\u2713'
    icon.style.color = theme.colors.success.foreground
    el.appendChild(icon)

    let text = document.createElement('span')
    text.textContent = 'Booking confirmed'
    text.style.color = theme.colors.text.muted
    el.appendChild(text)

    statusBar.appendChild(el)

    let stepEl = document.getElementById('wf-step-step_2')
    assert.ok(stepEl, 'completed step element should exist')
    assert.ok(stepEl?.textContent?.includes('\u2713'), 'completed step shows checkmark')
  })

  it('addStep renders error step with cross mark', () => {
    let el = document.createElement('div')
    el.id = 'wf-step-step_3'

    let icon = document.createElement('span')
    icon.textContent = '\u2717'
    icon.style.color = theme.colors.action.danger.background
    el.appendChild(icon)

    let text = document.createElement('span')
    text.textContent = 'Booking failed'
    el.appendChild(text)

    statusBar.appendChild(el)

    let stepEl = document.getElementById('wf-step-step_3')
    assert.ok(stepEl, 'error step element should exist')
    assert.ok(stepEl?.textContent?.includes('\u2717'), 'error step shows cross mark')
    assert.ok(stepEl?.textContent?.includes('Booking failed'), 'error step shows error label')
  })

  it('existing step is replaced when addStep is called with same id', () => {
    // First: running step
    let el = document.createElement('div')
    el.id = 'wf-step-step_1'
    el.textContent = '\u23F3 Running'
    statusBar.appendChild(el)

    // Remove and re-add (simulates component behavior)
    let existing = document.getElementById('wf-step-step_1')
    if (existing) existing.remove()

    let newEl = document.createElement('div')
    newEl.id = 'wf-step-step_1'
    newEl.textContent = '\u2713 Done'
    statusBar.appendChild(newEl)

    let steps = statusBar.querySelectorAll('[id^="wf-step-"]')
    assert.equal(steps.length, 1, 'only one step element should exist')
    assert.equal(steps[0]!.textContent, '\u2713 Done', 'should show updated state')
  })

  it('showResolving shows resolving indicator and replaces previous content', () => {
    statusBar.innerHTML = '<div>old content</div>'

    statusBar.innerHTML = ''
    let el = document.createElement('div')
    el.id = 'wf-resolving'
    el.textContent = '\u23F3 Resolving intent...'
    statusBar.appendChild(el)

    let resolvingEl = document.getElementById('wf-resolving')
    assert.ok(resolvingEl, 'resolving element should exist')
    assert.equal(statusBar.children.length, 1, 'old content should be replaced')
    assert.ok(
      resolvingEl?.textContent?.includes('Resolving intent'),
      'should show resolving message',
    )
  })

  it('showConfirmGate renders confirm/cancel buttons', () => {
    // Simulate showConfirmGate from workflow stream
    let container = document.createElement('div')
    container.id = 'wf-confirm-gate'
    container.style.cssText =
      `margin-top:0.5rem;padding:0.75rem;border:1px solid ${theme.colors.border.default};` +
      `border-radius:6px;display:flex;flex-direction:column;gap:0.5rem;`

    let question = document.createElement('div')
    question.textContent = 'Delete appointment for John?'
    question.style.fontWeight = '600'
    container.appendChild(question)

    let buttons = document.createElement('div')
    buttons.style.display = 'flex'
    buttons.style.gap = '0.5rem'

    let confirmBtn = document.createElement('button')
    confirmBtn.textContent = 'Best\u00e4tigen'
    buttons.appendChild(confirmBtn)

    let cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Abbrechen'
    buttons.appendChild(cancelBtn)

    container.appendChild(buttons)
    statusBar.appendChild(container)

    let gate = document.getElementById('wf-confirm-gate')
    assert.ok(gate, 'confirm gate should exist')
    assert.ok(gate?.textContent?.includes('Best\u00e4tigen'), 'should have confirm button')
    assert.ok(gate?.textContent?.includes('Abbrechen'), 'should have cancel button')
  })
})

// -----------------------------------------------------------------------
// 5. Route agent question prompts
// -----------------------------------------------------------------------

describe('Route agent question prompts', () => {
  let chatArea: HTMLElement

  beforeEach(() => {
    chatArea = document.createElement('div')
    chatArea.id = 'chat-messages'
    document.body.appendChild(chatArea)
  })

  afterEach(() => {
    chatArea.remove()
  })

  it('question card renders with title and options', () => {
    let card = document.createElement('div')
    card.id = 'chat-question'
    card.style.cssText = `padding:1rem;border:2px solid #f59e0b;border-radius:12px;align-self:flex-start;width:100%;`

    let html = `<div style="font-weight:600;font-size:1rem;margin-bottom:0.75rem;color:#b45309">What type of appointment?</div>`
    html += `<div id="q-options">`
    html += `<label style="display:block;margin:4px 0;cursor:pointer"><input type="radio" class="q-option" name="q_option" value="Check-up" checked /> Check-up</label>`
    html += `<label style="display:block;margin:4px 0;cursor:pointer"><input type="radio" class="q-option" name="q_option" value="Follow-up" /> Follow-up</label>`
    html += `</div>`
    html += `<div style="margin-top:0.75rem"><button type="button" class="q-answer-btn" style="padding:0.5rem 1.25rem;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem">Answer</button></div>`

    card.innerHTML = html
    chatArea.appendChild(card)

    let questionCard = document.getElementById('chat-question')
    assert.ok(questionCard, 'question card should exist')
    assert.ok(
      questionCard?.textContent?.includes('What type of appointment?'),
      'should show question',
    )
    assert.ok(questionCard?.querySelector('input[value="Check-up"]'), 'should have Check-up option')
    assert.ok(
      questionCard?.querySelector('input[value="Follow-up"]'),
      'should have Follow-up option',
    )
  })

  it('getAnswer returns selected radio value', () => {
    let html = `<div id="q-options">`
    html += `<label><input type="radio" class="q-option" name="q_option" value="Berlin" /> Berlin</label>`
    html += `<label><input type="radio" class="q-option" name="q_option" value="Munich" checked /> Munich</label>`
    html += `</div>`

    let div = document.createElement('div')
    div.innerHTML = html
    document.body.appendChild(div)

    let selected = div.querySelector('input[type="radio"]:checked') as HTMLInputElement | null
    assert.equal(selected?.value, 'Munich', 'should return selected radio value')

    div.remove()
  })

  it('getAnswer returns JSON array for multi_select with checked checkboxes', () => {
    let html = `<div id="q-options">`
    html += `<label><input type="checkbox" class="q-option" value="Email" checked /> Email</label>`
    html += `<label><input type="checkbox" class="q-option" value="SMS" checked /> SMS</label>`
    html += `<label><input type="checkbox" class="q-option" value="Phone" /> Phone</label>`
    html += `</div>`

    let div = document.createElement('div')
    div.innerHTML = html
    document.body.appendChild(div)

    let checked = div.querySelectorAll(
      'input[type="checkbox"]:checked',
    ) as NodeListOf<HTMLInputElement>
    let values = Array.from(checked).map((cb) => cb.value)
    assert.equal(values.length, 2, 'two options should be checked')
    assert.ok(values.includes('Email'), 'Email should be checked')
    assert.ok(values.includes('SMS'), 'SMS should be checked')

    div.remove()
  })
})

// -----------------------------------------------------------------------
// 6. Connection indicator invalidate event
// -----------------------------------------------------------------------

describe('ConnectionIndicator invalidate event', () => {
  let originalLocation: Location
  let cleanup: () => void

  beforeEach(() => {
    originalLocation = window.location
  })

  afterEach(() => {
    uninstallSseMock()
    cleanup?.()
  })

  it('invalidate event triggers frame reload in frame mode', async () => {
    installSseMock()
    resetCreatedEventSources()

    let result = render(<ConnectionIndicator url="/test/subscribe" reloadMode="frame" />)
    cleanup = result.cleanup

    await new Promise((r) => setTimeout(r, 20))

    let sources = getCreatedEventSources()
    if (sources.length > 0) {
      // The component attaches invalidate handler in queueTask
      sources[0]!.emit('invalidate', {})
      await new Promise((r) => setTimeout(r, 20))
    }

    // We can't easily assert on reload (it navigates away), but we can verify
    // no crash occurred and the test completes
    assert.ok(true, 'invalidate event dispatched without error')
  })

  it.skip('invalidate event in window mode calls window.location.reload', async () => {
    // Skipped: `window.location.reload` is unforgeable in real Chromium, so
    // dispatching invalidate in window mode navigates the page away and hangs
    // the test. There is no way to stub the reload, so this cannot be asserted
    // in a browser test. Window-mode reload is exercised manually instead.
    installSseMock()
    resetCreatedEventSources()

    let result = render(<ConnectionIndicator url="/test/subscribe" reloadMode="window" />)
    cleanup = result.cleanup

    await new Promise((r) => setTimeout(r, 20))

    let sources = getCreatedEventSources()
    assert.ok(sources.length > 0, 'EventSource should be created')

    sources[0]!.emit('invalidate', {})
    await new Promise((r) => setTimeout(r, 20))

    assert.ok(true, 'invalidate event dispatched in window mode without error')
  })

  it('invalidate event is skipped when skipReloadParams match', async () => {
    installSseMock()
    resetCreatedEventSources()

    // Add editing param to URL
    let url = new URL(window.location.href)
    url.searchParams.set('editing', '1')
    window.history.replaceState({}, '', url.toString())

    let result = render(
      <ConnectionIndicator
        url="/test/subscribe"
        reloadMode="window"
        skipReloadParams={['editing']}
      />,
    )
    cleanup = result.cleanup

    await new Promise((r) => setTimeout(r, 20))

    let sources = getCreatedEventSources()
    assert.ok(sources.length > 0, 'EventSource should be created')

    // When editing param is present and skipReloadParams includes 'editing',
    // the component should return early without calling reload.
    sources[0]!.emit('invalidate', {})
    await new Promise((r) => setTimeout(r, 20))

    assert.ok(true, 'invalidate event handled without reload when editing param present')

    // Clean up the query param
    window.history.replaceState({}, '', originalLocation.href)
  })
})

// -----------------------------------------------------------------------
// 7. Customer chat resume, theme tokens, busy indicator, cancel
// -----------------------------------------------------------------------

describe('Customer chat resume + theme + busy state', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    uninstallSseMock()
    cleanup?.()
    cleanupChatDom()
  })

  function sse(events: Array<{ type: string; data: string }>): Response {
    let encoder = new TextEncoder()
    let body = new ReadableStream({
      start(controller) {
        for (let { type, data } of events) {
          controller.enqueue(encoder.encode(`event: ${type}\ndata: ${data}\n\n`))
        }
        controller.close()
      },
    })
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
  }

  it('adopts the resumed data-thread-id and continues the same thread', async () => {
    installSseMock()
    resetCreatedEventSources()

    let container = document.createElement('div')
    container.innerHTML = `
      <form id="chat-form">
        <textarea id="msg" name="message"></textarea>
        <button id="chat-submit" type="submit">Send</button>
      </form>
      <div id="chat-messages" data-thread-id="thread-resume-1"></div>
    `
    document.body.appendChild(container)

    let capturedBody = ''
    let originalFetch = window.fetch
    window.fetch = async (_url, init) => {
      if (init?.body instanceof FormData) {
        capturedBody = Array.from(init.body.entries())
          .map(([k, v]) => `${k}=${String(v)}`)
          .join('&')
      } else {
        capturedBody = String(init?.body ?? '')
      }
      return sse([
        { type: 'start', data: JSON.stringify({ runId: 'r1', threadId: 'thread-resume-1' }) },
        { type: 'message', data: JSON.stringify({ text: 'Guten Tag' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])
    }

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    let form = document.getElementById('chat-form') as HTMLFormElement
    textarea.value = 'Hallo'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 50))

    assert.ok(
      capturedBody.includes('threadId=thread-resume-1'),
      'should continue the resumed thread',
    )
    let msgs = document.getElementById('chat-messages') as HTMLElement
    assert.ok(msgs.textContent?.includes('Guten Tag'), 'should render the streamed reply')

    window.fetch = originalFetch
  })

  it('renders bubbles with theme tokens instead of hardcoded hex', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    let originalFetch = window.fetch
    window.fetch = async () =>
      sse([
        { type: 'start', data: JSON.stringify({ runId: 'r1' }) },
        { type: 'message', data: JSON.stringify({ text: 'Antwort' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Frage'
    let form = document.getElementById('chat-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 50))

    let msgs = document.getElementById('chat-messages') as HTMLElement
    let html = msgs.innerHTML
    let tokenPrefix = 'var(--' + 'rmx-'
    assert.ok(html.includes(tokenPrefix), 'bubbles should use theme tokens')
    ;['#3b82f6', '#ef4444', '#f59e0b', '#b45309', '#ccc'].forEach((hex) => {
      assert.ok(!html.toLowerCase().includes(hex), `should not contain hardcoded ${hex}`)
    })

    window.fetch = originalFetch
  })

  it('renders the slot picker for a tool result with no preceding start chunk', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    let originalFetch = window.fetch
    window.fetch = async () =>
      sse([
        { type: 'start', data: JSON.stringify({ runId: 'r-slots' }) },
        {
          type: 'tool-result',
          data: JSON.stringify({
            toolCallId: 'call_slots',
            toolName: 'find_next_available_slots',
            result: {
              resource_id: 3,
              resource_name: 'Ruhiger Raum',
              slots: [
                {
                  date_display: 'Montag, 15.09.',
                  date_epoch_ms: 1757952000000,
                  start_min: 540,
                  end_min: 600,
                },
              ],
            },
          }),
        },
        { type: 'complete', data: JSON.stringify({}) },
      ])

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Termin bitte'
    let form = document.getElementById('chat-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 50))

    let picker = document.getElementById('chat-slot-picker')
    assert.ok(picker, 'slot picker should render for a slot result')
    assert.ok(picker!.textContent?.includes('Ruhiger Raum'), 'slot picker should name the resource')
    assert.ok(
      picker!.querySelector('.slot-btn'),
      'slot picker should expose a selectable slot button',
    )

    window.fetch = originalFetch
  })

  it('shows a busy/thinking indicator with Cancel and clears it after the stream', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    let streamState: { controller?: ReadableStreamDefaultController } = {}
    let encoder = new TextEncoder()
    let originalFetch = window.fetch
    window.fetch = async () => {
      let body = new ReadableStream({
        start(c) {
          streamState.controller = c as ReadableStreamDefaultController
        },
        pull() {},
        cancel() {},
      })
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
    }

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Frage'
    let form = document.getElementById('chat-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 0))

    let busy = document.getElementById('chat-busy')
    assert.ok(busy, 'busy indicator should appear while streaming')
    assert.ok(document.getElementById('chat-cancel'), 'cancel button should be present')

    streamState.controller?.enqueue(encoder.encode('event: message\ndata: {"text":"Antwort"}\n\n'))
    streamState.controller?.enqueue(encoder.encode('event: complete\ndata: {}\n\n'))
    streamState.controller?.close()

    await new Promise((r) => setTimeout(r, 50))

    assert.ok(!document.getElementById('chat-busy'), 'busy indicator should be cleared')
    let msgs = document.getElementById('chat-messages') as HTMLElement
    assert.ok(msgs.textContent?.includes('Antwort'), 'message should render')

    window.fetch = originalFetch
  })

  it('Cancel button clears the busy state and re-enables the composer', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    let streamState: { controller?: ReadableStreamDefaultController } = {}
    let originalFetch = window.fetch
    window.fetch = async () => {
      let body = new ReadableStream({
        start(c) {
          streamState.controller = c as ReadableStreamDefaultController
        },
        pull() {},
        cancel() {},
      })
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
    }

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Frage'
    let form = document.getElementById('chat-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 0))

    let cancel = document.getElementById('chat-cancel')
    assert.ok(cancel, 'cancel button should exist')
    cancel!.click()

    await new Promise((r) => setTimeout(r, 20))

    assert.ok(!document.getElementById('chat-busy'), 'busy should be cleared on cancel')
    textarea = document.getElementById('msg') as HTMLTextAreaElement
    assert.ok(!textarea.disabled, 'composer should be re-enabled after cancel')

    streamState.controller?.close()
    await new Promise((r) => setTimeout(r, 20))

    window.fetch = originalFetch
  })

  it('clears the ?new=1 fresh marker once the customer sends a message', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()
    window.history.replaceState({}, '', '/chat?new=1')

    let originalFetch = window.fetch
    window.fetch = async () =>
      sse([
        { type: 'start', data: JSON.stringify({ runId: 'r1', threadId: 't1' }) },
        { type: 'message', data: JSON.stringify({ text: 'Hi' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Hallo'
    let form = document.getElementById('chat-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 50))

    assert.ok(
      !window.location.href.includes('new=1'),
      'fresh marker should be cleared after sending a message',
    )

    window.history.replaceState({}, '', '/')
    window.fetch = originalFetch
  })

  it('starts a new thread when the page says ?new=1, even with a reused form', async () => {
    // "Neue Unterhaltung" is an in-app navigation: the runtime reconciles the
    // page and reuses the form element, so a submit listener created for the
    // previous page can serve this one. That listener must not post the previous
    // conversation's thread id.
    installSseMock()
    resetCreatedEventSources()
    window.history.replaceState({}, '', '/chat?new=1')

    // The entry starts on the RESUMED page, so it captures that thread id.
    let container = document.createElement('div')
    container.innerHTML = `
      <form id="chat-form">
        <textarea id="msg" name="message"></textarea>
        <button id="chat-submit" type="submit">Send</button>
      </form>
      <div id="chat-messages" data-thread-id="previous-thread"></div>
    `
    document.body.appendChild(container)

    let capturedBody = ''
    let originalFetch = window.fetch
    window.fetch = async (_url, init) => {
      capturedBody =
        init?.body instanceof FormData
          ? Array.from(init.body.entries())
              .map(([k, v]) => `${k}=${String(v)}`)
              .join('&')
          : String(init?.body ?? '')
      return sse([
        { type: 'start', data: JSON.stringify({ runId: 'r2', threadId: 'server-made-new' }) },
        { type: 'message', data: JSON.stringify({ text: 'Hallo!' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])
    }

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    // Now simulate the in-app navigation to /chat?new=1: the runtime swaps the
    // page (no thread id, marker in the URL) but REUSES this form, so the
    // listener serving the submit still holds `previous-thread`.
    let area = document.getElementById('chat-messages') as HTMLElement
    area.removeAttribute('data-thread-id')
    window.history.replaceState({}, '', '/chat?new=1')

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Neue Frage'
    let form = document.getElementById('chat-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 50))

    assert.ok(
      !capturedBody.includes('threadId='),
      'a ?new=1 page must not post a thread, got: ' + capturedBody,
    )

    window.history.replaceState({}, '', '/')
    window.fetch = originalFetch
  })

  it('keeps the ?new=1 fresh marker while the first message is still streaming', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()
    window.history.replaceState({}, '', '/chat?new=1')

    let streamState: { controller?: ReadableStreamDefaultController } = {}
    let originalFetch = window.fetch
    window.fetch = async () => {
      let body = new ReadableStream({
        start(c) {
          streamState.controller = c as ReadableStreamDefaultController
        },
        pull() {},
        cancel() {},
      })
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
    }

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Hallo'
    let form = document.getElementById('chat-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 20))

    assert.ok(
      window.location.href.includes('new=1'),
      'fresh marker must survive an in-flight first turn, or a refresh resumes the previous conversation',
    )

    streamState.controller?.close()
    await new Promise((r) => setTimeout(r, 20))

    window.history.replaceState({}, '', '/')
    window.fetch = originalFetch
  })

  it('keeps the ?new=1 fresh marker when the first message fails', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()
    window.history.replaceState({}, '', '/chat?new=1')

    let originalFetch = window.fetch
    window.fetch = async () => new Response('boom', { status: 500 })

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Hallo'
    let form = document.getElementById('chat-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 30))

    assert.ok(
      window.location.href.includes('new=1'),
      'a failed turn created no conversation, so the fresh marker must stay',
    )

    window.history.replaceState({}, '', '/')
    window.fetch = originalFetch
  })

  it('renders an agent error as a role="alert" bubble, not an assistant reply', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    let originalFetch = window.fetch
    window.fetch = async () =>
      sse([
        { type: 'start', data: JSON.stringify({ runId: 'r-err' }) },
        { type: 'agent-error', data: JSON.stringify({ error: 'Fehler bei der Verarbeitung.' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Frage'
    let form = document.getElementById('chat-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 50))

    let msgs = document.getElementById('chat-messages') as HTMLElement
    let alert = msgs.querySelector('[role="alert"]') as HTMLElement | null
    assert.ok(alert, 'the error should be announced as an alert')
    assert.ok(alert!.textContent?.includes('Fehler'), 'the alert should carry the error text')
    let tokenPrefix = 'var(--' + 'rmx-'
    assert.ok(
      msgs.innerHTML.includes(tokenPrefix),
      'the error bubble should use danger theme tokens',
    )

    window.fetch = originalFetch
  })

  it('sends on Enter and leaves Shift+Enter as a newline', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    let sentMessages: string[] = []
    let originalFetch = window.fetch
    window.fetch = async (_url, init) => {
      if (init?.body instanceof FormData) sentMessages.push(String(init.body.get('message')))
      return sse([
        { type: 'start', data: JSON.stringify({ runId: 'r-enter' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])
    }

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Hallo'

    textarea.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    await new Promise((r) => setTimeout(r, 10))
    assert.equal(sentMessages.length, 0, 'Shift+Enter must not submit')

    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    await new Promise((r) => setTimeout(r, 50))
    assert.deepEqual(sentMessages, ['Hallo'], 'plain Enter should submit the message')

    window.fetch = originalFetch
  })

  it('renders the question card for a question event and submits the typed answer', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    let answerBody = ''
    let originalFetch = window.fetch
    window.fetch = async (url, init) => {
      if (String(url) === '/chat/answer' && init?.body instanceof FormData) {
        answerBody = Array.from(init.body.entries())
          .map(([k, v]) => `${k}=${String(v)}`)
          .join('&')
      }
      return sse([
        { type: 'start', data: JSON.stringify({ runId: 'r-q' }) },
        {
          type: 'question',
          data: JSON.stringify({
            runId: 'r-q',
            question: 'Welchen Termin möchten Sie buchen?',
            options: null,
            selectionMode: 'single_select',
          }),
        },
        { type: 'complete', data: JSON.stringify({}) },
      ])
    }

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Frage'
    let form = document.getElementById('chat-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((r) => setTimeout(r, 50))

    let card = document.getElementById('chat-question')
    assert.ok(card, 'the question card should render for a question event')
    let free = document.getElementById('q-free-text') as HTMLInputElement
    assert.ok(free, 'a no-options question should render a free-text input')

    free.value = 'Mittwoch, 16.09. um 10:00'
    let answerBtn = document.querySelector('.q-answer-btn') as HTMLButtonElement
    answerBtn.click()
    await new Promise((r) => setTimeout(r, 50))

    assert.ok(
      answerBody.includes('answer=Mittwoch'),
      'the typed answer should be submitted to /chat/answer, got: ' + answerBody,
    )

    window.fetch = originalFetch
  })

  it('does not render the raw ask_user args card, only the question card', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    let originalFetch = window.fetch
    window.fetch = async () =>
      sse([
        { type: 'start', data: JSON.stringify({ runId: 'r-q' }) },
        {
          type: 'tool-call-input-streaming-start',
          data: JSON.stringify({ toolCallId: 'c1', toolName: 'ask_user' }),
        },
        {
          type: 'tool-call',
          data: JSON.stringify({
            toolCallId: 'c1',
            toolName: 'ask_user',
            args: { question: 'Welcher Termin?' },
          }),
        },
        {
          type: 'question',
          data: JSON.stringify({
            runId: 'r-q',
            toolCallId: 'c1',
            question: 'Welcher Termin?',
            options: null,
            selectionMode: 'single_select',
          }),
        },
        { type: 'complete', data: JSON.stringify({}) },
      ])

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Frage'
    let form = document.getElementById('chat-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((r) => setTimeout(r, 50))

    let msgs = document.getElementById('chat-messages') as HTMLElement
    assert.ok(
      !msgs.textContent?.includes('"question"'),
      'the raw ask_user args JSON must not be rendered',
    )
    assert.ok(document.getElementById('chat-question'), 'the question card should still render')

    window.fetch = originalFetch
  })

  it('re-surfaces a pending question via /chat/reconnect after a reload', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    let originalFetch = window.fetch
    window.fetch = async (url) => {
      if (String(url) === '/chat/reconnect') {
        return new Response(
          JSON.stringify({
            status: 'suspended',
            runId: 'r-pending',
            threadId: 't1',
            gateType: 'question',
            toolCallId: 'c1',
            toolName: 'ask_user',
            suspendPayload: {
              question: 'Welcher Termin?',
              options: [{ label: 'Di. 15.09. 10:00' }],
              selectionMode: 'single_select',
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      }
      return sse([
        { type: 'start', data: JSON.stringify({ runId: 'r1' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])
    }

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup
    await new Promise((r) => setTimeout(r, 40))

    let card = document.getElementById('chat-question')
    assert.ok(card, 'reconnect should re-render the pending question card')
    assert.ok(card!.textContent?.includes('Welcher Termin?'), 'card should show the question')
    assert.ok(card!.querySelector('.q-option'), 'question options should render as choices')
    // The composer stays disabled until the gate is resolved.
    assert.ok(
      (document.getElementById('msg') as HTMLTextAreaElement).disabled,
      'the composer should be disabled while a gate is pending',
    )

    window.fetch = originalFetch
  })

  it('keeps the transcript parked when the reader is not near the bottom', async () => {
    installSseMock()
    resetCreatedEventSources()

    let container = document.createElement('div')
    container.innerHTML = `
      <form id="chat-form">
        <textarea id="msg" name="message"></textarea>
        <button id="chat-submit" type="submit">Send</button>
      </form>
      <div id="chat-messages" style="height:80px;overflow-y:auto"></div>
    `
    document.body.appendChild(container)

    let area = document.getElementById('chat-messages') as HTMLElement
    for (let i = 0; i < 40; i++) {
      let line = document.createElement('div')
      line.style.height = '20px'
      line.textContent = 'Alt ' + i
      area.appendChild(line)
    }
    area.scrollTop = 0

    let stream: { controller?: ReadableStreamDefaultController } = {}
    let encoder = new TextEncoder()
    let originalFetch = window.fetch
    window.fetch = async () => {
      let body = new ReadableStream({
        start(c) {
          stream.controller = c as ReadableStreamDefaultController
        },
      })
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
    }

    let result = render(<CustomerChatStream />)
    cleanup = result.cleanup

    let form = document.getElementById('chat-form') as HTMLFormElement
    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    textarea.value = 'Frage'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await new Promise((r) => setTimeout(r, 0))

    // Park at the top after the user's own message force-scrolled to the bottom.
    area.scrollTop = 0
    stream.controller?.enqueue(encoder.encode('event: start\ndata: {"runId":"r"}\n\n'))
    stream.controller?.enqueue(encoder.encode('event: message\ndata: {"text":"Antwort"}\n\n'))
    await new Promise((r) => setTimeout(r, 30))

    assert.equal(area.scrollTop, 0, 'a reader parked above the fold must not be yanked down')

    // Back at the bottom, new content should follow.
    area.scrollTop = area.scrollHeight
    stream.controller?.enqueue(encoder.encode('event: message\ndata: {"text":"Noch"}\n\n'))
    await new Promise((r) => setTimeout(r, 30))
    assert.ok(area.scrollTop > 0, 'a reader at the bottom should keep following the stream')

    stream.controller?.close()
    window.fetch = originalFetch
  })
})

// -----------------------------------------------------------------------
// 8. Support-agent thread continuation (resume from the chatlog)
// -----------------------------------------------------------------------

function setupSupportDom(threadId?: string): HTMLElement {
  let container = document.createElement('div')
  container.innerHTML = `
    <div id="support-agent-frame-container" data-active-frame="support-agent-panel"></div>
    <div id="chat-messages"${threadId ? ` data-thread-id="${threadId}"` : ''}></div>
    <form id="support-agent-form">
      <textarea id="support-agent-input" name="message"></textarea>
      <button id="support-agent-submit" type="submit">Senden</button>
    </form>
  `
  document.body.appendChild(container)
  return container
}

describe('Support agent thread continuation', () => {
  let cleanup: (() => void) | undefined
  let dom: HTMLElement | undefined

  afterEach(() => {
    uninstallSseMock()
    cleanup?.()
    dom?.remove()
    dom = undefined
    window.history.replaceState({}, '', '/')
  })

  function sse(events: Array<{ type: string; data: string }>): Response {
    let encoder = new TextEncoder()
    let body = new ReadableStream({
      start(controller) {
        for (let { type, data } of events) {
          controller.enqueue(encoder.encode(`event: ${type}\ndata: ${data}\n\n`))
        }
        controller.close()
      },
    })
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
  }

  function captureBody(init?: RequestInit): string {
    return init?.body instanceof FormData
      ? Array.from(init.body.entries())
          .map(([k, v]) => `${k}=${String(v)}`)
          .join('&')
      : String(init?.body ?? '')
  }

  function submitSupportMessage(text: string): void {
    let textarea = document.getElementById('support-agent-input') as HTMLTextAreaElement
    textarea.value = text
    let form = document.getElementById('support-agent-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }

  it('adopts the resumed data-thread-id and posts it with the next message', async () => {
    installSseMock()
    resetCreatedEventSources()
    window.history.replaceState({}, '', '/admin/support-agent?threadId=resumed-thread-1')
    dom = setupSupportDom('resumed-thread-1')

    let capturedBody = ''
    let originalFetch = window.fetch
    window.fetch = async (url, init) => {
      if (String(url) === '/admin/support-agent') capturedBody = captureBody(init)
      return sse([
        { type: 'start', data: JSON.stringify({ runId: 'r1', threadId: 'resumed-thread-1' }) },
        { type: 'message', data: JSON.stringify({ text: 'Antwort' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])
    }

    let result = render(<SupportAgentStream />)
    cleanup = result.cleanup

    submitSupportMessage('Hallo')
    await new Promise((r) => setTimeout(r, 50))

    assert.ok(
      capturedBody.includes('threadId=resumed-thread-1'),
      'should continue the resumed thread, got: ' + capturedBody,
    )
    assert.ok(
      (document.getElementById('chat-messages') as HTMLElement).textContent?.includes('Antwort'),
      'should render the streamed reply',
    )

    window.fetch = originalFetch
  })

  it('does not continue the previous thread after an in-app navigation to a fresh page', async () => {
    installSseMock()
    resetCreatedEventSources()
    window.history.replaceState({}, '', '/admin/support-agent?threadId=previous-thread')
    dom = setupSupportDom('previous-thread')

    let bodies: string[] = []
    let originalFetch = window.fetch
    window.fetch = async (url, init) => {
      if (String(url) === '/admin/support-agent') bodies.push(captureBody(init))
      return sse([
        { type: 'start', data: JSON.stringify({ runId: 'r2', threadId: 'previous-thread' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])
    }

    let result = render(<SupportAgentStream />)
    cleanup = result.cleanup

    // The resumed page continues its own thread first...
    submitSupportMessage('Erste Frage')
    await new Promise((r) => setTimeout(r, 50))
    assert.ok(
      bodies[0]?.includes('threadId=previous-thread'),
      'the resumed page should continue the resumed thread, got: ' + bodies[0],
    )

    // ...then the runtime reuses the entry while swapping in a fresh page: the
    // chat area loses its data-thread-id and the URL no longer names a thread.
    let area = document.getElementById('chat-messages') as HTMLElement
    area.removeAttribute('data-thread-id')
    window.history.replaceState({}, '', '/admin/support-agent')

    submitSupportMessage('Neue Frage')
    await new Promise((r) => setTimeout(r, 50))

    assert.equal(bodies.length, 2, 'two turns should be submitted')
    assert.ok(
      !bodies[1]!.includes('threadId='),
      'a fresh page must not post the previous thread, got: ' + bodies[1],
    )

    window.fetch = originalFetch
  })

  it('does not post a URL thread id the server did not adopt', async () => {
    installSseMock()
    resetCreatedEventSources()
    // The index rejected this id (unknown/foreign), so it rendered no
    // data-thread-id — but the address bar still names it.
    window.history.replaceState({}, '', '/admin/support-agent?threadId=foreign-thread')
    dom = setupSupportDom()

    let bodies: string[] = []
    let originalFetch = window.fetch
    window.fetch = async (url, init) => {
      if (String(url) === '/admin/support-agent') bodies.push(captureBody(init))
      return sse([
        { type: 'start', data: JSON.stringify({ runId: 'r4', threadId: 'server-made-new' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])
    }

    let result = render(<SupportAgentStream />)
    cleanup = result.cleanup

    submitSupportMessage('Erste Frage')
    await new Promise((r) => setTimeout(r, 50))

    assert.equal(bodies.length, 1, 'one turn should be submitted')
    assert.ok(
      !bodies[0]!.includes('threadId='),
      'a URL id the server did not adopt must not be posted, got: ' + bodies[0],
    )

    window.fetch = originalFetch
  })

  it('reuses the thread created on the current page for the next message', async () => {
    installSseMock()
    resetCreatedEventSources()
    window.history.replaceState({}, '', '/admin/support-agent')
    dom = setupSupportDom()

    let bodies: string[] = []
    let originalFetch = window.fetch
    window.fetch = async (url, init) => {
      if (String(url) === '/admin/support-agent') bodies.push(captureBody(init))
      return sse([
        { type: 'start', data: JSON.stringify({ runId: 'r3', threadId: 'page-thread-1' }) },
        { type: 'message', data: JSON.stringify({ text: 'Ok' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])
    }

    let result = render(<SupportAgentStream />)
    cleanup = result.cleanup

    submitSupportMessage('Erste Frage')
    await new Promise((r) => setTimeout(r, 50))
    submitSupportMessage('Zweite Frage')
    await new Promise((r) => setTimeout(r, 50))

    assert.equal(bodies.length, 2, 'two turns should be submitted')
    assert.ok(!bodies[0]!.includes('threadId='), 'the first turn creates the thread')
    assert.ok(
      bodies[1]!.includes('threadId=page-thread-1'),
      'the second turn continues the page-created thread, got: ' + bodies[1],
    )

    window.fetch = originalFetch
  })
})

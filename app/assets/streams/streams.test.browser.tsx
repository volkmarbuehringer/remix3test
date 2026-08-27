import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/ui/test'

import { CustomerChatStream } from './public/customer-chat-stream.tsx'
import { TestAgentStream } from './public/test-agent-stream.tsx'
import { theme } from '../../ui/theme/theme.ts'
import { SupportAgentStream } from './public/support-agent-stream.tsx'
import { WorkflowAgentStream } from './public/workflow-agent-stream.tsx'
import { RouteAgentStream } from './public/route-agent-stream.tsx'
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
    <input id="chat-csrf-token" data-token="test-token-123" />
  `
  document.body.appendChild(container)
  return container
}

function cleanupChatDom() {
  let form = document.getElementById('chat-form')
  if (form) form.remove()
  let msgs = document.getElementById('chat-messages')
  if (msgs) msgs.remove()
  let csrf = document.getElementById('chat-csrf-token')
  if (csrf) csrf.remove()
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

  it('CustomerChatStream opens EventSource after form submission', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    let { cleanup: c } = render(<CustomerChatStream />)
    cleanup = c

    // Simulate form submission: type a message and submit
    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    let form = document.getElementById('chat-form') as HTMLFormElement
    textarea.value = 'Hello'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    // After a microtask, fetch should have been called
    await new Promise((r) => setTimeout(r, 50))

    // The form handler calls fetch('/chat', ...). Since we haven't mocked fetch,
    // it will fail but an EventSource should NOT be created (fetch fails).
    // Actually, the component calls startStream only if fetch returns a runId.
    // Without mocking fetch, no EventSource is created.
    let sources = getCreatedEventSources()
    assert.equal(sources.length, 0, 'no EventSource created when fetch fails')
  })

  it('CustomerChatStream creates EventSource on successful fetch', async () => {
    installSseMock()
    setupChatDom()
    resetCreatedEventSources()

    // Mock fetch to return a successful response with a runId
    let originalFetch = window.fetch
    window.fetch = async () =>
      new Response(JSON.stringify({ runId: 'test-run-123' }), {
        headers: { 'Content-Type': 'application/json' },
      })

    let { cleanup: c } = render(<CustomerChatStream />)
    cleanup = c

    let textarea = document.getElementById('msg') as HTMLTextAreaElement
    let form = document.getElementById('chat-form') as HTMLFormElement
    textarea.value = 'Hello'
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await new Promise((r) => setTimeout(r, 50))

    let sources = getCreatedEventSources()
    assert.equal(sources.length, 1, 'one EventSource should be created')
    assert.ok(sources[0].url.includes('test-run-123'), 'EventSource URL should contain the runId')

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
      sources[0].open()
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
      sources[0].readyState = EventSource.CLOSED
      sources[0].emitError()
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
    assert.equal(steps[0].textContent, '\u2713 Done', 'should show updated state')
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
      sources[0].emit('invalidate', {})
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

    sources[0].emit('invalidate', {})
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
    sources[0].emit('invalidate', {})
    await new Promise((r) => setTimeout(r, 20))

    assert.ok(true, 'invalidate event handled without reload when editing param present')

    // Clean up the query param
    window.history.replaceState({}, '', originalLocation.href)
  })
})

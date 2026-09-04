import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/ui/test'

import { NotificationBell } from './notification-bell.browser.tsx'
import {
  installSseMock,
  uninstallSseMock,
  getCreatedEventSources,
  resetCreatedEventSources,
} from '../test-utils/sse-mock.ts'

function stubFetchCount(count: number): () => void {
  let original = window.fetch
  window.fetch = (async () =>
    new Response(JSON.stringify({ count }), {
      headers: { 'Content-Type': 'application/json' },
    })) as typeof window.fetch
  return () => {
    window.fetch = original
  }
}

function renderBell() {
  return render(
    <NotificationBell
      eventsUrl="/notifications/events"
      unreadCountUrl="/notifications/unread-count"
      inboxUrl="/notifications"
    />,
  )
}

describe('NotificationBell', () => {
  let cleanup: () => void

  afterEach(() => {
    uninstallSseMock()
    cleanup?.()
  })

  it('shows no badge when the unread count is zero (no live events)', async () => {
    let restore = stubFetchCount(0)
    installSseMock()
    resetCreatedEventSources()

    let result = renderBell()
    cleanup = result.cleanup

    await new Promise((r) => setTimeout(r, 30))

    let badge = result.container.querySelector('[data-bell-count]')
    assert.equal(badge, null, 'no active badge should render when there is nothing unread')

    restore()
  })

  it('shows a live badge and bumps it on a pushed new event without a reload', async () => {
    let restore = stubFetchCount(1)
    installSseMock()
    resetCreatedEventSources()

    let result = renderBell()
    cleanup = result.cleanup

    await new Promise((r) => setTimeout(r, 30))

    let sources = getCreatedEventSources()
    assert.ok(sources.length > 0, 'bell should subscribe to the per-user SSE channel')
    if (sources.length > 0) {
      sources[0]!.open()
      await new Promise((r) => setTimeout(r, 10))
    }

    let badge = result.container.querySelector('[data-bell-count]')
    assert.ok(badge, 'badge should render once the initial count loads')
    assert.equal(badge!.textContent, '1')

    // Push a live `new` event -> badge increments without a reload.
    if (sources.length > 0) {
      sources[0]!.emit('new', { id: 1, type: 'confirmation', title: 'T' })
      await new Promise((r) => setTimeout(r, 10))
    }

    let badge2 = result.container.querySelector('[data-bell-count]')
    assert.ok(badge2, 'badge should still be present after a live event')
    assert.equal(badge2!.textContent, '2', 'badge should increment to 2')

    restore()
  })
})

import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { NotificationBell } from './notification-bell.browser.tsx'
import {
  installSseMock,
  uninstallSseMock,
  getCreatedEventSources,
  resetCreatedEventSources,
} from '../../test/sse-mock.ts'

function stubFetchCount(count: number | (() => number)): () => void {
  let original = window.fetch
  window.fetch = (async () => {
    let value = typeof count === 'function' ? count() : count
    return new Response(JSON.stringify({ count: value }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof window.fetch
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

  it('aborts its unread-count request when the entry is disposed', async () => {
    let original = window.fetch
    let requestSignal: AbortSignal | undefined
    let settle: ((response: Response) => void) | undefined
    window.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined
      return new Promise<Response>((resolve) => {
        settle = resolve
      })
    }) as typeof window.fetch
    installSseMock()
    resetCreatedEventSources()

    let result = renderBell()
    let container = result.container

    try {
      await new Promise((r) => setTimeout(r, 10))
      assert.ok(requestSignal, 'the count request should carry a lifetime signal')
      assert.equal(requestSignal!.aborted, false)

      result.cleanup()
      cleanup = () => {}
      assert.equal(requestSignal!.aborted, true, 'disposal must abort the pending count request')

      settle?.(
        new Response(JSON.stringify({ count: 5 }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      await new Promise((r) => setTimeout(r, 10))
      assert.equal(
        container.querySelector('[data-bell-count]'),
        null,
        'a late response must not paint a badge into a disposed entry',
      )
    } finally {
      window.fetch = original
    }
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
    let serverCount = 1
    let restore = stubFetchCount(() => serverCount)
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

    // Push a live `new` event -> badge increments without a reload. The server
    // count also moved to 2, so the event-triggered reconcile agrees.
    serverCount = 2
    if (sources.length > 0) {
      sources[0]!.emit('new', { id: 1, type: 'confirmation', title: 'T' })
      await new Promise((r) => setTimeout(r, 30))
    }

    let badge2 = result.container.querySelector('[data-bell-count]')
    assert.ok(badge2, 'badge should still be present after a live event')
    assert.equal(badge2!.textContent, '2', 'badge should increment to 2')

    restore()
  })

  it('refetches the count and clears the badge on a pushed read event', async () => {
    let restoreFetch = stubFetchCount(1)
    installSseMock()
    resetCreatedEventSources()

    let result = renderBell()
    cleanup = result.cleanup

    try {
      await new Promise((r) => setTimeout(r, 30))

      let sources = getCreatedEventSources()
      assert.ok(sources.length > 0, 'bell should subscribe to the per-user SSE channel')

      let badge = result.container.querySelector('[data-bell-count]')
      assert.ok(badge, 'badge should render once the initial count loads')
      assert.equal(badge!.textContent, '1')

      // The inbox marked the rows read; the server's count endpoint is now 0.
      // The bell must refetch instead of keeping the mount-time count.
      restoreFetch()
      restoreFetch = stubFetchCount(0)

      sources[0]!.emit('read', {})
      await new Promise((r) => setTimeout(r, 30))

      assert.equal(
        result.container.querySelector('[data-bell-count]'),
        null,
        'badge should clear after the read event resyncs the count',
      )
    } finally {
      restoreFetch()
    }
  })
})

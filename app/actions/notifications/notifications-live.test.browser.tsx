import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'
import type { Handle, RemixNode } from 'remix/component'

import { NotificationsLive } from './public/notifications-live.tsx'
import {
  getCreatedEventSources,
  installSseMock,
  uninstallSseMock,
  type MockEventSource,
} from '../../../test/sse-mock.ts'

// NotificationsLive is called directly with a synthetic handle, the pattern
// used by `lists-loading.test.browser.tsx`: the runtime FrameHandle is not
// publicly constructible and `render()`'s root frame reload throws, so the
// entry's `frame.reload` is a spy here. The real EventSource mock drives the
// channel and a fetch stub drives the enhanced form submissions. Covered: the
// live trigger, pending/queued state, failure statuses, the subscription and
// listener teardown, and the fetch-then-reload mutation path. The route wiring,
// the real frame reload, and the fetch/CSRF round trip are covered by
// controller.test.ts and notifications-live.test.e2e.ts.

let dispose: (() => void) | null = null
const originalFetch = window.fetch
let fetchCalls: Array<{ url: string; method: string; body: FormData | null }> = []
let fetchResolvers: Array<(response: Response) => void> = []

afterEach(() => {
  dispose?.()
  dispose = null
  window.fetch = originalFetch
  fetchCalls = []
  fetchResolvers = []
  uninstallSseMock()
  document.body.replaceChildren()
})

interface Mounted {
  result: RenderResult
  source: () => MockEventSource
}

function mount(reload: () => Promise<AbortSignal>): Mounted {
  installSseMock()
  let controller = new AbortController()
  let inner: (() => RemixNode) | null = null
  let resultRef: RenderResult | null = null

  let handle = {
    frame: { reload },
    props: { eventsUrl: '/notifications/events' },
    signal: controller.signal,
    // Mirror the runtime re-invoking the render function through the handle.
    update: () => {
      if (resultRef && inner) resultRef.root.render(<div>{inner()}</div>)
    },
    // The entry opens its EventSource and its submit listener in queueTask; a
    // synthetic handle must drain that task itself.
    queueTask: (task: () => void) => task(),
  } as unknown as Handle<{ eventsUrl: string }>

  inner = NotificationsLive(handle) as unknown as () => RemixNode
  resultRef = render(<div>{inner()}</div>)
  let result = resultRef

  dispose = () => {
    controller.abort()
    result.cleanup()
  }

  return {
    result,
    source: () => {
      let sources = getCreatedEventSources()
      assert.equal(sources.length, 1, 'the live entry opens exactly one subscription')
      return sources[0]!
    },
  }
}

/** A controllable fetch: every call parks until the test resolves it. */
function stubFetch(): void {
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      body: init?.body instanceof FormData ? init.body : null,
    })
    return new Promise<Response>((resolve) => fetchResolvers.push(resolve))
  }) as typeof window.fetch
}

function appendForm(
  options: { inPanel?: boolean; method?: string; action?: string } = {},
): HTMLFormElement {
  let host = document.createElement('div')
  if (options.inPanel !== false) host.setAttribute('data-notifications-panel', '')
  host.innerHTML = `
    <form action="${options.action ?? '/notifications/page-size'}" method="${options.method ?? 'POST'}">
      <input type="hidden" name="_csrf" value="csrf-token" />
      <input type="hidden" name="_action" value="page-size" />
      <button type="submit" name="button" value="save">Speichern</button>
    </form>
  `
  document.body.appendChild(host)
  return host.querySelector('form')!
}

/** Keeps a non-intercepted form from navigating the test page away. */
function preventNativeSubmit(form: HTMLFormElement): void {
  form.addEventListener('submit', (event) => event.preventDefault())
}

function submit(form: HTMLFormElement): SubmitEvent {
  let submitter = form.querySelector('button')
  let event = new SubmitEvent('submit', {
    bubbles: true,
    cancelable: true,
    submitter,
  })
  form.dispatchEvent(event)
  return event
}

function statusText(container: HTMLElement): string {
  return container.querySelector('[data-notifications-live]')?.textContent?.trim() ?? ''
}

describe('NotificationsLive', () => {
  it('reloads the panel on a new notification, but not on a read event', async (t) => {
    let reloads = 0
    let mounted = mount(async () => {
      reloads++
      return new AbortController().signal
    })
    let source = mounted.source()

    source.emit('new', { id: 1, type: 'confirmation', title: 'Termin bestätigt' })
    await t.waitFor(() => assert.equal(reloads, 1))
    assert.equal(statusText(mounted.result.container), '', 'the status clears after the reload')

    source.emit('read', '')
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(reloads, 1, 'read events must not refresh the panel')
  })

  it('shows a pending status while the reload runs', async (t) => {
    let resolveReload: ((signal: AbortSignal) => void) | undefined
    let mounted = mount(
      () =>
        new Promise<AbortSignal>((resolve) => {
          resolveReload = resolve
        }),
    )
    let source = mounted.source()

    source.emit('new', { id: 1 })
    await t.waitFor(() => assert.equal(statusText(mounted.result.container), 'Wird aktualisiert…'))

    resolveReload!(new AbortController().signal)
    await t.waitFor(() => assert.equal(statusText(mounted.result.container), ''))
  })

  it('folds a burst of notifications into one follow-up reload', async (t) => {
    let reloads = 0
    let pending: Array<(signal: AbortSignal) => void> = []
    let mounted = mount(() => {
      reloads++
      return new Promise<AbortSignal>((resolve) => pending.push(resolve))
    })
    let source = mounted.source()

    source.emit('new', { id: 1 })
    await t.waitFor(() => assert.equal(reloads, 1))

    source.emit('new', { id: 2 })
    source.emit('new', { id: 3 })
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(reloads, 1, 'only one reload runs at a time')

    pending[0]!(new AbortController().signal)
    await t.waitFor(() => assert.equal(reloads, 2))
  })

  it('reports a failed reload and retries on the next notification', async (t) => {
    let logged = t.mock.method(console, 'error')
    let calls = 0
    let mounted = mount(async () => {
      calls++
      if (calls === 1) throw new Error('offline')
      return new AbortController().signal
    })
    let source = mounted.source()

    source.emit('new', { id: 1 })
    await t.waitFor(() =>
      assert.equal(statusText(mounted.result.container), 'Aktualisierung fehlgeschlagen.'),
    )
    assert.equal(logged.mock.calls.length, 1, 'the failure is reported')

    source.emit('new', { id: 2 })
    await t.waitFor(() => assert.equal(statusText(mounted.result.container), ''))
  })

  it('closes the subscription when the entry unmounts', async () => {
    let mounted = mount(async () => new AbortController().signal)
    let source = mounted.source()

    dispose!()
    dispose = null
    assert.equal(source.closed, true)
  })

  it('submits a panel POST with fetch, then reloads the panel', async (t) => {
    stubFetch()
    let reloads = 0
    let mounted = mount(async () => {
      reloads++
      return new AbortController().signal
    })
    let form = appendForm()

    let event = submit(form)
    assert.equal(event.defaultPrevented, true, 'the native navigation is cancelled')
    await t.waitFor(() => assert.equal(fetchCalls.length, 1))

    let call = fetchCalls[0]!
    assert.equal(new URL(call.url).pathname, '/notifications/page-size')
    assert.equal(call.method, 'POST')
    assert.equal(call.body?.get('_csrf'), 'csrf-token', 'CSRF field is forwarded')
    assert.equal(call.body?.get('_action'), 'page-size')
    assert.equal(call.body?.get('button'), 'save', "the submitter's name/value is forwarded")
    await t.waitFor(() => assert.equal(statusText(mounted.result.container), 'Wird gespeichert…'))

    fetchResolvers[0]!(new Response('ok', { status: 200 }))
    await t.waitFor(() => assert.equal(reloads, 1))
    await t.waitFor(() => assert.equal(statusText(mounted.result.container), ''))
  })

  it('ignores a duplicate submit of the same form while it is pending', async (t) => {
    stubFetch()
    let reloads = 0
    mount(async () => {
      reloads++
      return new AbortController().signal
    })
    let form = appendForm()

    let first = submit(form)
    let second = submit(form)
    assert.equal(first.defaultPrevented, true)
    assert.equal(second.defaultPrevented, true, 'the duplicate is still cancelled')
    await t.waitFor(() => assert.equal(fetchCalls.length, 1))
    assert.equal(fetchCalls.length, 1, 'only one mutation is queued')

    fetchResolvers[0]!(new Response('ok', { status: 200 }))
    await t.waitFor(() => assert.equal(reloads, 1))

    // The guard is released once the mutation settles, so a real retry works.
    submit(form)
    await t.waitFor(() => assert.equal(fetchCalls.length, 2))
    fetchResolvers[1]!(new Response('ok', { status: 200 }))
    await new Promise((resolve) => setTimeout(resolve, 20))
  })

  it('leaves GET forms and forms outside the panel to the browser', async () => {
    stubFetch()
    let reloads = 0
    mount(async () => {
      reloads++
      return new AbortController().signal
    })

    let outside = appendForm({ inPanel: false })
    preventNativeSubmit(outside)
    submit(outside)

    let getForm = appendForm({ method: 'GET', action: '/notifications' })
    preventNativeSubmit(getForm)
    submit(getForm)

    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(fetchCalls.length, 0, 'only panel POSTs are enhanced')
    assert.equal(reloads, 0)
  })

  it('reports a failed mutation and does not reload', async (t) => {
    let logged = t.mock.method(console, 'error')
    stubFetch()
    let reloads = 0
    let mounted = mount(async () => {
      reloads++
      return new AbortController().signal
    })

    submit(appendForm())
    await t.waitFor(() => assert.equal(fetchCalls.length, 1))
    fetchResolvers[0]!(new Response('nope', { status: 500 }))

    await t.waitFor(() =>
      assert.equal(statusText(mounted.result.container), 'Aktion fehlgeschlagen.'),
    )
    assert.equal(reloads, 0, 'a failed mutation must not reload the panel')
    assert.equal(logged.mock.calls.length, 1, 'the failure is reported')
  })

  it('queues a submit that arrives while a live reload runs', async (t) => {
    stubFetch()
    let reloadResolvers: Array<(signal: AbortSignal) => void> = []
    let reloads = 0
    let mounted = mount(() => {
      reloads++
      return new Promise<AbortSignal>((resolve) => reloadResolvers.push(resolve))
    })
    let source = mounted.source()

    source.emit('new', { id: 1 })
    await t.waitFor(() => assert.equal(reloads, 1))

    let event = submit(appendForm())
    assert.equal(event.defaultPrevented, true)
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(fetchCalls.length, 0, 'the mutation waits for the active reload')

    reloadResolvers[0]!(new AbortController().signal)
    await t.waitFor(() => assert.equal(fetchCalls.length, 1))
    assert.equal(fetchCalls[0]!.method, 'POST')

    fetchResolvers[0]!(new Response('ok', { status: 200 }))
    await t.waitFor(() => assert.equal(reloads, 2))
  })

  it('detaches the submit listener when the entry unmounts', async () => {
    stubFetch()
    mount(async () => new AbortController().signal)
    let form = appendForm()
    preventNativeSubmit(form)

    dispose!()
    dispose = null

    submit(form)
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(fetchCalls.length, 0, 'the listener is removed with the entry')
  })
})

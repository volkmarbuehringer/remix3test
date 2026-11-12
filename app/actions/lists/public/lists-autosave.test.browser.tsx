import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsClient } from './lists-client.tsx'
import type { ListInitialState } from './lists-state.ts'

// ListsClient autosave + undo against a loaded list. fetch is stubbed so the
// debounced PUT is observable; the real round-trip and the frame reloadStart
// flush stay in the e2e suite. The pure transitions are in lists-state.test.ts.

const originalFetch = window.fetch
const realSetTimeout = window.setTimeout.bind(window)
let calls: Array<{ url: string; init: RequestInit }> = []
let deferredResponses: Array<() => void> = []
let cleanup: (() => void) | null = null
let removeCsrf: (() => void) | null = null

function installCsrf(token: string) {
  document.querySelectorAll('meta[name="csrf-token"]').forEach((meta) => meta.remove())
  let meta = document.createElement('meta')
  meta.name = 'csrf-token'
  meta.content = token
  document.head.appendChild(meta)
  removeCsrf = () => meta.remove()
}

function responseFor(init?: RequestInit): Response {
  let body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
  let state = {
    id: 7,
    title: typeof body.title === 'string' ? body.title : 'Alt',
    description: typeof body.description === 'string' ? body.description : 'D',
    items: Array.isArray(body.items) ? body.items : [],
    updated_at: 222,
  }
  return new Response(JSON.stringify(state), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * `defer: true` leaves each response pending until `respondToNextFetch()`, so
 * the undo test can put the second mutation in flight deterministically instead
 * of racing a real 1.5s timer against suite load.
 */
function stubFetch(options: { defer?: boolean } = {}) {
  let defer = options.defer ?? false
  deferredResponses = []
  window.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    if (!defer) return responseFor(init)
    return await new Promise<Response>((resolve) => {
      deferredResponses.push(() => resolve(responseFor(init)))
    })
  }) as typeof window.fetch
}

/**
 * Flush the fetch → response.json() → save continuation. `Response.json()`
 * reads the body through real browser tasks, so fake timers are not enough;
 * run a fixed number of real 0 ms tasks instead of waiting on a debounce clock.
 */
async function flushAsyncWork(result: ReturnType<typeof renderEditor>): Promise<void> {
  for (let turn = 0; turn < 10; turn++) {
    await result.act(() => new Promise<void>((resolve) => realSetTimeout(resolve, 0)))
  }
}

async function respondToNextFetch(result: ReturnType<typeof renderEditor>): Promise<void> {
  let respond = deferredResponses.shift()
  assert.ok(respond, 'expected a deferred fetch response')
  respond()
  await flushAsyncWork(result)
}

function renderEditor(state: ListInitialState) {
  let result = render(<ListsClient initialState={state} />)
  cleanup = result.cleanup
  return result
}

function titleInputOf(container: HTMLElement): HTMLInputElement {
  return container.querySelector('#lists-title') as HTMLInputElement
}

function itemIdsOf(container: HTMLElement): Array<string | null> {
  return [...container.querySelectorAll('[data-item-id]')].map((el) =>
    el.getAttribute('data-item-id'),
  )
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(text),
    ) ?? null
  )
}

function typeTitle(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  calls = []
  installCsrf('tok')
  stubFetch()
})

afterEach(() => {
  window.fetch = originalFetch
  removeCsrf?.()
  removeCsrf = null
  cleanup?.()
  cleanup = null
})

describe('ListsClient autosave', () => {
  it('autosaves a title edit only after the debounce window', async (t) => {
    let timers = t.useFakeTimers({ now: new Date('2026-11-11T12:00:00Z') })
    let result = renderEditor({
      id: 7,
      title: 'Alt',
      description: 'D',
      items: [{ id: 'i1', label: 'A' }],
      updated_at: 111,
    })

    typeTitle(titleInputOf(result.container), 'Neu')

    timers.advance(500)
    await flushAsyncWork(result)
    assert.equal(calls.length, 0, 'nothing is sent before the 1.5s debounce')

    timers.advance(1000)
    await flushAsyncWork(result)
    assert.equal(calls.length, 1, 'the edit should autosave')
    assert.equal(calls[0]!.url, '/lists/7')
    assert.equal(calls[0]!.init.method, 'PUT')
    let headers = calls[0]!.init.headers as Record<string, string>
    assert.equal(headers['Content-Type'], 'application/json')
    assert.equal(headers['X-Csrf-Token'], 'tok')
    assert.equal(headers['If-Match'], '111')
    assert.equal(calls[0]!.init.body, JSON.stringify({ title: 'Neu' }))
  })

  it('coalesces rapid edits into a single PUT', async (t) => {
    let timers = t.useFakeTimers({ now: new Date('2026-11-11T12:00:00Z') })
    let result = renderEditor({
      id: 7,
      title: 'Alt',
      description: 'D',
      items: [],
      updated_at: 111,
    })
    let input = titleInputOf(result.container)

    typeTitle(input, 'N')
    typeTitle(input, 'Ne')
    typeTitle(input, 'Neu')

    timers.advance(1500)
    await flushAsyncWork(result)
    assert.equal(calls.length, 1, 'only the final value should be sent')
    timers.advance(300)
    await flushAsyncWork(result)
    assert.equal(calls.length, 1, 'only the final value should be sent')
    assert.equal(calls[0]!.init.body, JSON.stringify({ title: 'Neu' }))
  })

  it('does not save when the value is unchanged', async (t) => {
    let timers = t.useFakeTimers({ now: new Date('2026-11-11T12:00:00Z') })
    let result = renderEditor({
      id: 7,
      title: 'Alt',
      description: 'D',
      items: [],
      updated_at: 111,
    })

    typeTitle(titleInputOf(result.container), 'Alt')

    timers.advance(1800)
    await flushAsyncWork(result)
    assert.equal(calls.length, 0)
  })

  it('adds an item via Enter and autosaves it', async (t) => {
    let timers = t.useFakeTimers({ now: new Date('2026-11-11T12:00:00Z') })
    let result = renderEditor({
      id: 7,
      title: 'Alt',
      description: 'D',
      items: [],
      updated_at: 111,
    })

    let newItem = result.container.querySelector(
      'textarea[placeholder="Neues Element eingeben…"]',
    ) as HTMLTextAreaElement
    assert.ok(newItem, 'the new-item textarea should render')

    newItem.value = 'Neues Element'
    newItem.dispatchEvent(new Event('input', { bubbles: true }))
    await result.act(() => {
      newItem.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      )
    })

    assert.equal(itemIdsOf(result.container).length, 1, 'Enter must add the item to the list')
    timers.advance(1500)
    await flushAsyncWork(result)
    assert.equal(calls.length, 1, 'the added item should autosave')
    let payload = JSON.parse(String(calls[0]!.init.body)) as {
      items: Array<{ id: string; label: string }>
    }
    assert.equal(payload.items.length, 1)
    assert.equal(payload.items[0]!.label, 'Neues Element')
  })

  it('deletes exactly the selected items and autosaves the survivors', async (t) => {
    let timers = t.useFakeTimers({ now: new Date('2026-11-11T12:00:00Z') })
    let result = renderEditor({
      id: 7,
      title: 'L',
      description: '',
      items: [
        { id: 'keep', label: 'Behalten' },
        { id: 'drop-a', label: 'Weg A' },
        { id: 'drop-b', label: 'Weg B' },
      ],
      updated_at: 111,
    })

    for (let id of ['drop-a', 'drop-b']) {
      let box = result.container.querySelector<HTMLInputElement>(`[data-select-item="${id}"]`)!
      await result.act(() => {
        box.checked = true
        box.dispatchEvent(new Event('change', { bubbles: true }))
      })
    }

    let deleteSelected = buttonByText(result.container, 'Auswahl löschen')
    assert.ok(deleteSelected, 'the delete-selected control should render')
    await result.act(() => deleteSelected!.click())

    assert.deepEqual(itemIdsOf(result.container), ['keep'])
    timers.advance(1500)
    await flushAsyncWork(result)
    assert.equal(calls.length, 1, 'the deletion should autosave')
    let payload = JSON.parse(String(calls[0]!.init.body)) as { items: Array<{ id: string }> }
    assert.deepEqual(
      payload.items.map((item) => item.id),
      ['keep'],
    )
  })
})

describe('ListsClient undo', () => {
  it('clears completed items, shows the undo chip, and restores them on undo', async () => {
    let result = renderEditor({
      id: 7,
      title: 'L',
      description: '',
      items: [
        { id: 'done', label: 'Erledigt', done: true },
        { id: 'open', label: 'Offen' },
      ],
      updated_at: 111,
    })

    let clear = buttonByText(result.container, 'Nur Erledigte löschen')
    assert.ok(clear, 'the clear-completed control should render')
    await result.act(() => clear!.click())

    assert.deepEqual(itemIdsOf(result.container), ['open'])
    assert.ok(result.container.textContent?.includes('Erledigte Elemente gelöscht.'))

    let undo = buttonByText(result.container, 'Rückgängig')
    assert.ok(undo, 'the undo chip should be offered')
    await result.act(() => undo!.click())

    assert.deepEqual(itemIdsOf(result.container), ['done', 'open'], 'undo restores the order')
    assert.equal(buttonByText(result.container, 'Rückgängig'), null, 'the chip dismisses')
  })

  it('autosaves the cleared selection and then the undone order', async (t) => {
    let timers = t.useFakeTimers({ now: new Date('2026-11-11T12:00:00Z') })
    stubFetch({ defer: true })

    let result = renderEditor({
      id: 7,
      title: 'L',
      description: '',
      items: [
        { id: 'done', label: 'Erledigt', done: true },
        { id: 'open', label: 'Offen' },
      ],
      updated_at: 111,
    })

    await result.act(() => buttonByText(result.container, 'Nur Erledigte löschen')!.click())

    // Fire the 1.5s autosave but leave its PUT pending.
    timers.advance(1500)
    await flushAsyncWork(result)
    assert.equal(calls.length, 1, 'the clear should autosave')
    assert.equal(
      JSON.parse(String(calls[0]!.init.body))
        .items.map((item: { id: string }) => item.id)
        .join(','),
      'open',
    )

    // Undo while the clear PUT is still in flight: the slowest legitimate
    // path, where saveNow serializes the second save and the save's drift
    // branch re-arms the debounce. Nothing here waits on a wall clock.
    await result.act(() => buttonByText(result.container, 'Rückgängig')!.click())
    await respondToNextFetch(result)

    timers.advance(1500)
    await flushAsyncWork(result)
    assert.equal(calls.length, 2, 'undo is itself a mutation')
    assert.equal(
      JSON.parse(String(calls[1]!.init.body))
        .items.map((item: { id: string }) => item.id)
        .join(','),
      'done,open',
    )

    // Settle the second PUT and prove no third autosave was armed.
    await respondToNextFetch(result)
    timers.advance(5000)
    await flushAsyncWork(result)
    assert.equal(calls.length, 2)
  })
})

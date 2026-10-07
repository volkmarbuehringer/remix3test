import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { createListsDrag, type ListsDragContext } from './lists-drag.ts'
import type { ListItem } from './lists-state.ts'

// ---------------------------------------------------------------------------
// ListsDrag — the drag-and-drop controller behind /lists.
//
// The controller is driven directly against real DOM fixtures: it registers the
// sidebar drop wiring on `document` and the rows when a drag starts, so a
// dragstart/dragover/drop dispatch reaches the same merge/move handlers the page
// uses. fetch and window.confirm are stubbed, so this asserts the client half
// (gesture -> confirmation -> request shape/order -> reload) without a server;
// the real server round trip stays in lists-client-ops.test.e2e.ts.
// ---------------------------------------------------------------------------

const originalFetch = window.fetch
const originalConfirm = window.confirm

type RecordedCall = {
  url: string
  method: string
  body: unknown
  headers: Record<string, string>
}

let calls: RecordedCall[] = []
let fixture: HTMLElement | null = null
let ac: AbortController | null = null
let controller: ReturnType<typeof createListsDrag> | null = null
let reloads = 0
let updates = 0
let committed: ListItem[][] = []
let confirmCalls = 0
let confirmMessage = ''
let confirmResult = true
let loadedListId: number | null = null
let loadedUpdatedAt: number | null = null
let items: ListItem[] = []
let events: string[] = []
let flushImpl: () => Promise<boolean> = async () => true

const SIDEBAR_HTML = `
  <div data-list-id="1" data-updated-at="111">
    <span data-list-name>Alpha</span>
    <span data-list-count>2/3</span>
  </div>
  <div data-list-id="2" data-updated-at="222">
    <span data-list-name>Beta</span>
    <span data-list-count>1/1</span>
  </div>
`

function stubFetch(status = 200) {
  window.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    })
    events.push('fetch')
    return new Response(JSON.stringify({}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof window.fetch
}

function sidebarRow(id: number): HTMLElement {
  return fixture!.querySelector<HTMLElement>(`[data-list-id="${id}"]`)!
}

function setup(options: { items?: ListItem[] } = {}) {
  fixture = document.createElement('div')
  fixture.innerHTML = SIDEBAR_HTML
  let editor = document.createElement('div')
  editor.setAttribute('data-editor', '')
  editor.innerHTML = (options.items ?? items)
    .map((_, index) => `<div data-editor-row="${index}"></div>`)
    .join('')
  fixture.appendChild(editor)
  document.body.appendChild(fixture)

  ac = new AbortController()
  let listRef = fixture.querySelector<HTMLDivElement>('[data-editor]')
  let ctx: ListsDragContext = {
    getItems: () => items,
    getLoadedListId: () => loadedListId,
    getLoadedUpdatedAt: () => loadedUpdatedAt,
    getListRef: () => listRef,
    isFilterActive: () => false,
    getCsrfHeaders: () => ({ 'X-Csrf-Token': 'tok' }),
    flush: async () => {
      events.push('flush')
      return flushImpl()
    },
    commitReorder: (next) => {
      items = next
      committed.push(next)
    },
    setLoadError: () => {},
    showConflict: () => {},
    reloadFrame: () => {
      reloads++
      events.push('reload')
    },
    update: () => {
      updates++
    },
    signal: ac.signal,
  }
  controller = createListsDrag(ctx)
}

function dragListTo(sourceId: number, targetId: number) {
  let dt = new DataTransfer()
  sidebarRow(sourceId).dispatchEvent(
    new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }),
  )
  let target = sidebarRow(targetId)
  target.dispatchEvent(
    new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }),
  )
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
}

function dragItemTo(index: number, targetId: number) {
  let row = fixture!.querySelector<HTMLElement>(`[data-editor-row="${index}"]`)!
  row.addEventListener('dragstart', (e) => controller!.handleDragStart(e as DragEvent, index))
  let dt = new DataTransfer()
  row.dispatchEvent(
    new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }),
  )
  let target = sidebarRow(targetId)
  target.dispatchEvent(
    new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }),
  )
  target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
}

async function waitFor(predicate: () => boolean, timeout = 3000): Promise<void> {
  let deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert.ok(predicate(), 'condition not met before timeout')
}

beforeEach(() => {
  calls = []
  reloads = 0
  updates = 0
  committed = []
  confirmCalls = 0
  confirmMessage = ''
  confirmResult = true
  loadedListId = null
  loadedUpdatedAt = null
  items = []
  events = []
  flushImpl = async () => true
  stubFetch()
  window.confirm = (message?: string) => {
    confirmCalls++
    confirmMessage = message ?? ''
    return confirmResult
  }
})

afterEach(() => {
  ac?.abort()
  ac = null
  controller = null
  fixture?.remove()
  fixture = null
  window.fetch = originalFetch
  window.confirm = originalConfirm
})

describe('ListsDrag list merge', () => {
  it('merges a dragged list into the target after confirming', async () => {
    setup()
    loadedListId = 2
    loadedUpdatedAt = 222

    dragListTo(1, 2)

    await waitFor(() => calls.length === 1)
    assert.equal(confirmCalls, 1)
    assert.ok(confirmMessage.includes('Alpha') && confirmMessage.includes('Beta'))
    assert.equal(calls[0]!.url, '/lists/1/merge')
    assert.equal(calls[0]!.method, 'POST')
    assert.deepEqual(calls[0]!.body, { targetId: 2 })
    assert.equal(calls[0]!.headers['If-Match'], '111', 'non-open source keeps its row snapshot')
    assert.equal(reloads, 1, 'a successful merge reloads the frame')
  })

  it('does not merge when the confirmation is declined', async () => {
    confirmResult = false
    setup()
    loadedListId = 1
    loadedUpdatedAt = 999

    dragListTo(1, 2)

    await waitFor(() => confirmCalls === 1)
    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.equal(calls.length, 0, 'a declined confirmation must not issue a request')
    assert.equal(reloads, 0)
    assert.ok(updates > 0, 'declining still re-renders')
  })

  it('flushes pending edits before merging with the live source timestamp', async () => {
    setup()
    loadedListId = 1
    loadedUpdatedAt = 999
    let release!: () => void
    let gate = new Promise<boolean>((resolve) => {
      release = () => resolve(true)
    })
    flushImpl = () => gate

    dragListTo(1, 2)

    await waitFor(() => events.includes('flush'))
    assert.equal(calls.length, 0, 'the merge must wait for the flush to settle')
    release()
    await waitFor(() => calls.length === 1)
    assert.deepEqual(
      events.slice(0, 2),
      ['flush', 'fetch'],
      'the flush resolves before the merge request',
    )
    assert.equal(
      calls[0]!.headers['If-Match'],
      '999',
      'the open source list uses its live updated_at, not the stale snapshot',
    )
  })
})

describe('ListsDrag item drop', () => {
  it('moves a dragged item onto a sidebar row', async () => {
    items = [{ id: 'i1', label: 'A' }]
    setup({ items })
    loadedListId = 1

    dragItemTo(0, 2)

    await waitFor(() => calls.length === 1)
    assert.equal(calls[0]!.url, '/lists/1/move')
    assert.equal(calls[0]!.method, 'POST')
    assert.deepEqual(calls[0]!.body, { targetId: 2, itemId: 'i1' })
    assert.equal(reloads, 1)
  })

  it('reorders items on an intra-list drop', () => {
    items = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]
    setup({ items })
    let row = fixture!.querySelector<HTMLElement>('[data-editor-row="0"]')!
    row.addEventListener('dragstart', (e) => controller!.handleDragStart(e as DragEvent, 0))
    let dt = new DataTransfer()
    row.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }),
    )

    controller!.handleContainerDragOver(
      new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
        clientY: 10_000,
      }),
    )
    controller!.handleDrop(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }),
    )

    assert.equal(committed.length, 1)
    assert.deepEqual(
      committed[0]!.map((item) => item.id),
      ['b', 'a'],
    )
  })
})

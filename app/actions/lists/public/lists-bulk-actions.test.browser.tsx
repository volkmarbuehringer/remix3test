import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsClient } from './lists-client.tsx'
import type { ListInitialState } from './lists-state.ts'

// Batch 4 bulk actions + the searchable target picker. These tests cover the
// client half: hidden selected rows participate in bulk done/open and move,
// the picker searches /lists/targets, and loading/empty/error/keyboard behavior
// works without a real server.

type Call = { url: string; method: string; body: Record<string, unknown> | null }

const originalFetch = window.fetch
let cleanup: (() => void) | null = null
let calls: Call[] = []
let currentItems: ListInitialState['items'] = []
let targetItems: ListInitialState['items'] = [{ id: 't1', label: 'Ziel Eintrag' }]
let targetsResponse: { data: unknown[]; hasMore: boolean } = {
  data: [{ id: 8, title: 'Ziel Liste', description: '', count: 1, doneCount: 0, updated_at: 5 }],
  hasMore: false,
}
let targetsFailure = false
let targetsDelay = 0

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch() {
  window.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    let method = init?.method ?? 'GET'
    let body =
      init?.body != null ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
    calls.push({ url, method, body })

    if (url.startsWith('/lists/targets')) {
      if (targetsDelay) await new Promise((resolve) => setTimeout(resolve, targetsDelay))
      if (targetsFailure) return new Response('{}', { status: 500 })
      let filter = new URL(url, 'http://test').searchParams.get('filter')?.toLowerCase() ?? ''
      let data = filter
        ? targetsResponse.data.filter((target) =>
            JSON.stringify(target).toLowerCase().includes(filter),
          )
        : targetsResponse.data
      return json({ data, hasMore: targetsResponse.hasMore, offset: 0 })
    }

    if (url === '/lists/7/move-items' && method === 'POST') {
      let ids = Array.isArray(body?.itemIds) ? (body.itemIds as string[]) : []
      let moved = currentItems.filter((item) => ids.includes(item.id))
      currentItems = currentItems.filter((item) => !ids.includes(item.id))
      targetItems = [...targetItems, ...moved]
      return json({
        source: { id: 7, title: 'Bulk', description: '', items: currentItems, updated_at: 999 },
        target: {
          id: 8,
          title: 'Ziel Liste',
          description: '',
          items: targetItems,
          updated_at: 999,
        },
        moved: moved.length,
      })
    }

    if (url === '/lists/7/move' && method === 'POST') {
      let itemId = String(body?.itemId ?? '')
      let moved = currentItems.filter((item) => item.id === itemId)
      currentItems = currentItems.filter((item) => item.id !== itemId)
      targetItems = [...targetItems, ...moved]
      return json({
        source: { id: 7, title: 'Bulk', description: '', items: currentItems, updated_at: 999 },
        target: {
          id: 8,
          title: 'Ziel Liste',
          description: '',
          items: targetItems,
          updated_at: 999,
        },
      })
    }

    if (url === '/lists/7' && method === 'PUT') {
      let items = Array.isArray(body?.items) ? body.items : currentItems
      currentItems = items as ListInitialState['items']
      return json({ id: 7, title: 'Bulk', description: '', items: currentItems, updated_at: 999 })
    }

    return json({ id: 7, title: 'Bulk', description: '', items: currentItems, updated_at: 999 })
  }) as typeof window.fetch
}

function mount(items: ListInitialState['items']) {
  currentItems = items.map((item) => ({ ...item }))
  targetItems = [{ id: 't1', label: 'Ziel Eintrag' }]
  calls = []
  targetsFailure = false
  targetsDelay = 0
  targetsResponse = {
    data: [{ id: 8, title: 'Ziel Liste', description: '', count: 1, doneCount: 0, updated_at: 5 }],
    hasMore: false,
  }
  let result = render(
    <ListsClient
      initialState={{
        id: 7,
        title: 'Bulk',
        description: 'bulk actions fixture',
        items,
        updated_at: 111,
      }}
    />,
  )
  cleanup = result.cleanup
  return result
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(text),
  ) as HTMLButtonElement | undefined
}

function statusTab(container: HTMLElement, status: string): HTMLButtonElement {
  return container.querySelector(`[data-status-filter="${status}"]`) as HTMLButtonElement
}

function filterInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('#lists-inner-filter') as HTMLInputElement
}

async function waitFor(predicate: () => boolean, timeout = 3000): Promise<boolean> {
  let deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return predicate()
}

function settle(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function selectItem(result: ReturnType<typeof mount>, id: string) {
  let box = result.container.querySelector(`[data-select-item="${id}"]`) as HTMLInputElement
  await result.act(() => box.click())
}

async function openPicker(result: ReturnType<typeof mount>, action: string): Promise<HTMLElement> {
  let button = buttonByText(result.container as HTMLElement, action)
  assert.ok(button, `the bulk bar must offer "${action}"`)
  await result.act(() => button!.click())
  assert.ok(
    await waitFor(() => result.container.querySelector('[data-target-picker-dialog]') !== null),
  )
  return result.container.querySelector('[data-target-picker-dialog]') as HTMLElement
}

beforeEach(() => {
  stubFetch()
})

afterEach(() => {
  window.fetch = originalFetch
  cleanup?.()
  cleanup = null
})

describe('bulk done/open', () => {
  it('marks every selected row, including hidden ones, and offers undo', async () => {
    let result = mount([
      { id: 'a', label: 'Alpha offen' },
      { id: 'b', label: 'Beta erledigt', done: true },
      { id: 'c', label: 'Gamma offen' },
    ])
    let container = result.container as HTMLElement
    assert.ok(await waitFor(() => statusTab(container, 'all') !== null))

    await selectItem(result, 'b')
    // Hide b behind the open tab, then select a visible row too.
    await result.act(() => statusTab(container, 'open').click())
    assert.ok(await waitFor(() => !container.querySelector('[data-select-item="b"]')))
    await selectItem(result, 'a')

    let bulk = container.querySelector('[data-bulk-count]') as HTMLElement
    assert.equal(bulk.getAttribute('data-bulk-count'), '2')
    assert.equal(bulk.getAttribute('data-bulk-hidden'), '1')

    let markDone = buttonByText(container, 'Als erledigt')
    assert.ok(markDone, 'the bulk bar must offer "Als erledigt"')
    await result.act(() => markDone!.click())

    // Both selected rows changed, including the hidden one: done=2, open=1.
    assert.ok(
      await waitFor(() => statusTab(container, 'done').getAttribute('data-status-count') === '2'),
      'bulk done must mark the hidden row too',
    )
    assert.equal(statusTab(container, 'open').getAttribute('data-status-count'), '1')

    let undo = buttonByText(container, 'Rückgängig')
    assert.ok(undo, 'the bulk done action must offer undo')
    assert.ok(
      container.textContent?.includes('Auswahl als erledigt markiert.'),
      'undo chip names the bulk done action',
    )
    await result.act(() => undo!.click())
    assert.ok(
      await waitFor(() => statusTab(container, 'done').getAttribute('data-status-count') === '1'),
      'undo restores the pre-bulk done count',
    )

    // And the inverse action. Switch back to Alle first: b is still hidden by
    // the open tab selected above. Both rows are still selected (selection
    // survives undo), so do not toggle b off again.
    await result.act(() => statusTab(container, 'all').click())
    assert.ok(await waitFor(() => container.querySelector('[data-select-item="b"]') !== null))
    let markOpen = buttonByText(container, 'Als offen')
    assert.ok(markOpen, 'the bulk bar must offer "Als offen"')
    await result.act(() => markOpen!.click())
    assert.ok(
      await waitFor(() => statusTab(container, 'done').getAttribute('data-status-count') === '0'),
      'bulk open must clear done',
    )
    await settle(350)
  })
})

describe('searchable target picker', () => {
  it('filters targets server-side and moves hidden selected rows', async () => {
    let result = mount([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ])
    let container = result.container as HTMLElement
    assert.ok(await waitFor(() => statusTab(container, 'all') !== null))

    await selectItem(result, 'b')
    // Hide b, then select a. Both must move.
    await result.act(() => {
      let filter = filterInput(container)
      filter.value = 'Alpha'
      filter.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.ok(await waitFor(() => !container.querySelector('[data-select-item="b"]')))
    await selectItem(result, 'a')

    await openPicker(result, 'In Liste verschieben')
    assert.ok(await waitFor(() => container.querySelector('[data-target-option="8"]') !== null))

    let search = container.querySelector('[data-target-picker-search]') as HTMLInputElement
    await result.act(() => {
      search.value = 'Ziel'
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await settle(300)
    assert.ok(await waitFor(() => container.querySelector('[data-target-option="8"]') !== null))
    let searchCall = calls.find(
      (call) => call.url.includes('/lists/targets?') && call.url.includes('filter=Ziel'),
    )
    assert.ok(searchCall, 'typing must issue a debounced /lists/targets search')

    await result.act(() =>
      (container.querySelector('[data-target-option="8"]') as HTMLElement).click(),
    )
    assert.ok(await waitFor(() => calls.some((call) => call.url === '/lists/7/move-items')))
    let moveCall = calls.find((call) => call.url === '/lists/7/move-items')!
    assert.deepEqual((moveCall.body?.itemIds as string[] | undefined)?.toSorted() ?? [], ['a', 'b'])
    assert.ok(
      await waitFor(() => container.textContent?.includes('nach „Ziel Liste" verschoben') ?? false),
    )
    assert.equal(container.querySelector('[data-bulk-count]'), null, 'the selection clears')
    await settle(50)
  })

  it('shows loading, empty and error states with a retry', async () => {
    let result = mount([{ id: 'a', label: 'Alpha' }])
    let container = result.container as HTMLElement
    assert.ok(await waitFor(() => statusTab(container, 'all') !== null))
    await selectItem(result, 'a')

    targetsDelay = 400
    targetsResponse = { data: [], hasMore: false }
    await openPicker(result, 'In Liste kopieren')
    // The dialog opens immediately while the request is still in flight.
    assert.ok(container.querySelector('[data-target-picker-loading]'))
    assert.ok(await waitFor(() => container.querySelector('[data-target-picker-empty]') !== null))

    targetsFailure = true
    let search = container.querySelector('[data-target-picker-search]') as HTMLInputElement
    await result.act(() => {
      search.value = 'kaputt'
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })
    assert.ok(await waitFor(() => container.querySelector('[data-target-picker-error]') !== null))
    assert.ok(
      buttonByText(
        container.querySelector('[data-target-picker-error]') as HTMLElement,
        'Erneut versuchen',
      ),
      'the error state must offer a retry',
    )
  })

  it('supports arrow navigation, Escape and focus restoration', async () => {
    let result = mount([{ id: 'a', label: 'Alpha' }])
    let container = result.container as HTMLElement
    assert.ok(await waitFor(() => statusTab(container, 'all') !== null))
    await selectItem(result, 'a')

    let copyButton = buttonByText(container, 'In Liste kopieren')
    assert.ok(copyButton)
    await result.act(() => copyButton!.click())
    assert.ok(await waitFor(() => container.querySelector('[data-target-option="8"]') !== null))
    assert.ok(
      await waitFor(
        () => document.activeElement?.getAttribute('data-target-picker-search') !== null,
      ),
      'the picker search input must receive focus',
    )

    document
      .querySelector('[data-target-picker-search]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await settle(20)
    assert.equal(
      document.activeElement?.getAttribute('data-target-option'),
      '8',
      'ArrowDown focuses the first target option',
    )

    await result.act(() => {
      document
        .querySelector('[data-target-picker-dialog]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    assert.ok(
      await waitFor(() => container.querySelector('[data-target-picker-dialog]') === null),
      'Escape closes the picker dialog',
    )
    await settle(20)
    assert.equal(document.activeElement, copyButton, 'Escape must refocus the trigger')
  })
})

describe('single-row move', () => {
  it('moves one item through the existing endpoint from the row menu', async () => {
    let result = mount([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ])
    let container = result.container as HTMLElement
    assert.ok(
      await waitFor(() => container.querySelector('[data-item-menu-button="a"]') !== null),
      'the row kebab renders',
    )

    await result.act(() =>
      (container.querySelector('[data-item-menu-button="a"]') as HTMLElement).click(),
    )
    let menu = container.querySelector('[data-item-menu="a"]') as HTMLElement
    assert.ok(menu)
    let move = [...menu.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('In Liste verschieben'),
    )
    assert.ok(move, 'the row menu must offer "In Liste verschieben"')
    await result.act(() => move!.click())
    assert.ok(
      await waitFor(() => container.querySelector('[data-target-picker-dialog]') !== null),
      'the row move action opens the target picker',
    )

    assert.ok(
      await waitFor(() => container.querySelector('[data-target-option="8"]') !== null),
      'the single-item picker lists the target',
    )
    await result.act(() =>
      (container.querySelector('[data-target-option="8"]') as HTMLElement).click(),
    )

    assert.ok(
      await waitFor(() => calls.some((call) => call.url === '/lists/7/move')),
      'the single move hits the per-item endpoint',
    )
    let moveCall = calls.find((call) => call.url === '/lists/7/move')!
    assert.equal(moveCall.body?.itemId, 'a')
    assert.ok(
      await waitFor(() => container.querySelector('[data-item-id="a"]') === null),
      'the moved row leaves the editor',
    )
    assert.ok(
      await waitFor(
        () => container.textContent?.includes('Element nach „Ziel Liste" verschoben') ?? false,
      ),
      'the single move announces success',
    )
  })
})

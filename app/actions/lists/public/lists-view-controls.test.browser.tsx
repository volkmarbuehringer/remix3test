import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsClient } from './lists-client.tsx'
import type { ListInitialState } from './lists-state.ts'

// Batch 3 view controls: status tabs + counts, hide-done, hidden selections,
// the filtered empty-state reset, and view-only sort/reverse/shuffle. The pure
// predicates and ordering math live in lists-state.test.ts.

const originalFetch = window.fetch
let cleanup: (() => void) | null = null

function isoDate(offsetDays: number): string {
  let d = new Date()
  d.setDate(d.getDate() + offsetDays)
  let m = String(d.getMonth() + 1).padStart(2, '0')
  let day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function mount(items: ListInitialState['items']) {
  // Any accidental autosave PUT must not leave the test.
  window.fetch = (async () =>
    new Response(
      JSON.stringify({ id: 7, title: 'Ansicht', description: '', items, updated_at: 222 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof window.fetch
  let result = render(
    <ListsClient
      initialState={{ id: 7, title: 'Ansicht', description: '', items, updated_at: 111 }}
    />,
  )
  cleanup = result.cleanup
  return result
}

function itemIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-item-id]')].map(
    (el) => el.getAttribute('data-item-id') ?? '',
  )
}

function statusTab(container: HTMLElement, status: string): HTMLButtonElement {
  return container.querySelector(`[data-status-filter="${status}"]`) as HTMLButtonElement
}

function hideDone(container: HTMLElement): HTMLInputElement {
  return container.querySelector('[data-hide-done]') as HTMLInputElement
}

function filterInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('#lists-inner-filter') as HTMLInputElement
}

function sortSelect(container: HTMLElement): HTMLSelectElement {
  return container.querySelector('select[aria-label="Sortieren"]') as HTMLSelectElement
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === text,
  ) as HTMLButtonElement | undefined
}

async function waitFor(predicate: () => boolean, timeout = 3000): Promise<boolean> {
  let deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return predicate()
}

async function setFilter(container: HTMLElement, value: string) {
  let input = filterInput(container)
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await waitFor(() => itemIds(container).length >= 0)
}

beforeEach(() => {
  assert.equal(cleanup, null)
})

afterEach(() => {
  cleanup?.()
  cleanup = null
  window.fetch = originalFetch
})

describe('lists view controls', () => {
  it('renders status tabs with counts and filters the visible rows', async () => {
    let result = mount([
      { id: 'a', label: 'Überfällig', due: isoDate(-1) },
      { id: 'b', label: 'Heute', due: isoDate(0) },
      { id: 'c', label: 'Erledigt', done: true },
      { id: 'd', label: 'Ohne Termin' },
    ])
    let container = result.container as HTMLElement
    await waitFor(() => statusTab(container, 'all') !== null)

    assert.equal(statusTab(container, 'all').getAttribute('data-status-count'), '4')
    assert.equal(statusTab(container, 'open').getAttribute('data-status-count'), '3')
    assert.equal(statusTab(container, 'done').getAttribute('data-status-count'), '1')
    assert.equal(statusTab(container, 'overdue').getAttribute('data-status-count'), '1')

    await result.act(() => statusTab(container, 'open').click())
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'a,b,d'))

    await result.act(() => statusTab(container, 'done').click())
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'c'))

    await result.act(() => statusTab(container, 'overdue').click())
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'a'))

    await result.act(() => statusTab(container, 'all').click())
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'a,b,c,d'))
  })

  it('combines the text filter with status counts and hide-done', async () => {
    let result = mount([
      { id: 'a', label: 'Alpha offen' },
      { id: 'b', label: 'Alpha erledigt', done: true },
      { id: 'c', label: 'Beta' },
    ])
    let container = result.container as HTMLElement
    await waitFor(() => statusTab(container, 'all') !== null)

    await setFilter(container, 'alpha')
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'a,b'))
    assert.equal(statusTab(container, 'all').getAttribute('data-status-count'), '2')
    assert.equal(statusTab(container, 'open').getAttribute('data-status-count'), '1')
    assert.equal(statusTab(container, 'done').getAttribute('data-status-count'), '1')

    await result.act(() => hideDone(container).click())
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'a'))
    assert.equal(statusTab(container, 'all').getAttribute('data-status-count'), '1')
    assert.equal(statusTab(container, 'all').getAttribute('aria-pressed'), 'true')

    // The explicit Erledigt tab still shows completed rows and clears the
    // hide-done shortcut so the tab cannot be silently emptied.
    await result.act(() => statusTab(container, 'done').click())
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'b'))
    assert.equal(hideDone(container).checked, false)
    assert.equal(hideDone(container).disabled, true)
  })

  it('keeps selected hidden rows and labels them', async () => {
    let result = mount([
      { id: 'a', label: 'Alpha offen' },
      { id: 'b', label: 'Beta erledigt', done: true },
      { id: 'c', label: 'Gamma offen' },
    ])
    let container = result.container as HTMLElement
    await waitFor(() => statusTab(container, 'all') !== null)

    let selected = container.querySelector('[data-select-item="b"]') as HTMLInputElement
    await result.act(() => selected.click())
    assert.ok(await waitFor(() => container.querySelector('[data-bulk-count]') !== null))

    await result.act(() => statusTab(container, 'open').click())
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'a,c'))
    let bulk = container.querySelector('[data-bulk-count]') as HTMLElement
    assert.equal(bulk.getAttribute('data-bulk-count'), '1')
    assert.equal(bulk.getAttribute('data-bulk-hidden'), '1')
    assert.ok(bulk.textContent?.includes('(inkl. 1 verborgener)'))

    await result.act(() => statusTab(container, 'done').click())
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'b'))
    assert.equal(bulk.getAttribute('data-bulk-hidden'), null)
    assert.equal(bulk.textContent?.trim(), '1 ausgewählt')
  })

  it('labels the visible-select action when hidden rows stay selected', async () => {
    let result = mount([
      { id: 'a', label: 'Alpha offen' },
      { id: 'b', label: 'Beta erledigt', done: true },
      { id: 'c', label: 'Gamma offen' },
    ])
    let container = result.container as HTMLElement
    await waitFor(() => statusTab(container, 'all') !== null)

    await result.act(() =>
      (container.querySelector('[data-select-item="b"]') as HTMLElement).click(),
    )
    await result.act(() => statusTab(container, 'open').click())
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'a,c'))

    // Select every visible row while the hidden done row stays selected.
    let selectAll = buttonByText(container, 'Alle sichtbaren auswählen')
    assert.ok(selectAll)
    await result.act(() => selectAll!.click())
    let toggle = buttonByText(container, 'Sichtbare abwählen')
    assert.ok(toggle, 'the action must name what it deselects when hidden rows remain')
    assert.equal(
      container.querySelector('[data-bulk-count]')?.getAttribute('data-bulk-hidden'),
      '1',
    )
  })

  it('resets text and status filters from the filtered empty state', async () => {
    let result = mount([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta', done: true },
    ])
    let container = result.container as HTMLElement
    await waitFor(() => statusTab(container, 'all') !== null)

    await result.act(() => statusTab(container, 'done').click())
    await setFilter(container, 'zzz')
    assert.ok(await waitFor(() => itemIds(container).length === 0))

    let reset = buttonByText(container, 'Filter zurücksetzen')
    assert.ok(reset, 'the filtered empty state must offer a reset action')
    await result.act(() => reset!.click())

    assert.ok(await waitFor(() => itemIds(container).join(',') === 'a,b'))
    assert.equal(filterInput(container).value, '')
    assert.equal(statusTab(container, 'all').getAttribute('aria-pressed'), 'true')
    assert.equal(hideDone(container).checked, false)
  })

  it('applies A–Z as a view-only sort without dirtying or offering undo', async () => {
    let result = mount([
      { id: 'b', label: 'Bravo' },
      { id: 'a', label: 'Alpha' },
      { id: 'c', label: 'Charlie' },
    ])
    let container = result.container as HTMLElement
    await waitFor(() => sortSelect(container) !== null)

    let select = sortSelect(container)
    select.value = 'az'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    assert.ok(await waitFor(() => itemIds(container).join(',') === 'a,b,c'))
    assert.ok(container.querySelector('[data-view-only-hint]'), 'the view-only badge is visible')
    assert.equal(container.querySelector('[data-save-status]')?.textContent, 'Gespeichert')
    assert.equal(
      container.textContent?.includes('Rückgängig'),
      false,
      'no undo chip for a view sort',
    )

    // Back to manual restores the persisted order.
    select = sortSelect(container)
    select.value = 'manual'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'b,a,c'))
    assert.equal(container.querySelector('[data-view-only-hint]'), null)
  })

  it('reverses and shuffles the view without dirtying the list', async () => {
    let result = mount([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ])
    let container = result.container as HTMLElement
    await waitFor(() => container.querySelector('[aria-label="Ansicht umkehren"]') !== null)

    let reverse = container.querySelector('[aria-label="Ansicht umkehren"]') as HTMLButtonElement
    let unpressedClass = reverse.className
    await result.act(() => reverse.click())
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'c,b,a'))
    assert.equal(reverse.getAttribute('aria-pressed'), 'true')
    let pressedReverse = container.querySelector(
      '[aria-label="Ansicht umkehren"]',
    ) as HTMLButtonElement
    assert.notEqual(
      pressedReverse.className,
      unpressedClass,
      'the pressed reverse toggle must gain a visible pressed style',
    )
    assert.equal(container.querySelector('[data-save-status]')?.textContent, 'Gespeichert')

    await result.act(() => reverse.click())
    assert.ok(await waitFor(() => itemIds(container).join(',') === 'a,b,c'))

    let random = Math.random
    Math.random = () => 0
    try {
      let shuffle = container.querySelector('[aria-label="Ansicht mischen"]') as HTMLButtonElement
      await result.act(() => shuffle.click())
      assert.ok(await waitFor(() => itemIds(container).join(',') === 'b,c,a'))
    } finally {
      Math.random = random
    }
    assert.equal(container.querySelector('[data-save-status]')?.textContent, 'Gespeichert')
    assert.equal(container.textContent?.includes('Rückgängig'), false)
  })
})

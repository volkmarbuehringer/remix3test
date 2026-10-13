import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsClient } from './lists-client.tsx'
import type { ListInitialState } from './lists-state.ts'

// Due-date surfacing and tag-driven filtering in the loaded editor:
//  - the due badge humanizes today/tomorrow and marks overdue items
//  - a tag chip click sets the in-list filter (input value + visible rows)
//  - the sort control offers "Nach Fälligkeit" and applies it
// The pure branches (ordering math, badge strings) live in lists-state.test.ts.

let cleanup: (() => void) | null = null
const originalFetch = window.fetch

function isoDate(offsetDays: number): string {
  let d = new Date()
  d.setDate(d.getDate() + offsetDays)
  let m = String(d.getMonth() + 1).padStart(2, '0')
  let day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function stateWith(items: ListInitialState['items']): ListInitialState {
  return { id: 7, title: 'Einkauf', description: '', items, updated_at: 111 }
}

function mount(items: ListInitialState['items']) {
  // Stub fetch so the dirty-triggered autosave PUT cannot escape the test.
  window.fetch = (async () =>
    new Response(
      JSON.stringify({ id: 7, title: 'Einkauf', description: '', items, updated_at: 222 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof window.fetch
  let result = render(<ListsClient initialState={stateWith(items)} />)
  cleanup = result.cleanup
  return result.container as HTMLElement
}

function itemIdsOf(container: HTMLElement): Array<string | null> {
  return [...container.querySelectorAll('[data-item-id]')].map((el) =>
    el.getAttribute('data-item-id'),
  )
}

function badgeByText(container: HTMLElement, text: string): HTMLElement | null {
  return (
    [...container.querySelectorAll<HTMLElement>('[data-due-badge]')].find((el) =>
      el.textContent?.includes(text),
    ) ?? null
  )
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

describe('lists due dates and tag filtering', () => {
  beforeEach(() => {
    assert.equal(cleanup, null)
  })

  afterEach(() => {
    cleanup?.()
    cleanup = null
    window.fetch = originalFetch
  })

  it('renders humanized due badges: heute, morgen, überfällig with overdue marker', () => {
    let container = mount([
      { id: 'a', label: 'Heute fällig', due: isoDate(0) },
      { id: 'b', label: 'Morgen fällig', due: isoDate(1) },
      { id: 'c', label: 'Gestern überfällig', due: isoDate(-1) },
    ])

    assert.ok(badgeByText(container, 'heute'), 'today shows "heute"')
    assert.ok(badgeByText(container, 'morgen'), 'tomorrow shows "morgen"')
    let overdue = badgeByText(container, 'überfällig')
    assert.ok(overdue, 'a past due date shows "überfällig"')
    assert.equal(overdue!.getAttribute('data-due-overdue'), '', 'overdue badge is marked')
  })

  it('does not mark done items as overdue', () => {
    let container = mount([
      { id: 'a', label: 'Erledigt, war überfällig', due: isoDate(-2), done: true },
    ])

    assert.equal(badgeByText(container, 'überfällig'), null, 'no overdue alarm after completion')
    assert.ok(container.querySelector('[data-due-badge]'), 'the date still renders')
  })

  it('clicking a tag chip filters the list to items carrying that tag', async () => {
    let container = mount([
      { id: 'a', label: 'Schrauben', tags: ['Werkstatt'] },
      { id: 'b', label: 'Zement', tags: ['Baumarkt'] },
      { id: 'c', label: 'Dübel', tags: ['Werkstatt'] },
    ])

    let chip = [...container.querySelectorAll('[data-tag-filter]')].find((el) =>
      el.textContent?.includes('Werkstatt'),
    ) as HTMLElement | undefined
    assert.ok(chip, 'tag chips are interactive')
    chip!.click()

    assert.equal(filterInput(container).value, 'Werkstatt', 'the filter input reflects the tag')
    assert.ok(
      await waitFor(() => itemIdsOf(container).join(',') === 'a,c'),
      'only tagged rows remain',
    )

    // Escape keeps clearing the filter as before (existing behavior).
    let event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    filterInput(container).dispatchEvent(event)
    assert.ok(
      await waitFor(() => itemIdsOf(container).length === 3),
      'Escape clears the tag filter',
    )
  })

  it('sort select offers "Nach Fälligkeit" and orders dated items first', async () => {
    let container = mount([
      { id: 'a', label: 'Ohne Termin' },
      { id: 'b', label: 'Später Termin', due: isoDate(7) },
      { id: 'c', label: 'Früher Termin', due: isoDate(1) },
    ])

    let select = container.querySelector('select[aria-label="Sortieren"]') as HTMLSelectElement
    let dueOption = [...select.options].find((o) => o.value === 'due')
    assert.ok(dueOption, 'the sort control offers a due-date mode')
    assert.equal(dueOption!.textContent, 'Nach Fälligkeit')

    select.value = 'due'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    assert.ok(
      await waitFor(() => itemIdsOf(container).join(',') === 'c,b,a'),
      'dated items come first, ascending',
    )
  })
})

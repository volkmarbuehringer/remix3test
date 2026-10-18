import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsClient } from './lists-client.tsx'

// Batch 5 polish: focus-managed help sheet, document-level undo, double-click
// editing, the trash glyph, and the demoted manual-save button.

const originalFetch = window.fetch
let cleanup: (() => void) | null = null

function stubFetch() {
  window.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    let body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
    return new Response(
      JSON.stringify({
        id: 7,
        title: typeof body.title === 'string' ? body.title : 'Polish',
        description: 'polish fixture',
        items: Array.isArray(body.items) ? body.items : [],
        updated_at: 222,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }) as typeof window.fetch
}

function mount() {
  let result = render(
    <ListsClient
      initialState={{
        id: 7,
        title: 'Polish',
        description: 'polish fixture',
        items: [
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ],
        updated_at: 111,
      }}
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

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(text),
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

function settle(ms = 0) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function deleteFirstRow(result: ReturnType<typeof mount>) {
  let kebab = result.container.querySelector('[data-item-menu-button="a"]') as HTMLButtonElement
  await result.act(() => kebab.click())
  let remove = [...result.container.querySelectorAll('[data-item-menu="a"] button')].find(
    (button) => button.textContent?.includes('Löschen'),
  ) as HTMLButtonElement
  await result.act(() => remove.click())
  assert.ok(await waitFor(() => itemIds(result.container).join(',') === 'b'))
}

beforeEach(() => {
  stubFetch()
})

afterEach(() => {
  window.fetch = originalFetch
  cleanup?.()
  cleanup = null
})

describe('keyboard help sheet', () => {
  it('opens focused, closes on Escape and returns focus to the trigger', async () => {
    let result = mount()
    let container = result.container as HTMLElement
    let trigger = container.querySelector('[data-help-button]') as HTMLButtonElement
    assert.ok(trigger, 'the ? trigger must render')

    await result.act(() => trigger.click())
    assert.ok(await waitFor(() => container.querySelector('[data-help-dialog]') !== null))
    assert.ok(await waitFor(() => document.activeElement?.hasAttribute('data-help-close') === true))
    assert.ok(
      container.textContent?.includes('Doppelklick'),
      'the sheet documents edit-on-double-click',
    )

    await result.act(() => {
      container
        .querySelector('[data-help-dialog]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    assert.ok(await waitFor(() => container.querySelector('[data-help-dialog]') === null))
    await settle(20)
    assert.equal(document.activeElement, trigger, 'Escape must restore the ? trigger')
  })

  it('closes when the overlay is clicked and does not trap the page', async () => {
    let result = mount()
    let container = result.container as HTMLElement
    let trigger = container.querySelector('[data-help-button]') as HTMLButtonElement
    await result.act(() => trigger.click())
    assert.ok(await waitFor(() => container.querySelector('[data-help-overlay]') !== null))

    await result.act(() => {
      container
        .querySelector('[data-help-overlay]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    assert.ok(await waitFor(() => container.querySelector('[data-help-dialog]') === null))
  })
})

describe('document undo', () => {
  it('reverts the last destructive action with Ctrl/Cmd+Z outside form fields', async () => {
    let result = mount()
    await deleteFirstRow(result)

    await result.act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      )
    })
    assert.ok(await waitFor(() => itemIds(result.container).join(',') === 'a,b'))
    assert.ok(
      await waitFor(() => buttonByText(result.container, 'Rückgängig') === undefined),
      'undo consumes the snapshot',
    )
  })

  it('leaves native text undo alone inside inputs', async () => {
    let result = mount()
    await deleteFirstRow(result)

    let title = result.container.querySelector('#lists-title') as HTMLInputElement
    await result.act(() => {
      title.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    })
    await settle(50)
    assert.equal(itemIds(result.container).join(','), 'b', 'the editor must not undo from an input')
  })

  it('clears the chip on the next mutation', async () => {
    let result = mount()
    await deleteFirstRow(result)
    assert.ok(await waitFor(() => buttonByText(result.container, 'Rückgängig') !== undefined))

    let done = result.container.querySelector('[data-done-item="b"]') as HTMLInputElement
    await result.act(() => done.click())
    assert.ok(await waitFor(() => buttonByText(result.container, 'Rückgängig') === undefined))
    await settle(350)
  })
})

describe('row affordances', () => {
  it('starts editing on a double click of the row', async () => {
    let result = mount()
    let container = result.container as HTMLElement
    let row = container.querySelector('[data-item-id="a"]') as HTMLElement
    await result.act(() => {
      row.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }))
    })
    assert.ok(await waitFor(() => container.querySelector('textarea') !== null))
  })

  it('uses the trash glyph for delete and keeps the manual save secondary', async () => {
    let result = mount()
    let container = result.container as HTMLElement
    let deleteBtn = container.querySelector(
      '[data-item-actions] button[aria-label="Löschen"]',
    ) as HTMLButtonElement
    assert.ok(deleteBtn, 'the desktop delete action must render')
    let glyphHref =
      deleteBtn.querySelector('use')?.getAttribute('xlink:href') ??
      deleteBtn.querySelector('use')?.getAttribute('href')
    assert.ok(glyphHref?.includes('trash'), 'delete must use the trash glyph')

    let save = container.querySelector('[data-manual-save]') as HTMLButtonElement
    assert.ok(save, 'the manual save escape hatch stays available')
    assert.equal(save.disabled, true, 'a clean list does not offer a pointless save')
    assert.ok(container.querySelector('[data-save-status]'), 'the status pill stays visible')
  })
})

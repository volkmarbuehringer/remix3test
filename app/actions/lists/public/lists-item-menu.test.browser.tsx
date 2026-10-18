import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsClient } from './lists-client.tsx'

// The touch row menu is transient browser state plus document-level dismissal
// listeners. These tests cover the parts the static render guards cannot:
// outside/Escape dismissal, focus restoration, and the filtered-list reorder
// guard (move actions are hidden and moveItem refuses while a filter is active).

const originalFetch = window.fetch
let cleanup: (() => void) | null = null

function stubFetch() {
  window.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    let body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
    let state = {
      id: 7,
      title: typeof body.title === 'string' ? body.title : 'Menu',
      description: 'seeded for the row-menu browser suite',
      items: Array.isArray(body.items) ? body.items : [],
      updated_at: 222,
    }
    return new Response(JSON.stringify(state), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof window.fetch
}

function renderEditor() {
  let result = render(
    <ListsClient
      initialState={{
        id: 7,
        title: 'Row menu',
        description: 'seeded for the row-menu browser suite',
        items: [
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
          { id: 'c', label: 'Gamma' },
        ],
        updated_at: 111,
      }}
    />,
  )
  cleanup = result.cleanup
  return result
}

function kebabOf(container: HTMLElement, id: string): HTMLButtonElement {
  return container.querySelector(`[data-item-menu-button="${id}"]`) as HTMLButtonElement
}

function menuOf(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-item-menu="${id}"]`)
}

function menuButton(container: HTMLElement, id: string, text: string): HTMLButtonElement {
  let menu = menuOf(container, id)
  assert.ok(menu, 'the row menu must be open')
  let button = [...menu!.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(text),
  )
  assert.ok(button, `the menu must offer "${text}"`)
  return button
}

function pointerDown(target: Element) {
  target.dispatchEvent(new Event('pointerdown', { bubbles: true }))
}

function pressEscape() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

function settle(ms = 0) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function openMenu(result: ReturnType<typeof renderEditor>, id: string) {
  await result.act(() => kebabOf(result.container, id).click())
  assert.ok(menuOf(result.container, id), 'the row menu must open')
}

beforeEach(() => {
  stubFetch()
})

afterEach(() => {
  window.fetch = originalFetch
  cleanup?.()
  cleanup = null
})

describe('lists row menu dismissal', () => {
  it('closes on an outside pointerdown', async () => {
    let result = renderEditor()
    await openMenu(result, 'a')

    await result.act(() => pointerDown(document.body))

    assert.equal(menuOf(result.container, 'a'), null)
  })

  it('closes on Escape and focuses the row that owned the menu', async () => {
    let result = renderEditor()
    await openMenu(result, 'a')

    await result.act(() => pressEscape())
    await result.act(() => settle())

    assert.equal(menuOf(result.container, 'a'), null)
    assert.equal(
      document.activeElement?.getAttribute('data-item-id'),
      'a',
      'Escape must return focus to the row trigger',
    )
  })
})

describe('lists row menu actions', () => {
  it('returns focus to the moved row after choosing Nach unten', async () => {
    let result = renderEditor()
    await openMenu(result, 'a')

    await result.act(() => menuButton(result.container, 'a', 'Nach unten').click())
    await result.act(() => settle())

    assert.equal(menuOf(result.container, 'a'), null)
    assert.equal(
      document.activeElement?.getAttribute('data-item-id'),
      'a',
      'focus must follow the moved item',
    )

    // Let the fast autosave flush against the stub so no timer leaks into the
    // next test; focus must survive the server echo re-render.
    await settle(350)
    assert.equal(document.activeElement?.getAttribute('data-item-id'), 'a')
  })

  it('returns focus to the next row after deleting', async () => {
    let result = renderEditor()
    await openMenu(result, 'b')

    await result.act(() => menuButton(result.container, 'b', 'Löschen').click())
    await result.act(() => settle())

    assert.equal(menuOf(result.container, 'b'), null)
    assert.equal(
      document.activeElement?.getAttribute('data-item-id'),
      'c',
      'focus must move to the surviving neighbour',
    )

    // Clear the undo timer and let the fast autosave settle.
    let undo = [...result.container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Rückgängig'),
    )
    assert.ok(undo, 'the delete must offer undo')
    await result.act(() => undo.click())
    await settle(350)
  })
})

describe('lists row menu reordering guard', () => {
  it('hides move actions while an in-list filter is active', async () => {
    let result = renderEditor()
    let filter = result.container.querySelector<HTMLInputElement>('#lists-inner-filter')
    assert.ok(filter, 'the in-list filter must render')

    filter!.value = 'Alpha'
    await result.act(() => filter!.dispatchEvent(new Event('input', { bubbles: true })))
    await openMenu(result, 'a')

    let menu = menuOf(result.container, 'a')
    assert.ok(menu, 'the row menu must open for the filtered row')
    let labels = [...menu!.querySelectorAll('button')].map((button) => button.textContent?.trim())
    assert.equal(labels.includes('Nach oben'), false)
    assert.equal(labels.includes('Nach unten'), false)
  })
})

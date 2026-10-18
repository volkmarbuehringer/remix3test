import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'
import type { Handle, RemixNode } from 'remix/component'

import { ListsClient } from './lists-client.tsx'
import type { ListInitialState } from './lists-state.ts'

// Slice 2c: the editor shows a loading state while its frame reloads (list
// switch, sidebar-search submit). loadingList used to be dead — never set true —
// so a slow frame swap gave no feedback. The entry now flips it on the frame's
// reloadStart and reloadFromFrame clears it on reloadComplete.
//
// ListsClient is called directly with a synthetic handle whose frame is a plain
// EventTarget (same pattern as pending-submit.test.browser.tsx): the runtime
// FrameHandle is not publicly constructible, but reloadStart/reloadComplete are
// plain events on it.

const originalFetch = window.fetch
let dispose: (() => void) | null = null
let marker: HTMLElement | null = null
let removeCsrf: (() => void) | null = null

function installCsrf(token: string) {
  document.querySelectorAll('meta[name="csrf-token"]').forEach((meta) => meta.remove())
  let meta = document.createElement('meta')
  meta.name = 'csrf-token'
  meta.content = token
  document.head.appendChild(meta)
  removeCsrf = () => meta.remove()
}

function state(): ListInitialState {
  return {
    id: 7,
    title: 'Alt',
    description: 'D',
    items: [{ id: 'i1', label: 'A' }],
    updated_at: 111,
  }
}

interface Mounted {
  result: RenderResult
  frame: EventTarget
}

function mountWithFrame(initial: ListInitialState): Mounted {
  let frame = new EventTarget()
  let controller = new AbortController()
  let inner: (() => RemixNode) | null = null
  let resultRef: RenderResult | null = null

  let handle = {
    frame,
    props: { initialState: initial },
    signal: controller.signal,
    update: () => {
      if (resultRef && inner) resultRef.root.render(<div>{inner()}</div>)
    },
    // The picker focuses its search field via queueTask; the synthetic handle
    // must drain tasks or the subsequent search never starts.
    queueTask: (task: () => void) => {
      task()
    },
  } as unknown as Handle<{ initialState?: ListInitialState | null }>

  inner = ListsClient(handle) as unknown as () => RemixNode
  resultRef = render(<div>{inner()}</div>)
  dispose = () => {
    controller.abort()
    resultRef?.cleanup()
  }
  return { result: resultRef, frame }
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(text),
  ) as HTMLButtonElement | undefined
}

function itemIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-item-id]')].map(
    (el) => el.getAttribute('data-item-id') ?? '',
  )
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

beforeEach(() => {
  installCsrf('tok')
  window.fetch = (async () =>
    new Response(JSON.stringify(state()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof window.fetch
})

afterEach(() => {
  window.fetch = originalFetch
  removeCsrf?.()
  removeCsrf = null
  dispose?.()
  dispose = null
  marker?.remove()
  marker = null
})

function stateA(): ListInitialState {
  return {
    id: 7,
    title: 'A',
    description: 'A description',
    items: [
      { id: 'a1', label: 'A1' },
      { id: 'a2', label: 'A2' },
    ],
    updated_at: 111,
  }
}

function stateB(): ListInitialState {
  return {
    id: 9,
    title: 'B',
    description: 'B description',
    items: [{ id: 'b1', label: 'B1' }],
    updated_at: 222,
  }
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('ListsClient loading state', () => {
  it('shows a loading state between reloadStart and reloadComplete', () => {
    let mounted = mountWithFrame(state())
    let { container } = mounted.result

    assert.ok(container.querySelector('#lists-title'), 'the editor renders first')
    assert.equal(container.querySelector('[data-loading-list]'), null, 'no loading state at rest')

    mounted.frame.dispatchEvent(new Event('reloadStart'))
    assert.ok(container.querySelector('[data-loading-list]'), 'loading appears on reloadStart')
    assert.equal(
      container.querySelector('#lists-title'),
      null,
      'the editor gives way to the loading state',
    )

    // The frame's new document carries the server state marker; reloadComplete
    // re-hydrates from it, exactly as a real frame swap would.
    marker = document.createElement('div')
    marker.id = 'lists-initial-state'
    marker.setAttribute('data-state', JSON.stringify(state()))
    document.body.appendChild(marker)

    mounted.frame.dispatchEvent(new Event('reloadComplete'))
    assert.ok(container.querySelector('#lists-title'), 'the editor returns after reloadComplete')
    assert.equal(container.querySelector('[data-loading-list]'), null, 'loading is cleared')
  })

  it('drops the undo snapshot when a frame switch loads another list', async () => {
    let mounted = mountWithFrame(stateA())
    let { container } = mounted.result

    await mounted.result.act(() => {
      ;(container.querySelector('[data-item-menu-button="a1"]') as HTMLButtonElement).click()
    })
    let remove = buttonByText(
      container.querySelector('[data-item-menu="a1"]') as HTMLElement,
      'Löschen',
    )
    assert.ok(remove)
    await mounted.result.act(() => remove!.click())
    assert.deepEqual(itemIds(container), ['a2'])
    assert.ok(await waitFor(() => buttonByText(container, 'Rückgängig') !== undefined))

    mounted.frame.dispatchEvent(new Event('reloadStart'))
    marker = document.createElement('div')
    marker.id = 'lists-initial-state'
    marker.setAttribute('data-state', JSON.stringify(stateB()))
    document.body.appendChild(marker)
    await mounted.result.act(() => mounted.frame.dispatchEvent(new Event('reloadComplete')))

    assert.deepEqual(itemIds(container), ['b1'], 'the new list is loaded')
    assert.equal(
      buttonByText(container, 'Rückgängig'),
      undefined,
      'the previous list undo must not survive navigation',
    )

    await mounted.result.act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      )
    })
    assert.deepEqual(itemIds(container), ['b1'], 'Ctrl+Z must not restore the old list items')
  })

  it('ignores a move response once the frame has switched lists', async () => {
    let resolveMove: (() => void) | null = null
    window.fetch = (async (input: string | URL | Request) => {
      let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.startsWith('/lists/targets')) {
        return json({
          data: [{ id: 8, title: 'Ziel', description: '', count: 0, doneCount: 0, updated_at: 1 }],
          hasMore: false,
          offset: 0,
        })
      }
      if (url === '/lists/7/move-items') {
        return new Promise<Response>((resolve) => {
          resolveMove = () =>
            resolve(
              json({
                source: {
                  id: 7,
                  title: 'A',
                  description: '',
                  items: [{ id: 'a2', label: 'A2' }],
                  updated_at: 333,
                },
                target: {
                  id: 8,
                  title: 'Ziel',
                  description: '',
                  items: [{ id: 'a1', label: 'A1' }],
                  updated_at: 333,
                },
                moved: 1,
              }),
            )
        })
      }
      return json(stateA())
    }) as typeof window.fetch

    let mounted = mountWithFrame(stateA())
    let { container } = mounted.result

    await mounted.result.act(() =>
      (container.querySelector('[data-select-item="a1"]') as HTMLInputElement).click(),
    )
    let move = buttonByText(container, 'In Liste verschieben')
    assert.ok(move, 'the bulk move action must render after selecting an item')
    await mounted.result.act(() => move!.click())
    assert.ok(
      await waitFor(() => container.querySelector('[data-target-option="8"]') !== null),
      'the target picker must list the target',
    )
    await mounted.result.act(() =>
      (container.querySelector('[data-target-option="8"]') as HTMLElement).click(),
    )
    assert.ok(await waitFor(() => resolveMove !== null), 'the move request should start')

    mounted.frame.dispatchEvent(new Event('reloadStart'))
    marker = document.createElement('div')
    marker.id = 'lists-initial-state'
    marker.setAttribute('data-state', JSON.stringify(stateB()))
    document.body.appendChild(marker)
    await mounted.result.act(() => mounted.frame.dispatchEvent(new Event('reloadComplete')))
    assert.deepEqual(itemIds(container), ['b1'])

    await mounted.result.act(() => (resolveMove as () => void)())
    await settle(50)
    assert.deepEqual(itemIds(container), ['b1'], 'the stale source response must not replace B')
    assert.ok(
      container.textContent?.includes('Die Liste wurde gewechselt'),
      'the stale action should be surfaced as cancelled',
    )
  })
})

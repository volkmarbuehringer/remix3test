import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'
import type { Handle, RemixNode } from 'remix/component'

import { AppointTypePanel } from './appointtype-panel.browser.tsx'
import { getTypeDragState, setTypeDragState } from '../utils/appointtype-drag.ts'

// ---------------------------------------------------------------------------
// AppointTypePanel — the schedule page's type list (add / rename / drag arm).
//
// Self-contained client entry: it renders its own DOM and reads the type list
// from the server-embedded #appointtype-data JSON on every render. The tests
// stub window.fetch (POST/PUT contracts) and drive the real state machine:
// click row → focused inline rename input, Enter/blur → commit, Escape →
// cancel; "+ Typ hinzufügen" → focused add row, empty title → silently
// cancelled; pointerdown/up → the shared drag store the calendar grid reads.
//
// The entry is mounted by calling its factory with a synthetic handle whose
// frame.reload() is a spy: the render()-harness root frame stub throws
// `reload not implemented` (only real DOM frame runtimes wire reload →
// resolveFrame), so handle.frame?.reload() would throw into the fetch chain
// instead of proving the success/failure branches. The re-render is routed to
// the test root exactly as the runtime would. Context-menu selection is
// covered by admin-context-menus.test.browser.tsx, the server routes by their
// tests.
// ---------------------------------------------------------------------------

const DATA = {
  types: [
    { id: 1, title: 'Beratung' },
    { id: 2, title: 'Workshop' },
  ],
  csrfToken: 'csrf-panel',
  appointmentTypesHref: '/admin/appointment-types',
}

interface FetchCall {
  url: string
  method: string
  headers: Record<string, string>
  body: string | undefined
}

const originalFetch = window.fetch

let fixture: HTMLElement | null = null
let result: RenderResult | null = null
let controller: AbortController | null = null
let calls: FetchCall[] = []
let reloads = 0

function mountData(): void {
  let host = document.createElement('div')
  host.innerHTML = `<script type="application/json" id="appointtype-data">${JSON.stringify(
    DATA,
  )}</script>`
  document.body.appendChild(host)
  fixture = host
}

function stubFetch(status = 200): void {
  calls = []
  reloads = 0
  window.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? String(init.body) : undefined,
    })
    return new Response('{}', { status })
  }) as typeof window.fetch
}

async function mountPanel(): Promise<RenderResult> {
  controller = new AbortController()
  let renderFn: (() => RemixNode) | null = null
  let handle = {
    props: { csrfToken: DATA.csrfToken },
    signal: controller.signal,
    frame: {
      reload: async () => {
        reloads++
      },
    },
    // The runtime re-invokes the render function through the handle; mirror
    // that onto the test root.
    update: () => {
      if (result && renderFn) result.root.render(<div>{renderFn()}</div>)
    },
  } as unknown as Handle<{ csrfToken: string }>

  renderFn = AppointTypePanel(handle) as unknown as () => RemixNode
  result = render(<div>{renderFn()}</div>)
  await result.act(() => undefined)
  return result
}

function panel(): HTMLElement {
  let node = result?.container.querySelector('[data-types-panel]')
  assert.ok(node, 'the panel must render')
  return node as HTMLElement
}

function typeRow(id: 1 | 2): HTMLElement {
  let row = panel().querySelector(`[data-type-id="${id}"]`)
  assert.ok(row, `type row ${id} must exist`)
  return row as HTMLElement
}

function addButton(): HTMLElement {
  let btn = [...panel().querySelectorAll('button')].find((b) =>
    b.textContent?.includes('Typ hinzufügen'),
  )
  assert.ok(btn, 'the add button must exist')
  return btn
}

function renameInput(label: string): HTMLInputElement | null {
  return panel().querySelector(`input[aria-label="${label}"]`)
}

function key(input: HTMLInputElement, keyName: string): void {
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true }),
  )
}

async function settle(ms = 80): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

afterEach(() => {
  window.fetch = originalFetch
  controller?.abort()
  controller = null
  result?.cleanup()
  result = null
  fixture?.remove()
  fixture = null
  setTypeDragState(null)
})

describe('AppointTypePanel', () => {
  it('renders the server types as rows', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    assert.equal(typeRow(1).textContent?.trim(), 'Beratung')
    assert.equal(typeRow(2).textContent?.trim(), 'Workshop')
    assert.equal(renameInput('Typnamen bearbeiten'), null, 'rows start as labels')
  })

  it('clicking a row opens an inline rename input, focused and selected', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    await result!.act(() => typeRow(1).click())

    let input = renameInput('Typnamen bearbeiten')
    assert.ok(input, 'rename input appears')
    assert.equal(input!.value, 'Beratung', 'prefilled with the current title')
    assert.equal(document.activeElement, input, 'the entry focuses it for immediate typing')
  })

  it('Enter commits a renamed title via PUT with the csrf header', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    await result!.act(() => typeRow(1).click())
    let input = renameInput('Typnamen bearbeiten') as HTMLInputElement
    input.value = 'Termine'

    await result!.act(() => key(input, 'Enter'))
    assert.equal(renameInput('Typnamen bearbeiten'), null, 'editing closed on commit')

    await settle() // the fetch + frame reload are async
    assert.deepEqual(
      calls.map((c) => [c.method, c.url]),
      [['PUT', '/admin/appointment-types/1']],
    )
    assert.equal(calls[0]!.body, JSON.stringify({ title: 'Termine' }))
    assert.equal(calls[0]!.headers['X-Csrf-Token'], 'csrf-panel')
  })

  it('committing an unchanged title saves nothing', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    await result!.act(() => typeRow(2).click())
    let input = renameInput('Typnamen bearbeiten') as HTMLInputElement
    await result!.act(() => key(input, 'Enter'))

    assert.deepEqual(calls, [])
    assert.equal(typeRow(2).textContent?.trim(), 'Workshop')
  })

  it('Escape cancels the rename without a request', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    await result!.act(() => typeRow(1).click())
    let input = renameInput('Typnamen bearbeiten') as HTMLInputElement
    input.value = 'sollte verworfen werden'
    await result!.act(() => key(input, 'Escape'))

    assert.deepEqual(calls, [])
    assert.equal(typeRow(1).textContent?.trim(), 'Beratung', 'old label restored')
  })

  it('blur commits the rename (Enter not required)', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    await result!.act(() => typeRow(1).click())
    let input = renameInput('Typnamen bearbeiten') as HTMLInputElement
    input.value = 'Blur gespeichert'
    await result!.act(() => input.blur())

    await settle()
    assert.equal(calls.length, 1)
    assert.equal(calls[0]!.method, 'PUT')
  })

  it('the add button opens a focused add input; Enter POSTs the new type', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    await result!.act(() => addButton().click())
    let input = renameInput('Neuer Typname')
    assert.ok(input, 'add row appears')
    assert.equal(document.activeElement, input)

    input!.value = '  Notfall  '
    await result!.act(() => key(input!, 'Enter'))
    assert.equal(renameInput('Neuer Typname'), null, 'add row closed after commit')

    await settle()
    assert.deepEqual(
      calls.map((c) => [c.method, c.url]),
      [['POST', '/admin/appointment-types']],
    )
    assert.equal(calls[0]!.body, JSON.stringify({ title: 'Notfall' }), 'title is trimmed')
  })

  it('an empty add is cancelled silently', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    await result!.act(() => addButton().click())
    let input = renameInput('Neuer Typname') as HTMLInputElement
    await result!.act(() => key(input, 'Enter'))

    assert.deepEqual(calls, [], 'nothing to add, nothing sent')
    assert.equal(renameInput('Neuer Typname'), null, 'the empty add row closes itself')
  })

  it('Escape closes the add row', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    await result!.act(() => addButton().click())
    await result!.act(() => key(renameInput('Neuer Typname') as HTMLInputElement, 'Escape'))

    assert.equal(renameInput('Neuer Typname'), null)
    assert.ok(addButton(), 'the add button is back')
  })

  it('a successful save reloads the frame exactly once', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    await result!.act(() => typeRow(1).click())
    let input = renameInput('Typnamen bearbeiten') as HTMLInputElement
    input.value = 'Frisch'
    await result!.act(() => key(input, 'Enter'))

    await settle()
    assert.equal(reloads, 1, 'the panel asks its frame to reload after the write')
  })

  it('a failing save does not reload the frame', async () => {
    mountData()
    stubFetch(500)
    await mountPanel()

    await result!.act(() => typeRow(1).click())
    let input = renameInput('Typnamen bearbeiten') as HTMLInputElement
    input.value = 'Kaputt'
    await result!.act(() => key(input, 'Enter'))

    await settle()
    assert.equal(reloads, 0)
  })

  it('pointerdown arms the shared drag store, pointerup clears it', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    typeRow(2).dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }))
    assert.deepEqual(getTypeDragState(), { active: true, typeId: 2, title: 'Workshop' })

    typeRow(2).dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true }))
    assert.equal(getTypeDragState(), null, 'the panel clears the arm if the grid never consumed it')
  })

  it('right-click pointerdown does not arm a drag', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    typeRow(1).dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true }))
    assert.equal(getTypeDragState(), null)
  })

  it('drag arming is blocked while adding a type', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    await result!.act(() => addButton().click())
    typeRow(1).dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }))

    assert.equal(getTypeDragState(), null, 'no drag while the add row is open')
  })

  it('one editor at a time: a row click while adding does not open rename', async () => {
    mountData()
    stubFetch()
    await mountPanel()

    await result!.act(() => addButton().click())
    await result!.act(() => typeRow(1).click())

    assert.equal(renameInput('Typnamen bearbeiten'), null, 'rename blocked during add')
    assert.ok(renameInput('Neuer Typname'), 'the add row stays open')
  })
})

import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListNameEdit } from './list-name-edit.tsx'

// ListNameEdit turns a sidebar row into an inline rename field: clicking the
// rename button injects an input, Escape cancels, Enter/blur PUT the new title
// with CSRF + If-Match, and a 409 flashes the name. fetch is stubbed; the frame
// reload on success is left to the e2e suite (the root frame in a component
// test cannot resolve a navigation).

const ROW_HTML = `
  <div data-list-id="7" data-updated-at="111">
    <span data-list-name>Alt</span>
    <button type="button" data-list-rename-btn>Umbenennen</button>
  </div>
`

const originalFetch = window.fetch
let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null
let calls: Array<{ url: string; init: RequestInit }> = []
let removeCsrf: (() => void) | null = null

function mount(html = ROW_HTML): HTMLElement {
  let host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  fixture = host
  return host
}

function rowOf(host: HTMLElement): HTMLElement {
  return host.querySelector('[data-list-id]') as HTMLElement
}
function nameSpanOf(host: HTMLElement): HTMLElement {
  return rowOf(host).querySelector('[data-list-name]') as HTMLElement
}
function inputOf(host: HTMLElement): HTMLInputElement | null {
  return rowOf(host).querySelector('input')
}

function mountEntry() {
  cleanup = render(<ListNameEdit />).cleanup
}

function clickRename(host: HTMLElement) {
  rowOf(host)
    .querySelector('[data-list-rename-btn]')
    ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

function press(input: HTMLInputElement, key: string) {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

function stubFetch(status: number) {
  window.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(null, { status })
  }) as typeof window.fetch
}

function installCsrf(token: string) {
  document.querySelectorAll('meta[name="csrf-token"]').forEach((meta) => meta.remove())
  let meta = document.createElement('meta')
  meta.name = 'csrf-token'
  meta.content = token
  document.head.appendChild(meta)
  removeCsrf = () => meta.remove()
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  calls = []
  installCsrf('tok123')
})

afterEach(() => {
  window.fetch = originalFetch
  removeCsrf?.()
  removeCsrf = null
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('ListNameEdit', () => {
  it('injects a focused, selected input when the rename button is clicked', () => {
    let host = mount()
    mountEntry()

    clickRename(host)

    let input = inputOf(host)
    assert.ok(input, 'an input should replace the name span')
    assert.equal(input!.value, 'Alt')
    assert.equal(nameSpanOf(host).style.display, 'none')
    assert.equal(document.activeElement, input)
    assert.equal(input!.selectionStart, 0)
    assert.equal(input!.selectionEnd, 3)
  })

  it('does not open a second input while one is already editing', () => {
    let host = mount()
    mountEntry()

    clickRename(host)
    clickRename(host)

    assert.equal(rowOf(host).querySelectorAll('input').length, 1)
  })

  it('cancels on Escape without a request', () => {
    let host = mount()
    mountEntry()
    clickRename(host)

    press(inputOf(host)!, 'Escape')

    assert.equal(inputOf(host), null)
    assert.equal(nameSpanOf(host).style.display, '')
    assert.equal(calls.length, 0)
  })

  it('cancels on Enter when the value is unchanged', () => {
    let host = mount()
    mountEntry()
    clickRename(host)

    press(inputOf(host)!, 'Enter')

    assert.equal(inputOf(host), null)
    assert.equal(calls.length, 0)
  })

  it('PUTs a changed title exactly once with CSRF + If-Match', async () => {
    let host = mount()
    mountEntry()
    stubFetch(200)
    clickRename(host)

    let input = inputOf(host)!
    input.value = 'Neu'
    press(input, 'Enter')
    await flush()

    assert.equal(calls.length, 1, 'removing the input must not re-submit')
    assert.equal(calls[0]!.url, '/lists/7')
    assert.equal(calls[0]!.init.method, 'PUT')
    let headers = calls[0]!.init.headers as Record<string, string>
    assert.equal(headers['Content-Type'], 'application/json')
    assert.equal(headers['X-Csrf-Token'], 'tok123')
    assert.equal(headers['If-Match'], '111')
    assert.equal(calls[0]!.init.body, JSON.stringify({ title: 'Neu' }))

    assert.equal(inputOf(host), null, 'the editor closes after a successful save')
    assert.equal(nameSpanOf(host).style.display, '')
  })

  it('submits a changed title on blur', async () => {
    let host = mount()
    mountEntry()
    stubFetch(200)
    clickRename(host)

    let input = inputOf(host)!
    input.value = 'Per Blur'
    input.dispatchEvent(new Event('blur'))
    await flush()

    assert.equal(calls.length, 1)
    assert.equal(calls[0]!.init.body, JSON.stringify({ title: 'Per Blur' }))
  })

  it('flashes the name on a 409 conflict and closes the editor', async () => {
    let host = mount()
    mountEntry()
    stubFetch(409)
    clickRename(host)

    let input = inputOf(host)!
    input.value = 'Konflikt'
    press(input, 'Enter')
    await flush()

    assert.ok(nameSpanOf(host).style.color, 'the conflicted name should be flashed')
    assert.equal(inputOf(host), null)
  })
})

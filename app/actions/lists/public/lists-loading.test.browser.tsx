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
  } as unknown as Handle<{ initialState?: ListInitialState | null }>

  inner = ListsClient(handle) as unknown as () => RemixNode
  resultRef = render(<div>{inner()}</div>)
  dispose = () => {
    controller.abort()
    resultRef?.cleanup()
  }
  return { result: resultRef, frame }
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
})

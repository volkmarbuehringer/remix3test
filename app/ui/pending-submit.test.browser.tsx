import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'
import type { Handle, RemixNode } from 'remix/component'

import { PendingSubmitButton } from './pending-submit.browser.tsx'

// ---------------------------------------------------------------------------
// PendingSubmitButton — pending feedback on frame reloads.
//
// The entry swaps its label and disables itself between the containing frame's
// `reloadStart` and `reloadComplete` events — an event vocabulary on the
// runtime FrameHandle that is not publicly constructible, and whose real
// trigger (a native submit intercepted by the frame runtime) is covered by the
// uploads e2e. What is testable in isolation is the entry's state machine:
// call the component factory with a synthetic handle whose `frame` is a plain
// EventTarget, dispatch the two events, and assert the button's DOM (disabled
// + label) in a real browser. The re-render is wired to the test root, so the
// assertions observe exactly what production's handle.update() path produces.
// ---------------------------------------------------------------------------

interface Mounted {
  result: RenderResult
  frame: EventTarget
  dispose: () => void
}

function mount(props: { children: string; pendingLabel?: string }): Mounted {
  let frame = new EventTarget()
  let controller = new AbortController()
  let inner: (() => RemixNode) | null = null
  let resultRef: RenderResult | null = null

  let handle = {
    frame,
    props,
    signal: controller.signal,
    // Production re-runs the render function through the runtime; here the
    // same function re-renders into the test root.
    update: () => {
      if (resultRef && inner) resultRef.root.render(<div>{inner()}</div>)
    },
  } as unknown as Handle<{ children: string; pendingLabel?: string }>

  inner = PendingSubmitButton(handle) as unknown as () => RemixNode
  resultRef = render(<div>{inner()}</div>)

  return {
    result: resultRef,
    frame,
    dispose: () => {
      controller.abort()
      resultRef?.cleanup()
    },
  }
}

function submitButton(result: RenderResult): HTMLButtonElement {
  let btn = result.container.querySelector('button[type="submit"]')
  assert.ok(btn instanceof HTMLButtonElement, 'the entry must render a submit button')
  return btn
}

let mounted: Mounted | null = null

function mountEntry(props: { children: string; pendingLabel?: string }): RenderResult {
  mounted = mount(props)
  return mounted.result
}

afterEach(() => {
  mounted?.dispose()
  mounted = null
})

describe('PendingSubmitButton', () => {
  it('renders the resting label enabled', () => {
    let result = mountEntry({ children: 'Speichern' })
    let btn = submitButton(result)

    assert.equal(btn.disabled, false)
    assert.equal(btn.textContent?.trim(), 'Speichern')
  })

  it('disables and appends the pending marker on reloadStart', () => {
    let result = mountEntry({ children: 'Speichern' })
    let btn = submitButton(result)
    assert.equal(btn.disabled, false, 'sanity: enabled before reload')

    mounted!.frame.dispatchEvent(new Event('reloadStart'))

    assert.equal(btn.disabled, true, 'submit must be disabled while the frame reloads')
    assert.equal(btn.textContent?.trim(), 'Speichern…', 'default pending label is children + …')
  })

  it('restores the resting state on reloadComplete', () => {
    let result = mountEntry({ children: 'Speichern' })
    let btn = submitButton(result)

    mounted!.frame.dispatchEvent(new Event('reloadStart'))
    assert.equal(btn.disabled, true)

    mounted!.frame.dispatchEvent(new Event('reloadComplete'))

    assert.equal(btn.disabled, false, 're-enabled once the frame is back')
    assert.equal(btn.textContent?.trim(), 'Speichern', 'label returns to the resting text')
  })

  it('uses the explicit pendingLabel when provided', () => {
    let result = mountEntry({ children: 'Löschen', pendingLabel: 'Wird gelöscht…' })
    let btn = submitButton(result)

    mounted!.frame.dispatchEvent(new Event('reloadStart'))

    assert.equal(btn.textContent?.trim(), 'Wird gelöscht…')
  })

  it('survives a duplicated reloadStart (idempotent pending)', () => {
    let result = mountEntry({ children: 'Senden' })
    let btn = submitButton(result)

    mounted!.frame.dispatchEvent(new Event('reloadStart'))
    mounted!.frame.dispatchEvent(new Event('reloadStart'))

    assert.equal(btn.disabled, true)
    assert.equal(btn.textContent?.trim(), 'Senden…')

    mounted!.frame.dispatchEvent(new Event('reloadComplete'))
    assert.equal(btn.disabled, false)
  })
})

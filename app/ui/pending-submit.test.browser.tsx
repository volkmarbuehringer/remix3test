import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'
import type { Handle, RemixNode } from 'remix/component'

import { PendingSubmitButton } from './pending-submit.browser.tsx'
import type { GlyphName } from './theme/glyph/glyph.tsx'

type PendingProps = {
  children: string
  pendingLabel?: string
  icon?: GlyphName
  stretch?: boolean
}

// ---------------------------------------------------------------------------
// PendingSubmitButton — pending feedback for its own form submission.
//
// The entry listens for `rmx:submission` on its button, so the test dispatches
// that event on the rendered button with a controllable `finished` promise.
// Unlike a frame-level `reloadStart`/`reloadComplete` pair, this must ignore
// unrelated frame reloads and a superseded submission must not clear a newer
// submission's pending state (#12183).
// ---------------------------------------------------------------------------

interface Mounted {
  result: RenderResult
  frame: EventTarget
  dispose: () => void
}

function mount(props: PendingProps): Mounted {
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
  } as unknown as Handle<PendingProps>

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

function pendingSubmission() {
  let resolve!: (signal: AbortSignal) => void
  let reject!: (error: unknown) => void
  let promise = new Promise<AbortSignal>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function dispatchSubmission(button: HTMLButtonElement, finished: Promise<AbortSignal>): void {
  button.dispatchEvent(Object.assign(new Event('rmx:submission', { bubbles: true }), { finished }))
}

async function flush(): Promise<void> {
  await Promise.resolve()
}

let mounted: Mounted | null = null

function mountEntry(props: PendingProps): RenderResult {
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

  it('disables and shows the pending label during its submission', () => {
    let result = mountEntry({ children: 'Speichern' })
    let btn = submitButton(result)
    assert.equal(btn.disabled, false, 'sanity: enabled before submission')

    dispatchSubmission(btn, pendingSubmission().promise)

    assert.equal(btn.disabled, true, 'submit must be disabled while the request is pending')
    assert.equal(btn.textContent?.trim(), 'Speichern…', 'default pending label is children + …')
  })

  it('restores the resting state when the submission finishes', async () => {
    let result = mountEntry({ children: 'Speichern' })
    let btn = submitButton(result)
    let submission = pendingSubmission()

    dispatchSubmission(btn, submission.promise)
    assert.equal(btn.disabled, true)

    submission.resolve(new AbortController().signal)
    await flush()

    assert.equal(btn.disabled, false, 're-enabled once the submission settles')
    assert.equal(btn.textContent?.trim(), 'Speichern', 'label returns to the resting text')
  })

  it('clears pending state when the submission fails', async () => {
    let result = mountEntry({ children: 'Speichern' })
    let btn = submitButton(result)
    let submission = pendingSubmission()

    dispatchSubmission(btn, submission.promise)
    submission.reject(new Error('save failed'))
    await flush()

    assert.equal(btn.disabled, false, 'a failed submission must not leave the button stuck')
    assert.equal(btn.textContent?.trim(), 'Speichern')
  })

  it('uses the explicit pendingLabel when provided', () => {
    let result = mountEntry({ children: 'Löschen', pendingLabel: 'Wird gelöscht…' })
    let btn = submitButton(result)

    dispatchSubmission(btn, pendingSubmission().promise)

    assert.equal(btn.textContent?.trim(), 'Wird gelöscht…')
  })

  it('can render an optional icon and keep its natural width', () => {
    let result = mountEntry({ children: 'Senden', icon: 'send', stretch: false })
    let btn = submitButton(result)

    assert.ok(btn.querySelector('svg'), 'the optional glyph should render before the label')
    assert.equal(btn.textContent?.trim(), 'Senden')
  })

  it('keeps pending state when a newer submission supersedes the first', async () => {
    let result = mountEntry({ children: 'Senden' })
    let btn = submitButton(result)
    let first = pendingSubmission()
    let second = pendingSubmission()

    dispatchSubmission(btn, first.promise)
    dispatchSubmission(btn, second.promise)

    let aborted = new AbortController()
    aborted.abort()
    first.resolve(aborted.signal)
    await flush()
    assert.equal(btn.disabled, true, 'the superseded submission must not clear the newer one')

    second.resolve(new AbortController().signal)
    await flush()
    assert.equal(btn.disabled, false)
    assert.equal(btn.textContent?.trim(), 'Senden')
  })

  it('ignores unrelated frame reloads', () => {
    let result = mountEntry({ children: 'Senden' })
    let btn = submitButton(result)

    mounted!.frame.dispatchEvent(new Event('reloadStart'))
    mounted!.frame.dispatchEvent(new Event('reloadComplete'))

    assert.equal(btn.disabled, false, 'only this button’s own submission may disable it')
    assert.equal(btn.textContent?.trim(), 'Senden')
  })
})

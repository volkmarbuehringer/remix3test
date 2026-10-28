import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'
import type { Handle, RemixNode } from 'remix/component'

import { FilterAutoSubmit } from './filter-autosubmit.browser.tsx'

// ---------------------------------------------------------------------------
// FilterAutoSubmit — debounced live search inside a frame-owned GET form.
//
// The entry only needs `handle.frame` (an EventTarget), `handle.signal` and a
// `queueTask` that runs after render, so the test mounts it with a synthetic
// handle and a real fixture form. The real DOM swap lives in the e2e suite; here
// we cover the state machine: debounce coalescing, unchanged-value no-ops,
// Escape-to-clear, and focus restoration after `reloadComplete`.
// ---------------------------------------------------------------------------

const FORM_SELECTOR = 'form[data-messages-filter]'

const FIXTURE_HTML = `
  <form data-messages-filter action="/admin/messages" method="GET">
    <input type="search" name="filter" value="" />
    <button type="submit">Suchen</button>
  </form>
`

interface Mounted {
  result: RenderResult
  frame: EventTarget
  form: HTMLFormElement
  input: HTMLInputElement
  submits: () => number
  dispose: () => void
}

let mounted: Mounted | null = null

function mount(): Mounted {
  let host = document.createElement('div')
  host.innerHTML = FIXTURE_HTML
  document.body.appendChild(host)

  let form = host.querySelector(FORM_SELECTOR) as HTMLFormElement
  let input = form.querySelector('input[name="filter"]') as HTMLInputElement
  let count = 0
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    count++
  })

  let frame = new EventTarget()
  let controller = new AbortController()
  let handle = {
    frame,
    props: { formSelector: FORM_SELECTOR },
    signal: controller.signal,
    queueTask: (task: () => void) => task(),
  } as unknown as Handle<{ formSelector: string }>

  let inner = FilterAutoSubmit(handle) as unknown as () => RemixNode
  let result = render(<div>{inner()}</div>)

  mounted = {
    result,
    frame,
    form,
    input,
    submits: () => count,
    dispose: () => {
      controller.abort()
      result.cleanup()
      host.remove()
    },
  }
  return mounted
}

function type(value: string): void {
  mounted!.input.value = value
  mounted!.input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function waitForDebounce(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 450))
}

afterEach(() => {
  mounted?.dispose()
  mounted = null
})

describe('FilterAutoSubmit', () => {
  it('coalesces rapid typing into one submit', async () => {
    mount()

    type('a')
    type('al')
    type('alpha')
    await waitForDebounce()

    assert.equal(mounted!.submits(), 1, 'one debounced submit for the whole burst')
  })

  it('does not resubmit an unchanged value', async () => {
    mount()

    type('alpha')
    await waitForDebounce()
    assert.equal(mounted!.submits(), 1)

    type('alpha')
    await waitForDebounce()
    assert.equal(mounted!.submits(), 1, 'the same filter must not loop the frame')
  })

  it('Escape clears the field and submits immediately', () => {
    mount()

    type('alpha')
    mounted!.input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )

    assert.equal(mounted!.input.value, '')
    assert.equal(mounted!.submits(), 1, 'Escape bypasses the debounce')
  })

  it('restores focus and the caret after reloadComplete when it submitted', async () => {
    mount()

    mounted!.input.focus()
    mounted!.input.setSelectionRange(0, 0)
    type('alpha')
    await waitForDebounce()
    assert.equal(mounted!.submits(), 1)

    mounted!.frame.dispatchEvent(new Event('reloadComplete'))

    assert.equal(
      document.activeElement,
      mounted!.input,
      'the replaced search field should receive focus again',
    )
    assert.equal(mounted!.input.selectionStart, mounted!.input.value.length)
  })
})

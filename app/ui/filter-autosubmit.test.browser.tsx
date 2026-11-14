import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'
import type { Handle, RemixNode } from 'remix/component'

import { FilterAutoSubmit } from './filter-autosubmit.browser.tsx'

// ---------------------------------------------------------------------------
// FilterAutoSubmit — debounced live search inside a frame-owned GET form.
//
// The entry only needs `handle.frame` (an EventTarget), `handle.signal` and a
// `queueTask` that runs after render, so the test
// mounts it with a synthetic handle and a real fixture form. The real DOM swap
// lives in the e2e suite; here we cover the state machine: debounce coalescing,
// unchanged-value no-ops, Escape-to-clear, focus restoration after
// `reloadComplete`, and text typed while the replacement input is in flight.
// ---------------------------------------------------------------------------

const FORM_SELECTOR = 'form[data-messages-filter]'

/** Mirrors `filter-autosubmit.browser.tsx`'s debounce window. */
const SEARCH_DEBOUNCE_MS = 350

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

function mount(initialValue = ''): Mounted {
  let host = document.createElement('div')
  host.innerHTML = FIXTURE_HTML
  document.body.appendChild(host)

  let form = host.querySelector(FORM_SELECTOR) as HTMLFormElement
  let input = form.querySelector('input[name="filter"]') as HTMLInputElement
  input.value = initialValue
  let count = 0
  let frame = new EventTarget()
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    count++
  })

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

/**
 * Simulate the frame swap: the server-rendered input replaces the live one and
 * carries the filter that was actually submitted.
 */
function replaceInputWithServerValue(value: string): void {
  let next = document.createElement('input')
  next.type = 'search'
  next.setAttribute('name', 'filter')
  next.value = value
  mounted!.input.replaceWith(next)
  mounted!.input = next
}

/** Simulate the frame runtime's event for a submission of the fixture form. */
function dispatchFormSubmission(): void {
  mounted!.form.dispatchEvent(
    Object.assign(new Event('rmx:submission', { bubbles: true }), { form: mounted!.form }),
  )
}

afterEach(() => {
  mounted?.dispose()
  mounted = null
})

describe('FilterAutoSubmit', () => {
  it('coalesces rapid typing into one submit', (t) => {
    let timers = t.useFakeTimers()
    mount()

    type('a')
    type('al')
    type('alpha')
    timers.advance(SEARCH_DEBOUNCE_MS - 1)
    assert.equal(mounted!.submits(), 0, 'the submit waits for the full debounce')
    timers.advance(1)

    assert.equal(mounted!.submits(), 1, 'one debounced submit for the whole burst')
  })

  it('does not resubmit an unchanged value', (t) => {
    let timers = t.useFakeTimers()
    mount()

    type('alpha')
    timers.advance(SEARCH_DEBOUNCE_MS)
    assert.equal(mounted!.submits(), 1)

    type('alpha')
    timers.advance(SEARCH_DEBOUNCE_MS)
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

  it('restores focus and the caret after reloadComplete when it submitted', (t) => {
    let timers = t.useFakeTimers()
    mount()

    mounted!.input.focus()
    mounted!.input.setSelectionRange(0, 0)
    type('alpha')
    timers.advance(SEARCH_DEBOUNCE_MS)
    assert.equal(mounted!.submits(), 1)

    mounted!.frame.dispatchEvent(new Event('reloadComplete'))

    assert.equal(
      document.activeElement,
      mounted!.input,
      'the replaced search field should receive focus again',
    )
    assert.equal(mounted!.input.selectionStart, mounted!.input.value.length)
  })

  it('restores focus after an explicit submit intercepted by the frame runtime', () => {
    mount()
    mounted!.input.focus()
    mounted!.input.value = 'alpha'

    // Enter or the Suchen button: the native submit runs, then the runtime
    // announces the intercepted submission before fetching the frame.
    mounted!.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    dispatchFormSubmission()
    replaceInputWithServerValue('alpha')
    mounted!.frame.dispatchEvent(new Event('reloadComplete'))

    assert.equal(
      document.activeElement,
      mounted!.input,
      'an explicit submission should restore focus like a debounced one',
    )
  })

  it('keeps text typed during a programmatic reload and restores focus', (t) => {
    let timers = t.useFakeTimers()
    mount('alpha')
    mounted!.input.focus()

    // `frame.reload()` has no initiating link or form, so it keeps the
    // field-focused behavior even though `rmx:submission` never fires.
    type('alphabeta')
    mounted!.frame.dispatchEvent(new Event('reloadStart'))
    replaceInputWithServerValue('alpha')
    mounted!.frame.dispatchEvent(new Event('reloadComplete'))

    assert.equal(mounted!.input.value, 'alphabeta', 'unsent text survives the refresh')
    assert.equal(
      document.activeElement,
      mounted!.input,
      'a background refresh must not drop the caret',
    )
    timers.advance(SEARCH_DEBOUNCE_MS)
    assert.equal(mounted!.submits(), 1, 'the restored text is submitted again')
  })

  it('does not steal focus after a link-origin reload', (t) => {
    let timers = t.useFakeTimers()
    mount('alpha')
    mounted!.input.focus()

    type('alphabeta')
    mounted!.frame.dispatchEvent(
      Object.assign(new Event('reloadStart'), { element: document.createElement('a') }),
    )
    replaceInputWithServerValue('beta')
    mounted!.frame.dispatchEvent(new Event('reloadComplete'))

    assert.equal(mounted!.input.value, 'beta', 'the link navigation wins over unsent text')
    assert.notEqual(
      document.activeElement,
      mounted!.input,
      'an unrelated link navigation must not pull focus into the filter',
    )
    timers.advance(SEARCH_DEBOUNCE_MS)
    assert.equal(mounted!.submits(), 0, 'discarded text must not be submitted')
  })

  it('keeps text typed while the reload is in flight and submits it after the swap', (t) => {
    let timers = t.useFakeTimers()
    mount()
    mounted!.input.focus()

    type('alpha')
    timers.advance(SEARCH_DEBOUNCE_MS)
    assert.equal(mounted!.submits(), 1)

    // The user keeps typing while the first request is still being applied;
    // the server then swaps in the input it rendered for "alpha".
    type('alphabeta')
    replaceInputWithServerValue('alpha')
    mounted!.frame.dispatchEvent(new Event('reloadComplete'))

    assert.equal(
      mounted!.input.value,
      'alphabeta',
      'keystrokes typed during the reload must survive the swap',
    )
    assert.equal(
      document.activeElement,
      mounted!.input,
      'focus should return to the restored field',
    )

    timers.advance(SEARCH_DEBOUNCE_MS)
    assert.equal(mounted!.submits(), 2, 'the restored value must be searched again')
  })

  it('lets an external filter change win over text typed before the reload', (t) => {
    let timers = t.useFakeTimers()
    mount('alpha')

    type('alphabet')
    // The user clicks "Zurücksetzen": the server swaps in an empty field.
    replaceInputWithServerValue('')
    mounted!.frame.dispatchEvent(new Event('reloadComplete'))

    assert.equal(mounted!.input.value, '', 'the reset navigation should win')
    timers.advance(SEARCH_DEBOUNCE_MS)
    assert.equal(mounted!.submits(), 0, 'discarded text must not be submitted')
  })
})

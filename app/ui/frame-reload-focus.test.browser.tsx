import * as assert from 'remix/assert'
import { clientEntry, run, type AppRuntime } from 'remix/component'
import { renderToStream } from 'remix/component/server'
import { afterEach, describe, it } from 'remix/test'

// Regression guard for remix #12461 (pin `56522c2e`): a frame reload that
// reorders surviving client entries must move the live DOM nodes without
// dropping focus/selection. The lists grid + editor frame swap and the admin
// grids reload in place, so a keyboard user's cursor must survive a reorder.
// On the previous pin the placement path moved nodes through a
// `DocumentFragment`, which blurs the focused input and resets its selection.

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(stream).text()
}

let runtime: AppRuntime | null = null

afterEach(() => {
  runtime?.dispose()
  runtime = null
  document.body.replaceChildren()
  for (let node of document.head.querySelectorAll(
    'style[data-rmx-style], script[data-rmx-import-map]',
  )) {
    node.remove()
  }
})

/** Install a streamed document without replacing the test runner's document shell. */
function installDocument(html: string) {
  let parsed = new DOMParser().parseFromString(html, 'text/html')
  for (let node of Array.from(parsed.head.childNodes)) document.head.append(node)
  document.body.replaceChildren(...Array.from(parsed.body.childNodes))
}

describe('frame reload focus', () => {
  it('preserves focus, selection, and scroll when a reload reorders client entries', async () => {
    let Entry = clientEntry('/assets/focus-entry.js#FocusEntry', function FocusEntry() {
      return () => <input id="focus-entry" />
    })
    let Other = clientEntry('/assets/focus-other.js#FocusOther', function FocusOther() {
      return () => <p>B</p>
    })
    let Third = clientEntry('/assets/focus-third.js#FocusThird', function Third() {
      return () => <p>C</p>
    })

    function page(reordered: boolean) {
      return (
        <html>
          <head />
          <body>
            <main
              id="focus-main"
              style={{ height: '40px', overflow: 'auto', overflowAnchor: 'none' }}
            >
              {reordered ? [<Other />, <Third />, <Entry />] : [<Entry />, <Other />, <Third />]}
            </main>
          </body>
        </html>
      )
    }

    installDocument(await drain(renderToStream(page(false))))
    let reordered = false
    runtime = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/focus-entry.js' && exportName === 'FocusEntry') return Entry
        if (moduleUrl === '/assets/focus-other.js' && exportName === 'FocusOther') return Other
        if (moduleUrl === '/assets/focus-third.js' && exportName === 'FocusThird') return Third
        throw new Error(`Unexpected client entry module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame() {
        reordered = !reordered
        return drain(renderToStream(page(reordered)))
      },
    })
    await runtime.ready()

    let input = document.querySelector<HTMLInputElement>('#focus-entry')
    let main = document.querySelector<HTMLElement>('#focus-main')
    assert.ok(input && main, 'the client entry and its scrolling container hydrate')

    input.value = 'Keep my draft'
    input.focus()
    input.setSelectionRange(2, 7, 'backward')
    assert.equal(document.activeElement, input, 'the input starts focused')

    let focusEvents = 0
    input.addEventListener('focus', () => focusEvents++)

    await runtime.frames.top.reload()

    assert.deepEqual(
      Array.from(main.children, (node) => node.tagName),
      ['P', 'P', 'INPUT'],
      'the reload reorders the surviving entries',
    )
    assert.equal(document.activeElement, input, 'focus stays on the moved input')
    assert.equal(input.value, 'Keep my draft', 'the live value survives')
    assert.equal(input.selectionStart, 2, 'the selection start survives')
    assert.equal(input.selectionEnd, 7, 'the selection end survives')
    assert.equal(input.selectionDirection, 'backward', 'the selection direction survives')
    if (typeof main.moveBefore === 'function') {
      assert.equal(focusEvents, 0, 'the native move does not blur and refocus the input')
    }
  })
})

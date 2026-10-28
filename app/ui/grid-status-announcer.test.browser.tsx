import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'

import { GridStatusAnnouncer } from './grid-status-announcer.browser.tsx'

// ---------------------------------------------------------------------------
// GridStatusAnnouncer — persistent live region for the admin grid footer.
//
// The entry observes the page scroller (where every content frame renders) and
// copies [data-pagination-info] into a role=status region that lives outside
// the frame. The fixture supplies the scroller + footer the real layout would
// render, then replaces the footer like a frame navigation does.
// ---------------------------------------------------------------------------

let cleanup: (() => void) | null = null
let scroller: HTMLElement | null = null

function mountWithInfo(info: string): RenderResult {
  scroller = document.createElement('div')
  scroller.setAttribute('data-page-scroller', 'true')
  setInfo(info)
  document.body.appendChild(scroller)

  let result = render(<GridStatusAnnouncer />)
  cleanup = result.cleanup
  return result
}

function setInfo(info: string): void {
  let node = document.createElement('span')
  node.setAttribute('data-pagination-info', 'true')
  node.textContent = info
  scroller!.replaceChildren(node)
}

function statusText(): string {
  return document.querySelector('[data-grid-status]')?.textContent ?? ''
}

async function flushObserver(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  scroller?.remove()
  scroller = null
})

describe('GridStatusAnnouncer', () => {
  it('mirrors the footer into a persistent polite status region when it changes', async () => {
    mountWithInfo('1–10 von 42 Nachrichten')

    let region = document.querySelector('[data-grid-status]') as HTMLElement
    assert.ok(region, 'the layout must render the status region')
    assert.equal(region.getAttribute('role'), 'status')
    assert.equal(region.getAttribute('aria-live'), 'polite')
    assert.equal(region.getAttribute('aria-atomic'), 'true')
    assert.equal(statusText(), '', 'the initial footer is read in place, not announced')

    setInfo('11–20 von 42 Nachrichten')
    await flushObserver()

    assert.equal(statusText(), '11–20 von 42 Nachrichten')
  })

  it('does not re-announce when unrelated content in the scroller changes', async () => {
    mountWithInfo('1–10 von 42 Nachrichten')

    setInfo('11–20 von 42 Nachrichten')
    await flushObserver()
    assert.equal(statusText(), '11–20 von 42 Nachrichten')

    let counter = document.createElement('span')
    counter.textContent = '0/1000'
    scroller!.appendChild(counter)
    counter.textContent = '1/1000'
    await flushObserver()

    assert.equal(statusText(), '11–20 von 42 Nachrichten', 'an unchanged summary stays silent')
  })
})

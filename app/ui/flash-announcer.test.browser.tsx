import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'

import { FlashAnnouncer } from './flash-announcer.browser.tsx'

// ---------------------------------------------------------------------------
// FlashAnnouncer — persistent live region for the one-shot success flash.
//
// The visual banner is inserted into a frame swap; a role=status node created
// together with its content is not announced. The entry therefore mirrors
// success banners into a region that lives in the document shell, outside the
// swapped fragment. Error banners keep their own role=alert and are skipped.
//
// Frame content is rendered inside [data-page-scroller] (app/ui/layout.tsx), so
// the observer is scoped there; a document Layout banner sits outside it and is
// covered by the initial scan after hydration.
// ---------------------------------------------------------------------------

let cleanup: (() => void) | null = null
let scroller: HTMLElement | null = null

function mount(): RenderResult {
  scroller = document.createElement('div')
  scroller.setAttribute('data-page-scroller', 'true')
  document.body.appendChild(scroller)

  let result = render(<FlashAnnouncer />)
  cleanup = result.cleanup
  return result
}

function addBanner(tone: 'success' | 'error', text: string, parent: HTMLElement): HTMLElement {
  let banner = document.createElement('div')
  banner.setAttribute('data-flash-banner', '')
  banner.setAttribute('data-flash-tone', tone)
  banner.textContent = text
  parent.appendChild(banner)
  return banner
}

function statusText(): string {
  return document.querySelector('[data-flash-status]')?.textContent ?? ''
}

async function flushObserver(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  for (let banner of document.querySelectorAll('[data-flash-banner]')) banner.remove()
  scroller?.remove()
  scroller = null
})

describe('FlashAnnouncer', () => {
  it('announces a server-rendered success flash after hydration', async () => {
    // The document Layout renders the banner outside the page scroller.
    addBanner('success', 'Termin angelegt.', document.body)
    mount()

    let region = document.querySelector('[data-flash-status]') as HTMLElement
    assert.ok(region, 'the document shell must render the flash status region')
    assert.equal(region.getAttribute('role'), 'status')
    assert.equal(region.getAttribute('aria-live'), 'polite')
    assert.equal(region.getAttribute('aria-atomic'), 'true')

    await flushObserver()
    assert.equal(statusText(), 'Termin angelegt.')
  })

  it('announces a success banner inserted by a frame swap', async () => {
    mount()
    addBanner('success', 'Liste gespeichert.', scroller!)
    await flushObserver()

    assert.equal(statusText(), 'Liste gespeichert.')
  })

  it('does not mirror error banners (role=alert announces those)', async () => {
    mount()
    addBanner('error', 'Speichern fehlgeschlagen.', scroller!)
    await flushObserver()

    assert.equal(statusText(), '')
  })

  it('announces again when the same banner element gets new text', async () => {
    mount()
    let banner = addBanner('success', 'Erst gespeichert.', scroller!)
    await flushObserver()
    assert.equal(statusText(), 'Erst gespeichert.')

    banner.textContent = 'Dann gespeichert.'
    await flushObserver()

    assert.equal(statusText(), 'Dann gespeichert.')
  })

  it('stays silent for unrelated content changes inside the page scroller', async () => {
    mount()
    addBanner('success', 'Nachricht gesendet.', scroller!)
    await flushObserver()

    let counter = document.createElement('span')
    counter.textContent = '0/10'
    scroller!.appendChild(counter)
    counter.textContent = '1/10'
    await flushObserver()

    assert.equal(statusText(), 'Nachricht gesendet.')
  })
})

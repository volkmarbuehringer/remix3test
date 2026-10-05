import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'

import { MessageExpand } from './message-expand.browser.tsx'

// ---------------------------------------------------------------------------
// MessageExpand — click-to-expand on clamped message cells.
//
// The clamp lives on a server-rendered class (admin-messages-page mirrors this
// fixture with `-webkit-line-clamp: 2` on a width-bounded span); the entry
// only manipulates INLINE properties and the toggle button. The click listener
// is module-guarded once per document, so it is registered exactly once no
// matter how many tests render the entry.
// The queueTask post-render scan is flushed via result.act().
// ---------------------------------------------------------------------------

const LONG_TEXT =
  'Diese Nachricht enthält bewusst sehr viel Text, damit die Zwei-Zeilen-Klemme ' +
  'wirklich greift und der Mehr-Weniger-Schalter sichtbar bleiben muss. ' +
  'Und hier ist noch mehr Text, damit die Box mit Sicherheit überläuft und ' +
  'die Scroll-Höhe deutlich über der sichtbaren Höhe liegt.'

function mountCells(): void {
  let host = document.createElement('div')
  host.innerHTML = `
    <style>
      [data-message-text] {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        width: 260px;
        font-size: 16px;
      }
    </style>
    <div data-message-cell="1">
      <span data-message-text>${LONG_TEXT}</span>
      <button type="button" data-expand-msg="1" data-label-more="Mehr" data-label-less="Weniger">Mehr</button>
    </div>
    <div data-message-cell="2">
      <span data-message-text>Kurzer Text.</span>
      <button type="button" data-expand-msg="2" data-label-more="Mehr" data-label-less="Weniger">Mehr</button>
    </div>
  `
  document.body.appendChild(host)
  fixture = host
}

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

async function renderEntry(): Promise<RenderResult> {
  let result = render(<MessageExpand />)
  cleanup = result.cleanup
  // Flush the queued scanCells post-render sweep.
  await result.act(() => undefined)
  return result
}

function cell(id: '1' | '2'): HTMLElement {
  let node = fixture?.querySelector(`[data-message-cell="${id}"]`)
  assert.ok(node, `cell ${id} must exist`)
  return node as HTMLElement
}

function textSpan(id: '1' | '2'): HTMLElement {
  return cell(id).querySelector('[data-message-text]') as HTMLElement
}

function toggleBtn(id: '1' | '2'): HTMLButtonElement {
  return cell(id).querySelector('button[data-expand-msg]') as HTMLButtonElement
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('MessageExpand', () => {
  it('shows the toggle only on messages that overflow the two-line clamp', async () => {
    mountCells()
    await renderEntry()

    assert.equal(toggleBtn('1').style.display, 'inline', 'overflowing text offers Mehr')
    assert.equal(toggleBtn('2').style.display, 'none', 'a short message gets no button')
    assert.equal(textSpan('1').getAttribute('data-expanded'), 'false')
  })

  it('expands on click: clamp lifted, button flips to Weniger', async () => {
    mountCells()
    await renderEntry()

    toggleBtn('1').click()

    let span = textSpan('1')
    assert.equal(span.getAttribute('data-expanded'), 'true')
    assert.equal(span.style.overflow, 'visible')
    assert.equal(span.style.getPropertyValue('-webkit-line-clamp'), 'unset')
    assert.equal(toggleBtn('1').getAttribute('aria-expanded'), 'true')
    assert.equal(toggleBtn('1').textContent, 'Weniger')
  })

  it('collapses again on a second click', async () => {
    mountCells()
    await renderEntry()

    let btn = toggleBtn('1')
    btn.click()
    btn.click()

    assert.equal(textSpan('1').getAttribute('data-expanded'), 'false')
    assert.equal(btn.getAttribute('aria-expanded'), 'false')
    assert.equal(btn.textContent, 'Mehr')
  })

  it('an entry re-render resets every cell to the collapsed default', async () => {
    mountCells()
    await renderEntry()
    toggleBtn('1').click()
    assert.equal(textSpan('1').getAttribute('data-expanded'), 'true')

    // A frame navigation re-mounts the entry without touching the cell markup;
    // the post-render sweep must collapse again (no state to reconcile).
    cleanup?.()
    cleanup = null
    await renderEntry()

    assert.equal(textSpan('1').getAttribute('data-expanded'), 'false')
    assert.equal(toggleBtn('1').textContent, 'Mehr')
  })

  it('ignores clicks outside the expand buttons', async () => {
    mountCells()
    await renderEntry()

    textSpan('1').click()

    assert.equal(textSpan('1').getAttribute('data-expanded'), 'false')
  })
})

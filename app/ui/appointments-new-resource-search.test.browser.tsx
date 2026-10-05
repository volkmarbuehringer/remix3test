import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'

import { ResourceSearchLive } from './appointments-new-resource-search.browser.tsx'

// ---------------------------------------------------------------------------
// ResourceSearchLive — live filtering of the wizard's resource cards.
//
// The entry registers delegated document input/keydown listeners once
// (module guard) and re-scans every [data-resource-search-root] via
// queueTask after each render. The fixture mirrors the server markup from
// appointments-new-resource-cards.tsx: a search input, resource cards with a
// data-search-text haystack, a result count, and an empty notice.
// ---------------------------------------------------------------------------

const ROOT_HTML = `
  <div data-resource-search-root>
    <input type="search" data-resource-search placeholder="Ressource suchen…" />
    <div data-resource-search-count></div>
    <div data-resource-search-empty>Keine Ressource gefunden.</div>
    <div data-resource-card data-search-text="Beratung online">Beratung online</div>
    <div data-resource-card data-search-text="Workshop Präsenz">Workshop Präsenz</div>
    <div data-resource-card data-search-text="Coaching">Coaching</div>
  </div>
`

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mount(html = ROOT_HTML): void {
  let host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  fixture = host
}

async function renderEntry(): Promise<RenderResult> {
  let result = render(<ResourceSearchLive />)
  cleanup = result.cleanup
  await result.act(() => undefined)
  return result
}

function input(): HTMLInputElement {
  return fixture?.querySelector('[data-resource-search]') as HTMLInputElement
}

function typeSearch(value: string): void {
  let field = input()
  field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

function cards(): HTMLElement[] {
  return [...(fixture?.querySelectorAll('[data-resource-card]') ?? [])] as HTMLElement[]
}

function visibleCards(): HTMLElement[] {
  return cards().filter((card) => card.style.display !== 'none')
}

function countLine(): HTMLElement {
  return fixture?.querySelector('[data-resource-search-count]') as HTMLElement
}

function emptyNotice(): HTMLElement {
  return fixture?.querySelector('[data-resource-search-empty]') as HTMLElement
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('ResourceSearchLive', () => {
  it('applies the filter of a pre-filled input on mount', async () => {
    mount(ROOT_HTML.replace('data-resource-search ', 'data-resource-search value="coac"'))
    await renderEntry()

    assert.deepEqual(
      visibleCards().map((card) => card.textContent?.trim()),
      ['Coaching'],
    )
    assert.equal(countLine().textContent, '1 von 3 Ressourcen')
  })

  it('filters on input, matching case- and whitespace-insensitively', async () => {
    mount()
    await renderEntry()

    typeSearch('BERATUNG')
    assert.deepEqual(
      visibleCards().map((card) => card.textContent?.trim()),
      ['Beratung online'],
    )

    typeSearch('  workshop  ')
    assert.deepEqual(
      visibleCards().map((card) => card.textContent?.trim()),
      ['Workshop Präsenz'],
    )
  })

  it('shows the empty notice when nothing matches', async () => {
    mount()
    await renderEntry()

    typeSearch('nix')

    assert.equal(visibleCards().length, 0)
    assert.equal(emptyNotice().style.display, '', 'the empty notice becomes visible')
    assert.equal(countLine().textContent, '0 von 3 Ressourcen')
  })

  it('restores everything and switches to the total label when cleared', async () => {
    mount()
    await renderEntry()

    typeSearch('coaching')
    assert.equal(countLine().textContent, '1 von 3 Ressourcen')

    typeSearch('')
    assert.equal(visibleCards().length, 3, 'an empty query never hides cards')
    assert.equal(countLine().textContent, '3 Ressourcen')
    assert.equal(emptyNotice().style.display, 'none')
  })

  it('uses the singular label for a single-card list', async () => {
    mount(`
      <div data-resource-search-root>
        <input data-resource-search />
        <div data-resource-search-count></div>
        <div data-resource-card data-search-text="Coaching">Coaching</div>
      </div>
    `)
    await renderEntry()

    assert.equal(countLine().textContent, '1 Ressource')
  })

  it('Escape clears a filled query and re-shows everything', async () => {
    mount()
    await renderEntry()

    typeSearch('coaching')
    let event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input().dispatchEvent(event)

    assert.equal(event.defaultPrevented, true, 'Escape is consumed once it clears the query')
    assert.equal(input().value, '')
    assert.equal(visibleCards().length, 3)
  })

  it('Escape on an empty input is left to the browser', async () => {
    mount()
    await renderEntry()

    let event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input().dispatchEvent(event)

    assert.equal(event.defaultPrevented, false)
  })

  it('ignores events from inputs that are not the resource search', async () => {
    mount(`
      <div>
        <input id="other" />
        <div data-resource-search-root>
          <input data-resource-search />
          <div data-resource-search-count></div>
          <div data-resource-card data-search-text="Coaching">Coaching</div>
        </div>
      </div>
    `)
    await renderEntry()

    let other = document.getElementById('other') as HTMLInputElement
    other.value = 'coaching'
    other.dispatchEvent(new Event('input', { bubbles: true }))

    assert.equal(countLine().textContent, '1 Ressource', 'untouched by the foreign input')
  })
})

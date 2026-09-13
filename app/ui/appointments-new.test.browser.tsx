import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/ui/test'

import { ResourceCards } from './appointments-new-resource-cards.tsx'
import { CreatePanelScrollLive } from './appointments-new-create.browser.tsx'
import type { ResourceOption } from '../data/appointments.ts'
import type { GridState } from '../utils/grid-state.ts'

const gridState: GridState = { offset: '', sort: '', order: '', filter: '', period: '' }

function makeResources(names: string[]): ResourceOption[] {
  return names.map((name, index) => ({ id: index + 1, name, description: name + ' Beschreibung' }))
}

function visibleCards(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-resource-card]')).filter(
    (card) => card.style.display !== 'none',
  )
}

function setSearch(input: HTMLInputElement, value: string): void {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function domRect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    width: 0,
    height: 0,
    top,
    right: 0,
    bottom: top,
    left: 0,
    toJSON: () => ({}),
  }
}

function stubMatchMedia(matches: boolean): () => void {
  let original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}

describe('Appointments new resource search', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  function renderCards(): ReturnType<typeof render> {
    let result = render(
      <ResourceCards
        resources={makeResources(['Raum 1', 'Raum 2', 'Saal 3'])}
        gridState={gridState}
      />,
    )
    cleanup = result.cleanup
    return result
  }

  it('filters the resource cards live and reports the matching count', async () => {
    let result = renderCards()
    await result.act(() => {})

    let input = result.container.querySelector<HTMLInputElement>('[data-resource-search]')
    if (!input) throw new Error('the resource search input should render')
    assert.equal(visibleCards(result.container).length, 3)

    await result.act(() => setSearch(input, 'Raum'))
    assert.equal(visibleCards(result.container).length, 2)
    assert.equal(
      result.container.querySelector('[data-resource-search-count]')?.textContent,
      '2 von 3 Ressourcen',
    )

    await result.act(() => setSearch(input, 'nicht vorhanden'))
    assert.equal(visibleCards(result.container).length, 0)
    let empty = result.container.querySelector<HTMLElement>('[data-resource-search-empty]')
    if (!empty) throw new Error('the no-match hint should render')
    assert.notEqual(empty.style.display, 'none')
  })

  it('clears the query on Escape and restores every card', async () => {
    let result = renderCards()
    await result.act(() => {})

    let input = result.container.querySelector<HTMLInputElement>('[data-resource-search]')
    if (!input) throw new Error('the resource search input should render')

    await result.act(() => setSearch(input, 'Raum'))
    assert.equal(visibleCards(result.container).length, 2)

    await result.act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    assert.equal(input.value, '')
    assert.equal(visibleCards(result.container).length, 3)
  })
})

describe('Appointments new create panel reveal', () => {
  let cleanup: (() => void) | undefined
  let restoreMatchMedia: (() => void) | undefined
  let scroller: HTMLElement | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    restoreMatchMedia?.()
    restoreMatchMedia = undefined
    scroller?.remove()
    scroller = undefined
  })

  function buildScroller(): { outer: HTMLElement; panel: HTMLElement } {
    let outer = document.createElement('div')
    outer.style.overflowY = 'auto'
    Object.defineProperty(outer, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(outer, 'clientHeight', { value: 200, configurable: true })
    let panel = document.createElement('div')
    panel.setAttribute('data-create-panel', 'true')
    panel.setAttribute('data-panel-step', 'create:2')
    outer.appendChild(panel)
    document.body.appendChild(outer)
    return { outer, panel }
  }

  function stubScrollTo(outer: HTMLElement, calls: ScrollToOptions[]): void {
    Object.defineProperty(outer, 'scrollTo', {
      configurable: true,
      value: (options?: ScrollToOptions | number) => {
        if (typeof options === 'object') calls.push(options)
      },
    })
  }

  it('resets the scroll container to the top when the panel header is above the fold', async () => {
    restoreMatchMedia = stubMatchMedia(false)
    let built = buildScroller()
    scroller = built.outer
    built.panel.getBoundingClientRect = () => domRect(-120)
    let scrollCalls: ScrollToOptions[] = []
    stubScrollTo(built.outer, scrollCalls)

    let result = render(<CreatePanelScrollLive />)
    cleanup = result.cleanup
    await result.act(() => {})

    assert.equal(scrollCalls.length, 1)
    assert.equal(scrollCalls[0]?.top, 0)
  })

  it('leaves the scroll position alone when the panel is already visible', async () => {
    restoreMatchMedia = stubMatchMedia(false)
    let built = buildScroller()
    scroller = built.outer
    built.panel.getBoundingClientRect = () => domRect(24)
    let scrollCalls: ScrollToOptions[] = []
    stubScrollTo(built.outer, scrollCalls)

    let result = render(<CreatePanelScrollLive />)
    cleanup = result.cleanup
    await result.act(() => {})

    assert.equal(scrollCalls.length, 0)
  })
})

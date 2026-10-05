import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsClient } from './lists-client.tsx'

// ---------------------------------------------------------------------------
// /lists editor layout guards (browser suite).
//
// Static render + computed-style assertions moved out of
// lists-client-ops.test.e2e.ts: the toolbar surface, the visible item label
// (a regression collapsed it to ~0px), the two-line label clamp (numeric
// WebkitLineClamp serialises as invalid `2px` — see lists-styles.ts), the
// distinct size/colour of the two checkbox columns, and their tooltips.
// Nothing here needs a server or a frame: ListsClient renders the full
// editor from `initialState`, and the css() mixins are real browser styles.
// The mutation behaviour of these controls stays in the e2e + controller
// tests.
// ---------------------------------------------------------------------------

let cleanup: (() => void) | null = null
let removeThemeVars: (() => void) | null = null

// The accent colours come from theme tokens (`--rmx-color-focus-ring` and
// `--rmx-color-success-foreground`), which the document shell populates but an
// isolated render() does not. Without them both accent-colors compute to the
// same default and the distinctness guard passes vacuously — define two
// concrete values on the root, as the real themed document would.
function defineAccentTokens() {
  let root = document.documentElement
  let previousRing = root.style.getPropertyValue('--rmx-color-focus-ring')
  let previousSuccess = root.style.getPropertyValue('--rmx-color-success-foreground')
  root.style.setProperty('--rmx-color-focus-ring', '#2563eb')
  root.style.setProperty('--rmx-color-success-foreground', '#16a34a')
  removeThemeVars = () => {
    root.style.setProperty('--rmx-color-focus-ring', previousRing)
    root.style.setProperty('--rmx-color-success-foreground', previousSuccess)
  }
}

function renderEditor() {
  defineAccentTokens()
  let result = render(
    <ListsClient
      initialState={{
        id: 7,
        title: 'Layout Guards',
        description: 'seeded for the browser layout suite',
        items: [
          { id: 'op-done', label: 'Erledigte Aufgabe', done: true },
          { id: 'op-open', label: 'Offene Aufgabe' },
        ],
        updated_at: 111,
      }}
    />,
  )
  cleanup = result.cleanup
  return result.container
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(text),
    ) ?? null
  )
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  removeThemeVars?.()
  removeThemeVars = null
})

describe('lists editor layout', () => {
  it('renders the list-level toolbar and shows item label text', () => {
    let container = renderEditor()

    // The toolbar surface: the sort control, the clear-completed action, the
    // duplicate action; plus the seeded completed item row.
    assert.ok(
      container.querySelector('select[aria-label="Sortieren"]'),
      'the sort control must render',
    )
    assert.ok(buttonByText(container, 'Nur Erledigte löschen'), 'clear-completed must render')
    assert.ok(buttonByText(container, 'Duplizieren'), 'duplicate must render')
    assert.ok(container.querySelector('[data-item-id="op-done"]'), 'the done row must render')

    // The label must have a real height, not the collapsed ~0px regression.
    let label = container.querySelector('[data-item-id="op-open"] > div > span') as HTMLElement
    assert.ok(label, 'the open item label must render')
    assert.ok(label.offsetHeight > 10, `label should be visible, got ${label.offsetHeight}px`)
  })

  it('clamps item labels to two lines', () => {
    let container = renderEditor()
    let label = container.querySelector('[data-item-id="op-open"] > div > span') as HTMLElement
    let lineClamp = getComputedStyle(label).getPropertyValue('-webkit-line-clamp').trim()
    assert.equal(lineClamp, '2', 'item labels must be clamped to two lines')
  })

  it('keeps the two checkbox columns visually distinct', () => {
    let container = renderEditor()
    let selection = container.querySelector('[data-select-item="op-open"]') as HTMLElement
    let done = container.querySelector('[data-done-item="op-open"]') as HTMLElement
    assert.ok(selection && done, 'both checkbox columns must render')

    let selectionStyle = getComputedStyle(selection)
    let doneStyle = getComputedStyle(done)
    assert.ok(
      parseFloat(doneStyle.width) > parseFloat(selectionStyle.width),
      'the completion toggle must be visibly larger than the row-selection box',
    )
    assert.notEqual(
      doneStyle.accentColor,
      selectionStyle.accentColor,
      'the two checkbox columns must use different accent colours',
    )
  })

  it('tooltips both completion toggles', () => {
    let container = renderEditor()
    assert.equal(
      container.querySelector('[data-done-item="op-open"]')?.getAttribute('title'),
      'Als erledigt markieren',
      'the open completion toggle must carry a tooltip',
    )
    assert.equal(
      container.querySelector('[data-done-item="op-done"]')?.getAttribute('title'),
      'Als offen markieren',
      'the completed toggle must offer the reverse tooltip',
    )
  })
})

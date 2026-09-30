import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { sidebarRowLabel, UNTITLED_LIST_LABEL } from './sidebar-sync.ts'

/** Minimal stand-in for a sidebar row's DOM surface (no browser needed). */
function rowWith(text: string | null, untitled = false): HTMLElement {
  return {
    querySelector: () => (text === null ? null : { textContent: text }),
    hasAttribute: (name: string) => untitled && name === 'data-list-untitled',
  } as unknown as HTMLElement
}

describe('sidebarRowLabel', () => {
  it('returns the trimmed row name for a titled list', () => {
    assert.equal(sidebarRowLabel(rowWith('  Einkaufsliste  '), 5), 'Einkaufsliste')
  })

  it('disambiguates a marked untitled list with its id', () => {
    assert.equal(
      sidebarRowLabel(rowWith(UNTITLED_LIST_LABEL, true), 5),
      `${UNTITLED_LIST_LABEL} (#5)`,
    )
  })

  it('does not treat a user-named list as untitled', () => {
    assert.equal(sidebarRowLabel(rowWith(UNTITLED_LIST_LABEL), 5), UNTITLED_LIST_LABEL)
  })

  it('falls back to the untitled form when the row or name is missing', () => {
    assert.equal(sidebarRowLabel(null, 7), `${UNTITLED_LIST_LABEL} (#7)`)
    assert.equal(sidebarRowLabel(rowWith(null), 7), `${UNTITLED_LIST_LABEL} (#7)`)
  })
})

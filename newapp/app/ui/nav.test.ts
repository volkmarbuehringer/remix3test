import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { NAV_SECTIONS } from './nav.ts'

// ---------------------------------------------------------------------------
// NAV_SECTIONS data structure tests
// Verifies section labels, items, and hrefs used by the layout renderer.
// ---------------------------------------------------------------------------

describe('NAV_SECTIONS', () => {
  // -----------------------------------------------------------------------
  // Overall structure
  // -----------------------------------------------------------------------

  it('has two sections (pages and showcase)', () => {
    // Act
    let ids = NAV_SECTIONS.map((s) => s.id)

    // Assert
    assert.equal(NAV_SECTIONS.length, 2)
    assert.equal(ids[0], 'pages')
    assert.equal(ids[1], 'showcase')
  })

  // -----------------------------------------------------------------------
  // Pages section
  // -----------------------------------------------------------------------

  it('pages section has a label and contains expected links', () => {
    // Act
    let pages = NAV_SECTIONS.find((s) => s.id === 'pages')

    // Assert
    assert.ok(pages, 'pages section should exist')
    assert.equal(pages!.label, 'Pages', 'should have a "Pages" label')

    let hrefs = pages!.items.map((i) => i.href)
    assert.ok(hrefs.includes('/'), 'should link to home')
    assert.ok(hrefs.includes('/ai'), 'should link to ai')
  })

  it('pages section has at least two items', () => {
    // Act
    let pages = NAV_SECTIONS.find((s) => s.id === 'pages')

    // Assert
    assert.ok(pages, 'pages section should exist')
    assert.ok(pages!.items.length >= 2, 'should have at least 2 items')
  })

  // -----------------------------------------------------------------------
  // Showcase section
  // -----------------------------------------------------------------------

  it('showcase section has a "Showcase" label', () => {
    // Act
    let showcase = NAV_SECTIONS.find((s) => s.id === 'showcase')

    // Assert
    assert.ok(showcase, 'showcase section should exist')
    assert.equal(showcase!.label, 'Showcase', 'should have a "Showcase" label')
  })

  it('showcase section links to /ui via Overview and to each registry page', () => {
    // Act
    let showcase = NAV_SECTIONS.find((s) => s.id === 'showcase')

    // Assert
    assert.ok(showcase, 'showcase section should exist')
    let overviewItem = showcase!.items.find((i) => i.href === '/ui')
    assert.ok(overviewItem, 'should link to /ui')
    assert.equal(overviewItem!.label, 'Overview')

    let buttonItem = showcase!.items.find((i) => i.href === '/ui/button')
    assert.ok(buttonItem, 'should link to /ui/button')
    assert.equal(buttonItem!.label, 'Button')

    let formItem = showcase!.items.find((i) => i.href === '/ui/form')
    assert.ok(formItem, 'should link to /ui/form')
    assert.equal(formItem!.label, 'Form')

    let themeItem = showcase!.items.find((i) => i.href === '/ui/theme')
    assert.ok(themeItem, 'should link to /ui/theme')
    assert.equal(themeItem!.label, 'Theme Tokens')
  })

  // -----------------------------------------------------------------------
  // All items have required fields
  // -----------------------------------------------------------------------

  it('every nav item has a label and href', () => {
    for (let section of NAV_SECTIONS) {
      for (let item of section.items) {
        assert.ok(typeof item.label === 'string', `item in ${section.id} should have a label`)
        assert.ok(item.label.length > 0, `item in ${section.id} should have non-empty label`)
        assert.ok(typeof item.href === 'string', `item ${item.label} should have a href`)
        assert.ok(item.href.startsWith('/'), `item ${item.label} href should start with /`)
      }
    }
  })
})

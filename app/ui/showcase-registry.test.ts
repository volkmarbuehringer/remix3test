import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { SHOWCASE_PAGES, SHOWCASE_SECTIONS } from './showcase-registry.ts'

// ---------------------------------------------------------------------------
// SHOWCASE_PAGES registry unit tests
// Verified via introspection rather than rendering components.
// ---------------------------------------------------------------------------

describe('SHOWCASE_PAGES registry', () => {
  // -----------------------------------------------------------------------
  // Known entries — registry contains expected showcase pages
  // -----------------------------------------------------------------------

  it('contains a button entry with correct metadata', () => {
    // Act
    let entry = SHOWCASE_PAGES['button']

    // Assert
    assert.ok(entry, 'should have a button entry')
    assert.equal(entry.label, 'Button')
    assert.equal(entry.eyebrow, 'Component')
    assert.equal(entry.path, '/ui/button')
    assert.equal(entry.sectionId, 'components')
    assert.ok(typeof entry.description === 'string', 'description should be a string')
    assert.ok(entry.description.length > 0, 'description should not be empty')
    assert.ok(typeof entry.render === 'function', 'render should be a function')
  })

  it('contains a form entry with correct metadata', () => {
    // Act
    let entry = SHOWCASE_PAGES['form']

    // Assert
    assert.ok(entry, 'should have a form entry')
    assert.equal(entry.label, 'Form')
    assert.equal(entry.eyebrow, 'Component')
    assert.equal(entry.path, '/ui/form')
    assert.equal(entry.sectionId, 'components')
    assert.ok(typeof entry.description === 'string', 'description should be a string')
    assert.ok(entry.description.length > 0, 'description should not be empty')
    assert.ok(typeof entry.render === 'function', 'render should be a function')
  })

  it('contains a theme entry with correct metadata', () => {
    // Act
    let entry = SHOWCASE_PAGES['theme']

    // Assert
    assert.ok(entry, 'should have a theme entry')
    assert.equal(entry.label, 'Theme Tokens')
    assert.equal(entry.eyebrow, 'Theme')
    assert.equal(entry.path, '/ui/theme')
    assert.equal(entry.sectionId, 'theme')
    assert.ok(typeof entry.description === 'string', 'description should be a string')
    assert.ok(entry.description.length > 0, 'description should not be empty')
    assert.ok(typeof entry.render === 'function', 'render should be a function')
  })

  // -----------------------------------------------------------------------
  // Registry completeness — all expected keys present
  // -----------------------------------------------------------------------

  it('has exactly three entries (button, form, theme)', () => {
    // Act
    let keys = Object.keys(SHOWCASE_PAGES).sort()

    // Assert
    assert.equal(keys.length, 3, 'should have exactly 3 registry entries')
    assert.equal(keys[0], 'button')
    assert.equal(keys[1], 'form')
    assert.equal(keys[2], 'theme')
  })

  // -----------------------------------------------------------------------
  // Unknown keys — returns undefined for non-existent slugs
  // -----------------------------------------------------------------------

  it('returns undefined for an unknown slug', () => {
    // Act
    let entry = (SHOWCASE_PAGES as Record<string, unknown>)['nonexistent']

    // Assert
    assert.equal(entry, undefined)
  })

  it('returns undefined for an empty string slug', () => {
    // Act
    let entry = (SHOWCASE_PAGES as Record<string, unknown>)['']

    // Assert
    assert.equal(entry, undefined)
  })
})

// ---------------------------------------------------------------------------
// SHOWCASE_SECTIONS unit tests
// ---------------------------------------------------------------------------

describe('SHOWCASE_SECTIONS', () => {
  it('exports two sections (components, theme)', () => {
    // Assert
    assert.equal(SHOWCASE_SECTIONS.length, 2)
    assert.equal(SHOWCASE_SECTIONS[0].id, 'components')
    assert.equal(SHOWCASE_SECTIONS[1].id, 'theme')
  })

  it('components section contains button and form', () => {
    // Assert
    let section = SHOWCASE_SECTIONS.find((s) => s.id === 'components')!
    assert.ok(section, 'components section should exist')
    assert.equal(section.label, 'Components')
    assert.ok(section.pageIds.includes('button'), 'should include button')
    assert.ok(section.pageIds.includes('form'), 'should include form')
  })

  it('theme section contains theme page', () => {
    // Assert
    let section = SHOWCASE_SECTIONS.find((s) => s.id === 'theme')!
    assert.ok(section, 'theme section should exist')
    assert.equal(section.label, 'Theme Tokens')
    assert.ok(section.pageIds.includes('theme'), 'should include theme')
  })

  it('every registered page belongs to at least one section', () => {
    let allSectionPageIds = new Set(SHOWCASE_SECTIONS.flatMap((s) => s.pageIds))
    for (let id of Object.keys(SHOWCASE_PAGES)) {
      assert.ok(allSectionPageIds.has(id as keyof typeof SHOWCASE_PAGES), `${id} should be in a section`)
    }
  })
})

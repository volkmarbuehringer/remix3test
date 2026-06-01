import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { NAV_SECTIONS } from './nav.ts'

describe('NAV_SECTIONS', () => {
  it('has one section', () => {
    assert.equal(NAV_SECTIONS.length, 1)
  })

  it('contains expected links', () => {
    let allItems = NAV_SECTIONS.flatMap((s) => s.items)
    let hrefs = allItems.map((i) => i.href)
    assert.ok(hrefs.includes('/'), 'should link to home')
    assert.ok(hrefs.includes('/appointment'), 'should link to Termine')
    assert.ok(hrefs.includes('/lists'), 'should link to Listen')
    assert.ok(hrefs.includes('/ai'), 'should link to KI')
    assert.ok(hrefs.includes('/admin'), 'should link to admin')
  })

  it('has german labels', () => {
    let allItems = NAV_SECTIONS.flatMap((s) => s.items)
    let findByLabel = (label: string) => allItems.find((i) => i.label === label)
    assert.ok(findByLabel('Termine'))
    assert.ok(findByLabel('Listen'))
    assert.ok(findByLabel('KI'))
  })

  it('admin is adminOnly', () => {
    let allItems = NAV_SECTIONS.flatMap((s) => s.items)
    let admin = allItems.find((i) => i.href === '/admin')
    assert.ok(admin)
    assert.equal(admin!.adminOnly, true)
  })

  it('has at least two items', () => {
    let count = NAV_SECTIONS.reduce((n, s) => n + s.items.length, 0)
    assert.ok(count >= 2, `expected at least 2 items, got ${count}`)
  })

  it('every nav item has a label and href', () => {
    for (let section of NAV_SECTIONS) {
      for (let item of section.items) {
        assert.ok(typeof item.label === 'string', 'item should have a label')
        assert.ok(item.label.length > 0, 'item should have non-empty label')
        assert.ok(typeof item.href === 'string', `item ${item.label} should have a href`)
        assert.ok(item.href.startsWith('/'), `item ${item.label} href should start with /`)
      }
    }
  })
})

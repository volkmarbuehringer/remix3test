import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { MOBILE_ITEMS, NAV_SECTIONS } from './nav.ts'

describe('NAV_SECTIONS', () => {
  it('has one section', () => {
    assert.equal(NAV_SECTIONS.length, 1)
  })

  it('contains expected links', () => {
    let allItems = NAV_SECTIONS.flatMap((s) => s.items)
    let hrefs = allItems.map((i) => i.href)
    assert.ok(hrefs.includes('/'), 'should link to home')
    assert.ok(hrefs.includes('/appointments/new'), 'should link to Termine')
    assert.ok(hrefs.includes('/appointment'), 'should link to TermineUI')
    assert.ok(hrefs.includes('/lists'), 'should link to Listen')
    assert.ok(hrefs.includes('/admin'), 'should link to admin')
  })

  it('has german labels', () => {
    let allItems = NAV_SECTIONS.flatMap((s) => s.items)
    let findByLabel = (label: string) => allItems.find((i) => i.label === label)
    assert.ok(findByLabel('Termine'))
    assert.ok(findByLabel('TermineUI'))
    assert.ok(findByLabel('Listen'))
  })

  it('Termine links to appointments/new and TermineUI links to appointment', () => {
    let allItems = NAV_SECTIONS.flatMap((s) => s.items)
    assert.equal(allItems.find((i) => i.label === 'Termine')?.href, '/appointments/new')
    assert.equal(allItems.find((i) => i.label === 'TermineUI')?.href, '/appointment')
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

describe('MOBILE_ITEMS', () => {
  it('has two items', () => {
    assert.equal(MOBILE_ITEMS.length, 2)
  })

  it('has Neuer Termin as CTA', () => {
    let termin = MOBILE_ITEMS.find((i) => i.label === 'Neuer Termin')
    assert.ok(termin, 'should have Neuer Termin')
    assert.equal(termin!.requireAuth, true)
    assert.equal(termin!.cta, true)
    assert.equal(termin!.href, '/appointments/new')
  })

  it('has Einstellungen as plain link', () => {
    let settings = MOBILE_ITEMS.find((i) => i.label === 'Einstellungen')
    assert.ok(settings, 'should have Einstellungen')
    assert.equal(settings!.requireAuth, true)
    assert.equal(settings!.cta, undefined)
    assert.equal(settings!.href, '/settings')
  })

  it('every mobile item has required fields', () => {
    for (let item of MOBILE_ITEMS) {
      assert.ok(typeof item.label === 'string', 'item should have a label')
      assert.ok(item.label.length > 0, 'item should have non-empty label')
      assert.ok(typeof item.href === 'string', `item ${item.label} should have a href`)
      assert.ok(item.href.startsWith('/'), `item ${item.label} href should start with /`)
      assert.equal(typeof item.requireAuth, 'boolean', `item ${item.label} should have requireAuth`)
    }
  })
})

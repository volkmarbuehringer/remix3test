import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import type { SafeUser } from '../data/admin-users.ts'
import {
  ADMIN_USERS_PDF_CELL_MAX_CHARS,
  adminUsersPdfCountLabel,
  adminUsersPdfViewLabel,
  buildAdminUsersPdf,
  clampAdminUsersPdfCell,
} from './admin-users-pdf.ts'

function user(overrides: Partial<SafeUser> = {}): SafeUser {
  return {
    id: 1,
    email: 'anna@example.com',
    name: 'Anna Beispiel',
    role: 'customer',
    email_verified: 1,
    disabled_at: null,
    created_at: Date.UTC(2026, 0, 2, 10, 15),
    updated_at: Date.UTC(2026, 0, 2, 10, 15),
    ...overrides,
  }
}

describe('buildAdminUsersPdf', () => {
  it('produces a PDF buffer for sample rows', async () => {
    let buffer = await buildAdminUsersPdf({
      rows: [user(), user({ id: 2, role: 'admin', disabled_at: Date.now(), email_verified: 0 })],
      total: 2,
      filter: 'Anna',
      status: 'enabled',
      sortColumn: 'email',
      sortDirection: 'desc',
      now: Date.UTC(2026, 10, 10),
    })
    assert.ok(buffer.length > 0, 'buffer should not be empty')
    assert.equal(buffer.subarray(0, 4).toString('latin1'), '%PDF')
  })

  it('builds after clamping an extremely long cell', async () => {
    let buffer = await buildAdminUsersPdf({
      rows: [user({ name: 'x'.repeat(10_000), email: 'y'.repeat(10_000) })],
      total: 1,
      sortColumn: 'name',
      sortDirection: 'asc',
    })
    assert.ok(buffer.length > 0)
    assert.equal(buffer.subarray(0, 4).toString('latin1'), '%PDF')
  })

  it('works for an empty filtered view', async () => {
    let buffer = await buildAdminUsersPdf({
      rows: [],
      total: 0,
      filter: 'niemand',
      status: 'disabled',
      sortColumn: 'created_at',
      sortDirection: 'desc',
    })
    assert.ok(buffer.length > 0)
  })
})

describe('clampAdminUsersPdfCell', () => {
  it('leaves short values untouched', () => {
    assert.deepEqual(clampAdminUsersPdfCell('  Anna  '), { text: 'Anna', clamped: false })
  })

  it('caps long values with an ellipsis', () => {
    let result = clampAdminUsersPdfCell('z'.repeat(500))
    assert.equal(result.clamped, true)
    assert.equal(result.text.length, ADMIN_USERS_PDF_CELL_MAX_CHARS + 1)
    assert.ok(result.text.endsWith('\u2026'))
  })
})

describe('adminUsersPdfViewLabel', () => {
  it('describes the search, status and sort', () => {
    let label = adminUsersPdfViewLabel({
      filter: 'Admin',
      status: 'enabled',
      sortColumn: 'email',
      sortDirection: 'desc',
    })
    assert.equal(
      label,
      'Ansicht: Suche \u201eAdmin\u201c \u00b7 Status Aktiv \u00b7 Sortierung E-Mail absteigend',
    )
  })

  it('still states the sort without a filter', () => {
    let label = adminUsersPdfViewLabel({
      filter: undefined,
      status: undefined,
      sortColumn: 'created_at',
      sortDirection: 'asc',
    })
    assert.equal(label, 'Ansicht: Sortierung Erstellt aufsteigend')
  })
})

describe('adminUsersPdfCountLabel', () => {
  it('counts all rows when the export is complete', () => {
    assert.equal(
      adminUsersPdfCountLabel({ rowCount: 3, total: 3, truncated: false, clampedCells: false }),
      'Insgesamt 3 Benutzer',
    )
  })

  it('discloses the row cap and clamped cells', () => {
    let label = adminUsersPdfCountLabel({
      rowCount: 10_000,
      total: 12_500,
      truncated: true,
      clampedCells: true,
    })
    assert.ok(label.startsWith('10.000 von 12.500 Benutzern'))
    assert.ok(label.includes('auf 10.000 Einträge begrenzt'))
    assert.ok(label.includes('Lange Einträge sind gekürzt'))
  })
})

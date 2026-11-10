import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import type { UploadRow } from '../data/uploads.ts'
import {
  UPLOADS_PDF_CELL_MAX_CHARS,
  buildUploadsPdf,
  clampUploadsPdfCell,
  uploadsPdfCountLabel,
  uploadsPdfViewLabel,
} from './uploads-pdf.ts'

function upload(overrides: Partial<UploadRow> = {}): UploadRow {
  return {
    id: 1,
    filename: 'rechnung-2026.pdf',
    mime_type: 'application/pdf',
    size: 1024,
    created_at: Date.UTC(2026, 0, 2, 10, 15),
    ...overrides,
  }
}

describe('buildUploadsPdf', () => {
  it('produces a PDF buffer for sample rows', async () => {
    let buffer = await buildUploadsPdf({
      rows: [upload(), upload({ id: 2, filename: 'foto.png', mime_type: 'image/png', size: 2048 })],
      total: 2,
      filter: 'rechnung',
      kind: 'pdf',
      sortColumn: 'size',
      sortDirection: 'asc',
      now: Date.UTC(2026, 10, 10),
    })
    assert.ok(buffer.length > 0, 'buffer should not be empty')
    assert.equal(buffer.subarray(0, 4).toString('latin1'), '%PDF')
  })

  it('builds after clamping an extremely long filename', async () => {
    let buffer = await buildUploadsPdf({
      rows: [upload({ filename: 'x'.repeat(10_000) })],
      total: 1,
      sortColumn: 'filename',
      sortDirection: 'asc',
    })
    assert.ok(buffer.length > 0)
    assert.equal(buffer.subarray(0, 4).toString('latin1'), '%PDF')
  })

  it('works for an empty filtered view', async () => {
    let buffer = await buildUploadsPdf({
      rows: [],
      total: 0,
      filter: 'niemand',
      kind: 'image',
      sortColumn: 'created_at',
      sortDirection: 'desc',
    })
    assert.ok(buffer.length > 0)
  })
})

describe('clampUploadsPdfCell', () => {
  it('leaves short values untouched', () => {
    assert.deepEqual(clampUploadsPdfCell('  rechnung.pdf  '), {
      text: 'rechnung.pdf',
      clamped: false,
    })
  })

  it('caps long values with an ellipsis', () => {
    let result = clampUploadsPdfCell('z'.repeat(500))
    assert.equal(result.clamped, true)
    assert.equal(result.text.length, UPLOADS_PDF_CELL_MAX_CHARS + 1)
    assert.ok(result.text.endsWith('\u2026'))
  })
})

describe('uploadsPdfViewLabel', () => {
  it('describes the search, kind and sort', () => {
    let label = uploadsPdfViewLabel({
      filter: 'rechnung',
      kind: 'pdf',
      sortColumn: 'size',
      sortDirection: 'desc',
    })
    assert.equal(
      label,
      'Ansicht: Suche \u201erechnung\u201c \u00b7 Typ PDF \u00b7 Sortierung Größe absteigend',
    )
  })

  it('still states the sort without a filter', () => {
    let label = uploadsPdfViewLabel({
      filter: undefined,
      kind: undefined,
      sortColumn: 'created_at',
      sortDirection: 'desc',
    })
    assert.equal(label, 'Ansicht: Sortierung Datum absteigend')
  })

  it('falls back to the raw column name for an unknown sort field', () => {
    let label = uploadsPdfViewLabel({
      sortColumn: 'uploaded_by',
      sortDirection: 'asc',
    })
    assert.ok(label.includes('Sortierung uploaded_by aufsteigend'))
  })
})

describe('uploadsPdfCountLabel', () => {
  it('counts all rows when the export is complete', () => {
    assert.equal(
      uploadsPdfCountLabel({ rowCount: 3, total: 3, truncated: false, clampedCells: false }),
      'Insgesamt 3 Dateien',
    )
  })

  it('uses the singular for one file', () => {
    assert.equal(
      uploadsPdfCountLabel({ rowCount: 1, total: 1, truncated: false, clampedCells: false }),
      'Insgesamt 1 Datei',
    )
  })

  it('discloses the row cap and clamped cells', () => {
    let label = uploadsPdfCountLabel({
      rowCount: 10_000,
      total: 12_500,
      truncated: true,
      clampedCells: true,
    })
    assert.ok(label.startsWith('10.000 von 12.500 Dateien'))
    assert.ok(label.includes('auf 10.000 Einträge begrenzt'))
    assert.ok(label.includes('Lange Einträge sind gekürzt'))
  })
})

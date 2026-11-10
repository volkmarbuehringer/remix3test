import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import type { Content, ContentTable, TDocumentDefinitions } from 'pdfmake/interfaces.js'

import { LIST_ITEM_LABEL_MAX_CHARS, type ListRow } from '../data/lists.ts'
import {
  buildListPdf,
  createListPdfDocument,
  LIST_PDF_MAX_ITEMS,
  LIST_PDF_SHORTENED_NOTE,
} from './list-pdf.ts'

const LIST: ListRow = {
  id: 7,
  user_id: 1,
  title: 'Einkauf',
  description: 'Für das Wochenende',
  created_at: Date.UTC(2026, 0, 1),
  updated_at: Date.UTC(2026, 0, 2),
  list: [
    {
      id: 'a',
      label: 'Brot',
      done: true,
      priority: 'high',
      due: '2026-01-03',
      tags: ['Backwaren', 'Frühstück'],
    },
    { id: 'b', label: 'Milch' },
  ],
}

function tableOf(document: TDocumentDefinitions): ContentTable {
  let content = document.content
  assert.ok(Array.isArray(content))
  let table = (content as Content[]).find(
    (entry): entry is ContentTable =>
      typeof entry === 'object' && entry !== null && 'table' in entry,
  )
  assert.ok(table, 'the list PDF should contain an item table')
  return table
}

function pdfTable(list: ListRow): ContentTable {
  return tableOf(createListPdfDocument(list))
}

function contentTexts(document: TDocumentDefinitions): string[] {
  let content = document.content
  assert.ok(Array.isArray(content))
  return (content as Content[]).map((entry) =>
    typeof entry === 'object' && entry !== null && 'text' in entry ? String(entry.text) : '',
  )
}

function summaryTextOf(document: TDocumentDefinitions): string {
  let summary = contentTexts(document).find(
    (text) =>
      (text.startsWith('Insgesamt ') || /^\d+ von \d+ Einträgen/.test(text)) &&
      / · \d+ erledigt/.test(text),
  )
  assert.ok(summary, 'the list PDF should contain the item summary line')
  return summary
}

function summaryText(list: ListRow): string {
  return summaryTextOf(createListPdfDocument(list))
}

describe('buildListPdf', () => {
  it('produces a PDF buffer', async () => {
    let buffer = await buildListPdf(LIST)
    assert.ok(buffer.length > 0)
    assert.equal(buffer.subarray(0, 4).toString('latin1'), '%PDF')
  })

  it('produces a PDF for an empty untitled list', async () => {
    let buffer = await buildListPdf({ ...LIST, title: '', description: '', list: [] })
    assert.ok(buffer.length > 0)
    assert.equal(buffer.subarray(0, 4).toString('latin1'), '%PDF')
  })

  it('includes every item field and preserves impossible dates verbatim', () => {
    assert.deepEqual(pdfTable(LIST).table.body[1], [
      'Erledigt',
      'Brot',
      'Hoch',
      '03.01.2026',
      'Backwaren, Frühstück',
    ])

    let invalidDateList = {
      ...LIST,
      list: [{ ...LIST.list[0]!, due: '2026-02-31' }],
    }
    assert.equal(pdfTable(invalidDateList).table.body[1]?.[3], '2026-02-31')
  })

  it('keeps long unbroken user text in wrappable columns', () => {
    let longLabel = 'x'.repeat(500)
    let document = createListPdfDocument({ ...LIST, list: [{ id: 'long', label: longLabel }] })
    assert.equal(document.defaultStyle?.wordBreak, 'break-all')
    assert.deepEqual(pdfTable({ ...LIST, list: [{ id: 'long', label: longLabel }] }).table.widths, [
      55,
      '*',
      55,
      65,
      90,
    ])
    assert.equal(
      pdfTable({ ...LIST, list: [{ id: 'long', label: longLabel }] }).table.body[1]?.[1],
      longLabel,
    )
  })

  it('clamps an oversized label before layout and discloses it', () => {
    let longLabel = 'x'.repeat(20_000)
    let list = { ...LIST, list: [{ id: 'long', label: longLabel }] }
    let cell = pdfTable(list).table.body[1]?.[1]

    assert.equal(String(cell).length, LIST_ITEM_LABEL_MAX_CHARS + 1)
    assert.ok(String(cell).endsWith('…'), 'a clamped cell must end with an ellipsis')
    assert.ok(
      summaryText(list).includes(LIST_PDF_SHORTENED_NOTE),
      'the summary must disclose shortened text',
    )
  })

  it('stops after the row cap and reports how many items are included', () => {
    let count = LIST_PDF_MAX_ITEMS + 10
    let list = {
      ...LIST,
      list: Array.from({ length: count }, (_, index) => ({
        id: String(index),
        label: `Eintrag ${index}`,
      })),
    }

    assert.equal(pdfTable(list).table.body.length, LIST_PDF_MAX_ITEMS + 1)
    assert.ok(
      summaryText(list).includes(`nur ${LIST_PDF_MAX_ITEMS} von ${count} Einträgen`),
      'the summary must state that the export is partial',
    )
  })

  it('describes a filtered view and reports the visible subset', () => {
    let document = createListPdfDocument(
      { ...LIST, list: LIST.list.slice(0, 1) },
      { viewLabel: 'Ansicht: Status Offen · A–Z', totalCount: 2 },
    )

    assert.ok(contentTexts(document).includes('Ansicht: Status Offen · A–Z'))
    assert.ok(
      summaryTextOf(document).startsWith('1 von 2 Einträgen · 1 erledigt'),
      'a filtered export must state how many of the stored items it contains',
    )
  })

  it('distinguishes an empty view from an empty list', () => {
    let filtered = createListPdfDocument(
      { ...LIST, list: [] },
      { viewLabel: 'Ansicht: Status Offen', totalCount: 2 },
    )
    assert.ok(contentTexts(filtered).includes('Keine Einträge für diese Ansicht.'))

    let empty = createListPdfDocument({ ...LIST, title: '', description: '', list: [] })
    assert.ok(contentTexts(empty).includes('Diese Liste enthält keine Einträge.'))
  })
})

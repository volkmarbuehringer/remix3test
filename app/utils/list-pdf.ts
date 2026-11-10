import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'

import { LIST_ITEM_LABEL_MAX_CHARS, type ListRow } from '../data/lists.ts'
import { formatCompactDateDE, formatUtcDateDE, parseIsoDateUtc } from './date-utils.ts'
import { generatePdfBuffer } from './pdf-utils.ts'

const priorityLabels = {
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
} as const

/**
 * Upper bound for the text of one table cell (a label or its joined tags).
 * Matches the write-side label cap so a freshly saved list can be exported
 * without truncation; older rows are clamped here.
 */
const LIST_PDF_MAX_CELL_CHARS = LIST_ITEM_LABEL_MAX_CHARS
/**
 * Bounds for one export. pdfmake's `wordBreak: 'break-all'` wraps text by
 * splitting it into one word per character, so a single pasted blob made
 * layout superlinear (measured: ~200k characters ≈ 20–35 s of CPU and
 * ~166 MB heap, blocking the single Node process). Capping the rows, the
 * per-cell text and the total laid-out text keeps a worst-case export at
 * roughly 1.5 s while normal lists are exported in full.
 */
export const LIST_PDF_MAX_ITEMS = 5_000
const LIST_PDF_MAX_TOTAL_CHARS = 100_000

/** Appended to the item count when long text had to be shortened. */
export const LIST_PDF_SHORTENED_NOTE = ' — Hinweis: Lange Einträge sind gekürzt.'

type ClampedText = { text: string; truncated: boolean }

/** Clamp user text before layout; never split a surrogate pair. */
function clampCell(value: string): ClampedText {
  if (value.length <= LIST_PDF_MAX_CELL_CHARS) return { text: value, truncated: false }
  let cut = value.slice(0, LIST_PDF_MAX_CELL_CHARS)
  let last = cut.charCodeAt(cut.length - 1)
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1)
  return { text: cut + '…', truncated: true }
}

function formatDueDate(value: string | undefined): string {
  if (!value) return '—'
  let timestamp = parseIsoDateUtc(value)
  return timestamp === null ? value : formatUtcDateDE(timestamp)
}

function buildItemRows(list: ListRow): {
  rows: string[][]
  truncated: boolean
  shortened: boolean
} {
  let rows: string[][] = []
  let shortened = false
  let usedChars = 0
  let truncated = false

  for (let item of list.list) {
    let label = clampCell(item.label)
    let tags = clampCell(item.tags && item.tags.length > 0 ? item.tags.join(', ') : '—')
    shortened ||= label.truncated || tags.truncated

    // The character budget is the real cost driver; the row cap keeps the
    // fixed per-row cells bounded for huge lists of very short items.
    if (
      rows.length >= LIST_PDF_MAX_ITEMS ||
      usedChars + label.text.length + tags.text.length > LIST_PDF_MAX_TOTAL_CHARS
    ) {
      truncated = true
      break
    }

    usedChars += label.text.length + tags.text.length
    rows.push([
      item.done === true ? 'Erledigt' : 'Offen',
      label.text,
      item.priority ? priorityLabels[item.priority] : '—',
      formatDueDate(item.due),
      tags.text,
    ])
  }

  return { rows, truncated, shortened }
}

/** Describe a partial export so a shortened PDF never looks complete. */
function truncationNote(listCount: number, exported: number, shortened: boolean): string {
  let notes: string[] = []
  if (exported < listCount) {
    notes.push(` — Hinweis: Es sind nur ${exported} von ${listCount} Einträgen enthalten.`)
  }
  if (shortened) notes.push(LIST_PDF_SHORTENED_NOTE)
  return notes.join('')
}

export interface ListPdfOptions {
  /** Describes the exported view (filter/sort) under the document header. */
  viewLabel?: string | undefined
  /** Items before the view filter, so a filtered export can state "X von Y". */
  totalCount?: number | undefined
}

/** Describe a PDF for one saved list, including (bounded) item metadata. */
export function createListPdfDocument(
  list: ListRow,
  options: ListPdfOptions = {},
): TDocumentDefinitions {
  let titleText = list.title.trim() || list.description.trim() || `Liste ${list.id}`
  let title = clampCell(titleText)
  let description = clampCell(list.description)
  let doneCount = list.list.filter((item) => item.done === true).length
  let totalCount = options.totalCount ?? list.list.length
  let countLabel =
    totalCount === list.list.length
      ? `Insgesamt ${list.list.length} ${list.list.length === 1 ? 'Eintrag' : 'Einträge'}`
      : `${list.list.length} von ${totalCount} Einträgen`
  let itemRows = buildItemRows(list)
  let shortened = title.truncated || description.truncated || itemRows.shortened
  let content: TDocumentDefinitions['content'] = [
    { text: title.text, style: 'header' },
    { text: `Zuletzt geändert: ${formatCompactDateDE(list.updated_at)}`, style: 'subheader' },
  ]

  if (options.viewLabel) {
    content.push({ text: options.viewLabel, style: 'subheader' })
  }

  if (list.description.trim() && list.description.trim() !== titleText) {
    content.push({ text: description.text, style: 'description' })
  }

  content.push({
    text:
      `${countLabel} · ${doneCount} erledigt` +
      truncationNote(list.list.length, itemRows.rows.length, shortened),
    style: 'subheader',
    margin: [0, 0, 0, 20],
  })

  if (list.list.length === 0) {
    content.push({
      text:
        totalCount === 0
          ? 'Diese Liste enthält keine Einträge.'
          : 'Keine Einträge für diese Ansicht.',
      style: 'description',
    })
  } else {
    content.push({
      table: {
        headerRows: 1,
        widths: [55, '*', 55, 65, 90],
        body: [
          [
            { text: 'Status', bold: true },
            { text: 'Eintrag', bold: true },
            { text: 'Priorität', bold: true },
            { text: 'Fällig', bold: true },
            { text: 'Tags', bold: true },
          ],
          ...itemRows.rows,
        ],
      },
      layout: 'lightHorizontalLines',
    })
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    // List text is user-controlled. Break long unbroken tokens instead of
    // clipping them or widening columns; clampCell bounds the layout cost.
    defaultStyle: { font: 'Roboto', wordBreak: 'break-all' },
    content,
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 8] },
      subheader: { fontSize: 11, color: '#666666', margin: [0, 0, 0, 4] },
      description: { fontSize: 11, margin: [0, 4, 0, 12] },
    },
  }
}

/** Build a PDF attachment body for one saved list. */
export async function buildListPdf(list: ListRow, options: ListPdfOptions = {}): Promise<Buffer> {
  return generatePdfBuffer(createListPdfDocument(list, options))
}

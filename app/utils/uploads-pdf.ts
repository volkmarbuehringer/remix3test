import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'

import type { UploadKind, UploadRow } from '../data/uploads.ts'
import { formatBytes, formatUploadType } from './upload-validation.ts'
import { generatePdfBuffer, PDF_TRUNCATED_NOTE } from './pdf-utils.ts'

/**
 * Cap for one text cell before pdfmake lays it out. Upload names come from the
 * multipart parser and are not length-limited by the upload policy, and an
 * unbounded cell makes the layout cost grow superlinearly (see the report/list
 * PDF export note). The cap is far above any realistic filename, so it only
 * truncates abusive input.
 */
export const UPLOADS_PDF_CELL_MAX_CHARS = 300

/** Longest search term shown in the "Ansicht" line. */
const UPLOADS_PDF_FILTER_LABEL_MAX_CHARS = 200

/** Column labels for the "Ansicht" line, keyed by the grid's sort fields. */
const SORT_LABELS: Record<string, string> = {
  id: 'ID',
  filename: 'Dateiname',
  mime_type: 'Typ',
  size: 'Größe',
  created_at: 'Datum',
}

/** German label per MIME grouping (mirrors the grid's kind tabs). */
const KIND_LABELS: Record<UploadKind, string> = {
  pdf: 'PDF',
  image: 'Bilder',
  text: 'Text',
}

export interface BuildUploadsPdfOptions {
  rows: UploadRow[]
  /** Total rows matching the filter, before the export row cap. */
  total: number
  /** True when the result set was cut at the export row cap. */
  truncated?: boolean
  /** Active text search (filename/mime type/id). */
  filter?: string | undefined
  /** Active MIME grouping filter. */
  kind?: UploadKind | undefined
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  /** Clock override for tests. */
  now?: number
}

/** Trim and cap one text value before it reaches pdfmake. */
export function clampUploadsPdfCell(
  value: string,
  max: number = UPLOADS_PDF_CELL_MAX_CHARS,
): { text: string; clamped: boolean } {
  let text = value.trim()
  if (text.length <= max) return { text, clamped: false }
  return { text: text.slice(0, max) + '\u2026', clamped: true }
}

/**
 * Date and time on two lines. A single `toLocaleString('de-DE')` string wraps at
 * its comma in a narrow auto column and leaves the comma dangling at the line
 * end; stacking date above time matches the grid's "Datum" cell.
 */
function formatTimestampDE(ts: number): string {
  let date = new Date(Number(ts))
  if (Number.isNaN(date.getTime())) return '\u2014'
  let day = date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  let time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${day}\n${time}`
}

function sortLabel(column: string, direction: 'asc' | 'desc'): string {
  let label = SORT_LABELS[column] ?? column
  return `${label} ${direction === 'asc' ? 'aufsteigend' : 'absteigend'}`
}

/** The "Ansicht" line: which filter and sort produced this file. */
export function uploadsPdfViewLabel(
  options: Pick<BuildUploadsPdfOptions, 'filter' | 'kind' | 'sortColumn' | 'sortDirection'>,
): string {
  let parts: string[] = []
  if (options.filter) {
    let term = clampUploadsPdfCell(options.filter, UPLOADS_PDF_FILTER_LABEL_MAX_CHARS)
    parts.push(`Suche \u201e${term.text}\u201c`)
  }
  if (options.kind) {
    parts.push(`Typ ${KIND_LABELS[options.kind]}`)
  }
  parts.push(`Sortierung ${sortLabel(options.sortColumn, options.sortDirection)}`)
  return `Ansicht: ${parts.join(' \u00b7 ')}`
}

/** "1 Datei" / "1.234 Dateien" (German plural, thousands separator). */
function formatFileCount(count: number): string {
  let formatted = count.toLocaleString('de-DE')
  return count === 1 ? `${formatted} Datei` : `${formatted} Dateien`
}

/** The count line, with the row-cap and cell-clamp disclosures. */
export function uploadsPdfCountLabel(options: {
  rowCount: number
  total: number
  truncated: boolean
  clampedCells: boolean
}): string {
  let { rowCount, total, truncated, clampedCells } = options
  let label = truncated
    ? `${rowCount.toLocaleString('de-DE')} von ${formatFileCount(total)}`
    : `Insgesamt ${formatFileCount(rowCount)}`
  if (truncated) label += PDF_TRUNCATED_NOTE
  if (clampedCells) label += ' \u2014 Lange Einträge sind gekürzt.'
  return label
}

/**
 * Build the uploads PDF: the same filter/sort as the /admin/uploads grid, every
 * matching row (not just the visible page), and a self-describing "Ansicht"
 * line so the file states which view it contains.
 */
export async function buildUploadsPdf(options: BuildUploadsPdfOptions): Promise<Buffer> {
  let {
    rows,
    total,
    truncated = false,
    filter,
    kind,
    sortColumn,
    sortDirection,
    now = Date.now(),
  } = options

  let clampedCell = false
  function textCell(value: string | null | undefined): string {
    let clamped = clampUploadsPdfCell(value ?? '', UPLOADS_PDF_CELL_MAX_CHARS)
    if (clamped.clamped) clampedCell = true
    return clamped.text || '\u2014'
  }

  let dataRows = rows.map((row) => [
    String(row.id),
    textCell(row.filename),
    textCell(formatUploadType(row.mime_type)),
    formatBytes(row.size),
    formatTimestampDE(row.created_at),
  ])

  let viewLabel = uploadsPdfViewLabel({ filter, kind, sortColumn, sortDirection })
  let countLabel = uploadsPdfCountLabel({
    rowCount: rows.length,
    total,
    truncated,
    clampedCells: clampedCell,
  })

  let content: TDocumentDefinitions['content'] = [
    { text: 'Hochgeladene Dateien', style: 'header' },
    {
      text: `Erstellt am ${new Date(now).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })}`,
      style: 'subheader',
    },
    { text: viewLabel, style: 'subheader' },
    { text: countLabel, style: 'subheader', margin: [0, 0, 0, 20] },
  ]

  if (rows.length === 0) {
    content.push({ text: 'Keine Dateien für diese Ansicht.', style: 'subheader' })
  } else {
    content.push({
      table: {
        headerRows: 1,
        widths: ['auto', '*', 'auto', 'auto', 'auto'],
        body: [
          [
            { text: 'ID', bold: true },
            { text: 'Dateiname', bold: true },
            { text: 'Typ', bold: true },
            { text: 'Größe', bold: true },
            { text: 'Datum', bold: true },
          ],
          ...dataRows,
        ],
      },
      layout: 'lightHorizontalLines',
    })
  }

  return generatePdfBuffer({
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    content,
    styles: {
      header: { fontSize: 18, bold: true, margin: [0, 0, 0, 8] },
      subheader: { fontSize: 11, color: '#666666', margin: [0, 0, 0, 4] },
    },
  })
}

import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'

import type { SafeUser } from '../data/admin-users.ts'
import type { UserStatus } from '../utils/user-status.ts'
import { generatePdfBuffer, PDF_TRUNCATED_NOTE } from './pdf-utils.ts'

/**
 * Cap for one text cell before pdfmake lays it out. The admin user form does
 * not length-limit name/e-mail, and an unbounded cell makes the layout cost
 * grow superlinearly (see the report/list PDF export note). The cap is far
 * above any realistic value, so it only truncates abusive input.
 */
export const ADMIN_USERS_PDF_CELL_MAX_CHARS = 300

/** Longest search term shown in the "Ansicht" line. */
const ADMIN_USERS_PDF_FILTER_LABEL_MAX_CHARS = 200

const SORT_LABELS: Record<string, string> = {
  id: 'ID',
  name: 'Name',
  email: 'E-Mail',
  role: 'Rolle',
  created_at: 'Erstellt',
}

export interface BuildAdminUsersPdfOptions {
  rows: SafeUser[]
  /** Total rows matching the filter, before the export row cap. */
  total: number
  /** True when the result set was cut at the export row cap. */
  truncated?: boolean
  /** Active text search. */
  filter?: string | undefined
  /** Active status filter. */
  status?: UserStatus | undefined
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  /** Clock override for tests. */
  now?: number
}

/** Trim and cap one text value before it reaches pdfmake. */
export function clampAdminUsersPdfCell(
  value: string,
  max: number = ADMIN_USERS_PDF_CELL_MAX_CHARS,
): { text: string; clamped: boolean } {
  let text = value.trim()
  if (text.length <= max) return { text, clamped: false }
  return { text: text.slice(0, max) + '\u2026', clamped: true }
}

function formatTimestampDE(ts: number | null | undefined): string {
  if (ts == null) return '\u2014'
  let date = new Date(Number(ts))
  if (Number.isNaN(date.getTime())) return '\u2014'
  let day = date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  let time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  // Stack date above time like the grid's "Erstellt" cell; a single string with
  // a comma wraps at the comma and leaves it dangling at the line end.
  return `${day}\n${time}`
}

function sortLabel(column: string, direction: 'asc' | 'desc'): string {
  let label = SORT_LABELS[column] ?? column
  return `${label} ${direction === 'asc' ? 'aufsteigend' : 'absteigend'}`
}

/** The "Ansicht" line: which filter and sort produced this file. */
export function adminUsersPdfViewLabel(
  options: Pick<BuildAdminUsersPdfOptions, 'filter' | 'status' | 'sortColumn' | 'sortDirection'>,
): string {
  let parts: string[] = []
  if (options.filter) {
    let term = clampAdminUsersPdfCell(options.filter, ADMIN_USERS_PDF_FILTER_LABEL_MAX_CHARS)
    parts.push(`Suche \u201e${term.text}\u201c`)
  }
  if (options.status) {
    parts.push(options.status === 'enabled' ? 'Status Aktiv' : 'Status Deaktiviert')
  }
  parts.push(`Sortierung ${sortLabel(options.sortColumn, options.sortDirection)}`)
  return `Ansicht: ${parts.join(' \u00b7 ')}`
}

/** The count line, with the row-cap and cell-clamp disclosures. */
export function adminUsersPdfCountLabel(options: {
  rowCount: number
  total: number
  truncated: boolean
  clampedCells: boolean
}): string {
  let { rowCount, total, truncated, clampedCells } = options
  let rows = rowCount.toLocaleString('de-DE')
  let allRows = total.toLocaleString('de-DE')
  let label = truncated ? `${rows} von ${allRows} Benutzern` : `Insgesamt ${rows} Benutzer`
  if (truncated) label += PDF_TRUNCATED_NOTE
  if (clampedCells) label += ' \u2014 Lange Einträge sind gekürzt.'
  return label
}

/**
 * Build the admin users PDF: the same filter/sort as the /admin/users grid,
 * every matching row (not just the visible page), and a self-describing
 * "Ansicht" line so the file states which view it contains.
 */
export async function buildAdminUsersPdf(options: BuildAdminUsersPdfOptions): Promise<Buffer> {
  let {
    rows,
    total,
    truncated = false,
    filter,
    status,
    sortColumn,
    sortDirection,
    now = Date.now(),
  } = options

  let clampedCell = false
  function textCell(value: string | null | undefined): string {
    let clamped = clampAdminUsersPdfCell(value ?? '', ADMIN_USERS_PDF_CELL_MAX_CHARS)
    if (clamped.clamped) clampedCell = true
    return clamped.text || '\u2014'
  }

  let dataRows = rows.map((row) => [
    String(row.id),
    textCell(row.name),
    textCell(row.email),
    row.role === 'admin' ? 'Admin' : 'Kunde',
    row.disabled_at ? 'Deaktiviert' : 'Aktiv',
    row.email_verified ? 'Ja' : 'Nein',
    formatTimestampDE(row.created_at),
  ])

  let viewLabel = adminUsersPdfViewLabel({ filter, status, sortColumn, sortDirection })
  let countLabel = adminUsersPdfCountLabel({
    rowCount: rows.length,
    total,
    truncated,
    clampedCells: clampedCell,
  })

  let content: TDocumentDefinitions['content'] = [
    { text: 'Benutzerliste', style: 'header' },
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
    content.push({ text: 'Keine Benutzer für diese Ansicht.', style: 'subheader' })
  } else {
    content.push({
      table: {
        headerRows: 1,
        widths: ['auto', '*', '*', 'auto', 'auto', 'auto', 'auto'],
        body: [
          [
            { text: 'ID', bold: true },
            { text: 'Name', bold: true },
            { text: 'E-Mail', bold: true },
            { text: 'Rolle', bold: true },
            { text: 'Status', bold: true },
            { text: 'Bestätigt', bold: true },
            { text: 'Erstellt', bold: true },
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

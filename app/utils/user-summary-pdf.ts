import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'

import { generatePdfBuffer } from './pdf-utils.ts'
import { formatMinOption, formatUtcDateDE } from './date-utils.ts'
import type { UserSummaryRow } from '../data/user-summary-rows.ts'

const TRUNCATED_NOTE = ' \u2014 Hinweis: Ergebnis auf 10.000 Eintr\u00e4ge begrenzt.'

export interface BuildUserSummaryPdfOptions {
  /** Main title, e.g. "Benutzer-Export". */
  title: string
  /** Optional extra subheader, e.g. a period or "Erstellt am" line. */
  periodLabel?: string
  /** Count line without truncation note, e.g. "Insgesamt 5 Benutzer". */
  countLabel: string
  rows: UserSummaryRow[]
  truncated?: boolean
}

/**
 * Build the shared user-summary PDF used by /verwaltung/users-pdf and
 * /verwaltung/users-export: title, optional period subheader, count line
 * (with truncation note), and the per-user summary table.
 */
export async function buildUserSummaryPdf(
  options: BuildUserSummaryPdfOptions,
): Promise<Buffer> {
  let { title, periodLabel, countLabel, rows, truncated = false } = options

  let content: TDocumentDefinitions['content'] = [
    { text: title, style: 'header' },
  ]
  if (periodLabel) {
    content.push({ text: periodLabel, style: 'subheader' })
  }
  content.push(
    {
      text: countLabel + (truncated ? TRUNCATED_NOTE : ''),
      style: 'subheader',
      margin: [0, 0, 0, 20],
    },
    {
      table: {
        headerRows: 1,
        widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
        body: [
          [
            { text: 'Name', bold: true },
            { text: 'E-Mail', bold: true },
            { text: 'Termine', bold: true },
            { text: 'Gesamtzeit', bold: true },
            { text: 'Erster Termin', bold: true },
            { text: 'Letzter Termin', bold: true },
          ],
          ...rows.map((row) => [
            row.name ?? row.email,
            row.email,
            String(row.appointment_count),
            row.appointment_count > 0 ? formatMinOption(row.total_minutes) : '\u2014',
            formatUtcDateDE(row.first_date),
            formatUtcDateDE(row.last_date),
          ]),
        ],
      },
      layout: 'lightHorizontalLines',
    },
  )

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

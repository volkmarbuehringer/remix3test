import type { TDocumentDefinitions } from 'pdfmake/interfaces.js'

import { generatePdfBuffer } from './pdf-utils.ts'
import { formatUtcDateDE } from './date-utils.ts'
import type { Report1Row } from '../data/report1.ts'

const TRUNCATED_NOTE = ' — Hinweis: Ergebnis auf 10.000 Einträge begrenzt.'

interface BuildReport1PdfOptions {
  /** e.g. "September 2026". */
  periodLabel: string
  /** Active user/name filter, when the export is narrowed. */
  filterLabel?: string | undefined
  rows: Report1Row[]
  truncated?: boolean
}

function fmtHours(min: number | null): string {
  if (!min) return '—'
  return (Number(min) / 60).toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

/**
 * Build the Monatsauswertung PDF: title, period/filter subheaders, and the
 * per-user table. Mirrors the on-screen columns.
 */
export async function buildReport1Pdf(options: BuildReport1PdfOptions): Promise<Buffer> {
  let { periodLabel, filterLabel, rows, truncated = false } = options

  let content: TDocumentDefinitions['content'] = [
    { text: 'Monatsauswertung', style: 'header' },
    { text: periodLabel, style: 'subheader' },
  ]
  if (filterLabel) content.push({ text: filterLabel, style: 'subheader' })
  content.push(
    {
      text: `Insgesamt ${rows.length} Benutzer${truncated ? TRUNCATED_NOTE : ''}`,
      style: 'subheader',
      margin: [0, 0, 0, 20],
    },
    {
      table: {
        headerRows: 1,
        widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
        body: [
          [
            { text: 'Name', bold: true },
            { text: 'E-Mail', bold: true },
            { text: 'Anzahl', bold: true },
            { text: 'Erster Termin', bold: true },
            { text: 'Letzter Termin', bold: true },
            { text: 'Std. gesamt', bold: true },
            { text: 'Std. ø', bold: true },
          ],
          ...rows.map((row) => [
            row.user_name,
            row.user_email,
            String(row.appointment_count),
            formatUtcDateDE(row.min_date),
            formatUtcDateDE(row.max_date),
            fmtHours(row.total_min),
            fmtHours(row.avg_min),
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

import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { buildUserSummaryPdf } from './user-summary-pdf.ts'
import type { UserSummaryRow } from '../data/user-summary-rows.ts'

const ROWS: UserSummaryRow[] = [
  {
    user_id: 1,
    name: 'Anna Beispiel',
    email: 'anna@example.com',
    appointment_count: 3,
    total_minutes: 150,
    first_date: Date.UTC(2026, 0, 2, 10, 15),
    last_date: Date.UTC(2026, 0, 30, 9, 0),
  },
  {
    user_id: 2,
    name: null as unknown as string,
    email: 'noname@example.com',
    appointment_count: 0,
    total_minutes: 0,
    first_date: null,
    last_date: null,
  },
]

describe('buildUserSummaryPdf', () => {
  it('produces a PDF buffer for sample rows', async () => {
    let buffer = await buildUserSummaryPdf({
      title: 'Benutzer-Export',
      periodLabel: 'Zeitraum: 1. Januar 2026 \u2013 31. Januar 2026',
      countLabel: 'Insgesamt 2 Benutzer mit Terminen',
      rows: ROWS,
      truncated: true,
    })
    assert.ok(buffer.length > 0, 'buffer should not be empty')
    assert.ok(buffer.subarray(0, 4).toString('latin1').startsWith('%PDF'), 'should be a PDF')
  })

  it('works without a period label and without truncation', async () => {
    let buffer = await buildUserSummaryPdf({
      title: 'Benutzerübersicht',
      countLabel: 'Insgesamt 2 Benutzer',
      rows: ROWS,
    })
    assert.ok(buffer.length > 0)
  })
})

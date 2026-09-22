import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import type { AppointmentRow } from '../data/appointments.ts'
import { createAppointmentsIcs, icsAttachmentResponse } from './appointments-ics.ts'

const fixedNow = new Date(Date.UTC(2026, 0, 8, 12, 34, 56))

describe('createAppointmentsIcs', () => {
  it('escapes text values in calendar, event and location fields', () => {
    let ics = createAppointmentsIcs(
      [
        row({
          title: 'Beratung, Planung; Projekt A\\Neu\nNächste Zeile',
          resource_name: 'Büro, Raum 1; Ecke\nLinks',
          user_email: 'user@newapp.com',
        }),
      ],
      fixedNow,
    )

    assertIcsIncludes(ics, 'X-WR-CALNAME:Termine\r\n')
    assertIcsIncludes(ics, 'SUMMARY:Beratung\\, Planung\\; Projekt A\\\\Neu\\nNächste Zeile\r\n')
    assertIcsIncludes(ics, 'LOCATION:Büro\\, Raum 1\\; Ecke\\nLinks\r\n')
    assertIcsIncludes(ics, 'DESCRIPTION:user@newapp.com\r\n')
  })

  it('emits a floating one-off VEVENT per appointment', () => {
    let day = Date.UTC(2026, 8, 22)
    let ics = createAppointmentsIcs(
      [
        row({
          id: 7,
          title: 'Beratung',
          date: String(day),
          start_min: 9 * 60 + 5,
          end_min: 10 * 60 + 15,
        }),
      ],
      fixedNow,
    )

    assertIcsIncludes(ics, 'BEGIN:VEVENT\r\n')
    assertIcsIncludes(ics, 'UID:appointment-7@newapp\r\n')
    assertIcsIncludes(ics, 'DTSTAMP:20260108T123456Z\r\n')
    assertIcsIncludes(ics, 'SUMMARY:Beratung\r\n')
    assertIcsIncludes(ics, 'DTSTART:20260922T090500\r\n')
    assertIcsIncludes(ics, 'DTEND:20260922T101500\r\n')
    assertIcsIncludes(ics, 'END:VEVENT\r\n')
  })

  it('omits LOCATION when the appointment has no resource', () => {
    let ics = createAppointmentsIcs([row({ resource_name: null })], fixedNow)

    assert.ok(!ics.includes('LOCATION'), 'no LOCATION line for resource-less appointments')
  })

  it('folds lines longer than 75 octets without splitting code points', () => {
    let ics = createAppointmentsIcs(
      [
        row({
          title: 'A'.repeat(100),
        }),
        row({
          id: 2,
          title: 'Übung, Höhepunkt; Straße'.repeat(12), // umlauts + escapes (multi-byte UTF-8)
        }),
        row({
          id: 3,
          title: 'Termin 😀 Planung'.repeat(15), // astral code point
        }),
      ],
      fixedNow,
    )
    let lines = ics.split('\r\n')

    assert.ok(lines.includes(`SUMMARY:${'A'.repeat(67)}`))
    assert.ok(lines.includes(` ${'A'.repeat(33)}`))

    for (let line of lines) {
      if (line) {
        assert.ok(
          Buffer.byteLength(line) <= 75,
          `ICS line exceeds 75 octets: ${Buffer.byteLength(line)}`,
        )
      }
    }
  })

  it('appends a notice event when the export is truncated', () => {
    let ics = createAppointmentsIcs([row()], fixedNow, { truncated: true })

    assertIcsIncludes(ics, 'UID:appointments-export-truncated@newapp\r\n')
    assertIcsIncludes(ics, 'SUMMARY:Export auf 10.000 Termine begrenzt\r\n')
  })

  it('renders an empty list as a calendar without events', () => {
    assert.equal(
      createAppointmentsIcs([], fixedNow),
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//newapp//Appointments Export//DE',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Termine',
        'END:VCALENDAR',
      ].join('\r\n') + '\r\n',
    )
  })
})

describe('icsAttachmentResponse', () => {
  it('returns an ICS attachment response with correct headers', () => {
    let ics = createAppointmentsIcs([], fixedNow)
    let response = icsAttachmentResponse(ics, 'termine-2026-09-22.ics')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/calendar; charset=utf-8')
    assert.match(response.headers.get('Content-Disposition') ?? '', /attachment/)
    assert.match(response.headers.get('Content-Disposition') ?? '', /termine-2026-09-22\.ics/)
    assert.equal(response.headers.get('Content-Length'), String(Buffer.byteLength(ics)))
  })

  it('sends the ICS body unchanged', async () => {
    let ics = createAppointmentsIcs([row({ title: 'Beratung' })], fixedNow)
    let response = icsAttachmentResponse(ics, 'x.ics')

    assert.equal(await response.text(), ics)
  })
})

function assertIcsIncludes(ics: string, expected: string) {
  assert.ok(ics.includes(expected), `Expected ICS to include:\n${expected}`)
}

function row(overrides: Partial<AppointmentRow> = {}): AppointmentRow {
  return {
    id: 1,
    title: 'Beratung',
    user_id: 5,
    user_email: 'user@newapp.com',
    resource_id: 2,
    resource_name: 'Büro 1',
    resource_description: null,
    date: String(Date.UTC(2026, 8, 22)),
    during: '480-600',
    start_min: 480,
    end_min: 600,
    created_at: '2026-09-22T10:00:00Z',
    updated_at: '2026-09-22T10:00:00Z',
    ...overrides,
  }
}

import { SuperHeaders } from 'remix/headers'

import type { AppointmentRow } from '../data/appointments.ts'

const calendarProductId = '-//newapp//Appointments Export//DE'
const calendarName = 'Termine'

/**
 * Build an iCalendar (.ics) document from appointment rows. Each appointment
 * becomes a one-off VEVENT. DTSTART/DTEND use floating (local) date-times so a
 * calendar renders the appointment's wall-clock time regardless of the user's
 * timezone; the stored `date` is a UTC-midnight day marker and `start_min`/
 * `end_min` are minutes into that day.
 *
 * When `truncated` is set, a notice event is appended so a capped export is
 * visible in the calendar instead of silently missing rows.
 */
export function createAppointmentsIcs(
  rows: AppointmentRow[],
  now = new Date(),
  options?: { truncated?: boolean | undefined },
): string {
  let lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${calendarProductId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ]

  for (let row of rows) {
    let dateMs = Number(row.date)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(`appointment-${row.id}@newapp`)}`,
      `DTSTAMP:${formatUtcDateTime(now)}`,
      `SUMMARY:${escapeIcsText(row.title)}`,
      `DTSTART:${formatFloatingDateTime(dateMs + row.start_min * 60_000)}`,
      `DTEND:${formatFloatingDateTime(dateMs + row.end_min * 60_000)}`,
      ...(row.resource_name ? [`LOCATION:${escapeIcsText(row.resource_name)}`] : []),
      `DESCRIPTION:${escapeIcsText(row.user_email)}`,
      'END:VEVENT',
    )
  }

  if (options?.truncated) {
    lines.push(
      'BEGIN:VEVENT',
      'UID:appointments-export-truncated@newapp',
      `DTSTAMP:${formatUtcDateTime(now)}`,
      'SUMMARY:Export auf 10.000 Termine begrenzt',
      'DESCRIPTION:Es sind mehr Termine vorhanden, als exportiert wurden. Schränken Sie den Zeitraum oder die Suche ein.',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return `${foldIcsLines(lines).join('\r\n')}\r\n`
}

/**
 * Wrap an .ics document as an attachment-download Response with the standard
 * headers used by the verwaltung export routes.
 */
export function icsAttachmentResponse(ics: string, filename: string): Response {
  let headers = new SuperHeaders()
  headers.contentType = 'text/calendar; charset=utf-8'
  headers.contentDisposition = { type: 'attachment', filename }
  headers.contentLength = Buffer.byteLength(ics)
  return new Response(ics, { headers })
}

function formatFloatingDateTime(ms: number): string {
  let date = new Date(ms)
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('')
}

function formatUtcDateTime(date: Date): string {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z',
  ].join('')
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\n')
}

function foldIcsLines(lines: string[]): string[] {
  return lines.flatMap((line) => {
    // RFC 5545 limits a content line to 75 octets; a continuation line is a
    // leading space (1 octet) plus up to 74 octets of content.
    let folded: string[] = []
    let remaining = line
    let isFirst = true

    while (remaining.length > 0) {
      let budget = isFirst ? 75 : 74
      let part = sliceToBytes(remaining, budget)
      folded.push(isFirst ? part : ` ${part}`)
      remaining = remaining.slice(part.length)
      isFirst = false
    }

    return folded
  })
}

/**
 * Slice up to `maxBytes` UTF-8 octets without splitting a code point, so
 * non-ASCII text (umlauts, emoji) folds cleanly and never exceeds the limit.
 */
function sliceToBytes(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value) <= maxBytes) return value
  let bytes = 0
  let end = 0
  for (let i = 0; i < value.length;) {
    let codePoint = value.codePointAt(i)!
    let size = codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4
    if (bytes + size > maxBytes) break
    bytes += size
    i += codePoint > 0xffff ? 2 : 1
    end = i
  }
  return value.slice(0, end)
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

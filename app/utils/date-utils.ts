export const MS_PER_DAY = 86_400_000

/**
 * Check whether a UTC-midnight epoch ms value is strictly in the past
 * (before the start of today in UTC).
 */
export function isDateInPast(epochMs: number): boolean {
  let now = new Date()
  let todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return epochMs < todayUtcMidnight
}

/**
 * Check whether a timestamp is at least `hours` in the future from now.
 * Returns true if `epochMs - Date.now() >= hours * 3600000`.
 * Used for the cancellation policy — appointments can only be modified
 * if they are at least `hours` away from the current server time.
 */
export function isWithinHours(epochMs: number, hours: number): boolean {
  return epochMs - Date.now() >= hours * 3600000
}

/**
 * Returns epoch ms for today at 00:00:00 UTC.
 */
export function getTodayUtcMidnight(): number {
  let now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

/**
 * Returns epoch ms for Monday 00:00:00 UTC of the current week.
 */
export function getCurrentWeekMonday(): number {
  let now = new Date()
  let day = now.getUTCDay() || 7
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1))
}

/**
 * Formats a week_start epoch ms into "KW 25" label.
 */
export function formatWeekLabel(weekStart: number): string {
  let d = new Date(weekStart)
  let dayNum = d.getUTCDay() || 7
  let thursday = new Date(d)
  thursday.setUTCDate(d.getUTCDate() - dayNum + 4)
  let year = thursday.getUTCFullYear()
  let firstThursday = new Date(Date.UTC(year, 0, 4))
  let diff = thursday.getTime() - firstThursday.getTime()
  let weekNum = Math.ceil((diff / 86_400_000 + firstThursday.getUTCDay() + 1) / 7)
  return `KW ${weekNum}`
}

/**
 * Format an epoch ms value to German date locale, e.g. "Mo, 10.06.2026".
 * Returns an em dash for null/invalid input.
 */
export function formatDateDE(epochMs: number | null | undefined): string {
  if (epochMs == null) return '\u2014'
  let d = new Date(Number(epochMs))
  if (isNaN(d.getTime())) return '\u2014'
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Format an epoch ms value as a short UTC date, e.g. "10.06.2026".
 * Returns an em dash for null/invalid input.
 */
export function formatUtcDateDE(epochMs: number | null | undefined): string {
  if (epochMs == null) return '\u2014'
  let d = new Date(Number(epochMs))
  if (isNaN(d.getTime())) return '\u2014'
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Format a UTC-midnight epoch ms value as a long German UTC day, e.g.
 * "1. Januar 2026". Used for export period labels so the label always
 * describes the exact queried UTC window.
 */
export function formatUtcPeriodDayDE(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Parse a YYYY-MM-DD calendar date into UTC-midnight epoch ms. Returns null
 * for non-calendar dates (e.g. 2024-02-31) that would silently roll over.
 */
export function parseIsoDateUtc(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  let ms = Date.parse(value + 'T00:00:00Z')
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString().slice(0, 10) === value ? ms : null
}

export function generateMinOptions(count: number, step: number, offset = 0): number[] {
  return Array.from({ length: count }, (_, i) => (i + offset) * step)
}

export function formatMinOption(minutes: number): string {
  let h = String(Math.floor(minutes / 60)).padStart(2, '0')
  let m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

export function getPeriodRange(period: string): { startMs: number; endMs: number } | null {
  let now = new Date()

  if (period === 'today') {
    let start = getTodayUtcMidnight()
    return { startMs: start, endMs: start + 86_400_000 }
  }

  if (period === 'this-week') {
    let day = now.getUTCDay() || 7
    let monday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1)),
    )
    let nextMonday = new Date(monday)
    nextMonday.setUTCDate(monday.getUTCDate() + 7)
    return { startMs: monday.getTime(), endMs: nextMonday.getTime() }
  }

  if (period === 'next-week') {
    let day = now.getUTCDay() || 7
    let monday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (day - 1) + 7),
    )
    let nextMonday = new Date(monday)
    nextMonday.setUTCDate(monday.getUTCDate() + 7)
    return { startMs: monday.getTime(), endMs: nextMonday.getTime() }
  }

  if (period === 'this-month') {
    let firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    let firstOfNext = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    return { startMs: firstOfMonth.getTime(), endMs: firstOfNext.getTime() }
  }

  if (period === 'next-month') {
    let firstOfNext = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    let firstOfAfter = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1))
    return { startMs: firstOfNext.getTime(), endMs: firstOfAfter.getTime() }
  }

  return null
}

/**
 * Calculate the number of ISO weeks in a given year.
 * A year has 53 weeks if Jan 1 is a Thursday, or if it's a leap year and Jan 1 is a Wednesday.
 */
export function isoWeeksInYear(year: number): number {
  let jan1 = new Date(Date.UTC(year, 0, 1))
  let day = jan1.getUTCDay() || 7
  let isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return day === 4 || (isLeap && day === 3) ? 53 : 52
}

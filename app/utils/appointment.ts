/**
 * Shared appointment utility functions.
 *
 * Consolidates duplicated `readData()` and `formatDateRange()` logic
 * used by multiple appointment UI components.
 */

/**
 * Read appointment page data from the embedded JSON script tag.
 * Falls back to empty object if the element or content is missing.
 */
export function readAppointmentData(): Record<string, unknown> {
  try {
    let el = document.getElementById('appointment-data')
    if (!el) return {}
    return JSON.parse(el.textContent || '{}')
  } catch {
    return {}
  }
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/**
 * Format a date range spanning Monday to Sunday of a given ISO week.
 *
 * @param mondayMs - Epoch ms for Monday 00:00 UTC
 * @returns Formatted range like "Mar 24 – Mar 30, 2025"
 */
export function formatDateRange(mondayMs: number): string {
  if (!mondayMs) return ''
  let monday = new Date(mondayMs)
  let sunday = new Date(mondayMs + 6 * 86_400_000)
  let monStr = `${MONTHS_SHORT[monday.getUTCMonth()]} ${monday.getUTCDate()}`
  let sunStr = `${MONTHS_SHORT[sunday.getUTCMonth()]} ${sunday.getUTCDate()}, ${sunday.getUTCFullYear()}`
  return `${monStr} – ${sunStr}`
}

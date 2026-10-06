/**
 * Parsing and formatting for the Postgres `int4range` minutes-of-day values in
 * `appointments.during` / `appointoffering.during`. The driver can hand back
 * either a range object (`{ lower, upper }`) or its text form (`[start,end)`), and
 * different call sites saw different shapes; these helpers normalize both.
 */

function formatMinutes(minutes: number): string {
  let h = String(Math.floor(minutes / 60)).padStart(2, '0')
  let m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Parse a during range into `{ startMin, endMin }`, or `null` when the value is
 * not a recognised range.
 */
export function parseDuring(during: unknown): { startMin: number; endMin: number } | null {
  if (during == null) return null

  // Postgres range object format { lower, upper }.
  if (typeof during === 'object' && during !== null) {
    let r = during as { lower: unknown; upper: unknown }
    return { startMin: Number(r.lower) || 0, endMin: Number(r.upper) || 60 }
  }

  let str = String(during)

  // Standard format: "[start,end)".
  let match = str.match(/^\[(\d+),(\d+)\)$/)
  if (match) {
    return { startMin: parseInt(match[1]!, 10), endMin: parseInt(match[2]!, 10) }
  }
  // Fallback: two numbers separated by a comma inside brackets.
  let fallback = str.match(/\[(\d+)\s*,\s*(\d+)/)
  if (fallback) {
    return { startMin: parseInt(fallback[1]!, 10), endMin: parseInt(fallback[2]!, 10) }
  }
  return null
}

/** Format a during range as `HH:MM–HH:MM`; falls back to `String(during)`. */
export function formatDuring(during: unknown): string {
  let parsed = parseDuring(during)
  if (!parsed) return String(during)
  return `${formatMinutes(parsed.startMin)}–${formatMinutes(parsed.endMin)}`
}

/**
 * Normalize a driver range object to the app's `[start,end)` text form.
 * Returns `undefined` when the value is not a range object.
 */
export function formatDuringRange(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  let r = value as { lower?: unknown; upper?: unknown }
  if (r.lower === undefined || r.upper === undefined) return undefined
  return `[${r.lower},${r.upper})`
}

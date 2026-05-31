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

export function formatMinOption(minutes: number): string {
  let h = String(Math.floor(minutes / 60)).padStart(2, '0')
  let m = String(minutes % 60).padStart(2, '0')
  return `${h}:${m}`
}



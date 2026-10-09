/** Lowest value the "Einträge pro Seite" slider can save. */
export const PAGE_SIZE_MIN = 5

/** Highest value the "Einträge pro Seite" slider can save. */
export const PAGE_SIZE_MAX = 100

/** Shown when the user has not chosen a page size. */
export const PAGE_SIZE_DEFAULT = 15

/**
 * True when `value` can be stored as a session page-size preference. The
 * Settings control is a slider, so any whole number in
 * [PAGE_SIZE_MIN, PAGE_SIZE_MAX] is allowed — not just a preset list.
 */
export function isValidPageSize(value: number): boolean {
  return Number.isInteger(value) && value >= PAGE_SIZE_MIN && value <= PAGE_SIZE_MAX
}

export function getPageSize(
  session: { get: (key: string) => unknown } | null | undefined,
  defaultSize: number,
): number {
  if (!session) return defaultSize
  let override = session.get('pageSize')
  if (typeof override === 'number' && isValidPageSize(override)) {
    return override
  }
  return defaultSize
}

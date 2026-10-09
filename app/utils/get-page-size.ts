/** Lowest value the "Einträge pro Seite" slider can save. */
export const PAGE_SIZE_MIN = 5

/** Highest value the "Einträge pro Seite" slider can save. */
export const PAGE_SIZE_MAX = 100

/** Shown when the user has not chosen a page size. */
export const PAGE_SIZE_DEFAULT = 15

/**
 * Stable keys for the per-page page-size overrides. Each key names one grid and
 * mirrors the route key path it belongs to.
 */
export const PAGE_SIZE_KEYS = {
  notifications: 'notifications',
  verwaltungOfferings: 'verwaltung.offerings',
  verwaltungAppointments: 'verwaltung.appointments',
  verwaltungResources: 'verwaltung.resources',
  verwaltungOfferingConfigs: 'verwaltung.offering-configs',
  verwaltungReport1: 'verwaltung.report1',
} as const

export type PageSizeKey = (typeof PAGE_SIZE_KEYS)[keyof typeof PAGE_SIZE_KEYS]

/** True when `value` is a registered page key (guards the untrusted form field). */
export function isPageSizeKey(value: string): value is PageSizeKey {
  return Object.values(PAGE_SIZE_KEYS).includes(value as PageSizeKey)
}

/** Session value shape for the override map. */
type PageSizeOverrides = Partial<Record<PageSizeKey, number>>

/** The minimal session surface the readers need. */
interface ReadableSession {
  get: (key: string) => unknown
}

/** The minimal session surface the writers need. */
interface WritableSession extends ReadableSession {
  set: (key: string, value: unknown) => void
}

/**
 * True when `value` can be stored as a page-size preference. The Settings
 * control is a slider, so any whole number in [PAGE_SIZE_MIN, PAGE_SIZE_MAX] is
 * allowed — not just a preset list.
 */
export function isValidPageSize(value: number): boolean {
  return Number.isInteger(value) && value >= PAGE_SIZE_MIN && value <= PAGE_SIZE_MAX
}

function readOverrides(session: ReadableSession): PageSizeOverrides {
  let raw = session.get('pageSizes')
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return raw as PageSizeOverrides
}

/**
 * The override saved for `pageKey`, or `null` when that grid has none and
 * therefore falls back to the global default.
 */
export function getPageSizeOverride(
  session: ReadableSession | null | undefined,
  pageKey: PageSizeKey,
): number | null {
  if (!session) return null
  let value = readOverrides(session)[pageKey]
  return typeof value === 'number' && isValidPageSize(value) ? value : null
}

/**
 * Resolve the page size for a grid: an explicit per-page override first, then
 * the global default, then the caller's fallback (the value shown when the user
 * has never chosen one and the route has no saved setting).
 */
export function getPageSize(
  session: ReadableSession | null | undefined,
  defaultSize: number,
  pageKey?: PageSizeKey,
): number {
  if (!session) return defaultSize

  if (pageKey) {
    let override = getPageSizeOverride(session, pageKey)
    if (override != null) return override
  }

  let global = session.get('pageSize')
  if (typeof global === 'number' && isValidPageSize(global)) {
    return global
  }
  return defaultSize
}

/**
 * Save a per-page override (or the global default when `pageKey` is omitted).
 *
 * The overrides map is always replaced rather than mutated: the session is only
 * marked dirty by `set`, and it serializes the value passed to `set`.
 * Returns `false` when `value` is not a valid page size.
 */
export function setPageSize(
  session: WritableSession,
  value: number,
  pageKey?: PageSizeKey,
): boolean {
  if (!isValidPageSize(value)) return false

  if (!pageKey) {
    session.set('pageSize', value)
    return true
  }

  session.set('pageSizes', { ...readOverrides(session), [pageKey]: value })
  return true
}

/** Remove a per-page override so the grid falls back to the global default. */
export function clearPageSize(session: WritableSession, pageKey: PageSizeKey): void {
  let next = { ...readOverrides(session) }
  delete next[pageKey]
  session.set('pageSizes', next)
}

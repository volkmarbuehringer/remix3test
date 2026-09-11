/**
 * Which surface a chatlog thread belongs to.
 *
 * Every conversation the app stores — customer `/chat` and admin
 * `/admin/support-agent` — lands in the same Mastra thread store and is only
 * distinguished by `mastra_threads.resourceId`. The chatlog used to ignore that
 * column entirely, so 300+ threads from retired agent routes and deleted users
 * were mixed into one list with no way to tell them apart (or to find the
 * admin's own support conversations).
 *
 * Classification is derived, not stored: no schema change and no backfill.
 */

export type ChatlogSource = 'support' | 'customer' | 'legacy'

/** Filter value accepted by `/admin/chatlog`; `all` keeps every source. */
export type ChatlogSourceFilter = 'all' | ChatlogSource

const NUMERIC_RESOURCE = /^\d+$/

export const CHATLOG_SOURCE_FILTERS: readonly ChatlogSourceFilter[] = [
  'all',
  'support',
  'customer',
  'legacy',
]

export const CHATLOG_SOURCE_LABELS: Record<ChatlogSourceFilter, string> = {
  all: 'Alle',
  support: 'Support',
  customer: 'Kunden',
  legacy: 'Sonstige',
}

/**
 * Parses the `source` query parameter, defaulting to `all`.
 *
 * An unknown value is treated as `all` rather than as an error, matching how the
 * other admin grids fall back for an unrecognised filter.
 */
export function parseSourceFilter(raw: string | null | undefined): ChatlogSourceFilter {
  return raw && (CHATLOG_SOURCE_FILTERS as readonly string[]).includes(raw)
    ? (raw as ChatlogSourceFilter)
    : 'all'
}

/**
 * Classifies a thread by its owning resource id, for a specific admin.
 *
 * - `support` — the resource is this admin's own user id (that is how
 *   `/admin/support-agent` scopes its threads)
 * - `customer` — any other numeric id: a customer's `/chat` thread
 * - `legacy` — a non-numeric placeholder (`route-user`, `test-user`,
 *   `customer-agent`, …) written by routes that no longer exist
 */
export function classifyThreadSourceFor(
  resourceId: string,
  adminUserId: number | undefined,
): ChatlogSource {
  if (NUMERIC_RESOURCE.test(resourceId)) {
    return adminUserId !== undefined && resourceId === String(adminUserId) ? 'support' : 'customer'
  }
  return 'legacy'
}

/** Counts threads per filter value, for the filter bar labels. */
export function countThreadsBySource(
  threads: readonly { resourceId: string }[],
  adminUserId: number | undefined,
): Record<ChatlogSourceFilter, number> {
  let counts: Record<ChatlogSourceFilter, number> = {
    all: threads.length,
    support: 0,
    customer: 0,
    legacy: 0,
  }
  for (let thread of threads) {
    counts[classifyThreadSourceFor(thread.resourceId, adminUserId)]++
  }
  return counts
}

/** Whether a thread matches the active source filter. */
export function matchesSourceFilter(
  resourceId: string,
  adminUserId: number | undefined,
  filter: ChatlogSourceFilter,
): boolean {
  return filter === 'all' || classifyThreadSourceFor(resourceId, adminUserId) === filter
}

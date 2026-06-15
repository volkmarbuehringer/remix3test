export const VALID_PAGE_SIZES = [10, 15, 20, 25, 50, 100] as const

export type PageSize = (typeof VALID_PAGE_SIZES)[number]

export function getPageSize(session: { get: (key: string) => unknown } | null | undefined, defaultSize: number): number {
  if (!session) return defaultSize
  let override = session.get('pageSize')
  if (typeof override === 'number' && (VALID_PAGE_SIZES as readonly number[]).includes(override)) {
    return override
  }
  return defaultSize
}

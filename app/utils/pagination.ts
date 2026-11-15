import type { Database, WhereInput } from 'remix/data-table'

interface PaginateOptions {
  pageSize: number
  page: number
  orderBy: [string, 'asc' | 'desc'][]
  where?: WhereInput | undefined
}

interface PaginateResult<Row> {
  items: Row[]
  page: number
  hasMore: boolean
}

export async function paginate<Row = Record<string, unknown>>(
  db: Database,
  table: Parameters<Database['findMany']>[0],
  options: PaginateOptions,
): Promise<PaginateResult<Row>> {
  let { pageSize, page, orderBy, where } = options
  // Defensive: a caller that computed `page` from an untrusted value could
  // otherwise hand `findMany` a bigint-overflowing OFFSET. The controllers
  // validate first; this keeps a future caller from reintroducing the 500.
  let safePage = Number.isSafeInteger(page) && page > 0 ? page : 1
  let safePageSize = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : 1
  let rawOffset = (safePage - 1) * safePageSize
  let offset = Number.isSafeInteger(rawOffset) ? rawOffset : 0

  let allItems = (await db.findMany(table, {
    limit: safePageSize + 1,
    offset,
    orderBy: orderBy as never,
    ...(where ? { where } : {}),
  })) as Row[]

  let hasMore = allItems.length > safePageSize
  let items = hasMore ? allItems.slice(0, safePageSize) : allItems

  return { items, page: safePage, hasMore }
}

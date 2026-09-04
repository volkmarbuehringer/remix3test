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
  let offset = (page - 1) * pageSize

  let allItems = (await db.findMany(table, {
    limit: pageSize + 1,
    offset,
    orderBy: orderBy as never,
    ...(where ? { where } : {}),
  })) as Row[]

  let hasMore = allItems.length > pageSize
  let items = hasMore ? allItems.slice(0, pageSize) : allItems

  return { items, page, hasMore }
}

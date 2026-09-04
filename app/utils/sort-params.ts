interface SortResult {
  column: string
  direction: 'asc' | 'desc'
}

interface ParseSortOptions {
  allowedColumns: readonly string[]
  defaultColumn?: string
  defaultDirection?: 'asc' | 'desc'
}

export function parseSort(url: URL, options: ParseSortOptions): SortResult {
  let { allowedColumns, defaultColumn = allowedColumns[0]!, defaultDirection = 'asc' } = options

  let sortParam = url.searchParams.get('sort')
  let orderParam = url.searchParams.get('order')

  let column = defaultColumn
  if (sortParam && allowedColumns.includes(sortParam)) {
    column = sortParam
  }

  let direction: 'asc' | 'desc' = defaultDirection
  if (orderParam === 'asc' || orderParam === 'desc') {
    direction = orderParam
  }

  return { column, direction }
}

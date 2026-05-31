export function sortArrow(field: string, sortField: string, sortOrder: 'asc' | 'desc'): string {
  if (field !== sortField) return '\u2195'
  return sortOrder === 'asc' ? '\u2191' : '\u2193'
}

export function buildSortUrl(
  base: string,
  field: string,
  currentSort: string,
  currentOrder: 'asc' | 'desc',
  offset: number,
  filter?: string,
): string {
  let newOrder = field === currentSort ? (currentOrder === 'asc' ? 'desc' : 'asc') : 'asc'
  let params = new URLSearchParams()
  params.set('offset', '0')
  params.set('sort', field)
  params.set('order', newOrder)
  if (filter) params.set('filter', filter)
  return `${base}?${params.toString()}`
}

export function buildPaginationUrl(
  base: string,
  newOffset: number,
  sort: string,
  order: 'asc' | 'desc',
  filter?: string,
): string {
  let params = new URLSearchParams()
  params.set('offset', String(newOffset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return `${base}?${params.toString()}`
}

export function buildCreateUrl(
  base: string,
  offset: number,
  sort: string,
  order: string,
  filter?: string,
): string {
  let params = new URLSearchParams()
  params.set('creating', 'true')
  if (offset > 0) params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return `${base}?${params.toString()}`
}

export function buildEditUrl(
  base: string,
  id: string | number,
  offset: number,
  sort: string,
  order: string,
  filter?: string,
): string {
  let params = new URLSearchParams()
  params.set('editing', String(id))
  params.set('offset', String(offset))
  params.set('sort', sort)
  params.set('order', order)
  if (filter) params.set('filter', filter)
  return `${base}?${params.toString()}`
}

export function formatTimestamp(ts: number | string | null | undefined): string {
  if (ts == null) return '\u2014'
  return new Date(Number(ts)).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

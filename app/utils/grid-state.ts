import { redirect } from 'remix/response/redirect'

export interface GridState {
  offset: string
  sort: string
  order: string
  filter: string
  period?: string | undefined
  status?: string | undefined
}

export function gridStateFromURL(url: URL): GridState {
  return {
    offset: url.searchParams.get('offset') || '',
    sort: url.searchParams.get('sort') || '',
    order: url.searchParams.get('order') || '',
    filter: url.searchParams.get('filter') || '',
    period: url.searchParams.get('period') || '',
    status: url.searchParams.get('status') || '',
  }
}

export function gridStateFromForm(parsed: Record<string, string>): GridState {
  return {
    offset: parsed._offset || '',
    sort: parsed._sort || '',
    order: parsed._order || '',
    filter: parsed._filter || '',
    period: parsed._period || '',
    status: parsed._status || '',
  }
}

export function gridStateFromFormData(formData: FormData): GridState {
  return {
    offset: (formData.get('_offset') as string) ?? '',
    sort: (formData.get('_sort') as string) ?? '',
    order: (formData.get('_order') as string) ?? '',
    filter: (formData.get('_filter') as string) ?? '',
    period: (formData.get('_period') as string) ?? '',
    status: (formData.get('_status') as string) ?? '',
  }
}

export function gridStateToParams(state: GridState): URLSearchParams {
  let params = new URLSearchParams()
  if (state.offset) params.set('offset', state.offset)
  if (state.sort) params.set('sort', state.sort)
  if (state.order) params.set('order', state.order)
  if (state.filter) params.set('filter', state.filter)
  if (state.period) params.set('period', state.period)
  if (state.status) params.set('status', state.status)
  return params
}

export function editingRedirect(
  base: string,
  editingId: number | string | null,
  state: GridState,
): Response {
  let params = gridStateToParams(state)
  if (editingId != null) {
    params.set('editing', String(editingId))
  }
  let qs = params.toString()
  let url = base + (qs ? '?' + qs : '')
  return redirect(url)
}

export function gridStateOffset(state: GridState): number | undefined {
  let n = Number(state.offset)
  return n > 0 ? n : undefined
}

export function gridStateSort(state: GridState): string | undefined {
  return state.sort || undefined
}

export function gridStateDirection(state: GridState): 'asc' | 'desc' | undefined {
  // Whitelist instead of casting: hidden grid-state fields are client-supplied, and an
  // invalid value must fall back to the caller's default rather than reach a raw-SQL
  // ORDER BY compiler (which throws on anything that is not asc/desc).
  return state.order === 'asc' || state.order === 'desc' ? state.order : undefined
}

export function gridStateFilter(state: GridState): string | undefined {
  return state.filter || undefined
}

export function gridStatePeriod(state: GridState): string | undefined {
  return state.period || undefined
}

export function gridStateStatus(state: GridState): string | undefined {
  return state.status || undefined
}

/** The loader overrides derived from submitted grid-state form fields. */
export interface GridStateOverrides {
  offset: number | undefined
  sortColumn: string | undefined
  sortDirection: 'asc' | 'desc' | undefined
  filter: string | undefined
  period: string | undefined
  status: string | undefined
}

/**
 * Build the `offset`/`sortColumn`/`sortDirection`/`filter`/`period`/`status` overrides that
 * grid page-data loaders accept from submitted grid-state form fields.
 *
 * Controllers re-render a page after a validation or constraint error, and every branch needs
 * the same six values; building them once keeps those branches to a single spread and routes
 * the direction through the one whitelist in {@link gridStateDirection}. Values are
 * `| undefined`-friendly for `exactOptionalPropertyTypes`.
 */
export function gridStateOverrides(state: GridState): GridStateOverrides {
  return {
    offset: gridStateOffset(state),
    sortColumn: gridStateSort(state),
    sortDirection: gridStateDirection(state),
    filter: gridStateFilter(state),
    period: gridStatePeriod(state),
    status: gridStateStatus(state),
  }
}

import { redirect } from 'remix/response/redirect'

export interface GridState {
  offset: string
  sort: string
  order: string
  filter: string
  period?: string
  status?: string
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
  editingId: number | null,
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
  return (state.order as 'asc' | 'desc') || undefined
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

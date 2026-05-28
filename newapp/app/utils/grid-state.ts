export interface GridState {
  offset: string
  sort: string
  order: string
  filter: string
}

export function gridStateFromURL(url: URL): GridState {
  return {
    offset: url.searchParams.get('offset') || '',
    sort: url.searchParams.get('sort') || '',
    order: url.searchParams.get('order') || '',
    filter: url.searchParams.get('filter') || '',
  }
}

export function gridStateFromForm(parsed: Record<string, string>): GridState {
  return {
    offset: parsed._offset || '',
    sort: parsed._sort || '',
    order: parsed._order || '',
    filter: parsed._filter || '',
  }
}

export function gridStateFromFormData(formData: FormData): GridState {
  return {
    offset: (formData.get('_offset') as string) ?? '',
    sort: (formData.get('_sort') as string) ?? '',
    order: (formData.get('_order') as string) ?? '',
    filter: (formData.get('_filter') as string) ?? '',
  }
}

export function gridStateToParams(state: GridState): URLSearchParams {
  let params = new URLSearchParams()
  if (state.offset) params.set('offset', state.offset)
  if (state.sort) params.set('sort', state.sort)
  if (state.order) params.set('order', state.order)
  if (state.filter) params.set('filter', state.filter)
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
  return new Response(null, { status: 302, headers: { Location: url } })
}

import type { SortMode, StatusFilter } from './lists-state.ts'

/**
 * Query-parameter names that carry the editor's view controls into a PDF
 * download. The editor builds them and the PDF route parses them, so both
 * sides share this contract.
 */
export const LIST_VIEW_PARAMS = {
  query: 'q',
  status: 'status',
  hideDone: 'hideDone',
  sort: 'sort',
  reverse: 'reverse',
} as const

/** The editor's view-only controls as a plain data value. */
export type ListViewState = {
  query: string
  status: StatusFilter
  hideDone: boolean
  sort: SortMode
  reverse: boolean
}

/** Serialize the non-default view controls as download query parameters. */
export function listViewSearchParams(view: ListViewState): URLSearchParams {
  let params = new URLSearchParams()
  let query = view.query.trim()
  if (query) params.set(LIST_VIEW_PARAMS.query, query)
  if (view.status !== 'all') params.set(LIST_VIEW_PARAMS.status, view.status)
  if (view.hideDone) params.set(LIST_VIEW_PARAMS.hideDone, '1')
  if (view.sort !== 'manual') params.set(LIST_VIEW_PARAMS.sort, view.sort)
  if (view.reverse) params.set(LIST_VIEW_PARAMS.reverse, '1')
  return params
}

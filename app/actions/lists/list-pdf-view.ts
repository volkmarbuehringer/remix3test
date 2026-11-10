import {
  buildVisibleItems,
  sortModeLabel,
  statusFilterLabel,
  type ListItem,
  type SortMode,
  type StatusFilter,
} from './public/lists-state.ts'
import { LIST_VIEW_PARAMS, type ListViewState } from './public/lists-view-params.ts'

const STATUS_FILTERS: ReadonlySet<string> = new Set<StatusFilter>([
  'all',
  'open',
  'done',
  'overdue',
])
const SORT_MODES: ReadonlySet<string> = new Set<SortMode>([
  'manual',
  'az',
  'done',
  'due',
  'updated',
])

/**
 * Parse the editor's view controls from a PDF download URL. Unknown or
 * hand-edited values fall back to the defaults instead of failing the
 * download; the text filter is capped like the sidebar's filter query.
 */
export function parseListPdfView(searchParams: URLSearchParams): ListViewState {
  let status = searchParams.get(LIST_VIEW_PARAMS.status) ?? 'all'
  let sort = searchParams.get(LIST_VIEW_PARAMS.sort) ?? 'manual'
  return {
    query: (searchParams.get(LIST_VIEW_PARAMS.query) ?? '').trim().slice(0, 200),
    status: STATUS_FILTERS.has(status) ? (status as StatusFilter) : 'all',
    hideDone: searchParams.get(LIST_VIEW_PARAMS.hideDone) === '1',
    sort: SORT_MODES.has(sort) ? (sort as SortMode) : 'manual',
    reverse: searchParams.get(LIST_VIEW_PARAMS.reverse) === '1',
  }
}

/**
 * One self-describing line for the PDF so a filtered export never reads like
 * the whole list. Defaults are omitted; `hideDone` only narrows the "all" tab,
 * so it is not repeated when a concrete status already excludes done items.
 */
export function listPdfViewLabel(view: ListViewState): string | undefined {
  let parts: string[] = []
  if (view.status !== 'all') parts.push(`Status ${statusFilterLabel(view.status)}`)
  else if (view.hideDone) parts.push('Erledigte ausgeblendet')
  if (view.sort !== 'manual') parts.push(sortModeLabel(view.sort))
  if (view.reverse) parts.push('umgekehrt')
  if (view.query) parts.push(`Suche „${view.query}“`)
  return parts.length > 0 ? `Ansicht: ${parts.join(' · ')}` : undefined
}

/** Select and order exactly the rows the editor shows for this view. */
export function selectListPdfItems(
  items: ListItem[],
  view: ListViewState,
  nowMs?: number,
): ListItem[] {
  return buildVisibleItems(items, view, nowMs)
}

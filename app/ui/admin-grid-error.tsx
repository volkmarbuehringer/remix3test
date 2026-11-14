import type { RemixNode } from 'remix/component'

import { renderAdminPage } from './admin-layout.tsx'
import type { PageSizeKey } from '../utils/get-page-size.ts'

/**
 * Grid-state and validation-error metadata carried on a controlled-submission error re-render.
 *
 * A validation failure is a client error: the helper renders the page fragment with the
 * submitted values and per-field errors at status 400 (guide 09 "Return validation failures
 * with the form"). The frame transport renders HTML 4xx bodies, so the fragment still swaps
 * into the frame instead of becoming an error card.
 */
export interface AdminGridErrorState {
  offset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter?: string | undefined
  status?: string | undefined
  pageSize: number
  pageKey: PageSizeKey
  pageSizeOverride: number | null
}

interface AdminGridErrorPage<Row> extends AdminGridErrorState {
  rows: Row[]
  hasMore: boolean
  total?: number | undefined
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
}

type RenderFn = Parameters<typeof renderAdminPage>[0]
type ActiveItem = Parameters<typeof renderAdminPage>[1]

/**
 * Re-render an admin grid page with a validation error (Pattern 1 direct re-render).
 *
 * `loadRows` supplies the paginated grid rows for the current grid state; `buildPage`
 * turns those rows plus the error metadata into the page component. The result is
 * rendered at status 400 so the swapped-in frame content carries the inline errors and
 * preserved values (a no-JS submission renders the same errors in the full page).
 */
export async function renderGridFormError<Row>(opts: {
  render: RenderFn
  activeItem: ActiveItem
  loadRows: () => Promise<{ rows: Row[]; hasMore: boolean; total?: number | undefined }>
  buildPage: (page: AdminGridErrorPage<Row>) => RemixNode
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
  /** Keep a bounded grid page full-height on the error re-render too. */
  fullHeight?: boolean | undefined
  grid: AdminGridErrorState
  /** Response status; defaults to 400 (validation). Pass 429/409/404 when the caller knows better. */
  status?: number | undefined
}): Promise<Response> {
  let { render, activeItem, loadRows, buildPage, grid } = opts
  let { rows, hasMore, total } = await loadRows()

  return renderAdminPage(
    render,
    activeItem,
    buildPage({
      rows,
      hasMore,
      total,
      formValues: opts.formValues,
      fieldErrors: opts.fieldErrors,
      formError: opts.formError,
      offset: grid.offset,
      sortColumn: grid.sortColumn,
      sortDirection: grid.sortDirection,
      filter: grid.filter,
      status: grid.status,
      pageSize: grid.pageSize,
      pageKey: grid.pageKey,
      pageSizeOverride: grid.pageSizeOverride,
    }),
    { status: opts.status ?? 400, fullHeight: opts.fullHeight },
  )
}

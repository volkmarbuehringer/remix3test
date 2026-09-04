import type { RemixNode } from 'remix/ui'

import { renderAdminPage } from './admin-layout.tsx'

/**
 * Grid-state and validation-error metadata carried on a controlled-submission error re-render.
 *
 * The frame transport treats any non-OK response as an unrecoverable error card,
 * so a validation-error re-render MUST be a 200. This helper centralizes that
 * contract: it loads the grid rows, renders the page fragment with the submitted
 * values and per-field errors, and returns it as `renderAdminPage(..., { status: 200 })`.
 */
export interface AdminGridErrorState {
  offset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter?: string | undefined
  pageSize: number
}

export interface AdminGridErrorPage<Row> extends AdminGridErrorState {
  rows: Row[]
  hasMore: boolean
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
 * always rendered at status 200 so the swapped-in frame content shows the inline
 * errors and preserved values instead of an error card.
 */
export async function renderGridFormError<Row>(opts: {
  render: RenderFn
  activeItem: ActiveItem
  loadRows: () => Promise<{ rows: Row[]; hasMore: boolean }>
  buildPage: (page: AdminGridErrorPage<Row>) => RemixNode
  formValues?: Record<string, string> | undefined
  fieldErrors?: Record<string, string> | undefined
  formError?: string | undefined
  grid: AdminGridErrorState
}): Promise<Response> {
  let { render, activeItem, loadRows, buildPage, grid } = opts
  let { rows, hasMore } = await loadRows()

  return renderAdminPage(
    render,
    activeItem,
    buildPage({
      rows,
      hasMore,
      formValues: opts.formValues,
      fieldErrors: opts.fieldErrors,
      formError: opts.formError,
      offset: grid.offset,
      sortColumn: grid.sortColumn,
      sortDirection: grid.sortDirection,
      filter: grid.filter,
      pageSize: grid.pageSize,
    }),
    { status: 200 },
  )
}

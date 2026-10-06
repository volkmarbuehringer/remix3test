import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

/**
 * Shared parsers for the hidden `_offset` / `_sort` / `_order` / `_filter`
 * grid-state fields that data-grid pages round-trip through their forms.
 *
 * Each grid whitelists its own sortable columns and default order, so the
 * column/direction helpers take those as arguments. The column test is the
 * load-bearing one: the value lands in ORDER BY, so it must be checked against
 * the grid's own set rather than trusted.
 */

/** Clamp the hidden `_offset` field to a non-negative integer. */
export function gridOffset(raw: Record<string, string>): number {
  return Math.max(0, Number(raw._offset) || 0)
}

/** The hidden `_filter` field, or `undefined` when empty. */
export function gridFilter(raw: Record<string, string>): string | undefined {
  return raw._filter || undefined
}

/**
 * Whitelist the submitted `_sort` column against the grid's sortable set,
 * falling back to `fallback` when absent or unrecognized so the value can
 * never reach the SQL builder unchecked.
 */
export function gridSortColumn(
  raw: Record<string, string>,
  sortableFields: readonly string[],
  fallback: string,
): string {
  let col = raw._sort
  return col && sortableFields.includes(col) ? col : fallback
}

/**
 * The submitted `_order`, defaulting to `direction` when absent or invalid.
 * Grids that list newest first pass `'desc'`; every other grid keeps the
 * historical ascending default.
 */
export function gridSortDirection(
  raw: Record<string, string>,
  direction: 'asc' | 'desc' = 'asc',
): 'asc' | 'desc' {
  return raw._order === 'asc' || raw._order === 'desc' ? raw._order : direction
}

/**
 * The hidden grid-state fields every data-grid form round-trips so paging,
 * sorting and filtering survive a submit. Spread into a form-data object.
 */
export const gridQueryFields = {
  _offset: f.field(s.defaulted(s.string(), '')),
  _sort: f.field(s.defaulted(s.string(), '')),
  _order: f.field(s.defaulted(s.string(), '')),
  _filter: f.field(s.defaulted(s.string(), '')),
  _period: f.field(s.defaulted(s.string(), '')),
}

/** The optional `_status` filter, used only by grids that have a status column. */
export const gridStatusField = {
  _status: f.field(s.defaulted(s.string(), '')),
}

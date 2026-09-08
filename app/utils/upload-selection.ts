/**
 * Client-side, cross-page selection store for the uploads grid.
 *
 * The bulk delete / bulk download clientEntries read the checked row checkboxes
 * live from the DOM, but that only covers the rows on the current page. This
 * module keeps a shared, id-based Set of the selected uploads so a selection
 * survives page changes (the admin uploads grid paginates via frame SPA
 * navigation, so the module stays alive) and is honoured by both bulk actions.
 *
 * The Set is scoped by a key derived from the active search filter: changing the
 * filter starts a fresh selection, which keeps the behaviour predictable instead
 * of silently carrying ids the user can no longer see.
 *
 * This is an intentionally small, non-persistent store (no localStorage) — a
 * full reload of the frame starts a clean selection, matching what users expect
 * from a paged grid.
 */
let scopeKey = ''
let selected = new Set<number>()

/** Reset the selection when the active scope (filter) changes. */
export function ensureSelectionScope(key: string): void {
  if (key !== scopeKey) {
    scopeKey = key
    selected = new Set<number>()
  }
}

export function isSelected(id: number): boolean {
  return selected.has(id)
}

export function selectIds(ids: number[]): void {
  for (let id of ids) selected.add(id)
}

export function deselectIds(ids: number[]): void {
  for (let id of ids) selected.delete(id)
}

export function selectedIds(): number[] {
  return [...selected]
}

export function selectedCount(): number {
  return selected.size
}

export function clearSelection(): void {
  selected = new Set<number>()
}

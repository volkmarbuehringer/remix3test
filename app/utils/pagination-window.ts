/**
 * Compact page window for a pagination bar: every page for short result sets,
 * otherwise the first and last page plus the current page's neighbours, with
 * `'gap'` marking an omitted run.
 *
 * Shared by the admin grids so numbered pagination stays consistent and the
 * window math only lives in one place.
 */
export function paginationWindow(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
  let pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .toSorted((a, b) => a - b)
  let window: (number | 'gap')[] = []
  let previous = 0
  for (let candidate of pages) {
    if (previous !== 0 && candidate - previous > 1) window.push('gap')
    window.push(candidate)
    previous = candidate
  }
  return window
}

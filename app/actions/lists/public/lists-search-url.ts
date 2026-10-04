/**
 * Build the frame URL for the sidebar search: `/lists?filter=<value>&load=<id>`.
 *
 * `load` comes from the current frame src when present (an opened list), and
 * otherwise from the active id the editor rendered — a list opened by the
 * "most recent" rule has no load param, and typing a search must not swap it
 * for the new-list form. A blank/whitespace filter drops the filter param, and
 * every other query param is discarded (the search owns the URL).
 */
export function buildListsSearchHref(
  src: string,
  activeListId: string | null,
  value: string,
): string {
  let load = new URL(src, 'http://localhost').searchParams.get('load') ?? activeListId
  let params = new URLSearchParams()
  let filter = value.trim()
  if (filter) params.set('filter', filter)
  if (load) params.set('load', load)
  return '/lists' + (params.toString() ? '?' + params.toString() : '')
}

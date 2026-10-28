import { routes } from '../routes.ts'

/**
 * Grid URL for `/admin/messages` that omits the defaults, so paging and
 * resetting keep a clean link while a filtered or re-sorted view survives.
 *
 * Shared by the page (links) and the controller (post-send/post-delete
 * redirects) so both sides can never disagree about which state is "default".
 */
export function messagesGridHref(
  offset: number,
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  filter?: string | undefined,
): string {
  let params = new URLSearchParams()
  if (offset > 0) params.set('offset', String(offset))
  if (sortColumn !== 'created_at') params.set('sort', sortColumn)
  if (sortDirection !== 'desc') params.set('order', sortDirection)
  if (filter) params.set('filter', filter)
  let qs = params.toString()
  return routes.admin.messages.index.href() + (qs ? '?' + qs : '')
}

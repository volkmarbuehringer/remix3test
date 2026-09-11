import type { ChatlogSourceFilter } from '../data/chatlog-sources.ts'

/**
 * Builds the chatlog list query string, carrying the active source filter
 * wherever the grid state is preserved (pagination, transcript frame, delete).
 *
 * Kept as a pure helper so the controller's redirects and the page's links
 * cannot drift on which parameters the grid state consists of.
 */
export function chatlogQuery(offset: number, source: ChatlogSourceFilter): string {
  let params = new URLSearchParams()
  if (offset > 0) params.set('offset', String(offset))
  if (source !== 'all') params.set('source', source)
  let query = params.toString()
  return query ? '?' + query : ''
}

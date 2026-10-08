import type { Handle } from 'remix/component'

import { getCspNonce } from '../middleware/security-headers.ts'

interface GridStateScriptProps {
  /** DOM id the row context menu reads via `navigateGridParam`. */
  id: string
  /** Base href the row menu's edit/config action navigates to. */
  baseHref: string
  offset: number | string
  sort: string
  order: string
  filter?: string | undefined
  period?: string | undefined
  status?: string | undefined
}

/**
 * Serialize a grid page's state into the JSON blob its row context menu reads.
 * Centralizes the blob shape so a page and the menu that consumes it cannot
 * drift apart.
 *
 * WARNING: only serialize server-controlled data — user-provided values MUST be
 * escaped to prevent a `</script>` breakout.
 */
export function GridStateScript(handle: Handle<GridStateScriptProps>) {
  return () => {
    let { id, baseHref, offset, sort, order, filter, period, status } = handle.props
    return (
      <script id={id} type="application/json" nonce={getCspNonce()}>
        {JSON.stringify({
          offset: String(offset),
          sort,
          order,
          filter: filter ?? '',
          period: period ?? '',
          status: status ?? '',
          baseHref,
        })}
      </script>
    )
  }
}

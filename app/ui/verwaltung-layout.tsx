import type { RemixNode } from 'remix/ui'
import { getContext } from 'remix/middleware/async-context'

import { Layout } from './layout.tsx'

const FRAME_TARGETS = new Set(['admin-content', 'lists-content'])

export function renderVerwaltungPage(
  render: (node: RemixNode, init?: ResponseInit) => Response,
  content: RemixNode,
  init?: ResponseInit,
) {
  let isFrame = false
  try {
    let target = getContext().request.headers.get('X-Remix-Target')
    isFrame = target != null && FRAME_TARGETS.has(target)
  } catch {
    /* no request context */
  }
  if (isFrame) {
    return render(content, init)
  }
  return render(<Layout>{content}</Layout>, init)
}

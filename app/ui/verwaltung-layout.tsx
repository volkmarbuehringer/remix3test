import type { RemixNode } from 'remix/ui'

import { Layout } from './layout.tsx'

export function renderVerwaltungPage(
  render: (node: RemixNode, init?: ResponseInit) => Response,
  content: RemixNode,
  init?: ResponseInit,
) {
  return render(<Layout>{content}</Layout>, init)
}

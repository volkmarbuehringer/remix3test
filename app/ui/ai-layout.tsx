import type { RemixNode } from 'remix/ui'
import { Glyph } from 'remix/ui/glyph'

import { routes, frames } from '../routes.ts'
import { createSidebarLayout, type NavGroup } from './sidebar-layout.tsx'

export type AiNavItem = 'dashboard' | 'chat' | 'agent' | 'workflow'

// ── Nav data ────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup<AiNavItem>[] = [
  {
    items: [{ id: 'dashboard', label: 'Dashboard', route: routes.ai.index }],
  },
  {
    label: 'KI-Tools',
    items: [
      { id: 'chat', label: 'Chat', route: routes.ai.chat.index },
      { id: 'agent', label: 'Agent', route: routes.ai.agent.index },
      { id: 'workflow', label: 'Workflows', route: routes.ai.workflow.index },
    ],
  },
]

// ── Icons ───────────────────────────────────────────────────────

function navIcon(id: AiNavItem): RemixNode {
  switch (id) {
    case 'dashboard':
      return <Glyph name="menu" width={16} height={16} />
    case 'chat':
      return <Glyph name="chat" width={16} height={16} />
    case 'agent':
      return <Glyph name="info" width={16} height={16} />
    case 'workflow':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      )
  }
}

function sidebarHeaderIcon(): RemixNode {
  return <Glyph name="clock" width={14} height={14} />
}

// ── Exports ─────────────────────────────────────────────────────

export const { renderPage: renderAiPage, Layout: AiLayout } =
  createSidebarLayout<AiNavItem>({
    frameTarget: frames.aiContent,
    navGroups: NAV_GROUPS,
    navIcon,
    headerIcon: sidebarHeaderIcon(),
    headerLabel: 'KI',
  })

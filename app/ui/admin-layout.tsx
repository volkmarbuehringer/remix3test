import type { RemixNode } from 'remix/ui'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'

import { routes, frames, webhookRequestsRoute } from '../routes.ts'
import { createSidebarLayout, type NavGroup } from './sidebar-layout.tsx'
import { AdminViewToggle } from '../ui/admin/admin-view-toggle.browser.tsx'

import { PersistentAdminCounter } from '../ui/admin/persistent-admin-counter.browser.tsx'
export type AdminNavItem =
  | 'dashboard'
  | 'chatlog'
  | 'messages'
  | 'lists'
  | 'support'
  | 'workflow'
  | 'client'
  | 'users'
  | 'nutzer'
  | 'uploads'
  | 'webhooks'
  | 'testagent'

// ── Nav data ────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup<AdminNavItem>[] = [
  {
    items: [{ id: 'dashboard', label: 'Dashboard', route: routes.admin.index }],
  },
  {
    label: 'Daten',
    items: [
      { id: 'chatlog', label: 'Chat-Protokolle', route: routes.admin.chatlog.index },
      { id: 'messages', label: 'Nachrichten', route: routes.admin.messages.index },
      { id: 'lists', label: 'Listen', route: routes.admin.lists.index },
      { id: 'support', label: 'Support-Agent', route: routes.mastra.chat.index },
      {
        id: 'workflow',
        label: 'Workflow-Agent',
        route: routes.workflowAgent.index,
        iframeNav: false,
      },
      { id: 'client', label: 'Client-Test', route: routes.admin.client.index },
      { id: 'users', label: 'Benutzer', route: routes.admin.users.index },
      { id: 'nutzer', label: 'Nutzer', route: routes.admin.nutzer.index },
      { id: 'uploads', label: 'Uploads', route: routes.uploads.index },
      { id: 'webhooks', label: 'Webhooks', route: webhookRequestsRoute, iframeNav: false },
      { id: 'testagent', label: 'Test-Agent', route: routes.testAgent.index },
    ],
  },
]

// ── Icons ───────────────────────────────────────────────────────

function navIcon(id: AdminNavItem): RemixNode {
  switch (id) {
    case 'dashboard':
      return <Glyph name="menu" width={16} height={16} />
    case 'chatlog':
      return chatSvg()
    case 'messages':
      return mailSvg()
    case 'lists':
      return <Glyph name="menu" width={16} height={16} />
    case 'support':
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )
    case 'workflow':
      return workflowSvg()
    case 'client':
      return usersSvg()
    case 'users':
      return usersSvg()
    case 'nutzer':
      return usersSvg()
    case 'uploads':
      return uploadSvg()
    case 'webhooks':
      return webhookSvg()
    case 'testagent':
      return testAgentSvg()
  }
}

function sidebarHeaderIcon(): RemixNode {
  return <Glyph name="alert" width={14} height={14} />
}

// ── SVG helpers ─────────────────────────────────────────────────

function chatSvg(): RemixNode {
  return <Glyph name="chat" width={16} height={16} />
}

function mailSvg(): RemixNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function uploadSvg(): RemixNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function usersSvg(): RemixNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function workflowSvg(): RemixNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  )
}

function testAgentSvg(): RemixNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  )
}

function webhookSvg(): RemixNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M18 8a6 6 0 0 1 0 8" />
      <path d="M6 8a6 6 0 0 0 0 8" />
      <path d="M2 12h20" />
    </svg>
  )
}

// ── Exports ─────────────────────────────────────────────────────

export const { renderPage: renderAdminPage, Layout: AdminLayout } =
  createSidebarLayout<AdminNavItem>({
    frameTarget: frames.adminContent,
    acceptFrameTargets: [frames.listsContent],
    navGroups: NAV_GROUPS,
    navIcon,
    headerIcon: sidebarHeaderIcon(),
    headerLabel: 'Admin',
    sidebarExtras: (
      <>
        <AdminViewToggle />
        <PersistentAdminCounter />
      </>
    ),
  })

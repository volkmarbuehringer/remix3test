import type { RemixNode } from 'remix/ui'
import { Glyph } from 'remix/ui/glyph'

import { adminRoutes as routes, frames } from '../routes.ts'
import { createSidebarLayout, type NavGroup } from './sidebar-layout.tsx'
import { AdminViewToggle } from '../assets/admin-view-toggle.tsx'
import { PersistentAdminCounter } from '../assets/persistent-admin-counter.tsx'

export type AdminNavItem =
  | 'dashboard'
  | 'chatlog'
  | 'chatonly'
  | 'agentonly'
  | 'messages'
  | 'lists'
  | 'client'
  | 'users'

// ── Nav data ────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup<AdminNavItem>[] = [
  {
    items: [{ id: 'dashboard', label: 'Dashboard', route: routes.admin.index }],
  },
  {
    label: 'Daten',
    items: [
      { id: 'chatlog', label: 'Chat-Protokolle', route: routes.admin.chatlog.index },
      { id: 'chatonly', label: 'Nur Chat', href: '/admin/chatlog?type=chat' },
      { id: 'agentonly', label: 'Nur Agent', href: '/admin/chatlog?type=agent' },
      { id: 'messages', label: 'Nachrichten', route: routes.admin.messages.index },
      { id: 'lists', label: 'Listen', route: routes.admin.lists.index },
      { id: 'client', label: 'Client-Test', href: '/client', iframeNav: false },
      { id: 'users', label: 'Benutzer', route: routes.admin.users.index },
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
    case 'chatonly':
      return chatPlusSvg()
    case 'agentonly':
      return <Glyph name="info" width={16} height={16} />
    case 'messages':
      return mailSvg()
    case 'lists':
      return <Glyph name="menu" width={16} height={16} />
    case 'client':
      return usersSvg()
    case 'users':
      return usersSvg()
  }
}

function sidebarHeaderIcon(): RemixNode {
  return <Glyph name="alert" width={14} height={14} />
}

// ── SVG helpers ─────────────────────────────────────────────────

function chatSvg(): RemixNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function chatPlusSvg(): RemixNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="12" y1="7" x2="12" y2="13" />
    </svg>
  )
}

function mailSvg(): RemixNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function usersSvg(): RemixNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

// ── Exports ─────────────────────────────────────────────────────

export const { renderPage: renderAdminPage, Layout: AdminLayout } =
  createSidebarLayout<AdminNavItem>({
    frameTarget: frames.adminContent,
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

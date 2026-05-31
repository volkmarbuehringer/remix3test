import type { RemixNode } from 'remix/ui'

import { SHOWCASE_OVERVIEW, SHOWCASE_NAV_ITEMS } from './showcase-nav.ts'

/** Base nav item type shared across all navigation systems. */
export type BaseNavItem = {
  label: string
  href?: string
}

type NavItem = BaseNavItem & {
  href: string
  icon?: string
  adminOnly?: boolean
}

type NavSection = {
  id: string
  label?: string
  items: NavItem[]
}

export const NAV_SECTIONS = [
  {
    id: 'pages',
    label: 'Pages',
    items: [
      { label: 'Home', href: '/' },
      { label: 'Appointment', href: '/appointment' },
      { label: 'Lists', href: '/lists' },
      { label: 'AI', href: '/ai' },
      { label: 'Admin', href: '/admin', adminOnly: true },
    ],
  },
  {
    id: 'showcase',
    label: 'Showcase',
    items: [SHOWCASE_OVERVIEW, ...SHOWCASE_NAV_ITEMS],
  },
]

/** Base nav item type shared across all navigation systems. */
export type BaseNavItem = {
  label: string
  href?: string
}

type NavItem = BaseNavItem & {
  href: string
  adminOnly?: boolean
}

type NavSection = {
  label?: string
  items: NavItem[]
}

export type MobileNavItem = {
  label: string
  href: string
  requireAuth: boolean
  cta?: boolean
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Termine', href: '/appointments/new' },
      { label: 'TermineUI', href: '/appointment' },
      { label: 'Listen', href: '/lists' },
      { label: 'Verwaltung', href: '/verwaltung', adminOnly: true },
      { label: 'Admin', href: '/admin', adminOnly: true },
      { label: 'KI', href: '/mastra/chat', adminOnly: true },
      { label: 'Beratung', href: '/chat' },
    ],
  },
]

export const MOBILE_ITEMS: MobileNavItem[] = [
  { label: 'Neuer Termin', href: '/appointments/new', requireAuth: true, cta: true },
  { label: 'Einstellungen', href: '/settings', requireAuth: true },
]

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

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Termine', href: '/appointment' },
      { label: 'Listen', href: '/lists' },
      { label: 'KI', href: '/ai' },
      { label: 'Admin', href: '/admin', adminOnly: true },
    ],
  },
]

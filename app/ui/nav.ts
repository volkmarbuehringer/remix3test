import { routes } from '../routes.ts'

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

type MobileNavItem = {
  label: string
  href: string
  requireAuth: boolean
  cta?: boolean
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Home', href: routes.home.href() },
      { label: 'Termine', href: routes.appointmentsNew.index.href() },
      { label: 'TermineUI', href: routes.appointment.index.href() },
      { label: 'Listen', href: routes.lists.index.href() },
      { label: 'Verwaltung', href: routes.verwaltung.index.href(), adminOnly: true },
      { label: 'Admin', href: routes.admin.index.href(), adminOnly: true },
      { label: 'Beratung', href: routes.chat.index.href() },
    ],
  },
]

/**
 * Role-filtered navigation sections. Admin-only items live in NAV_SECTIONS so
 * the route contract stays in one place, but they must be dropped wherever a
 * section list renders (the desktop nav and the mobile drawer alike). Keeping
 * the filter here stops the two surfaces from drifting apart.
 */
export function navSectionsForRole(role: string | undefined): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.adminOnly || role === 'admin'),
  })).filter((section) => section.items.length > 0)
}

export const MOBILE_ITEMS: MobileNavItem[] = [
  {
    label: 'Neuer Termin',
    href: routes.appointmentsNew.index.href(),
    requireAuth: true,
    cta: true,
  },
  { label: 'Benachrichtigungen', href: routes.notifications.index.href(), requireAuth: true },
  { label: 'Einstellungen', href: routes.settings.index.href(), requireAuth: true },
]

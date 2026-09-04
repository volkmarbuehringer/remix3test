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

export type MobileNavItem = {
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
      { label: 'Benachrichtigungen', href: routes.notifications.index.href() },
    ],
  },
]

export const MOBILE_ITEMS: MobileNavItem[] = [
  { label: 'Neuer Termin', href: routes.appointmentsNew.index.href(), requireAuth: true, cta: true },
  { label: 'Einstellungen', href: routes.settings.index.href(), requireAuth: true },
]

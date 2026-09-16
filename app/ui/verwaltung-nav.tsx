import { css } from 'remix/ui'
import { getContext } from 'remix/middleware/async-context'
import { theme } from './theme/theme.ts'
import { routes } from '../routes.ts'

/**
 * Section navigation for the /verwaltung area. Verwaltung pages render as
 * top-level documents (there is no admin-style sidebar), so once a user drills
 * into one section the only way back to a sibling was the breadcrumb or the top
 * nav. Rendered by renderVerwaltungPage on full-page responses only; frame
 * fragments (agent panels) omit it.
 */

interface NavItem {
  label: string
  href: string
}

const ITEMS: NavItem[] = [
  { label: 'Übersicht', href: routes.verwaltung.index.href() },
  { label: 'Termine', href: routes.verwaltung.appointments.index.href() },
  { label: 'Angebote', href: routes.verwaltung.offerings.index.href() },
  { label: 'Ressourcen', href: routes.verwaltung.resources.index.href() },
  { label: 'Angebotskonfigurationen', href: routes.verwaltung.offeringConfigs.index.href() },
  { label: 'Monatsauswertung', href: routes.verwaltung.report1.index.href() },
  { label: 'Exporte', href: routes.verwaltung.usersExport.index.href() },
]

const navCss = css({
  marginBottom: theme.space.sm,
  borderBottom: '1px solid ' + theme.colors.border.default,
})

const listCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '2px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
})

const linkBase = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: theme.space.xs + ' ' + theme.space.md,
  marginBottom: '-1px',
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
  borderBottomWidth: '2px',
  borderBottomStyle: 'solid' as const,
  borderBottomColor: 'transparent',
  whiteSpace: 'nowrap' as const,
  '&:hover': {
    color: theme.colors.text.primary,
  },
}

const linkCss = css(linkBase)

/**
 * Never combine with linkCss: both declare borderBottomColor, and the class
 * sub-layers (rmx.*) are order-dependent. One class per state is deterministic.
 */
const activeLinkCss = css({
  ...linkBase,
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.semibold,
  borderBottomColor: theme.colors.action.primary.background,
})

export function VerwaltungNav() {
  return () => {
    let pathname = ''
    try {
      pathname = new URL(getContext().request.url).pathname
    } catch {
      /* no request context (e.g. unit-rendered) */
    }
    let home = routes.verwaltung.index.href()
    let isActive = (href: string): boolean =>
      href === home ? pathname === home : pathname === href || pathname.startsWith(href + '/')

    return (
      <nav aria-label="Verwaltung" mix={navCss}>
        <ul mix={listCss}>
          {ITEMS.map((item) => {
            let active = isActive(item.href)
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  mix={active ? activeLinkCss : linkCss}
                >
                  {item.label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    )
  }
}

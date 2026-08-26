import { css, type Handle } from 'remix/ui'
import { Glyph, type GlyphName } from '../ui/theme/glyph/glyph.tsx'
import { theme } from '../ui/theme/theme.ts'

import { routes } from '../routes.ts'
import type { DashboardStats } from '../data/admin-dashboard.ts'

interface VerwaltungDashboardContentProps {
  stats?: DashboardStats
}

interface NavCardProps {
  icon: GlyphName
  title: string
  desc: string
  href: string
  badges?: Array<{ text: string; danger?: boolean }>
}

const cardBaseCss = {
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1.5rem',
  boxShadow: theme.shadow.sm,
  border: `1px solid ${theme.colors.border.default}`,
}

const cardStyle = css(cardBaseCss)

/**
 * Whole-card navigation link. The entire card is the hit target (matching the
 * button-only affordance before, but with a larger, more scannable surface).
 */
const cardLinkStyle = css({
  ...cardBaseCss,
  display: 'flex',
  flexDirection: 'column',
  color: 'inherit',
  textDecoration: 'none',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadow.md,
    borderColor: theme.colors.action.primary.background,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.action.primary.background}`,
    outlineOffset: '2px',
  },
})

const titleRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  marginBottom: '0.5rem',
})

const iconStyle = css({
  color: theme.colors.action.primary.background,
  flexShrink: 0,
})

const cardTitleStyle = css({
  fontSize: '1.25rem',
  fontWeight: 600,
})

const cardDescStyle = css({
  color: theme.colors.text.secondary,
  fontSize: '0.875rem',
  marginBottom: '1.5rem',
})

const countStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  fontSize: '0.75rem',
  color: theme.colors.text.secondary,
  marginBottom: '1.5rem',
})

const countBadgeStyle = css({
  display: 'inline-block',
  padding: '0.1rem 0.5rem',
  borderRadius: theme.radius.full,
  backgroundColor: theme.colors.action.secondary.background,
  color: theme.colors.action.secondary.foreground,
  fontSize: '0.75rem',
  fontWeight: 600,
})

const countExpiredStyle = css({
  display: 'inline-block',
  padding: '0.1rem 0.5rem',
  borderRadius: theme.radius.full,
  backgroundColor: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  fontSize: '0.75rem',
  fontWeight: 600,
})

const cardActionStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  marginTop: 'auto',
  color: theme.colors.action.primary.background,
  fontWeight: 600,
  fontSize: '0.875rem',
})

const headingStyle = css({
  fontSize: theme.fontSize.xl,
  fontWeight: theme.fontWeight.bold,
  marginBottom: theme.space.lg,
})

const toolbarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.md,
  marginBottom: theme.space.xl,
})

const searchFormStyle = css({
  display: 'flex',
  flex: '1 1 320px',
  maxWidth: '480px',
  gap: theme.space.xs,
})

const searchInputStyle = css({
  flex: 1,
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl1,
  color: theme.colors.text.primary,
  '&::placeholder': { color: theme.colors.text.muted },
  '&:focus-visible': {
    outline: 'none',
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 2px ${theme.colors.action.primary.background}`,
  },
})

const searchBtnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  padding: '0.5rem 1rem',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.2s',
  '&:hover': { background: theme.colors.action.primary.backgroundHover },
})

const quickCreateStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  padding: '0.5rem 1rem',
  color: theme.colors.action.primary.foreground,
  background: theme.colors.action.primary.background,
  textDecoration: 'none',
  borderRadius: theme.radius.md,
  fontSize: '0.875rem',
  fontWeight: 600,
  transition: 'background 0.2s',
  '&:hover': { background: theme.colors.action.primary.backgroundHover },
})

const exportRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  padding: `${theme.space.sm} 0`,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  '&:last-child': { borderBottom: 'none' },
})

const exportLinkStyle = css({
  color: theme.colors.action.primary.background,
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '0.875rem',
  '&:hover': {
    textDecoration: 'underline',
  },
})

const exportLabelStyle = css({
  fontSize: '1rem',
  fontWeight: 600,
})

const exportDescStyle = css({
  color: theme.colors.text.secondary,
  fontSize: '0.75rem',
})

function formatCount(n: number): string {
  return n.toLocaleString('de-DE')
}

/** A single navigation destination rendered as a fully clickable card. */
function NavCard(handle: Handle<NavCardProps>) {
  return () => {
    let { icon, title, desc, href, badges } = handle.props
    return (
      <a href={href} mix={cardLinkStyle}>
        <span mix={titleRowStyle}>
          <Glyph name={icon} width={20} height={20} mix={iconStyle} />
          <h2 mix={cardTitleStyle}>{title}</h2>
        </span>
        <p mix={cardDescStyle}>{desc}</p>
        {badges && badges.length > 0 ? (
          <div mix={countStyle}>
            {badges.map((b) => (
              <span key={b.text} mix={b.danger ? countExpiredStyle : countBadgeStyle}>
                {b.text}
              </span>
            ))}
          </div>
        ) : null}
        <span mix={cardActionStyle}>
          Öffnen
          <Glyph name="arrowRight" width={14} height={14} />
        </span>
      </a>
    )
  }
}

export function VerwaltungDashboardContent(handle: Handle<VerwaltungDashboardContentProps>) {
  return () => {
    let stats = handle.props.stats
    let pending = formatCount(stats?.appointmentsPending ?? 0)
    let expired = formatCount(stats?.appointmentsExpired ?? 0)
    let offerings = formatCount(stats?.offerings ?? 0)
    let resources = formatCount(stats?.resources ?? 0)
    let configs = formatCount(stats?.offeringConfigs ?? 0)

    return (
      <div>
        <h1 mix={headingStyle}>Verwaltung</h1>

        <div mix={toolbarStyle}>
          <form
            method="GET"
            action={routes.verwaltung.appointments.index.href()}
            mix={searchFormStyle}
          >
            <input
              type="search"
              name="filter"
              placeholder="Termine durchsuchen..."
              aria-label="Termine durchsuchen"
              mix={searchInputStyle}
            />
            <button type="submit" mix={searchBtnStyle}>
              <Glyph name="search" width={14} height={14} />
              Suchen
            </button>
          </form>
          <a href={routes.appointmentsNew.index.href()} data-rmx-document mix={quickCreateStyle}>
            <Glyph name="add" width={14} height={14} />
            Neuer Termin
          </a>
        </div>

        <div
          mix={css({
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: theme.space.xl,
          })}
        >
          <NavCard
            icon="calendar"
            title="Termine"
            desc="Termine und Buchungen verwalten."
            href={routes.verwaltung.appointments.index.href()}
            badges={[
              { text: `${pending} ausstehend` },
              { text: `${expired} abgelaufen`, danger: true },
            ]}
          />

          <NavCard
            icon="clock"
            title="Angebote"
            desc="Angebote und Buchungszeiträume verwalten."
            href={routes.verwaltung.offerings.index.href()}
            badges={[{ text: `${offerings} Buchungszeiträume` }]}
          />

          <NavCard
            icon="cog"
            title="Ressourcen"
            desc="Ressourcen anlegen und verwalten."
            href={routes.verwaltung.resources.index.href()}
            badges={[{ text: `${resources} Ressourcen` }]}
          />

          <NavCard
            icon="edit"
            title="Angebotskonfigurationen"
            desc="Zeitraster-Konfigurationen für Ressourcen."
            href={routes.verwaltung.offeringConfigs.index.href()}
            badges={[{ text: `${configs} konfiguriert` }]}
          />

          <NavCard
            icon="info"
            title="Monatsauswertung"
            desc="Termine pro Benutzer nach Monat auswerten."
            href={routes.verwaltung.report1.index.href()}
          />

          <div mix={cardStyle}>
            <span mix={titleRowStyle}>
              <Glyph name="open" width={20} height={20} mix={iconStyle} />
              <h2 mix={cardTitleStyle}>Exporte & Berichte</h2>
            </span>
            <p mix={cardDescStyle}>Termine und Benutzer als PDF/Export herunterladen.</p>
            <div>
              <div mix={exportRowStyle}>
                <div>
                  <div mix={exportLabelStyle}>Alle Termine</div>
                  <div mix={exportDescStyle}>Gesamte Buchungsliste als PDF.</div>
                </div>
                <a
                  href={routes.verwaltung.pdf.index.href()}
                  data-rmx-document
                  mix={exportLinkStyle}
                >
                  PDF
                </a>
              </div>
              <div mix={exportRowStyle}>
                <div>
                  <div mix={exportLabelStyle}>Benutzerübersicht</div>
                  <div mix={exportDescStyle}>Alle Benutzer mit Terminsumme als PDF.</div>
                </div>
                <a
                  href={routes.verwaltung.usersPdf.index.href()}
                  data-rmx-document
                  mix={exportLinkStyle}
                >
                  PDF
                </a>
              </div>
              <div mix={exportRowStyle}>
                <div>
                  <div mix={exportLabelStyle}>Benutzer im Zeitraum</div>
                  <div mix={exportDescStyle}>Benutzer mit Terminen in einem Zeitraum als PDF.</div>
                </div>
                <a href={routes.verwaltung.usersExport.index.href()} mix={exportLinkStyle}>
                  Export
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

import { css, type Handle } from 'remix/component'
import { Glyph, type GlyphName } from '../ui/theme/glyph/glyph.tsx'
import { theme } from '../ui/theme/theme.ts'
import { PageSection } from './page-primitives.tsx'

import { routes } from '../routes.ts'
import type { DashboardStats } from '../data/admin-dashboard.ts'

interface VerwaltungDashboardContentProps {
  stats?: DashboardStats
}

interface Badge {
  text: string
  danger?: boolean
  /** When set the badge is its own link, e.g. "16 abgelaufen" -> ?status=expired */
  href?: string
}

interface NavCardProps {
  icon: GlyphName
  title: string
  desc: string
  href: string
  badges?: Badge[]
}

const cardBaseCss = {
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1.25rem',
  boxShadow: theme.shadow.sm,
  border: '1px solid ' + theme.colors.border.default,
}

const cardStyle = css(cardBaseCss)

/**
 * Interactive navigation card. The whole surface stays clickable, but the card
 * itself is a <div>: a transparent overlay <a> (labelled with the title) covers
 * it. That is what lets the count badges be independent links — nesting them
 * inside a whole-card <a> would emit invalid interactive content.
 */
const cardNavStyle = css({
  ...cardBaseCss,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadow.md,
    borderColor: theme.colors.action.primary.background,
  },
})

const cardOverlayStyle = css({
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  borderRadius: theme.radius.lg,
  '&:focus-visible': {
    outline: '2px solid ' + theme.colors.action.primary.background,
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
  marginBottom: '1rem',
})

const countStyle = css({
  position: 'relative',
  zIndex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  fontSize: '0.75rem',
  color: theme.colors.text.secondary,
  marginBottom: '1rem',
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

const badgeLinkStyle = css({
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
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

const toolbarStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.md,
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
  border: '1px solid ' + theme.colors.border.default,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl1,
  color: theme.colors.text.primary,
  '&::placeholder': { color: theme.colors.text.muted },
  '&:focus-visible': {
    outline: 'none',
    borderColor: theme.colors.action.primary.background,
    boxShadow: '0 0 0 2px ' + theme.colors.action.primary.background,
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

// ── KPI tiles (mirrors the /admin dashboard strip) ──

const kpiGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: theme.space.md,
})

const kpiTileStyle = css({
  ...cardBaseCss,
  padding: theme.space.lg,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

const kpiTileLinkStyle = css({
  ...cardBaseCss,
  padding: theme.space.lg,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  color: 'inherit',
  textDecoration: 'none',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadow.md,
    borderColor: theme.colors.action.primary.background,
  },
  '&:focus-visible': {
    outline: '2px solid ' + theme.colors.action.primary.background,
    outlineOffset: '2px',
  },
})

const kpiLabelStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  fontWeight: theme.fontWeight.medium,
})

const kpiValueStyle = css({
  fontSize: '1.625rem',
  fontWeight: theme.fontWeight.bold,
  color: theme.colors.text.primary,
  fontVariantNumeric: 'tabular-nums',
  lineHeight: theme.lineHeight.tight,
})

const kpiHintStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const kpiValueDangerStyle = css({
  color: theme.colors.action.danger.background,
})

const kpiValueSuccessStyle = css({
  color: theme.colors.success.foreground,
})

const navGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: theme.space.xl,
  alignItems: 'start',
})

const sectionLabelStyle = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  textTransform: 'uppercase',
  letterSpacing: theme.letterSpacing.meta,
  color: theme.colors.text.muted,
  margin: 0,
})

const exportRowStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  padding: theme.space.sm + ' 0',
  borderBottom: '1px solid ' + theme.colors.border.default,
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

/** A single navigation destination rendered as an interactive card. */
function NavCard(handle: Handle<NavCardProps>) {
  return () => {
    let { icon, title, desc, href, badges } = handle.props
    return (
      <div mix={cardNavStyle}>
        <a href={href} aria-label={title} mix={cardOverlayStyle} />
        <span mix={titleRowStyle}>
          <Glyph name={icon} width={20} height={20} mix={iconStyle} />
          <h2 mix={cardTitleStyle}>{title}</h2>
        </span>
        <p mix={cardDescStyle}>{desc}</p>
        {badges && badges.length > 0 ? (
          <div mix={countStyle}>
            {badges.map((b) => {
              let badgeMix = b.danger ? countExpiredStyle : countBadgeStyle
              return b.href ? (
                <a key={b.text} href={b.href} mix={[badgeMix, badgeLinkStyle]}>
                  {b.text}
                </a>
              ) : (
                <span key={b.text} mix={badgeMix}>
                  {b.text}
                </span>
              )
            })}
          </div>
        ) : null}
        <span mix={cardActionStyle}>
          Öffnen
          <Glyph name="arrowRight" width={14} height={14} />
        </span>
      </div>
    )
  }
}

interface KpiTileProps {
  label: string
  value: string
  hint?: string
  kind?: 'normal' | 'danger' | 'success'
  href?: string
}

/** A single at-a-glance figure; links to its section when actionable. */
function KpiTile(handle: Handle<KpiTileProps>) {
  return () => {
    let { label, value, hint, kind, href } = handle.props
    let valueClass =
      kind === 'danger' ? kpiValueDangerStyle : kind === 'success' ? kpiValueSuccessStyle : null
    let body = (
      <>
        <div mix={kpiLabelStyle}>{label}</div>
        <div mix={[kpiValueStyle, valueClass].filter(Boolean)}>{value}</div>
        {hint ? <div mix={kpiHintStyle}>{hint}</div> : null}
      </>
    )
    return href ? (
      <a href={href} mix={kpiTileLinkStyle}>
        {body}
      </a>
    ) : (
      <div mix={kpiTileStyle}>{body}</div>
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

    let appointments = routes.verwaltung.appointments.index.href()
    let pendingUrl = appointments + '?status=pending'
    let expiredUrl = appointments + '?status=expired'
    let offeringsUrl = routes.verwaltung.offerings.index.href()
    let resourcesUrl = routes.verwaltung.resources.index.href()
    let configsUrl = routes.verwaltung.offeringConfigs.index.href()

    return (
      <PageSection
        title="Verwaltung"
        description="Überblick über Termine, Angebote und Ressourcen."
      >
        <div mix={toolbarStyle}>
          <form method="GET" action={appointments} mix={searchFormStyle}>
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

        <div mix={kpiGridStyle}>
          <KpiTile
            label="Ausstehende Termine"
            value={pending}
            kind="success"
            hint="ab heute"
            href={pendingUrl}
          />
          <KpiTile
            label="Abgelaufene Termine"
            value={expired}
            kind="danger"
            hint="vor heute"
            href={expiredUrl}
          />
          <KpiTile
            label="Angebote"
            value={offerings}
            hint="Buchungszeiträume"
            href={offeringsUrl}
          />
          <KpiTile
            label="Ressourcen"
            value={resources}
            hint="verfügbare Ressourcen"
            href={resourcesUrl}
          />
          <KpiTile
            label="Konfigurationen"
            value={configs}
            hint="Zeitraster-Regeln"
            href={configsUrl}
          />
        </div>

        <p mix={sectionLabelStyle}>Schnellzugriff</p>

        <div mix={navGridStyle}>
          <NavCard
            icon="calendar"
            title="Termine"
            desc="Termine und Buchungen verwalten."
            href={appointments}
            badges={[
              { text: pending + ' ausstehend', href: pendingUrl },
              { text: expired + ' abgelaufen', danger: true, href: expiredUrl },
            ]}
          />

          <NavCard
            icon="clock"
            title="Angebote"
            desc="Angebote und Buchungszeiträume verwalten."
            href={offeringsUrl}
            badges={[{ text: offerings + ' Buchungszeiträume', href: offeringsUrl }]}
          />

          <NavCard
            icon="cog"
            title="Ressourcen"
            desc="Ressourcen anlegen und verwalten."
            href={resourcesUrl}
            badges={[{ text: resources + ' Ressourcen', href: resourcesUrl }]}
          />

          <NavCard
            icon="edit"
            title="Angebotskonfigurationen"
            desc="Zeitraster-Konfigurationen für Ressourcen."
            href={configsUrl}
            badges={[{ text: configs + ' konfiguriert', href: configsUrl }]}
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
      </PageSection>
    )
  }
}

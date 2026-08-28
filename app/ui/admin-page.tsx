import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { Glyph, type GlyphName } from './theme/glyph/glyph.tsx'
import { theme } from '../ui/theme/theme.ts'

import { routes } from '../routes.ts'
import type { DashboardStats } from '../data/admin-dashboard.ts'

interface AdminDashboardContentProps {
  stats?: DashboardStats
}

interface NavCardProps {
  icon: GlyphName
  title: string
  desc: string
  href: string
}

function formatCount(n: number): string {
  return n.toLocaleString('de-DE')
}

// ── Card base ───────────────────────────────────────────────────

const cardBaseCss = {
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1.5rem',
  boxShadow: theme.shadow.sm,
  border: `1px solid ${theme.colors.border.default}`,
}

/** Whole-card navigation link — the entire card is the hit target. */
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

const pageHeaderStyle = css({
  marginBottom: theme.space.lg,
})

const headingStyle = css({
  fontSize: theme.fontSize.xxl,
  fontWeight: theme.fontWeight.bold,
  margin: 0,
})

const subtitleStyle = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  marginTop: theme.space.xs,
})

const sectionTitleStyle = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  textTransform: 'uppercase',
  letterSpacing: theme.letterSpacing.meta,
  color: theme.colors.text.muted,
  margin: `0 0 ${theme.space.md}`,
})

// ── KPI stat tiles ──────────────────────────────────────────────

const kpiGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: theme.space.md,
  marginBottom: theme.space.lg,
})

const kpiTileStyle = css({
  ...cardBaseCss,
  padding: theme.space.lg,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
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
  color: theme.colors.success.background,
})

// ── Navigation cards ────────────────────────────────────────────

const navGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: theme.space.md,
  marginBottom: theme.space.lg,
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

const navTitleStyle = css({
  fontSize: '1.25rem',
  fontWeight: 600,
  margin: 0,
})

const navDescStyle = css({
  color: theme.colors.text.secondary,
  fontSize: '0.875rem',
  margin: `0 0 ${theme.space.lg}`,
})

const navActionStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  marginTop: 'auto',
  color: theme.colors.action.primary.background,
  fontWeight: 600,
  fontSize: '0.875rem',
})

// ── Frame sections ──────────────────────────────────────────────

const frameGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
  gap: theme.space.xl,
})

const fallbackStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1.5rem',
  border: `1px solid ${theme.colors.border.default}`,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.sm,
})

/** A single navigation destination rendered as a fully clickable card. */
function NavCard(handle: Handle<NavCardProps>) {
  return () => {
    let { icon, title, desc, href } = handle.props
    return (
      <a href={href} mix={cardLinkStyle}>
        <span mix={titleRowStyle}>
          <Glyph name={icon} width={20} height={20} mix={iconStyle} />
          <h2 mix={navTitleStyle}>{title}</h2>
        </span>
        <p mix={navDescStyle}>{desc}</p>
        <span mix={navActionStyle}>
          Öffnen
          <Glyph name="arrowRight" width={14} height={14} />
        </span>
      </a>
    )
  }
}

/** A single at-a-glance figure shown in the KPI strip. */
function KpiTile(handle: Handle<{ label: string; value: string; hint?: string; kind?: 'normal' | 'danger' | 'success' }>) {
  return () => {
    let { label, value, hint, kind } = handle.props
    let valueClass =
      kind === 'danger' ? kpiValueDangerStyle : kind === 'success' ? kpiValueSuccessStyle : null

    return (
      <div mix={kpiTileStyle}>
        <div mix={kpiLabelStyle}>{label}</div>
        <div mix={[kpiValueStyle, valueClass].filter(Boolean)}>{value}</div>
        {hint ? <div mix={kpiHintStyle}>{hint}</div> : null}
      </div>
    )
  }
}

export function AdminDashboardContent(handle: Handle<AdminDashboardContentProps>) {
  return () => {
    let stats = handle.props.stats
    let pending = formatCount(stats?.appointmentsPending ?? 0)
    let expired = formatCount(stats?.appointmentsExpired ?? 0)
    let offerings = formatCount(stats?.offerings ?? 0)
    let resources = formatCount(stats?.resources ?? 0)
    let configs = formatCount(stats?.offeringConfigs ?? 0)

    let navCards: NavCardProps[] = [
      {
        icon: 'chat',
        title: 'Chat-Protokolle',
        desc: 'Zeigt den Verlauf der KI-Konversationen aus Chat und Agent.',
        href: routes.admin.chatlog.index.href(),
      },
      {
        icon: 'menu',
        title: 'Listen',
        desc: 'Listeneinträge aus der gesamten App anzeigen und verwalten.',
        href: routes.admin.lists.index.href(),
      },
      {
        icon: 'shield',
        title: 'Support-Agent',
        desc: 'Frage zu Benutzern, Terminen und Systemdaten.',
        href: routes.admin.supportAgent.index.href(),
      },
      {
        icon: 'user',
        title: 'Client-Test',
        desc: 'CRUD-Tabelle mit Paginierung, Sortierung und Filterung.',
        href: routes.admin.clients.index.href(),
      },
    ]

    return (
      <div>
        <div mix={pageHeaderStyle}>
          <h1 mix={headingStyle}>Dashboard</h1>
          <p mix={subtitleStyle}>Überblick über Termine, Angebote und Systemdaten.</p>
        </div>

        {/* At-a-glance business figures — driven by real database counts */}
        <div mix={kpiGridStyle}>
          <KpiTile label="Ausstehende Termine" value={pending} kind="success" hint="ab heute" />
          <KpiTile label="Abgelaufene Termine" value={expired} kind="danger" hint="vor heute" />
          <KpiTile label="Angebote" value={offerings} hint="Buchungszeiträume" />
          <KpiTile label="Ressourcen" value={resources} hint="verfügbare Ressourcen" />
          <KpiTile label="Konfigurationen" value={configs} hint="Zeitraster-Regeln" />
        </div>

        {/* Quick access — whole-card links to the main sections */}
        <p mix={sectionTitleStyle}>Schnellzugriff</p>
        <div mix={navGridStyle}>
          {navCards.map((card) => (
            <NavCard key={card.title} {...card} />
          ))}
        </div>

        {/* Frame-based dashboard sections — load independently */}
        <p mix={sectionTitleStyle}>System & Aktivität</p>
        <div mix={frameGridStyle}>
          <div>
            <Frame
              name="admin-stats"
              src={routes.admin.fragments.stats.href()}
              fallback={<div mix={fallbackStyle}>Server-Statistiken werden geladen…</div>}
            />
          </div>

          <div>
            <Frame
              name="admin-recent-activity"
              src={routes.admin.fragments.recentActivity.href()}
              fallback={<div mix={fallbackStyle}>Letzte Aktivitäten werden geladen…</div>}
            />
          </div>
        </div>
      </div>
    )
  }
}

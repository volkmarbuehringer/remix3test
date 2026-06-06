import { css, Frame } from 'remix/ui'
import { theme } from 'remix/ui/theme'

import { routes, frames } from '../routes.ts'

const cardStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1.5rem',
  marginBottom: '1.5rem',
  boxShadow: theme.shadow.sm,
  border: `1px solid ${theme.colors.border.default}`,
})

const cardTitleStyle = css({
  fontSize: '1.25rem',
  fontWeight: 600,
  marginBottom: '0.75rem',
})

const cardDescStyle = css({
  color: theme.colors.text.secondary,
  fontSize: '0.875rem',
  marginBottom: '1.5rem',
})

const btnStyle = css({
  display: 'inline-block',
  padding: '0.5rem 1rem',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  textDecoration: 'none',
  borderRadius: theme.radius.md,
  fontSize: '1rem',
  border: 'none',
  cursor: 'pointer',
  transition: 'background 0.2s',
  '&:hover': {
    background: theme.colors.action.primary.backgroundHover,
  },
})

const frameSectionStyle = css({
  marginBottom: '1.5rem',
})

const fallbackStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1.5rem',
  border: `1px solid ${theme.colors.border.default}`,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.sm,
})

export function AdminDashboardContent() {
  return () => (
    <div>
      {/* Navigation cards — static, always visible */}
      <div
        mix={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: theme.space.xl,
          marginBottom: theme.space.xl,
        })}
      >
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>Chat-Protokolle</h2>
          <p mix={cardDescStyle}>Zeigt den Verlauf der KI-Konversationen aus Chat und Agent.</p>
          <a href={routes.admin.chatlog.index.href()} mix={btnStyle}>
            Chat-Protokolle anzeigen
          </a>
        </div>
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>Listen</h2>
          <p mix={cardDescStyle}>Listeneinträge aus der gesamten App anzeigen und verwalten.</p>
          <a href={routes.admin.lists.index.href()} mix={btnStyle}>
            Listen öffnen
          </a>
        </div>
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>Client-Test</h2>
          <p mix={cardDescStyle}>CRUD-Tabelle mit Paginierung, Sortierung und Filterung.</p>
          <a href={routes.client.index.href()} mix={btnStyle}>
            Client-Test öffnen
          </a>
        </div>
      </div>

      {/* Frame-based dashboard sections — load independently */}
      <div
        mix={css({
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: theme.space.xl,
          alignItems: 'start',
        })}
      >
        <div mix={frameSectionStyle}>
          <Frame
            name="admin-stats"
            src={routes.admin.fragments.stats.href()}
            fallback={
              <div mix={fallbackStyle}>Server-Statistiken werden geladen…</div>
            }
          />
        </div>

        <div mix={frameSectionStyle}>
          <Frame
            name="admin-recent-activity"
            src={routes.admin.fragments.recentActivity.href()}
            fallback={
              <div mix={fallbackStyle}>Letzte Aktivitäten werden geladen…</div>
            }
          />
        </div>
      </div>
    </div>
  )
}

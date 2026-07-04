import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'

import { routes } from '../routes.ts'

const cardStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1.5rem',
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

const headingStyle = css({
  fontSize: theme.fontSize.xl,
  fontWeight: theme.fontWeight.bold,
  marginBottom: theme.space.lg,
})

export function VerwaltungDashboardContent() {
  return () => (
    <div>
      <h1 mix={headingStyle}>Verwaltung</h1>
      <div
        mix={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: theme.space.xl,
        })}
      >
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>Angebote</h2>
          <p mix={cardDescStyle}>Angebote und Buchungszeiträume verwalten.</p>
          <a href={routes.verwaltung.offerings.index.href()} mix={btnStyle}>
            Angebote öffnen
          </a>
        </div>
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>Termine</h2>
          <p mix={cardDescStyle}>Termine und Buchungen verwalten.</p>
          <a href={routes.verwaltung.appointments.index.href()} mix={btnStyle}>
            Termine öffnen
          </a>
        </div>
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>Ressourcen</h2>
          <p mix={cardDescStyle}>Ressourcen anlegen und verwalten.</p>
          <a href={routes.verwaltung.resources.index.href()} mix={btnStyle}>
            Ressourcen öffnen
          </a>
        </div>
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>Angebotskonfigurationen</h2>
          <p mix={cardDescStyle}>Zeitraster-Konfigurationen für Ressourcen.</p>
          <a href={routes.verwaltung.offeringConfigs.index.href()} mix={btnStyle}>
            Konfigurationen öffnen
          </a>
        </div>
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>Monatsauswertung</h2>
          <p mix={cardDescStyle}>Termine pro Benutzer nach Monat auswerten.</p>
          <a href={routes.verwaltung.report1.index.href()} mix={btnStyle}>
            Auswertung öffnen
          </a>
        </div>
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>PDF-Export</h2>
          <p mix={cardDescStyle}>Alle Termine als PDF herunterladen.</p>
          <a href={routes.verwaltung.pdf.index.href()} rmx-document mix={btnStyle}>
            PDF herunterladen
          </a>
        </div>
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>Benutzer-PDF</h2>
          <p mix={cardDescStyle}>Benutzerübersicht mit Terminzusammenfassung als PDF.</p>
          <a href={routes.verwaltung.usersPdf.index.href()} rmx-document mix={btnStyle}>
            PDF herunterladen
          </a>
        </div>
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>Benutzer-Export (gefiltert)</h2>
          <p mix={cardDescStyle}>Benutzer mit Terminen in einem Zeitraum als PDF exportieren.</p>
          <a href={routes.verwaltung.usersExport.index.href()} mix={btnStyle}>
            Zum Export
          </a>
        </div>
      </div>
    </div>
  )
}

import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'

import { routes } from '../routes.ts'

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

export function AiDashboardContent() {
  return () => (
    <div>
      <h1 mix={css({ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' })}>
        KI-Dashboard
      </h1>
      <div
        mix={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: theme.space.xl,
        })}
      >
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>Chat</h2>
          <p mix={cardDescStyle}>
            Ein Konversations-KI-Assistent, der Fragen beantwortet und bei Aufgaben hilft.
          </p>
          <a href={routes.ai.chat.index.href()} mix={btnStyle}>
            Chat öffnen
          </a>
        </div>
        <div mix={cardStyle}>
          <h2 mix={cardTitleStyle}>Agent</h2>
          <p mix={cardDescStyle}>
            Ein KI-Agent mit Werkzeugen – Wikipedia durchsuchen, Wetter prüfen und mehr.
          </p>
          <a href={routes.ai.agent.index.href()} mix={btnStyle}>
            Agent öffnen
          </a>
        </div>
      </div>
    </div>
  )
}

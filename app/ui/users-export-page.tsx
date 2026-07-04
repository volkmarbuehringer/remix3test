import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { routes } from '../routes.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'

interface UsersExportPageProps {
  error?: string
  startDate?: string
  endDate?: string
}

const pageStyle = css({
  padding: '2rem',
  maxWidth: '640px',
})

const headingStyle = css({
  fontSize: theme.fontSize.xl,
  fontWeight: theme.fontWeight.bold,
  marginBottom: '0.5rem',
})

const descStyle = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
  marginBottom: '1.5rem',
})

const formStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
})

const fieldRowStyle = css({
  display: 'flex',
  gap: '1rem',
  alignItems: 'flex-end',
  flexWrap: 'wrap',
})

const fieldGroupStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
})

const labelStyle = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.medium,
})

const inputStyle = css({
  fontSize: theme.fontSize.sm,
  padding: '0.5rem 0.75rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl1,
  color: theme.colors.text.primary,
})

const submitStyle = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  padding: '0.5rem 1.5rem',
  border: 'none',
  borderRadius: theme.radius.md,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  cursor: 'pointer',
  alignSelf: 'flex-start',
})

const errorStyle = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
  padding: '0.75rem',
  border: `1px solid ${theme.colors.action.danger.border}`,
  borderRadius: theme.radius.md,
  background: theme.colors.action.danger.background,
  marginBottom: '1rem',
})

export function UsersExportPage(handle: Handle<UsersExportPageProps>) {
  return () => {
    let p = handle.props

    return (
      <div mix={pageStyle}>
        <h2 mix={headingStyle}>Benutzer-Export (gefiltert)</h2>
        <p mix={descStyle}>
          Wählen Sie einen Zeitraum aus, um alle Benutzer mit Terminen in diesem Zeitraum als PDF zu exportieren.
        </p>

        {p.error && <div mix={errorStyle}>{p.error}</div>}

        <form
          method="POST"
          action={routes.verwaltung.usersExport.index.href()}
          mix={formStyle}
        >
          <CsrfTokenInput />
          <div mix={fieldRowStyle}>
            <div mix={fieldGroupStyle}>
              <label mix={labelStyle} htmlFor="startDate">Startdatum</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                value={p.startDate ?? ''}
                mix={inputStyle}
                required
              />
            </div>
            <div mix={fieldGroupStyle}>
              <label mix={labelStyle} htmlFor="endDate">Enddatum</label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                value={p.endDate ?? ''}
                mix={inputStyle}
                required
              />
            </div>
          </div>
          <button type="submit" mix={submitStyle}>PDF erstellen</button>
        </form>
      </div>
    )
  }
}

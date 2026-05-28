import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { RestfulForm } from './restful-form.tsx'
import { mondayOfWeek } from '../data/offering-configs.ts'

interface AdminOfferingsWeekPageProps {
  resources: ResourceOption[]
}

interface ResourceOption {
  id: string
  description: string
}

function isoWeeksInYear(year: number): number {
  let jan1 = new Date(Date.UTC(year, 0, 1))
  let day = jan1.getUTCDay() || 7
  let isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return day === 4 || (isLeap && day === 3) ? 53 : 52
}

function weekDateRange(year: number, week: number): string {
  let monday = new Date(mondayOfWeek(year, week))
  let sunday = new Date(monday.getTime() + 6 * 86_400_000)
  let opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${monday.toLocaleDateString('de-DE', opts)} – ${sunday.toLocaleDateString('de-DE', opts)}`
}

// ── Styles ──

const panelStyle = css({
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  overflow: 'hidden',
})

const panelHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  padding: `${theme.space.md} ${theme.space.lg}`,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  background: theme.surface.lvl2,
})

const panelTitleStyle = css({
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const panelBodyStyle = css({
  padding: theme.space.lg,
})

const fieldGroupStyle = css({
  marginBottom: theme.space.md,
})

const labelStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  marginBottom: theme.space.xs,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
})

const selectStyle = css({
  width: '100%',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  fontSize: theme.fontSize.sm,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  outline: 'none',
  '&:focus': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 2px ${theme.colors.focus.ring}`,
  },
})

const noteStyle = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
  marginBottom: theme.space.md,
  lineHeight: '1.4',
})

const actionsStyle = css({
  display: 'flex',
  gap: theme.space.sm,
  marginTop: theme.space.lg,
  paddingTop: theme.space.md,
  borderTop: `1px solid ${theme.colors.border.default}`,
})

export function AdminOfferingsWeekPage(handle: Handle<AdminOfferingsWeekPageProps>) {
  return () => {
    let { resources } = handle.props
    let years = Array.from({ length: 5 }, (_, i) => 2026 + i)

    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action="/admin/offerings/week">
          <div mix={panelStyle}>
            <div mix={panelHeaderStyle}>
              <span mix={panelTitleStyle}>Woche hinzufügen</span>
            </div>

            <div mix={panelBodyStyle}>
              <div mix={noteStyle}>
                Erzeugt Angebote für alle Ressourcen mit Konfiguration. Feiertage werden automatisch übersprungen.
              </div>

              {/* Year */}
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} for="aw-year">Jahr</label>
                <select id="aw-year" name="year" required mix={[input.base, input.focus, selectStyle]}>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Week */}
              <div mix={fieldGroupStyle}>
                <label mix={labelStyle} for="aw-week">Woche</label>
                <select id="aw-week" name="week" required mix={[input.base, input.focus, selectStyle]}>
                  <option value="" disabled selected>Woche auswählen...</option>
                  {years.map((y) => {
                    let max = isoWeeksInYear(y)
                    return Array.from({ length: max }, (_, i) => {
                      let w = i + 1
                      return (
                        <option key={`${y}-${w}`} value={w} data-year={y}>
                          KW {w} — {weekDateRange(y, w)}
                        </option>
                      )
                    })
                  })}
                </select>
              </div>

              <div mix={actionsStyle}>
                <Button type="submit" tone="primary" mix={css({ flex: 1 })}>
                  Erstellen
                </Button>
                <a href="/admin/offerings" style={{ flex: 1, textDecoration: 'none' }}>
                  <Button type="button" tone="secondary" mix={css({ width: '100%' })}>
                    Abbrechen
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </RestfulForm>
      </div>
    )
  }
}

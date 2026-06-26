import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../lib/theme.ts'
import button from '../lib/button.ts'
import { animateEntrance } from 'remix/ui/animation'
import { input } from './mixins/input.ts'
import { table } from './mixins/admin-table.ts'
import { RestfulForm } from './restful-form.tsx'
import { mondayOfWeek } from '../data/offering-configs.ts'
import { isoWeeksInYear } from '../utils/date-utils.ts'

interface AdminOfferingsWeekPageProps {
  resources: ResourceOption[]
}

interface ResourceOption {
  id: string
  description: string
}

function weekDateRange(year: number, week: number): string {
  let monday = new Date(mondayOfWeek(year, week))
  let sunday = new Date(monday.getTime() + 6 * 86_400_000)
  let opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${monday.toLocaleDateString('de-DE', opts)} – ${sunday.toLocaleDateString('de-DE', opts)}`
}

// ── Styles (unique to this week-add panel) ──

const noteStyle = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
  marginBottom: theme.space.md,
  lineHeight: '1.4',
})

export function AdminOfferingsWeekPage(handle: Handle<AdminOfferingsWeekPageProps>) {
  return () => {
    let { resources } = handle.props
    let years = Array.from({ length: 5 }, (_, i) => 2026 + i)

    return (
      <div mix={animateEntrance({ opacity: 0, transform: 'translateY(4px)', duration: 180 })}>
        <RestfulForm method="POST" action="/verwaltung/offerings/week">
          <div mix={table.panel}>
            <div mix={table.panelHeader}>
              <span mix={table.panelTitle}>Woche hinzufügen</span>
            </div>

            <div mix={table.panelBody}>
              <div mix={noteStyle}>
                Erzeugt Angebote für alle Ressourcen mit Konfiguration. Feiertage werden automatisch übersprungen.
              </div>

              {/* Year */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} for="aw-year">Jahr</label>
                <select id="aw-year" name="year" required mix={[input.base, input.focus, table.select]}>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Week */}
              <div mix={table.fieldGroup}>
                <label mix={table.label} for="aw-week">Woche</label>
                <select id="aw-week" name="week" required mix={[input.base, input.focus, table.select]}>
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

              <div mix={table.actions}>
                <button type="submit" mix={[button({ tone: 'primary' }), table.spacer]}>
                  Erstellen
                </button>
                <a href="/verwaltung/offerings" mix={[table.spacer, table.linkPlain]}>
                  <button type="button" mix={[button({ tone: 'secondary' }), css({ width: '100%' })]}>
                    Abbrechen
                  </button>
                </a>
              </div>
            </div>
          </div>
        </RestfulForm>
      </div>
    )
  }
}
